-- =============================================================
-- 0028: Graphic Design department, Basic / Premium tasks, automatic dates
--
-- A Graphic Design task waits in "Assigned" with no dates. The day it first
-- reaches "Consultation" (or any later stage) becomes its start date, and its
-- due date is 20 (Basic) or 25 (Premium) business days counting that day as
-- day 1. Business days are Sunday to Thursday. Days are Kuwait days.
-- The start date is set once, so moving back and forward doesn't restart the
-- clock. Changing the type (or the start date) recalculates the due date; a
-- hand-edited due date otherwise sticks.
-- =============================================================

INSERT INTO departments (name, slug) VALUES ('Graphic Design', 'graphics')
ON CONFLICT (slug) DO NOTHING;

-- Orange family, dark -> light by position; the done stage gets its own green.
WITH dept AS (SELECT id FROM departments WHERE slug = 'graphics')
INSERT INTO department_stages (department_id, name, position, is_terminal, color)
SELECT dept.id, s.name, s.pos, s.terminal, s.color
FROM dept, (VALUES
  ('Assigned',     1, false, '#c2410c'),
  ('Consultation', 2, false, '#ea580c'),
  ('Moodboard',    3, false, '#f97316'),
  ('In Process',   4, false, '#fb923c'),
  ('Submission',   5, true,  '#4ade80')
) AS s(name, pos, terminal, color)
ON CONFLICT (department_id, position) DO NOTHING;

ALTER TABLE tasks
  ADD COLUMN tier TEXT CHECK (tier IN ('basic', 'premium'));

-- The date `n` business days on, counting `start` as day 1 when it is one.
CREATE OR REPLACE FUNCTION add_business_days(start DATE, n INT)
RETURNS DATE LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  d DATE := start;
  counted INT := 0;
BEGIN
  LOOP
    -- extract(dow): Sunday 0 … Saturday 6. Friday 5 and Saturday 6 are off.
    IF extract(dow FROM d) NOT IN (5, 6) THEN
      counted := counted + 1;
      EXIT WHEN counted >= n;
    END IF;
    d := d + 1;
  END LOOP;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION graphics_task_dates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  consult_pos INT;
  stage_pos INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM departments WHERE id = NEW.department_id AND slug = 'graphics') THEN
    RETURN NEW;
  END IF;

  IF NEW.start_date IS NULL THEN
    SELECT position INTO consult_pos FROM department_stages
      WHERE department_id = NEW.department_id AND lower(name) = 'consultation'
      ORDER BY position LIMIT 1;
    SELECT position INTO stage_pos FROM department_stages WHERE id = NEW.current_stage_id;
    IF consult_pos IS NOT NULL AND stage_pos >= consult_pos THEN
      NEW.start_date := (now() AT TIME ZONE 'Asia/Kuwait')::date;
    END IF;
  END IF;

  IF NEW.start_date IS NOT NULL AND NEW.tier IS NOT NULL AND (
    TG_OP = 'INSERT'
    OR NEW.start_date IS DISTINCT FROM OLD.start_date
    OR NEW.tier IS DISTINCT FROM OLD.tier
  ) THEN
    NEW.due_date := add_business_days(NEW.start_date, CASE NEW.tier WHEN 'premium' THEN 25 ELSE 20 END);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION graphics_task_dates() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_graphics_task_dates
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION graphics_task_dates();
