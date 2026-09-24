import { existsSync } from 'node:fs';
import type { EmailTransportConfig, S3StorageConfig } from '@eleansphere/be-core';

export type StorageSettings = { kind: 's3'; s3: S3StorageConfig } | { kind: 'memory' };

export interface Environment {
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
  jwtSecret: string;
  /** The web app's origin: password reset links point here. */
  appBaseUrl: string;
  corsOrigins: string[];
  trustProxy: number | undefined;
  emailFrom: string;
  email: EmailTransportConfig;
  storage: StorageSettings;
}

type Variables = NodeJS.ProcessEnv;

const LOCAL_ENV_FILE = '.env';
const DEFAULT_PORT = 3000;
const DEFAULT_SMTP_PORT = 587;
const MIN_JWT_SECRET_LENGTH = 32;
const DEFAULT_EMAIL_FROM = 'Kniho-hlod <noreply@kniho-hlod.local>';
/** Local SMTP catchers such as Mailpit accept any credentials. */
const LOCAL_SMTP_CREDENTIALS = { user: 'kniho-hlod', pass: 'kniho-hlod' };
const LIST_SEPARATOR = ',';

/** Loads `.env` from the working directory when present (local development). */
export function loadEnvFile(): void {
  if (existsSync(LOCAL_ENV_FILE)) process.loadEnvFile(LOCAL_ENV_FILE);
}

export function requireVariable(variables: Variables, name: string): string {
  const value = variables[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function readJwtSecret(variables: Variables): string {
  const secret = requireVariable(variables, 'JWT_SECRET');
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }
  return secret;
}

function readList(value: string | undefined): string[] | undefined {
  const items = value
    ?.split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
  return items?.length ? items : undefined;
}

function readEmailTransport(variables: Variables): EmailTransportConfig {
  if (variables.RESEND_API_KEY) {
    return { kind: 'resend', apiKey: variables.RESEND_API_KEY };
  }
  if (variables.SMTP_HOST) {
    return {
      kind: 'smtp',
      host: variables.SMTP_HOST,
      port: Number(variables.SMTP_PORT ?? DEFAULT_SMTP_PORT),
      secure: variables.SMTP_SECURE === 'true',
      auth: {
        user: variables.SMTP_USER ?? LOCAL_SMTP_CREDENTIALS.user,
        pass: variables.SMTP_PASS ?? LOCAL_SMTP_CREDENTIALS.pass,
      },
    };
  }
  return { kind: 'log' };
}

function readStorage(variables: Variables): StorageSettings {
  if (!variables.R2_BUCKET) return { kind: 'memory' };
  return {
    kind: 's3',
    s3: {
      endpoint: requireVariable(variables, 'R2_ENDPOINT'),
      bucket: variables.R2_BUCKET,
      accessKeyId: requireVariable(variables, 'R2_ACCESS_KEY_ID'),
      secretAccessKey: requireVariable(variables, 'R2_SECRET_ACCESS_KEY'),
      publicBaseUrl: variables.R2_PUBLIC_BASE_URL,
    },
  };
}

function assertProductionReady(environment: Environment): void {
  if (!environment.isProduction) return;
  if (environment.email.kind === 'log') {
    throw new Error('Production needs RESEND_API_KEY or SMTP_HOST: emails would only be logged');
  }
  if (environment.storage.kind === 'memory') {
    throw new Error('Production needs the R2_* variables: uploads would be lost on restart');
  }
}

/** Reads and checks the API's configuration. Throws on anything missing or unsafe. */
export function readEnvironment(variables: Variables = process.env): Environment {
  const appBaseUrl = requireVariable(variables, 'APP_BASE_URL');
  const environment: Environment = {
    isProduction: variables.NODE_ENV === 'production',
    port: Number(variables.PORT ?? DEFAULT_PORT),
    databaseUrl: requireVariable(variables, 'DATABASE_URL'),
    databaseSsl: variables.DATABASE_SSL !== 'false',
    jwtSecret: readJwtSecret(variables),
    appBaseUrl,
    corsOrigins: readList(variables.CORS_ORIGINS) ?? [appBaseUrl],
    trustProxy: variables.TRUST_PROXY ? Number(variables.TRUST_PROXY) : undefined,
    emailFrom: variables.EMAIL_FROM ?? DEFAULT_EMAIL_FROM,
    email: readEmailTransport(variables),
    storage: readStorage(variables),
  };
  assertProductionReady(environment);
  return environment;
}
