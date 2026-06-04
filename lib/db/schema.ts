/**
 * Track B — initial Drizzle schema (schema-as-code, not Prisma).
 *
 * Operating rules honored here (see CLAUDE.md):
 *  - The DB holds USER DATA ONLY. Diagnostic questions, scoring weights, the
 *    Playbook structure, and AI prompts live in /lib config + Git — never here.
 *  - `users` is owned by Supabase Auth (`auth.users`). We do NOT define an app
 *    users table; we reference auth.users for foreign keys via a pgSchema ref.
 *  - RLS scopes every table to workspace membership (admin bypasses). RLS lives
 *    in SQL/migrations, not in this file — these are table definitions only.
 *
 * Migrations are intentionally NOT generated yet.
 */

import { sql } from "drizzle-orm"
import {
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

/* -------------------------------------------------------------------------- */
/* Supabase Auth reference                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Reference to Supabase's `auth.users` table. Supabase manages this table; we
 * only declare its primary key so app tables can carry foreign keys to it.
 * Do not create/alter this table from app migrations.
 */
export const authSchema = pgSchema("auth")
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
})

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const planEnum = pgEnum("plan", [
  "free",
  "diagnostic",
  "playbook",
  "enterprise",
])

export const membershipRoleEnum = pgEnum("membership_role", ["owner", "member"])

export const diagnosticStatusEnum = pgEnum("diagnostic_status", [
  "draft",
  "submitted",
])

export const playbookStatusEnum = pgEnum("playbook_status", [
  "draft",
  "published",
])

/* -------------------------------------------------------------------------- */
/* Tenancy: workspaces + memberships                                          */
/* -------------------------------------------------------------------------- */

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "restrict" }),
  plan: planEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("member"),
  },
  (t) => [unique("memberships_workspace_user_unique").on(t.workspaceId, t.userId)],
)

/* -------------------------------------------------------------------------- */
/* Diagnostic surface                                                          */
/* -------------------------------------------------------------------------- */

export const diagnostics = pgTable("diagnostics", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => authUsers.id, { onDelete: "restrict" }),
  status: diagnosticStatusEnum("status").notNull().default("draft"),
  // User responses only — never the questions/weights (those live in /lib).
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
})

export const diagnosticReports = pgTable("diagnostic_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  diagnosticId: uuid("diagnostic_id")
    .notNull()
    .references(() => diagnostics.id, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Computed scorecard (pillar -> score/level). Output data, not methodology.
  pillarScores: jsonb("pillar_scores"),
  aiAnalysis: text("ai_analysis"),
  pdfUrl: text("pdf_url"),
})

/* -------------------------------------------------------------------------- */
/* Playbook surface                                                            */
/* -------------------------------------------------------------------------- */

export const playbooks = pgTable("playbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: playbookStatusEnum("status").notNull().default("draft"),
  data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
})

export const playbookSections = pgTable(
  "playbook_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playbookId: uuid("playbook_id")
      .notNull()
      .references(() => playbooks.id, { onDelete: "cascade" }),
    // e.g. numbers | icp | motion | routing | messaging | coverage | hiring | operating
    sectionKey: text("section_key").notNull(),
    content: jsonb("content").notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("playbook_sections_playbook_key_unique").on(
      t.playbookId,
      t.sectionKey,
    ),
  ],
)

/* -------------------------------------------------------------------------- */
/* Billing: Stripe-synced subscriptions (Stripe is source of truth)           */
/* -------------------------------------------------------------------------- */

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  // Free-text to mirror Stripe price/plan + status values verbatim.
  plan: text("plan").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
})

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type Membership = typeof memberships.$inferSelect
export type NewMembership = typeof memberships.$inferInsert
export type Diagnostic = typeof diagnostics.$inferSelect
export type NewDiagnostic = typeof diagnostics.$inferInsert
export type DiagnosticReport = typeof diagnosticReports.$inferSelect
export type NewDiagnosticReport = typeof diagnosticReports.$inferInsert
export type Playbook = typeof playbooks.$inferSelect
export type NewPlaybook = typeof playbooks.$inferInsert
export type PlaybookSection = typeof playbookSections.$inferSelect
export type NewPlaybookSection = typeof playbookSections.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
