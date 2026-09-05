import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  schema: 'packages/db/src/schema.ts',
  out: 'db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // strict makes drizzle-kit ask before it applies anything. The website repo
  // set this; this repo had not, which is the wrong way round given this
  // schema is the one that is behind. See scripts/db-push-guard.mjs.
  strict: true,
  verbose: true,
});
