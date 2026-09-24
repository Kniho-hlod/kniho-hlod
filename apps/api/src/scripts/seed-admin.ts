import bcrypt from 'bcrypt';
import { createCore, generateId } from '@eleansphere/be-core';
import { validateFields } from '@eleansphere/schema';
import { ADMIN_ROLE, userEntity } from '@kniho-hlod/domain';
import { buildAppConfig } from '../app-config';
import { loadEnvFile, readEnvironment, requireVariable } from '../env';

const BCRYPT_ROUNDS = 10;
const DEFAULT_ADMIN_DISPLAY_NAME = 'Admin';

/**
 * Creates the administrator account, or promotes an existing account with that email and resets
 * its password. Reads ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_DISPLAY_NAME.
 */
async function seedAdmin(): Promise<void> {
  loadEnvFile();
  const email = requireVariable(process.env, 'ADMIN_EMAIL');
  const password = requireVariable(process.env, 'ADMIN_PASSWORD');
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? DEFAULT_ADMIN_DISPLAY_NAME;

  const issues = validateFields(
    userEntity.config.fields,
    { email, password, displayName },
    { mode: 'create' }
  );
  if (issues.length > 0) {
    throw new Error(`Invalid administrator account: ${JSON.stringify(issues)}`);
  }

  const core = await createCore(buildAppConfig(readEnvironment()));
  try {
    const User = core.models[userEntity.config.name];
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      await existing.update({ role: ADMIN_ROLE, password: passwordHash });
      console.info(`Promoted ${email} to administrator`);
    } else {
      await User.create({
        id: generateId(userEntity.config.prefix),
        email,
        displayName,
        password: passwordHash,
        role: ADMIN_ROLE,
      });
      console.info(`Created administrator ${email}`);
    }
  } finally {
    await core.close();
  }
}

seedAdmin().catch((err: unknown) => {
  console.error('Seeding the administrator failed:', err);
  process.exitCode = 1;
});
