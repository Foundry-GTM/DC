import { defineConfig } from "drizzle-kit"

/**
 * Drizzle Kit config. Migrations are NOT generated yet — this just wires up
 * the schema + output dir so `drizzle-kit generate` / `migrate` work later.
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // App tables only — never touch the Supabase-managed `auth` schema.
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
})
