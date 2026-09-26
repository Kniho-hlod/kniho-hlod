import { attachFiles, FILE_MODEL_NAME, removeStoredFile } from '@eleansphere/be-core';
import type { AccessRule, ModelRouteOverrides, StorageAdapter } from '@eleansphere/be-core';
import { ADMIN_ROLE, FILE_REF_TYPES, FILE_ROLES, userEntity } from '@kniho-hlod/domain';
import type { FeedbackReporter } from '@kniho-hlod/domain';
import type { ModelRegistry } from '../models-registry';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;
type BeforeDelete = NonNullable<ModelRouteOverrides['beforeDelete']>;

const CREATE_METHOD = 'POST';
/** Where `attachFiles` puts a report's screenshot list before it is reduced to one `screenshot`. */
const SCREENSHOTS_KEY = 'screenshots';

/**
 * Reports come in through `POST /api/feedback`, as the reader who sends them; administrators only
 * resolve and delete them.
 */
const onlyAdministratorsResolving: AccessRule = (req) =>
  req.method !== CREATE_METHOD && req.user?.role === ADMIN_ROLE;

export interface FeedbackDetails {
  /** `routes.feedback`: the administrators' `/api/admin/feedback`. */
  routes: ModelRouteOverrides;
  /** Every report with its `reporter` and `screenshot` (`FeedbackWithDetails`). */
  attach: Enrich;
}

export function createFeedbackDetails(
  registry: ModelRegistry,
  storage: StorageAdapter
): FeedbackDetails {
  const attachReporters: Enrich = async (reports) => {
    const reporterIds = [...new Set(reports.map((report) => String(report.get('reporterId'))))];
    const reporters = await registry.get(userEntity.config.name).findAll({
      where: { id: reporterIds },
      attributes: ['id', 'displayName', 'email'],
    });
    const byId = new Map(
      reporters.map((reporter): [string, FeedbackReporter] => [
        String(reporter.get('id')),
        {
          id: String(reporter.get('id')),
          displayName: String(reporter.get('displayName')),
          email: String(reporter.get('email')),
        },
      ])
    );
    return reports.map((report) => ({
      ...report.toJSON(),
      reporter: byId.get(String(report.get('reporterId'))) ?? null,
    }));
  };

  const attach: Enrich = async (reports) => {
    const withReporters = await attachReporters(reports);
    const rows = withReporters.map((report) => ({
      id: String(report.id),
      toJSON: () => report,
    }));
    const withScreenshots = await attachFiles(
      registry.get(FILE_MODEL_NAME),
      storage,
      FILE_REF_TYPES.feedback,
      rows,
      { role: FILE_ROLES.screenshot, as: SCREENSHOTS_KEY }
    );
    return withScreenshots.map(({ [SCREENSHOTS_KEY]: screenshots, ...report }) => ({
      ...report,
      screenshot: Array.isArray(screenshots) ? (screenshots[0] ?? null) : null,
    }));
  };

  /** A deleted report takes its screenshot with it. */
  const removeScreenshot: BeforeDelete = async (report) => {
    const screenshots = await registry.get(FILE_MODEL_NAME).findAll({
      where: {
        refType: FILE_REF_TYPES.feedback,
        refId: report.get('id'),
        role: FILE_ROLES.screenshot,
      },
    });
    await Promise.all(screenshots.map((screenshot) => removeStoredFile(screenshot, storage)));
  };

  return {
    routes: {
      access: { write: onlyAdministratorsResolving },
      enrich: attach,
      beforeDelete: removeScreenshot,
    },
    attach,
  };
}
