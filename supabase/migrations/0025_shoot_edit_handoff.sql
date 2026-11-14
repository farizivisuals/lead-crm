-- =============================================================
-- 0025: Shoot → edit handoff
-- An edit task points at the shoot task it follows. When that shoot task
-- moves forward past its department's "Shoot" stage, it closes itself
-- (jumps to the done stage) and every following editor is notified.
-- =============================================================

ALTER TABLE tasks
  ADD COLUMN follows_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_follows_task_id ON tasks(follows_task_id) WHERE follows_task_id IS NOT NULL;

CREATE OR REPLACE FUNCTION handoff_shoot_to_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  shoot_pos INT;
  old_pos   INT;
  new_pos   INT;
  done_id   UUID;
  e         RECORD;
BEGIN
  IF OLD.current_stage_id IS NOT DISTINCT FROM NEW.current_stage_id THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE follows_task_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT position INTO shoot_pos FROM department_stages
    WHERE department_id = NEW.department_id AND lower(name) = 'shoot'
    ORDER BY position LIMIT 1;
  IF shoot_pos IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT position INTO old_pos FROM department_stages WHERE id = OLD.current_stage_id;
  SELECT position INTO new_pos FROM department_stages WHERE id = NEW.current_stage_id;
  IF NOT (old_pos <= shoot_pos AND new_pos > shoot_pos) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO done_id FROM department_stages
    WHERE department_id = NEW.department_id AND is_terminal
    ORDER BY position LIMIT 1;
  IF done_id IS NOT NULL THEN
    NEW.current_stage_id := done_id;
  END IF;

  FOR e IN SELECT id, assigned_to FROM tasks WHERE follows_task_id = NEW.id LOOP
    PERFORM notify_user(
      e.assigned_to,
      'shoot_done',
      'task',
      e.id,
      'Shoot done — ready to edit',
      'Shoot done — ready to edit: ' || NEW.title
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Same lockdown as 0018: trigger functions are never called directly.
REVOKE EXECUTE ON FUNCTION handoff_shoot_to_edit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_shoot_handoff
  BEFORE UPDATE OF current_stage_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION handoff_shoot_to_edit();
