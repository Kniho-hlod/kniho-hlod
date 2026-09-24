import { createCore } from '@eleansphere/be-core';
import { buildAppConfig } from './app-config';
import { loadEnvFile, readEnvironment } from './env';

async function start(): Promise<void> {
  loadEnvFile();
  const environment = readEnvironment();
  const core = await createCore(buildAppConfig(environment));
  await core.listen();
  console.info(`Kniho-hlod API listening on port ${environment.port}`);
}

start().catch((err: unknown) => {
  console.error('Kniho-hlod API failed to start:', err);
  process.exitCode = 1;
});
