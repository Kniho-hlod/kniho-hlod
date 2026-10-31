import { createCore } from '@eleansphere/be-core';
import { buildAppConfig } from './app-config';
import { loadEnvFile, readEnvironment } from './env';
import { privatizeReportScreenshots } from './feedback/private-screenshots';

async function start(): Promise<void> {
  loadEnvFile();
  const environment = readEnvironment();
  const core = await createCore(buildAppConfig(environment));
  await core.listen();
  console.info(`Kniho-hlod API listening on port ${environment.port}`);
  if (core.storage) {
    // After listening, so the healthcheck doesn't wait; a failure is retried on the next start.
    privatizeReportScreenshots(core.models, core.storage)
      .then((moved) => {
        if (moved > 0) console.info(`Moved ${moved} report screenshots to private keys`);
      })
      .catch((err: unknown) => console.error('Moving report screenshots failed:', err));
  }
}

start().catch((err: unknown) => {
  console.error('Kniho-hlod API failed to start:', err);
  process.exitCode = 1;
});
