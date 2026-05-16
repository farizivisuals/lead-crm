-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (
    -- Employees see all profiles; clients see their own
    current_user_type() = 'employee' OR id = auth.uid()
  );

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE POLICY "departments_select" ON departments FOR SELECT TO authenticated
  USING (current_user_type() = 'employee');

CREATE POLICY "departments_manage" ON departments FOR ALL TO authenticated
  USING (current_employee_role() = 'root')
  WITH CHECK (current_employee_role() = 'root');

-- ============================================================
-- DEPARTMENT STAGES
-- ============================================================
CREATE POLICY "stages_select" ON department_stages FOR SELECT TO authenticated
  USING (current_user_type() = 'employee');

CREATE POLICY "stages_manage" ON department_stages FOR ALL TO authenticated
  USING (
    current_employee_role() = 'root'
    OR (
      current_employee_role() = 'manager'
      AND department_id = current_department_id()
    )
  )
  WITH CHECK (
    current_employee_role() = 'root'
    OR (
      current_employee_role() = 'manager'
      AND department_id = current_department_id()
    )
  );

-- ============================================================
-- EMPLOYEES
-- ============================================================
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated
  USING (current_user_type() = 'employee');

CREATE POLICY "employees_manage" ON employees FOR ALL TO authenticated
  USING (current_employee_role() = 'root')
  WITH CHECK (current_employee_role() = 'root');

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated
  USING (
    is_root_or_exec()
    -- Manager / employee: if a project for this client involves their dept
    OR (
      current_user_type() = 'employee'
      AND EXISTS (
        SELECT 1 FROM projects p
        JOIN project_departments pd ON pd.project_id = p.id
        WHERE p.client_id = clients.id
          AND pd.department_id = current_department_id()
      )
    )
    -- Client: their own company
    OR EXISTS (
      SELECT 1 FROM client_contacts cc
      WHERE cc.client_id = clients.id AND cc.profile_id = auth.uid()
    )
  );

CREATE POLICY "clients_manage" ON clients FOR ALL TO authenticated
  USING (
    is_root_or_exec()
    OR current_employee_role() = 'manager'
  )
  WITH CHECK (
    is_root_or_exec()
    OR current_employee_role() = 'manager'
  );

-- ============================================================
-- CLIENT CONTACTS
-- ============================================================
CREATE POLICY "client_contacts_select" ON client_contacts FOR SELECT TO authenticated
  USING (
    current_user_type() = 'employee'
    OR profile_id = auth.uid()
  );

CREATE POLICY "client_contacts_manage" ON client_contacts FOR ALL TO authenticated
  USING (
    is_root_or_exec() OR current_employee_role() = 'manager'
  )
  WITH CHECK (
    is_root_or_exec() OR current_employee_role() = 'manager'
  );

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE POLICY "projects_select" ON projects FOR SELECT TO authenticated
  USING (can_see_project(id));

CREATE POLICY "projects_manage" ON projects FOR ALL TO authenticated
  USING (
    is_root_or_exec()
    OR (
      current_employee_role() = 'manager'
      AND EXISTS (
        SELECT 1 FROM project_departments pd
        WHERE pd.project_id = id AND pd.department_id = current_department_id()
      )
    )
  )
  WITH CHECK (
    is_root_or_exec()
    OR current_employee_role() = 'manager'
  );

-- ============================================================
-- PROJECT DEPARTMENTS
-- ============================================================
CREATE POLICY "project_departments_select" ON project_departments FOR SELECT TO authenticated
  USING (can_see_project(project_id));

CREATE POLICY "project_departments_manage" ON project_departments FOR ALL TO authenticated
  USING (is_root_or_exec() OR current_employee_role() = 'manager')
  WITH CHECK (is_root_or_exec() OR current_employee_role() = 'manager');

-- ============================================================
-- TASKS
-- ============================================================
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
  USING (
    can_see_project(project_id)
    AND current_user_type() = 'employee'  -- clients never see raw tasks
  );

CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated
  WITH CHECK (
    current_user_type() = 'employee'
    AND can_see_project(project_id)
  );

CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    current_user_type() = 'employee'
    AND (
      is_root_or_exec()
      OR current_employee_role() = 'manager'
      OR assigned_to = auth.uid()
    )
  );

CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated
  USING (is_root_or_exec() OR current_employee_role() = 'manager');

-- ============================================================
-- TASK STAGE HISTORY
-- ============================================================
CREATE POLICY "task_history_select" ON task_stage_history FOR SELECT TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

CREATE POLICY "task_history_insert" ON task_stage_history FOR INSERT TO authenticated
  WITH CHECK (current_user_type() = 'employee' AND moved_by = auth.uid());

-- ============================================================
-- TASK CHECKLIST ITEMS
-- ============================================================
CREATE POLICY "checklist_select" ON task_checklist_items FOR SELECT TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

CREATE POLICY "checklist_manage" ON task_checklist_items FOR ALL TO authenticated
  USING (current_user_type() = 'employee')
  WITH CHECK (current_user_type() = 'employee');

-- ============================================================
-- DELIVERABLES
-- ============================================================
CREATE POLICY "deliverables_select" ON deliverables FOR SELECT TO authenticated
  USING (
    can_see_project(project_id)
    AND (
      current_user_type() = 'employee'
      OR status IN ('client_review', 'approved', 'revision_requested')
    )
  );

CREATE POLICY "deliverables_insert" ON deliverables FOR INSERT TO authenticated
  WITH CHECK (
    current_user_type() = 'employee'
    AND can_see_project(project_id)
  );

CREATE POLICY "deliverables_update" ON deliverables FOR UPDATE TO authenticated
  USING (
    current_user_type() = 'employee'
    AND can_see_project(project_id)
  );

CREATE POLICY "deliverables_delete" ON deliverables FOR DELETE TO authenticated
  USING (is_root_or_exec() OR current_employee_role() = 'manager');

-- ============================================================
-- DELIVERABLE REVISIONS
-- ============================================================
CREATE POLICY "revisions_select" ON deliverable_revisions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM deliverables d
      WHERE d.id = deliverable_id AND can_see_project(d.project_id)
    )
  );

CREATE POLICY "revisions_insert" ON deliverable_revisions FOR INSERT TO authenticated
  WITH CHECK (
    actor_profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM deliverables d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = deliverable_id
        AND (
          current_user_type() = 'employee'
          OR EXISTS (
            SELECT 1 FROM client_contacts cc
            WHERE cc.client_id = p.client_id AND cc.profile_id = auth.uid()
          )
        )
    )
  );

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated
  USING (
    (current_user_type() = 'employee' OR is_client_visible = true)
    -- verify entity visibility via projects where possible
  );

CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated
  WITH CHECK (author_profile_id = auth.uid());

CREATE POLICY "comments_update_own" ON comments FOR UPDATE TO authenticated
  USING (author_profile_id = auth.uid());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated
  USING (recipient_profile_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated
  USING (recipient_profile_id = auth.uid())
  WITH CHECK (recipient_profile_id = auth.uid());

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE POLICY "activity_select" ON activity_log FOR SELECT TO authenticated
  USING (current_user_type() = 'employee');

-- ============================================================
-- Enable realtime for notifications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
