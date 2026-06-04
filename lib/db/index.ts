import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

/**
 * Drizzle client backed by postgres.js.
 *
 * Use the Supabase connection string in DATABASE_URL. When pointing at the
 * Supabase transaction-mode pooler (port 6543), prepared statements must be
 * disabled — hence `prepare: false`.
 */
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

// Reuse a single client across hot reloads in dev.
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>
}

const client = globalForDb.client ?? postgres(connectionString, { prepare: false })
if (process.env.NODE_ENV !== "production") globalForDb.client = client

export const db = drizzle(client, { schema })
export { schema }
