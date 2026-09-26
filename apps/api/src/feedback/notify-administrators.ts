import type { EmailService } from '@eleansphere/be-core';
import { ADMIN_ROLE, userEntity } from '@kniho-hlod/domain';
import type { Feedback, Locale } from '@kniho-hlod/domain';
import { feedbackReportEmail } from '../emails/feedback-report';
import type { ModelRegistry } from '../models-registry';

/** Where the web app lists the reports for administrators. */
const ADMIN_INBOX_PATH = '/admin/feedback';

export interface ReportSender {
  displayName: string;
  email: string;
}

export interface AdministratorNotifierOptions {
  registry: ModelRegistry;
  emailService: EmailService;
  appBaseUrl: string;
}

/**
 * E-mails every administrator, each in their own language, that a report has come in. A failed
 * delivery is logged and doesn't stop the others: the report is stored either way.
 */
export function createAdministratorNotifier({
  registry,
  emailService,
  appBaseUrl,
}: AdministratorNotifierOptions) {
  const inboxUrl = new URL(ADMIN_INBOX_PATH, appBaseUrl).toString();

  return async function notifyAdministrators(
    report: Feedback,
    sender: ReportSender
  ): Promise<void> {
    const administrators = await registry.get(userEntity.config.name).findAll({
      where: { role: ADMIN_ROLE },
      attributes: ['email', 'locale'],
    });
    const deliveries = await Promise.allSettled(
      administrators.map((administrator) =>
        emailService.send({
          to: String(administrator.get('email')),
          ...feedbackReportEmail({
            locale: administrator.get('locale') as Locale,
            kind: report.kind,
            message: report.message,
            reporterName: sender.displayName,
            reporterEmail: sender.email,
            pageUrl: report.pageUrl,
            appVersion: report.appVersion,
            viewport: report.viewport,
            userAgent: report.userAgent,
            inboxUrl,
          }),
        })
      )
    );
    for (const delivery of deliveries) {
      if (delivery.status === 'rejected') {
        console.warn(`A feedback report e-mail failed: ${String(delivery.reason)}`);
      }
    }
  };
}

export type NotifyAdministrators = ReturnType<typeof createAdministratorNotifier>;
