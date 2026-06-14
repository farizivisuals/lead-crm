-- =============================================================
-- 0014: Role-based access restrictions (3-tier, assignment-based)
-- =============================================================
-- Tiers:
--   Executive   = employees.role IN (root, ceo, cfo, manager)  -> full admin
--   Creative    = role 'employee' in the 'creatives' department -> assigned projects only
--   Team member = role 'employee' in any other department       -> assigned tasks only
--
-- Replaces the previous department-wide visibility model (department
-- membership + department_cross_access) with assignment-based visibility.
-- department_cross_access is left in place but is no longer referenced.

-- -------------------------------------------------------------
-- 1. Helper functions
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_executive()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_employee_role() IN ('root', 'ceo', 'cfo', 'manager');
$$;

CREATE OR REPLACE FUNCTION is_creative()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    JOIN departments d ON d.id = e.department_id
    WHERE e.profile_id = auth.uid()
      AND e.role = 'employee'
      AND d.slug = 'creatives'
  );
$$;

-- -------------------------------------------------------------
-- 2. Assignment-based project visibility
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_see_project(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects pr
    WHERE pr.id = p_project_id
    AND (
      -- Executives see everything
      is_executive()
      -- Client contacts for this project's client
      OR EXISTS (
        SELECT 1 FROM client_contacts cc
        WHERE cc.client_id = pr.client_id
          AND cc.profile_id = auth.uid()
      )
      -- Creatives explicitly assigned to the project
      OR EXISTS (
        SELECT 1 FROM project_creatives pc
        WHERE pc.project_id = pr.id
          AND pc.profile_id = auth.uid()
      )
      -- Team members assigned to a task in the project
      OR EXISTS (
        SELECT 1 FROM tasks t
        WHERE t.project_id = pr.id
          AND (
            t.assigned_to = auth.uid()
            OR EXISTS (
              SELECT 1 FROM task_creatives tc
              WHERE tc.task_id = t.id AND tc.profile_id = auth.uid()
            )
          )
      )
    )
  );
$$;

-- -------------------------------------------------------------
-- 3. CLIENTS
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated
  USING (
    is_executive()
    -- Client contacts: their own company
    OR EXISTS (
      SELECT 1 FROM client_contacts cc
      WHERE cc.client_id = clients.id AND cc.profile_id = auth.uid()
    )
    -- Employees: clients of a project they are assigned to
    OR (
      current_user_type() = 'employee'
      AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.client_id = clients.id AND can_see_project(p.id)
      )
    )
  );

DROP POLICY IF EXISTS "clients_manage" ON clients;
CREATE POLICY "clients_manage" ON clients FOR ALL TO authenticated
  USING (is_executive())
  WITH CHECK (is_executive());

-- Creatives can no longer create clients
DROP POLICY IF EXISTS "clients_insert_dept" ON clients;
DROP POLICY IF EXISTS "client_contacts_insert_dept" ON client_contacts;

UPDATE departments SET can_add_clients = false WHERE slug = 'creatives';

-- client_contacts management -> executives only
DROP POLICY IF EXISTS "client_contacts_manage" ON client_contacts;
CREATE POLICY "client_contacts_manage" ON client_contacts FOR ALL TO authenticated
  USING (is_executive())
  WITH CHECK (is_executive());

-- -------------------------------------------------------------
-- 4. PROJECTS
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "projects_manage" ON projects;
CREATE POLICY "projects_manage" ON projects FOR ALL TO authenticated
  USING (is_executive())
  WITH CHECK (is_executive());

DROP POLICY IF EXISTS "project_departments_manage" ON project_departments;
CREATE POLICY "project_departments_manage" ON project_departments FOR ALL TO authenticated
  USING (is_executive())
  WITH CHECK (is_executive());

-- project_creatives: only executives assign creatives to projects
DROP POLICY IF EXISTS "project_creatives_manage" ON project_creatives;
CREATE POLICY "project_creatives_manage" ON project_creatives FOR ALL TO authenticated
  USING (is_executive())
  WITH CHECK (is_executive());

