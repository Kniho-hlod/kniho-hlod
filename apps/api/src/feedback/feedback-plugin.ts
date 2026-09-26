import {
  createRateLimiter,
  createVerifyToken,
  generateId,
  validateFields,
  ValidationError,
} from '@eleansphere/be-core';
import type { ProjectPlugin, RateLimitConfig } from '@eleansphere/be-core';
import {
  DEFAULT_FEEDBACK_STATUS,
  FEEDBACK_CONTEXT_MAX_LENGTH,
  FEEDBACK_PATH,
  feedbackEntity,
  feedbackReportFields,
  userEntity,
} from '@kniho-hlod/domain';
import type { Feedback, FeedbackReportRequest } from '@kniho-hlod/domain';
import type { Request, RequestHandler } from 'express';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';
import { createAdministratorNotifier } from './notify-administrators';
import type { ReportSender } from './notify-administrators';

const CREATED = 201;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
/** Per reader: plenty for anyone with something to say, too few to flood the administrators. */
export const FEEDBACK_RATE_LIMIT: RateLimitConfig = { windowMs: RATE_LIMIT_WINDOW_MS, max: 10 };

export interface FeedbackPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  appBaseUrl: string;
  rateLimit: RateLimitConfig | 'off';
}

/** The report's own fields from the body, or a 400 with the issues the form shows too. */
function readReport(body: unknown): FeedbackReportRequest {
  const sent = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const issues = validateFields(feedbackReportFields, sent, { mode: 'create' });
  if (issues.length > 0) throw new ValidationError(issues);
  const reportKeys = Object.keys(feedbackReportFields).filter((key) => key in sent);
  return Object.fromEntries(reportKeys.map((key) => [key, sent[key]])) as FeedbackReportRequest;
}

/** The browser the report came from, as its `User-Agent` names it, cut to fit the column. */
function userAgentOf(req: Request): string | null {
  return req.get('user-agent')?.slice(0, FEEDBACK_CONTEXT_MAX_LENGTH) ?? null;
}

/**
 * `POST /api/feedback` — a signed-in reader reports a bug or an idea. The report is stored as
 * theirs and every administrator gets an e-mail; the answer is the stored report, whose id a
 * screenshot is uploaded for.
 */
export function createFeedbackPlugin({
  jwtSecret,
  registry,
  appBaseUrl,
  rateLimit,
}: FeedbackPluginOptions): ProjectPlugin {
  return {
    registerRoutes(app, _sequelize, _models, emailService) {
      const notifyAdministrators =
        emailService && createAdministratorNotifier({ registry, emailService, appBaseUrl });
      const guards: RequestHandler[] = [createVerifyToken(jwtSecret)];
      if (rateLimit !== 'off') {
        guards.push(
          createRateLimiter({ ...rateLimit, keyOf: (req) => `feedback:${req.user?.id}` })
        );
      }

      app.post(
        FEEDBACK_PATH,
        ...guards,
        asyncHandler(async (req, res) => {
          const report = readReport(req.body);
          const reporterId = String(req.user?.id);
          const stored = await registry.get(feedbackEntity.config.name).create({
            ...report,
            id: generateId(feedbackEntity.config.prefix),
            userAgent: userAgentOf(req),
            reporterId,
            status: DEFAULT_FEEDBACK_STATUS,
          });
          const feedback = stored.toJSON() as Feedback;

          if (notifyAdministrators) {
            const reporter = await registry
              .get(userEntity.config.name)
              .findByPk(reporterId, { attributes: ['displayName', 'email'] });
            const sender: ReportSender = {
              displayName: String(reporter?.get('displayName')),
              email: String(reporter?.get('email')),
            };
            await notifyAdministrators(feedback, sender);
          }
          res.status(CREATED).json(feedback);
        })
      );
    },
  };
}
