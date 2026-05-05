import { defineConfig } from 'drizzle-kit';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required for migrations');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'],
  },
  migrations: {
    table: 'drizzle_migrations',
    schema: 'public',
  },
  verbose: true,
  strict: true,
});
