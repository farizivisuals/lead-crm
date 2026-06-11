-- =============================================================
-- 0012: Creatives assigned to projects and tasks (many-to-many)
-- =============================================================

-- Creatives on a project
CREATE TABLE project_creatives (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES employees(profile_id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, profile_id)
);

ALTER TABLE project_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_creatives_select" ON project_creatives FOR SELECT TO authenticated
  USING (can_see_project(project_id));

CREATE POLICY "project_creatives_manage" ON project_creatives FOR ALL TO authenticated
  USING (is_root_or_exec() OR current_employee_role() = 'manager')
  WITH CHECK (is_root_or_exec() OR current_employee_role() = 'manager');

-- Creatives on a task
CREATE TABLE task_creatives (
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES employees(profile_id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, profile_id)
);

ALTER TABLE task_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_creatives_select" ON task_creatives FOR SELECT TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

-- Any employee who can see the project can manage a task's creatives
-- (mirrors tasks_insert, so task creation flows can attach creatives).
CREATE POLICY "task_creatives_manage" ON task_creatives FOR ALL TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  )
  WITH CHECK (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );
