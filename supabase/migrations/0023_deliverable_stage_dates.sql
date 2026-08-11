-- =============================================================
-- 0023: Per-stage scheduled dates for deliverables
-- A (deliverable, stage) row now holds scheduling info: who and when.
-- Either can be set without the other, so assigned_to becomes nullable.
-- =============================================================

ALTER TABLE task_deliverable_assignments
  ALTER COLUMN assigned_to DROP NOT NULL;

ALTER TABLE task_deliverable_assignments
  ADD COLUMN scheduled_date DATE;
