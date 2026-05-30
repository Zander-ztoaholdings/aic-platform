/**
 * Environment variable validation.
 * Import this at the top of your app entry point to fail fast on missing config.
 */

interface EnvConfig {
  // Database
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_HOST: string;
  POSTGRES_PORT: string;
  POSTGRES_DB: string;

  // Auth
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
}

const required: (keyof EnvConfig)[] = [
  'POSTGRES_HOST',
  'POSTGRES_DB',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
];

const warnings: string[] = [];
const errors: string[] = [];

for (const key of required) {
  if (!process.env[key] && !process.env.CI) {
    errors.push(`Missing required environment variable: ${key}`);
  }
}

// Warn on optional but recommended vars
if (!process.env.ENGINE_URL && !process.env.CI) {
  warnings.push('ENGINE_URL not set — engine integration will be unavailable');
}

if (errors.length > 0) {
  console.error('=== Environment Validation Failed ===');
  errors.forEach((e) => console.error(`  ERROR: ${e}`));
  if (warnings.length > 0) {
    warnings.forEach((w) => console.warn(`  WARN: ${w}`));
  }
  console.error('');
  console.error('Copy .env.example to .env and fill in values.');
  console.error('=====================================');

  // In production, fail hard. In dev, allow graceful degradation.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${errors.join(', ')}`);
  }
}

if (warnings.length > 0 && errors.length === 0) {
  warnings.forEach((w) => console.warn(`[env] ${w}`));
}

export const env = {
  db: {
    user: process.env.POSTGRES_USER || 'aic_admin',
    password: process.env.POSTGRES_PASSWORD || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'aic_platform',
    url: process.env.POSTGRES_URL,
  },
  auth: {
    secret: process.env.NEXTAUTH_SECRET || '',
    url: process.env.NEXTAUTH_URL || 'http://localhost:3001',
  },
  engine: {
    url: process.env.ENGINE_URL || 'http://localhost:8000',
  },
} as const;
