import { createCore } from '@eleansphere/be-core';
import type { CoreInstance } from '@eleansphere/be-core';
import { buildAppConfig } from '../app-config';
import { loadEnvFile, readEnvironment } from '../env';
import type { Environment } from '../env';
import { sendBorrowerReminders } from './borrower-reminders';
import { sendLoanReminders } from './loan-reminders';
import { sendWeeklyDigests } from './weekly-digest';

/** A scheduled job: does its work on the API's models and says what it did. */
type Job = (core: CoreInstance, environment: Environment) => Promise<string>;

function emailJobOptions(core: CoreInstance, environment: Environment) {
  if (!core.emailService) throw new Error('The e-mail jobs need e-mail configured');
  return {
    models: core.models,
    emailService: core.emailService,
    appBaseUrl: environment.appBaseUrl,
  };
}

async function weeklyDigests(core: CoreInstance, environment: Environment): Promise<string> {
  const { readers, failed } = await sendWeeklyDigests(emailJobOptions(core, environment));
  return `Sent the weekly e-mail to ${readers} readers; ${failed} e-mails failed`;
}

/**
 * `loan-reminders` is the daily run (Railway's cron service starts it by that name): the
 * reminders, then the weekly e-mail for the readers whose day it is. `weekly-digest` runs only the
 * latter, by hand.
 */
const JOBS: Record<string, Job> = {
  'loan-reminders': async (core, environment) => {
    const reminders = emailJobOptions(core, environment);
    const { readers, loans, failed } = await sendLoanReminders(reminders);
    const borrowed = await sendBorrowerReminders(reminders);
    return (
      `Reminded ${readers} readers of ${loans} loans; ${failed} e-mails failed. ` +
      `Reminded ${borrowed.borrowers} friends of ${borrowed.loans} borrowed books; ` +
      `${borrowed.failed} e-mails failed. ${await weeklyDigests(core, environment)}`
    );
  },
  'weekly-digest': weeklyDigests,
};

/**
 * Runs the job named on the command line — `node dist/jobs.cjs loan-reminders` — and exits. The
 * schema is the API's to migrate: a job starts on the tables as they are.
 */
async function runJob(name: string | undefined): Promise<void> {
  const job = name === undefined ? undefined : JOBS[name];
  if (!job) {
    throw new Error(`Unknown job "${name}"; the jobs are: ${Object.keys(JOBS).join(', ')}`);
  }
  loadEnvFile();
  const environment = readEnvironment();
  const core = await createCore({
    ...buildAppConfig(environment),
    syncMode: 'none',
    migrations: [],
  });
  try {
    console.info(`${name}: ${await job(core, environment)}`);
  } finally {
    await core.close();
  }
}

runJob(process.argv[2]).catch((err: unknown) => {
  console.error('The job failed:', err);
  process.exitCode = 1;
});