-- Moodboards live on projects.moodboard_url, but creatives must be able to
-- manage them without full project-management rights. This SECURITY DEFINER
-- function lets executives and assigned creatives update ONLY that column.
CREATE OR REPLACE FUNCTION set_project_moodboard(p_project_id UUID, p_url TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (is_executive() OR (is_creative() AND can_see_project(p_project_id))) THEN
    RAISE EXCEPTION 'Not authorized to edit this project''s moodboard';
  END IF;
  UPDATE projects SET moodboard_url = p_url, updated_at = now() WHERE id = p_project_id;
END;
$$;

-- -------------------------------------------------------------
-- 5. TASKS
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
  USING (
    -- Clients keep portal timeline visibility for their own projects
    (current_user_type() = 'client' AND can_see_project(project_id))
    OR (
      current_user_type() = 'employee'
      AND (
        -- Executives and creatives see all tasks in projects they can see
        ((is_executive() OR is_creative()) AND can_see_project(project_id))
        -- Team members see only the tasks assigned to them
        OR assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_creatives tc
          WHERE tc.task_id = tasks.id AND tc.profile_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks FOR INSERT TO authenticated
  WITH CHECK (is_executive());

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    current_user_type() = 'employee'
    AND (is_executive() OR assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks FOR DELETE TO authenticated
  USING (is_executive());

-- task_creatives: only executives assign creatives to tasks
DROP POLICY IF EXISTS "task_creatives_manage" ON task_creatives;
CREATE POLICY "task_creatives_manage" ON task_creatives FOR ALL TO authenticated
  USING (is_executive())
  WITH CHECK (is_executive());

-- -------------------------------------------------------------
-- 6. DELIVERABLES
-- -------------------------------------------------------------
-- insert unchanged in effect (any employee who can see the project may upload
-- for internal review) but restated for clarity.
DROP POLICY IF EXISTS "deliverables_insert" ON deliverables;
CREATE POLICY "deliverables_insert" ON deliverables FOR INSERT TO authenticated
  WITH CHECK (
    current_user_type() = 'employee'
    AND can_see_project(project_id)
  );

-- Only executives or assigned creatives may change a deliverable's status
-- (approve for client review / send back for internal revision).
DROP POLICY IF EXISTS "deliverables_update" ON deliverables;
CREATE POLICY "deliverables_update" ON deliverables FOR UPDATE TO authenticated
  USING (
    is_executive()
    OR (is_creative() AND can_see_project(project_id))
  );

DROP POLICY IF EXISTS "deliverables_delete" ON deliverables;
CREATE POLICY "deliverables_delete" ON deliverables FOR DELETE TO authenticated
  USING (is_executive());

-- deliverable_revisions: employee-side approvals limited to execs/creatives;
-- client contacts may still approve/request revision on client_review items.
DROP POLICY IF EXISTS "revisions_insert" ON deliverable_revisions;
CREATE POLICY "revisions_insert" ON deliverable_revisions FOR INSERT TO authenticated
  WITH CHECK (
    actor_profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM deliverables d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = deliverable_id
        AND (
          ((is_executive() OR is_creative()) AND can_see_project(d.project_id))
          OR EXISTS (
            SELECT 1 FROM client_contacts cc
            WHERE cc.client_id = p.client_id AND cc.profile_id = auth.uid()
          )
        )
    )
  );

-- -------------------------------------------------------------
-- 7. COMMENTS — verify the underlying entity is actually visible
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated
  USING (
    (current_user_type() = 'employee' OR is_client_visible = true)
    AND (
      (entity_type = 'project' AND can_see_project(entity_id))
      OR (entity_type = 'task' AND EXISTS (
        SELECT 1 FROM tasks t WHERE t.id = entity_id AND can_see_project(t.project_id)
      ))
      OR (entity_type = 'deliverable' AND EXISTS (
        SELECT 1 FROM deliverables d WHERE d.id = entity_id AND can_see_project(d.project_id)
      ))
    )
  );

-- -------------------------------------------------------------
-- 8. ACTIVITY LOG — execs see all; others only for visible projects
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "activity_select" ON activity_log;
CREATE POLICY "activity_select" ON activity_log FOR SELECT TO authenticated
  USING (
    is_executive()
    OR (
      current_user_type() = 'employee'
      AND (
        (entity_type = 'project' AND can_see_project(entity_id))
        OR (entity_type = 'task' AND EXISTS (
          SELECT 1 FROM tasks t WHERE t.id = entity_id AND can_see_project(t.project_id)
        ))
        OR (entity_type = 'deliverable' AND EXISTS (
          SELECT 1 FROM deliverables d WHERE d.id = entity_id AND can_see_project(d.project_id)
        ))
      )
    )
  );
