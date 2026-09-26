import { defineEntity, withFiles } from '@eleansphere/entity-core';
import type { FileDto, InferCreateDto } from '@eleansphere/entity-core';
import { FILE_REF_TYPES, FILE_ROLES } from '../../constants';
import { feedbackFields } from './fields';
import type { feedbackReportFields } from './fields';

/** `POST` a report here: any signed-in reader. */
export const FEEDBACK_PATH = '/api/feedback';
/** Where administrators list, resolve and delete reports. */
export const ADMIN_FEEDBACK_PATH = '/api/admin/feedback';

/** `POST /api/feedback`: what the reader wrote, and where in the app they were. */
export type FeedbackReportRequest = InferCreateDto<typeof feedbackReportFields>;

/**
 * Bug reports and ideas readers send to the administrators, with an optional screenshot. Readers
 * only send them (`report`); the CRUD routes belong to administrators, who resolve and delete.
 */
export const feedbackEntity = defineEntity({
  name: 'feedback',
  prefix: 'fb_',
  basePath: ADMIN_FEEDBACK_PATH,
  access: { read: 'admin', write: 'admin' },
  fields: feedbackFields,
  query: {
    filter: { status: 'eq', kind: 'eq' },
    sort: ['createdAt'],
    defaultSort: '-createdAt',
  },
  extend: (Base) =>
    class extends withFiles(Base, FILE_REF_TYPES.feedback, [FILE_ROLES.screenshot]) {
      /** Sends a report as the signed-in reader; attach a screenshot to the answer's id after. */
      report(request: FeedbackReportRequest) {
        return this.post<Feedback>(FEEDBACK_PATH, request);
      }
    },
});

export type Feedback = InstanceType<typeof feedbackEntity.Dto>;

/** Who sent a report, as administrators see it. */
export interface FeedbackReporter {
  id: string;
  displayName: string;
  email: string;
}

/** A report as administrators list it: with its reporter and screenshot. */
export type FeedbackWithDetails = Feedback & {
  reporter: FeedbackReporter | null;
  screenshot: FileDto | null;
};
