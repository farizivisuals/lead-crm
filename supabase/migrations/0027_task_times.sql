-- =============================================================
-- 0027: Optional time slot on tasks (Kuwait local time, no timezone).
-- A slot runs from start_date start_time to due_date end_time; no times
-- means the whole day. Both or neither.
-- =============================================================

ALTER TABLE tasks
  ADD COLUMN start_time TIME,
  ADD COLUMN end_time TIME,
  ADD CONSTRAINT tasks_time_pair CHECK ((start_time IS NULL) = (end_time IS NULL));
