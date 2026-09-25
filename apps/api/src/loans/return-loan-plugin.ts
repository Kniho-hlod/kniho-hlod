import {
  createVerifyToken,
  HttpError,
  validateFields,
  ValidationError,
} from '@eleansphere/be-core';
import type { ModelRouteOverrides, ProjectPlugin } from '@eleansphere/be-core';
import { findLoanDatesIssues, loanEntity, loanFields, LOANS_PATH } from '@kniho-hlod/domain';
import type { ReturnLoanRequest } from '@kniho-hlod/domain';
import { asyncHandler } from '../http/async-handler';
import type { ModelRegistry } from '../models-registry';
import type { ReaderToday } from './reader-today';

type Enrich = NonNullable<ModelRouteOverrides['enrich']>;

const NOT_FOUND = 404;
const CONFLICT = 409;
const RETURN_FIELDS = { returnedAt: loanFields.returnedAt };

export interface ReturnLoanPluginOptions {
  jwtSecret: string;
  registry: ModelRegistry;
  readerToday: ReaderToday;
  /** Shapes the answer like every other loan response (`routes.loan.enrich`). */
  loanDetails: Enrich;
}

function readReturnRequest(body: unknown): ReturnLoanRequest {
  const request = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const issues = validateFields(RETURN_FIELDS, request, { mode: 'patch' });
  if (issues.length > 0) throw new ValidationError(issues);
  return typeof request.returnedAt === 'string' ? { returnedAt: request.returnedAt } : {};
}

/**
 * `POST /api/loans/:id/return` — marks a loan returned, today in the reader's time zone unless the
 * body names the day. Another reader's loan is a 404; a loan already returned is a 409.
 */
export function createReturnLoanPlugin({
  jwtSecret,
  registry,
  readerToday,
  loanDetails,
}: ReturnLoanPluginOptions): ProjectPlugin {
  return {
    registerRoutes(app) {
      app.post(
        `${LOANS_PATH}/:id/return`,
        createVerifyToken(jwtSecret),
        asyncHandler(async (req, res) => {
          const request = readReturnRequest(req.body);
          const readerId = String(req.user?.id);
          const loan = await registry
            .get(loanEntity.config.name)
            .findOne({ where: { id: req.params.id, ownerId: readerId } });
          if (!loan) throw new HttpError(NOT_FOUND, 'loan not found');
          if (loan.get('returnedAt')) throw new HttpError(CONFLICT, 'The loan is already returned');

          const returnedAt = request.returnedAt ?? (await readerToday(readerId));
          const issues = findLoanDatesIssues({ lentAt: String(loan.get('lentAt')), returnedAt });
          if (issues.length > 0) throw new ValidationError(issues);

          await loan.update({ returnedAt });
          const [returned] = await loanDetails([loan]);
          res.json(returned);
        })
      );
    },
  };
}
