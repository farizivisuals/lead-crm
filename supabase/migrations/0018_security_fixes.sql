-- =============================================================
-- 0018: Security fixes from full-codebase audit
-- =============================================================
-- C1: calendar_events view ran with owner privileges (bypassing RLS), so any
--     authenticated user could read every client's tasks/projects/deliverables
--     via PostgREST.
-- H2: handle_new_user trusted client-supplied signup metadata for user_type
--     and defaulted to 'employee', so a public signup could mint an
--     employee-level account.
-- M1: quotes/line-items SELECT was open to every employee; reads now match
--     the owner-or-exec model the write policies already use (0013/0017).
-- M2: hot single-column lookups under RLS had no indexes (composite PKs
--     already cover the two-column probes in can_see_project).

-- -------------------------------------------------------------
-- C1. Make the calendar view honor the querying user's RLS.
-- -------------------------------------------------------------
ALTER VIEW calendar_events SET (security_invoker = on);
REVOKE ALL ON calendar_events FROM anon;

-- -------------------------------------------------------------
-- H2. Least-privilege default for new auth users. user_type is never taken
-- from signup metadata (client-controlled); the service-role provisioning
-- actions (addEmployee / client provisioning) upsert the correct type
-- immediately after createUser.
-- -------------------------------------------------------------
ALTER TABLE profiles ALTER COLUMN user_type SET DEFAULT 'client';

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, user_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'client'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------
-- M1. Scope quote reads to owner-or-executive, matching the write policies.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "employees_select_quotes" ON quotes;
CREATE POLICY "employees_select_quotes" ON quotes
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR is_executive());

DROP POLICY IF EXISTS "employees_select_line_items" ON quote_line_items;
CREATE POLICY "employees_select_line_items" ON quote_line_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_id AND (q.created_by = auth.uid() OR is_executive())
    )
  );

-- -------------------------------------------------------------
-- M2. Indexes for RLS-hot single-column lookups.
-- -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_creatives_profile ON task_creatives(profile_id);
CREATE INDEX IF NOT EXISTS idx_project_creatives_profile ON project_creatives(profile_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_profile ON client_contacts(profile_id);
CREATE INDEX IF NOT EXISTS idx_project_departments_department ON project_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

-- -------------------------------------------------------------
-- Advisor follow-ups (Supabase security lints after the above).
-- notify_user was callable by any signed-in user via /rest/v1/rpc, allowing
-- spoofed notifications to arbitrary recipients. Function EXECUTE defaults to
-- PUBLIC, so revokes must target PUBLIC; grant back only what the app needs.
-- RLS helpers run as the querying (authenticated) user; trigger functions and
-- notify_user run as their SECURITY DEFINER owner and need no caller grant.
-- -------------------------------------------------------------

-- Pin search_path on the two functions that were missing it.
ALTER FUNCTION get_calendar_events(DATE, DATE) SET search_path = public;
ALTER FUNCTION set_updated_at() SET search_path = public;

-- RLS helpers: authenticated only.
REVOKE EXECUTE ON FUNCTION can_see_project(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION can_see_project(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION is_task_creative(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_task_creative(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION is_executive() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_executive() TO authenticated;
REVOKE EXECUTE ON FUNCTION is_creative() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_creative() TO authenticated;
REVOKE EXECUTE ON FUNCTION is_root_or_exec() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_root_or_exec() TO authenticated;
REVOKE EXECUTE ON FUNCTION current_employee_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_employee_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION current_department_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_department_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION current_user_type() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_user_type() TO authenticated;

-- RPCs the app calls from signed-in sessions.
REVOKE EXECUTE ON FUNCTION set_project_moodboard(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_project_moodboard(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_calendar_events(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_calendar_events(DATE, DATE) TO authenticated;

-- Definer-owned internals: no caller grants at all.
REVOKE EXECUTE ON FUNCTION notify_user(UUID, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_deliverable_revision() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_task_stage_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION on_task_assigned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION on_deliverable_revision_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION on_comment_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION guard_profile_privilege_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_updated_at() FROM PUBLIC, anon, authenticated;
