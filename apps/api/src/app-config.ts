import { createStorageAdapter, MemoryStorageAdapter, ValidationError } from '@eleansphere/be-core';
import type {
  AppConfig,
  CrudHook,
  EmailTransport,
  ModelRouteOverrides,
  RateLimitConfig,
  StorageAdapter,
} from '@eleansphere/be-core';
import { toModelConfigs } from '@eleansphere/entity-core';
import {
  allEntities,
  bookEntity,
  contactEntity,
  ENTITIES_WITHOUT_CRUD_ROUTES,
  feedbackEntity,
  findActiveRangeIssues,
  findIsbnIssues,
  findLoanDatesIssues,
  findReadingDatesIssues,
  loanEntity,
  PROFILE_FIELDS,
  REGISTRATION_FIELDS,
  shelfEntity,
  SINGLE_FILE_ROLES,
  systemNotificationEntity,
  toIsbn13,
  userEntity,
} from '@kniho-hlod/domain';
import type { Environment, StorageSettings } from './env';
import { createModelRegistry } from './models-registry';
import { createAdminStatsPlugin } from './admin/admin-stats-plugin';
import { createUserAccounts } from './admin/user-accounts';
import { createUserRolePlugin } from './admin/user-role-plugin';
import { createFileAuthorizer } from './files/authorize-file-access';
import { createFeedbackDetails } from './feedback/feedback-details';
import { createFeedbackPlugin, FEEDBACK_RATE_LIMIT } from './feedback/feedback-plugin';
import { createBookCovers } from './books/book-covers';
import { createIsbnCatalogue } from './isbn/isbn-catalogue';
import { createIsbnPlugin, ISBN_RATE_LIMIT } from './isbn/isbn-plugin';
import { createActiveLoans } from './loans/active-loans';
import { createLoanDetails } from './loans/loan-details';
import { createLoanHistory } from './loans/loan-history';
import { createReaderToday } from './loans/reader-today';
import { createReturnLoanPlugin } from './loans/return-loan-plugin';
import { createBookShelves } from './shelves/book-shelves';
import { createBookShelvesPlugin } from './shelves/book-shelves-plugin';
import { createShelfNameCheck } from './shelves/shelf-names';
import { createSampleLibraryPlugin } from './sample-library/sample-library-plugin';
import { createStatsPlugin } from './stats/stats-plugin';
import { passwordResetEmail } from './emails/password-reset';
import { migrations } from './migrations';

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
  /** The clock behind "today" (returning a loan, due dates in the stats). */
  now?: () => Date;
}

interface BookInput {
  isbn?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}

interface ActiveRangeInput {
  activeFrom?: string | Date | null;
  activeTo?: string | Date | null;
}

interface LoanInput {
  lentAt?: string | null;
  dueAt?: string | null;
  returnedAt?: string | null;
}

/** An announcement ends after it starts — checked against the stored end, since a PATCH may send one. */
const rejectInvalidActiveRange: CrudHook = async (data, _req, stored) => {
  const issues = findActiveRangeIssues({ ...stored, ...data } as ActiveRangeInput);
  if (issues.length > 0) throw new ValidationError(issues);
  return data;
};

/**
 * Book rules beyond single fields: a valid ISBN, and reading dates in order — checked against the
 * stored dates too, since a PATCH may send only one of them.
 */
const rejectInvalidBook: CrudHook = async (data, _req, stored) => {
  const sent = data as BookInput;
  const book = { ...stored, ...data } as BookInput;
  const issues = [...findIsbnIssues(sent), ...findReadingDatesIssues(book)];
  if (issues.length > 0) throw new ValidationError(issues);
  return data;
};

/** Due and return dates can't precede the day of lending, stored dates included. */
const rejectInvalidLoanDates: CrudHook = async (data, _req, stored) => {
  const issues = findLoanDatesIssues({ ...stored, ...data } as LoanInput);
  if (issues.length > 0) throw new ValidationError(issues);
  return data;
};

/** Books keep their ISBN as ISBN-13 without separators, however it was typed; empty → none. */
const storeIsbnAsIsbn13: CrudHook = async (data) => {
  const { isbn } = data as BookInput;
  return typeof isbn === 'string' ? { ...data, isbn: toIsbn13(isbn) } : data;
};

