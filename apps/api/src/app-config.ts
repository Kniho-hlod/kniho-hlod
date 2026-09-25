import { createStorageAdapter, MemoryStorageAdapter, ValidationError } from '@eleansphere/be-core';
import type {
  AppConfig,
  CrudHook,
  EmailTransport,
  RateLimitConfig,
  StorageAdapter,
} from '@eleansphere/be-core';
import { toModelConfigs } from '@eleansphere/entity-core';
import {
  allEntities,
  bookEntity,
  ENTITIES_WITHOUT_CRUD_ROUTES,
  findActiveRangeIssues,
  findIsbnIssues,
  findReadingDatesIssues,
  PROFILE_FIELDS,
  REGISTRATION_FIELDS,
  SINGLE_FILE_ROLES,
  systemNotificationEntity,
  toIsbn13,
  userEntity,
} from '@kniho-hlod/domain';
import type { Environment, StorageSettings } from './env';
import { createModelRegistry } from './models-registry';
import { createFileAuthorizer } from './files/authorize-file-access';
import { createBookCovers } from './books/book-covers';
import { createIsbnCatalogue } from './isbn/isbn-catalogue';
import { createIsbnPlugin, ISBN_RATE_LIMIT } from './isbn/isbn-plugin';
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
  /** Answers the ISBN catalogue lookups instead of the real Open Library and Google Books. */
  fetch?: typeof fetch;
}

interface BookInput {
  isbn?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

const rejectInvalidActiveRange: CrudHook = async (data) => {
  const issues = findActiveRangeIssues(data as { activeFrom?: string; activeTo?: string });
  if (issues.length > 0) throw new ValidationError(issues);
  return data;
};

/** Book rules beyond single fields: a valid ISBN, and reading dates in order. */
const rejectInvalidBook: CrudHook = async (data) => {
  const book = data as BookInput;
  const issues = [...findIsbnIssues(book), ...findReadingDatesIssues(book)];
  if (issues.length > 0) throw new ValidationError(issues);
  return data;
};

/** Books keep their ISBN as ISBN-13 without separators, however it was typed; empty → none. */
const storeIsbnAsIsbn13: CrudHook = async (data) => {
  const { isbn } = data as BookInput;
  return typeof isbn === 'string' ? { ...data, isbn: toIsbn13(isbn) } : data;
};

function chainHooks(...hooks: CrudHook[]): CrudHook {
  return (data, req) =>
    hooks.reduce((result, hook) => result.then((next) => hook(next, req)), Promise.resolve(data));
}

const beforeSavingBook = chainHooks(rejectInvalidBook, storeIsbnAsIsbn13);

function buildStorageAdapter(
  settings: StorageSettings,
  override: StorageAdapter | undefined
): StorageAdapter {
  if (override) return override;
  if (settings.kind === 's3') return createStorageAdapter({ s3: settings.s3 });
  return new MemoryStorageAdapter();
}

/** The whole backend, declared: models, routes, auth, email, files and the ISBN lookup. */
export function buildAppConfig(
  environment: Environment,
  overrides: AppConfigOverrides = {}
): AppConfig {
  const models = createModelRegistry();
  const storageAdapter = buildStorageAdapter(environment.storage, overrides.storageAdapter);
  const bookCovers = createBookCovers(models, storageAdapter);
  const isbnPlugin = createIsbnPlugin({
    catalogue: createIsbnCatalogue({ fetch: overrides.fetch }),
    jwtSecret: environment.jwtSecret,
    rateLimit: overrides.rateLimit === 'off' ? 'off' : ISBN_RATE_LIMIT,
  });

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
      [bookEntity.config.name]: {
        hooks: { beforeCreate: beforeSavingBook, beforeUpdate: beforeSavingBook },
        enrich: bookCovers.attach,
        beforeDelete: bookCovers.removeWithBook,
      },
    },
    plugins: [models.plugin, isbnPlugin],
    email: {
      from: environment.emailFrom,
      transport: overrides.emailTransport ?? environment.email,
    },
    storage: {
      adapter: storageAdapter,
      singleRoles: SINGLE_FILE_ROLES,
      authorize: createFileAuthorizer(models),
    },
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
