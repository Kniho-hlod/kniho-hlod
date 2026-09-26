import { createCore } from '@eleansphere/be-core';
import type { CoreInstance } from '@eleansphere/be-core';
import { buildAppConfig } from '../app-config';
import { loadEnvFile, readEnvironment } from '../env';
import type { Environment } from '../env';
import { sendLoanReminders } from './loan-reminders';

/** A scheduled job: does its work on the API's models and says what it did. */
type Job = (core: CoreInstance, environment: Environment) => Promise<string>;

const JOBS: Record<string, Job> = {
  'loan-reminders': async (core, environment) => {
    if (!core.emailService) throw new Error('Loan reminders need e-mail configured');
    const { readers, loans, failed } = await sendLoanReminders({
      models: core.models,
      emailService: core.emailService,
      appBaseUrl: environment.appBaseUrl,
    });
    return `Reminded ${readers} readers of ${loans} loans; ${failed} e-mails failed`;
  },
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
