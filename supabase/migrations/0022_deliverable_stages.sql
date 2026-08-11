-- =============================================================
-- 0022: Each deliverable tracks its own stage
-- NULL means "use the parent task's current stage".
-- =============================================================

ALTER TABLE task_deliverables
  ADD COLUMN current_stage_id UUID REFERENCES department_stages(id) ON DELETE SET NULL;

UPDATE task_deliverables td
SET current_stage_id = t.current_stage_id
FROM tasks t
WHERE t.id = td.task_id;
