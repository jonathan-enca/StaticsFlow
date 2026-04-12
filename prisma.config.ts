// Prisma v7 configuration file
// Replaces datasource url/directUrl in schema.prisma
// https://pris.ly/d/config-datasource
//
// Note: for migrations (`prisma migrate deploy`), always export DIRECT_URL so
// the CLI uses the Supabase direct connection (port 5432) instead of the
// transaction pooler (port 6543) — pgbouncer doesn't support DDL statements.
//
// Example:
//   export DIRECT_URL=<supabase-direct-url> && npx prisma migrate deploy

import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
