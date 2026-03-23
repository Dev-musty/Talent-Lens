type RawConfig = Record<string, unknown>;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const requireString = (config: RawConfig, key: string): string => {
  const value = asString(config[key]).trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const parseNumber = (
  config: RawConfig,
  key: string,
  fallback?: number,
): number => {
  const raw = asString(config[key]).trim();
  if (!raw && fallback !== undefined) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return value;
};

export type EnvVar = {
  PORT: number;
  FRONTEND_URL?: string;
  GEMINI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  DATABASE_URL?: string;
  DB_TYPE?: 'postgres';
  DB_HOST?: string;
  DB_PORT?: number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB?: string;
  DB_SSL?: 'true' | 'false';
};

export const validate = (config: RawConfig): EnvVar => {
  const PORT = parseNumber(config, 'PORT', 3000);
  const FRONTEND_URL = asString(config.FRONTEND_URL).trim() || undefined;
  const GEMINI_API_KEY = requireString(config, 'GEMINI_API_KEY');
  const SUPABASE_URL = requireString(config, 'SUPABASE_URL');
  const SUPABASE_ANON_KEY = requireString(config, 'SUPABASE_ANON_KEY');
  const DATABASE_URL = asString(config.DATABASE_URL).trim() || undefined;
  const DB_SSL_RAW = asString(config.DB_SSL).trim();

  if (DB_SSL_RAW && DB_SSL_RAW !== 'true' && DB_SSL_RAW !== 'false') {
    throw new Error('Environment variable DB_SSL must be either true or false');
  }

  const env: EnvVar = {
    PORT,
    FRONTEND_URL,
    GEMINI_API_KEY,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    DATABASE_URL,
    DB_SSL: DB_SSL_RAW ? (DB_SSL_RAW as 'true' | 'false') : undefined,
  };

  if (!DATABASE_URL) {
    const DB_TYPE = (asString(config.DB_TYPE).trim() ||
      'postgres') as 'postgres';
    if (DB_TYPE !== 'postgres') {
      throw new Error('Environment variable DB_TYPE must be postgres');
    }

    env.DB_TYPE = DB_TYPE;
    env.DB_HOST = requireString(config, 'DB_HOST');
    env.DB_PORT = parseNumber(config, 'DB_PORT', 5432);
    env.DB_USERNAME = requireString(config, 'DB_USERNAME');
    env.DB_PASSWORD = requireString(config, 'DB_PASSWORD');
    env.DB = requireString(config, 'DB');
  }

  return env;
};
