-- Row Level Security for Track B.
--
-- Model (see CLAUDE.md): a user may read/write only rows that belong to a
-- workspace they are a member of (joined via `memberships`). drew@drewcalin.co
-- is a bypass admin via a SEPARATE permissive policy on every table.
--
-- Helpers are SECURITY DEFINER so membership/ownership checks do NOT re-trigger
-- RLS on the tables they read — this is what prevents infinite recursion when a
-- policy on `memberships` needs to look at `memberships`. `search_path = ''`
-- forces fully-qualified names (Supabase-recommended hardening).
--
-- Note: RLS governs access by the `authenticated`/`anon` roles (the Supabase
-- client / PostgREST path using the publishable key). Trusted server code using
-- the secret key (service_role) and direct owner connections bypass RLS by
-- design — that is how Stripe webhook writes to `subscriptions` work.

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt() ->> 'email', '') = 'drew@drewcalin.co';
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.workspace_id = ws AND m.user_id = auth.uid()
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = ws AND w.owner_user_id = auth.uid()
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_member_of_diagnostic(d uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.diagnostics dg
    JOIN public.memberships m ON m.workspace_id = dg.workspace_id
    WHERE dg.id = d AND m.user_id = auth.uid()
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_member_of_playbook(p uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.playbooks pb
    JOIN public.memberships m ON m.workspace_id = pb.workspace_id
    WHERE pb.id = p AND m.user_id = auth.uid()
  );
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Enable RLS on all 7 application tables
-- ---------------------------------------------------------------------------

ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "diagnostics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "diagnostic_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playbooks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "playbook_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- workspaces: members read/update; owner inserts/deletes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "workspaces_select" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_select" ON "workspaces"
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_insert" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_insert" ON "workspaces"
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_update" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_update" ON "workspaces"
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(id))
  WITH CHECK (public.is_workspace_member(id));--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_delete" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_delete" ON "workspaces"
  FOR DELETE TO authenticated
  USING (public.is_workspace_owner(id));--> statement-breakpoint

DROP POLICY IF EXISTS "workspaces_admin" ON "workspaces";--> statement-breakpoint
CREATE POLICY "workspaces_admin" ON "workspaces"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- memberships: members can read; only the workspace owner can write
-- (owner is checked against workspaces, so no recursion onto memberships)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "memberships_select" ON "memberships";--> statement-breakpoint
CREATE POLICY "memberships_select" ON "memberships"
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS "memberships_write" ON "memberships";--> statement-breakpoint
CREATE POLICY "memberships_write" ON "memberships"
  FOR ALL TO authenticated
  USING (public.is_workspace_owner(workspace_id))
  WITH CHECK (public.is_workspace_owner(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS "memberships_admin" ON "memberships";--> statement-breakpoint
CREATE POLICY "memberships_admin" ON "memberships"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- diagnostics: workspace members CRUD
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "diagnostics_member" ON "diagnostics";--> statement-breakpoint
CREATE POLICY "diagnostics_member" ON "diagnostics"
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS "diagnostics_admin" ON "diagnostics";--> statement-breakpoint
CREATE POLICY "diagnostics_admin" ON "diagnostics"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- diagnostic_reports: scoped through the parent diagnostic's workspace
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "diagnostic_reports_member" ON "diagnostic_reports";--> statement-breakpoint
CREATE POLICY "diagnostic_reports_member" ON "diagnostic_reports"
  FOR ALL TO authenticated
  USING (public.is_member_of_diagnostic(diagnostic_id))
  WITH CHECK (public.is_member_of_diagnostic(diagnostic_id));--> statement-breakpoint

DROP POLICY IF EXISTS "diagnostic_reports_admin" ON "diagnostic_reports";--> statement-breakpoint
CREATE POLICY "diagnostic_reports_admin" ON "diagnostic_reports"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- playbooks: workspace members CRUD
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "playbooks_member" ON "playbooks";--> statement-breakpoint
CREATE POLICY "playbooks_member" ON "playbooks"
  FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS "playbooks_admin" ON "playbooks";--> statement-breakpoint
CREATE POLICY "playbooks_admin" ON "playbooks"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- playbook_sections: scoped through the parent playbook's workspace
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "playbook_sections_member" ON "playbook_sections";--> statement-breakpoint
CREATE POLICY "playbook_sections_member" ON "playbook_sections"
  FOR ALL TO authenticated
  USING (public.is_member_of_playbook(playbook_id))
  WITH CHECK (public.is_member_of_playbook(playbook_id));--> statement-breakpoint

DROP POLICY IF EXISTS "playbook_sections_admin" ON "playbook_sections";--> statement-breakpoint
CREATE POLICY "playbook_sections_admin" ON "playbook_sections"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- subscriptions: members may READ their workspace's subscription. Writes are
-- performed only by trusted server code via the secret key (service_role),
-- which bypasses RLS — so no member write policy is defined here.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "subscriptions_select" ON "subscriptions";--> statement-breakpoint
CREATE POLICY "subscriptions_select" ON "subscriptions"
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));--> statement-breakpoint

DROP POLICY IF EXISTS "subscriptions_admin" ON "subscriptions";--> statement-breakpoint
CREATE POLICY "subscriptions_admin" ON "subscriptions"
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
