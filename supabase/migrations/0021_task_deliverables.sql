-- =============================================================
-- 0021: Task deliverables with per-stage assignment
-- =============================================================

CREATE TABLE task_deliverables (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_deliverables_select" ON task_deliverables FOR SELECT TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

CREATE POLICY "task_deliverables_manage" ON task_deliverables FOR ALL TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  )
  WITH CHECK (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

-- One row per (deliverable, stage): the task's current stage row is the live
-- assignment; earlier-stage rows are the permanent per-phase record.
CREATE TABLE task_deliverable_assignments (
  deliverable_id UUID NOT NULL REFERENCES task_deliverables(id) ON DELETE CASCADE,
  stage_id       UUID NOT NULL REFERENCES department_stages(id) ON DELETE CASCADE,
  assigned_to    UUID NOT NULL REFERENCES employees(profile_id) ON DELETE CASCADE,
  assigned_by    UUID REFERENCES profiles(id),
  assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (deliverable_id, stage_id)
);

ALTER TABLE task_deliverable_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_deliverable_assignments_select" ON task_deliverable_assignments FOR SELECT TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (
      SELECT 1 FROM task_deliverables td JOIN tasks t ON t.id = td.task_id
      WHERE td.id = deliverable_id AND can_see_project(t.project_id)
    )
  );

CREATE POLICY "task_deliverable_assignments_manage" ON task_deliverable_assignments FOR ALL TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (
      SELECT 1 FROM task_deliverables td JOIN tasks t ON t.id = td.task_id
      WHERE td.id = deliverable_id AND can_see_project(t.project_id)
    )
  )
  WITH CHECK (
    current_user_type() = 'employee'
    AND EXISTS (
      SELECT 1 FROM task_deliverables td JOIN tasks t ON t.id = td.task_id
      WHERE td.id = deliverable_id AND can_see_project(t.project_id)
    )
  );
