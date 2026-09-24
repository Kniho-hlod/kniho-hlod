import { MemoryStorageAdapter, ValidationError } from '@eleansphere/be-core';
import type {
  AppConfig,
  CrudHook,
  EmailTransport,
  RateLimitConfig,
  StorageAdapter,
  StorageConfig,
} from '@eleansphere/be-core';
import { toModelConfigs } from '@eleansphere/entity-core';
import {
  allEntities,
  ENTITIES_WITHOUT_CRUD_ROUTES,
  findActiveRangeIssues,
  PROFILE_FIELDS,
  REGISTRATION_FIELDS,
  SINGLE_FILE_ROLES,
  systemNotificationEntity,
  userEntity,
} from '@kniho-hlod/domain';
import type { Environment, StorageSettings } from './env';
import { authorizeFileAccess } from './files/authorize-file-access';
import { passwordResetEmail } from './emails/password-reset';

const ACCESS_TOKEN_LIFETIME = '15m';
const REFRESH_TOKEN_LIFETIME = '60d';
const ROLE_CLAIM = 'role';

/** Test and script hooks: replace infrastructure without touching the environment. */
export interface AppConfigOverrides {
  schema?: string;
  emailTransport?: EmailTransport;
  storageAdapter?: StorageAdapter;
  rateLimit?: RateLimitConfig | 'off';
}

const rejectInvalidActiveRange: CrudHook = async (data) => {
  const issues = findActiveRangeIssues(data as { activeFrom?: string; activeTo?: string });
  if (issues.length > 0) throw new ValidationError(issues);
  return data;
};

function buildStorage(settings: StorageSettings, adapter: StorageAdapter | undefined): StorageConfig {
  const policy = { singleRoles: SINGLE_FILE_ROLES, authorize: authorizeFileAccess };
  if (adapter) return { ...policy, adapter };
  if (settings.kind === 's3') return { ...policy, s3: settings.s3 };
  return { ...policy, adapter: new MemoryStorageAdapter() };
}

/** The whole backend, declared: models, routes, auth, email and files. */
export function buildAppConfig(
  environment: Environment,
  overrides: AppConfigOverrides = {}
): AppConfig {
  return {
    databaseUrl: environment.databaseUrl,
    dbSsl: environment.databaseSsl,
    schema: overrides.schema,
    jwtSecret: environment.jwtSecret,
    port: environment.port,
    trustProxy: environment.trustProxy,
    cors: { origin: environment.corsOrigins },
    modelConfigs: toModelConfigs(allEntities, { custom: ENTITIES_WITHOUT_CRUD_ROUTES }),
    routes: {
      [systemNotificationEntity.config.name]: {
        hooks: { beforeCreate: rejectInvalidActiveRange, beforeUpdate: rejectInvalidActiveRange },
      },
    },
    email: {
      from: environment.emailFrom,
      transport: overrides.emailTransport ?? environment.email,
    },
    storage: buildStorage(environment.storage, overrides.storageAdapter),
    auth: {
      modelName: userEntity.config.name,
      expiresIn: ACCESS_TOKEN_LIFETIME,
      tokenClaims: [ROLE_CLAIM],
      refreshTokens: { expiresIn: REFRESH_TOKEN_LIFETIME },
      register: { idPrefix: userEntity.config.prefix, fields: [...REGISTRATION_FIELDS] },
      changePassword: true,
      profileFields: [...PROFILE_FIELDS],
      deleteAccount: true,
      passwordReset: { appBaseUrl: environment.appBaseUrl, template: passwordResetEmail },
      rateLimit: overrides.rateLimit,
    },
  };
}
