// Prisma v7 configuration file
// Replaces datasource url/directUrl in schema.prisma
// https://pris.ly/d/config-datasource

import { defineConfig } from "prisma/config";

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