function chainHooks(...hooks: CrudHook[]): CrudHook {
  return (data, req, stored) =>
    hooks.reduce(
      (result, hook) => result.then((next) => hook(next, req, stored)),
      Promise.resolve(data)
    );
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
  const activeLoans = createActiveLoans(models);
  const loanHistory = createLoanHistory(models);
  const loanDetails = createLoanDetails(models, bookCovers);
  const bookShelves = createBookShelves(models);
  const bookDetails: NonNullable<ModelRouteOverrides['enrich']> = async (books) =>
    bookShelves.attachToBooks(await activeLoans.attachToBooks(await bookCovers.attach(books)));
  const rejectDuplicateShelfName = createShelfNameCheck(models);
  const readerToday = createReaderToday(models, overrides.now);
  const userAccounts = createUserAccounts(models, storageAdapter);
  const feedbackDetails = createFeedbackDetails(models, storageAdapter);
  const isbnPlugin = createIsbnPlugin({
    catalogue: createIsbnCatalogue({
      fetch: overrides.fetch,
      googleBooksApiKey: environment.googleBooksApiKey,
    }),
    jwtSecret: environment.jwtSecret,
    rateLimit: overrides.rateLimit === 'off' ? 'off' : ISBN_RATE_LIMIT,
  });

  return {
    databaseUrl: environment.databaseUrl,
    dbSsl: environment.databaseSsl,
    schema: overrides.schema,
    syncMode: 'migrate',
    migrations,
    jwtSecret: environment.jwtSecret,
    port: environment.port,
    trustProxy: environment.trustProxy,
    cors: { origin: environment.corsOrigins },
    modelConfigs: toModelConfigs(allEntities, { custom: ENTITIES_WITHOUT_CRUD_ROUTES }),
    routes: {
      [userEntity.config.name]: userAccounts.routes,
      [systemNotificationEntity.config.name]: {
        hooks: { beforeCreate: rejectInvalidActiveRange, beforeUpdate: rejectInvalidActiveRange },
      },
      [bookEntity.config.name]: {
        hooks: { beforeCreate: beforeSavingBook, beforeUpdate: beforeSavingBook },
        enrich: bookDetails,
        customFilters: { lent: activeLoans.lentFilter, shelf: bookShelves.shelfFilter },
        beforeDelete: async (book, req) => {
          await loanHistory.clearForBook(book, req);
          await bookCovers.removeWithBook(book, req);
        },
      },
      [contactEntity.config.name]: {
        enrich: activeLoans.countForContacts,
        beforeDelete: loanHistory.clearForContact,
      },
      [loanEntity.config.name]: {
        hooks: { beforeCreate: rejectInvalidLoanDates, beforeUpdate: rejectInvalidLoanDates },
        enrich: loanDetails,
      },
      [shelfEntity.config.name]: {
        hooks: { beforeCreate: rejectDuplicateShelfName, beforeUpdate: rejectDuplicateShelfName },
        enrich: bookShelves.countBooks,
      },
      [feedbackEntity.config.name]: feedbackDetails.routes,
    },
    plugins: [
      models.plugin,
      isbnPlugin,
      createReturnLoanPlugin({
        jwtSecret: environment.jwtSecret,
        registry: models,
        readerToday,
        loanDetails,
      }),
      createStatsPlugin({ jwtSecret: environment.jwtSecret, registry: models, readerToday }),
      createBookShelvesPlugin({ jwtSecret: environment.jwtSecret, registry: models, bookDetails }),
      createUserRolePlugin({
        jwtSecret: environment.jwtSecret,
        registry: models,
        userOverview: userAccounts.overview,
      }),
      createAdminStatsPlugin({
        jwtSecret: environment.jwtSecret,
        registry: models,
        now: overrides.now,
      }),
      createFeedbackPlugin({
        jwtSecret: environment.jwtSecret,
        registry: models,
        appBaseUrl: environment.appBaseUrl,
        rateLimit: overrides.rateLimit === 'off' ? 'off' : FEEDBACK_RATE_LIMIT,
      }),
      createSampleLibraryPlugin({
        jwtSecret: environment.jwtSecret,
        registry: models,
        bookCovers,
        now: overrides.now,
      }),
    ],
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
