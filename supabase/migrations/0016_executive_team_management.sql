-- =============================================================
-- 0016: Allow the executive tier to manage team members
-- =============================================================
-- Previously employees could only be managed by 'root'. Per the access model,
-- the full executive tier (root/ceo/cfo/manager) manages users.

DROP POLICY IF EXISTS "employees_manage" ON employees;
CREATE POLICY "employees_manage" ON employees FOR ALL TO authenticated
  USING (is_executive())
  WITH CHECK (is_executive());
