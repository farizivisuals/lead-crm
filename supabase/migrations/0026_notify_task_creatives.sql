-- =============================================================
-- 0026: Creatives added to a task get the same "Task assigned to you"
-- notification as the assignee. Skipped when the creative is also the
-- assignee, who has already been told by on_task_assigned.
-- =============================================================

CREATE OR REPLACE FUNCTION on_task_creative_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
  adder_name TEXT;
BEGIN
  SELECT title, assigned_to INTO t FROM tasks WHERE id = NEW.task_id;
  IF t.assigned_to IS NOT DISTINCT FROM NEW.profile_id THEN
    RETURN NEW;
  END IF;
  SELECT full_name INTO adder_name FROM profiles WHERE id = auth.uid();
  PERFORM notify_user(
    NEW.profile_id,
    'task_assigned',
    'task',
    NEW.task_id,
    'Task assigned to you',
    coalesce(adder_name, 'Someone') || ' added you to "' || t.title || '"'
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION on_task_creative_added() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_task_creative_added_trigger
  AFTER INSERT ON task_creatives
  FOR EACH ROW EXECUTE FUNCTION on_task_creative_added();
