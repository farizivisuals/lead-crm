-- =============================================================
-- 0029: Notifications for every task / project change, phone push, and
-- "Mark done" (complete_task_step).
--
-- Who hears about a task: the assignee, its creatives, and whoever holds a
-- video's current phase ("people") — always pushed to their phone — plus the
-- executives (root, ceo, cfo, manager), who see everything in their list but
-- are only pushed for key events: new tasks, steps marked done, date changes
-- and client approvals. Nobody is notified about their own action.
-- =============================================================

ALTER TABLE notifications
  ADD COLUMN push BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN pushed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION actor_name()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT split_part(full_name, ' ', 1) FROM profiles WHERE id = auth.uid()), 'Someone');
$$;

/** People on a task: assignee, creatives, and each video's current-phase assignee. */
CREATE OR REPLACE FUNCTION task_people(p_task_id UUID)
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT p) FILTER (WHERE p IS NOT NULL), '{}')
  FROM (
    SELECT assigned_to AS p FROM tasks WHERE id = p_task_id
    UNION SELECT profile_id FROM task_creatives WHERE task_id = p_task_id
    UNION SELECT a.assigned_to
      FROM task_deliverables d
      JOIN task_deliverable_assignments a ON a.deliverable_id = d.id AND a.stage_id = d.current_stage_id
      WHERE d.task_id = p_task_id
  ) x;
$$;

/**
 * One notification per person: `p_people` are always pushed; executives not
 * already among them get it with push = p_exec_push. The actor and anyone in
 * `p_skip` are left out.
 */
CREATE OR REPLACE FUNCTION notify_many(
  p_people UUID[], p_exec_push BOOLEAN, p_type TEXT, p_entity_type TEXT, p_entity_id UUID,
  p_title TEXT, p_body TEXT, p_skip UUID[] DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (recipient_profile_id, type, entity_type, entity_id, title, body, push)
  -- array_remove: a NULL in an array makes `= ANY` NULL, which would drop everyone.
  SELECT r.id, p_type, p_entity_type, p_entity_id, p_title, p_body, r.push
  FROM (
    SELECT DISTINCT unnest(array_remove(p_people, NULL)) AS id, true AS push
    UNION
    SELECT e.profile_id, p_exec_push FROM employees e
    WHERE e.role IN ('root', 'ceo', 'cfo', 'manager')
      AND NOT (e.profile_id = ANY (array_remove(p_people, NULL)))
  ) r
  WHERE r.id IS DISTINCT FROM auth.uid()
    AND NOT (r.id = ANY (array_remove(p_skip, NULL)));
END;
$$;

/** "20 Nov", "20 Nov, 09:00–12:00", "20 Nov – 25 Nov", or "no dates". */
CREATE OR REPLACE FUNCTION slot_text(s DATE, d DATE, st TIME, et TIME)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN s IS NULL AND d IS NULL THEN 'no dates'
    WHEN coalesce(s, d) = coalesce(d, s) THEN to_char(coalesce(s, d), 'FMDD Mon')
    ELSE to_char(s, 'FMDD Mon') || ' – ' || to_char(d, 'FMDD Mon')
  END || CASE WHEN st IS NOT NULL AND et IS NOT NULL
    THEN ', ' || to_char(st, 'HH24:MI') || '–' || to_char(et, 'HH24:MI') ELSE '' END;
$$;

-- ---------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_task_created_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- The assignee and creatives already get "assigned to you" / "added you".
  PERFORM notify_many('{}', true, 'task_created', 'task', NEW.id, 'New task',
    actor_name() || ' added "' || NEW.title || '" · ' || slot_text(NEW.start_date, NEW.due_date, NEW.start_time, NEW.end_time),
    ARRAY[NEW.assigned_to]);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION on_task_changed_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_stage department_stages%ROWTYPE;
  new_stage department_stages%ROWTYPE;
  due_note TEXT := '';
  new_name TEXT;
BEGIN
  IF OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id THEN
    SELECT * INTO old_stage FROM department_stages WHERE id = OLD.current_stage_id;
    SELECT * INTO new_stage FROM department_stages WHERE id = NEW.current_stage_id;
    IF NEW.due_date IS DISTINCT FROM OLD.due_date AND NEW.due_date IS NOT NULL THEN
      due_note := ' · due ' || to_char(NEW.due_date, 'FMDD Mon');
    END IF;
    IF new_stage.position > old_stage.position THEN
      PERFORM notify_many(task_people(NEW.id), true, 'task_step_done', 'task', NEW.id,
        CASE WHEN new_stage.is_terminal THEN 'Task done' ELSE 'Step done' END,
        actor_name() || ' finished ' || old_stage.name || ' on "' || NEW.title || '" · now ' || new_stage.name || due_note);
    ELSE
      PERFORM notify_many(task_people(NEW.id), false, 'task_moved_back', 'task', NEW.id, 'Moved back',
        actor_name() || ' moved "' || NEW.title || '" back to ' || new_stage.name);
    END IF;
  ELSIF (OLD.start_date, OLD.due_date, OLD.start_time, OLD.end_time)
        IS DISTINCT FROM (NEW.start_date, NEW.due_date, NEW.start_time, NEW.end_time) THEN
    PERFORM notify_many(task_people(NEW.id), true, 'task_dates_changed', 'task', NEW.id, 'Dates changed',
      '"' || NEW.title || '" is now ' || slot_text(NEW.start_date, NEW.due_date, NEW.start_time, NEW.end_time));
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- The new assignee hears from on_task_assigned.
    IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to IS DISTINCT FROM auth.uid() THEN
      INSERT INTO notifications (recipient_profile_id, type, entity_type, entity_id, title, body)
      VALUES (OLD.assigned_to, 'task_unassigned', 'task', NEW.id, 'Taken off a task',
        actor_name() || ' took you off "' || NEW.title || '"');
    END IF;
    SELECT split_part(full_name, ' ', 1) INTO new_name FROM profiles WHERE id = NEW.assigned_to;
    PERFORM notify_many('{}', false, 'task_reassigned', 'task', NEW.id, 'Reassigned',
      '"' || NEW.title || '" is now with ' || coalesce(new_name, 'nobody'),
      ARRAY[OLD.assigned_to, NEW.assigned_to]);
  END IF;
  RETURN NEW;
END;
$$;

-- BEFORE DELETE so the creatives are still there to be told.
CREATE OR REPLACE FUNCTION on_task_deleted_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_many(task_people(OLD.id), false, 'task_deleted', 'project', OLD.project_id, 'Task deleted',
    actor_name() || ' deleted "' || OLD.title || '"');
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_task_created_notify_trigger AFTER INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION on_task_created_notify();
CREATE TRIGGER on_task_changed_notify_trigger AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION on_task_changed_notify();
CREATE TRIGGER on_task_deleted_notify_trigger BEFORE DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION on_task_deleted_notify();

-- ---------------------------------------------------------------
-- Videos (task_deliverables) and their per-phase assignees
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_deliverable_stage_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  who UUID;
  stage_name TEXT;
  task_title TEXT;
BEGIN
  IF OLD.current_stage_id IS NOT DISTINCT FROM NEW.current_stage_id THEN RETURN NEW; END IF;
  SELECT assigned_to INTO who FROM task_deliverable_assignments
    WHERE deliverable_id = NEW.id AND stage_id = NEW.current_stage_id;
  IF who IS NULL OR who = auth.uid() THEN RETURN NEW; END IF;
  SELECT name INTO stage_name FROM department_stages WHERE id = NEW.current_stage_id;
  SELECT title INTO task_title FROM tasks WHERE id = NEW.task_id;
  INSERT INTO notifications (recipient_profile_id, type, entity_type, entity_id, title, body)
  VALUES (who, 'video_your_turn', 'task', NEW.task_id, 'Your turn',
    '"' || NEW.title || '" (' || task_title || ') is now in ' || stage_name);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION on_phase_assignment_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d task_deliverables%ROWTYPE;
  stage_name TEXT;
  task_title TEXT;
  what TEXT;
BEGIN
  IF NEW.assigned_to IS NULL OR NEW.assigned_to = auth.uid() THEN RETURN NEW; END IF;
  SELECT * INTO d FROM task_deliverables WHERE id = NEW.deliverable_id;
  SELECT name INTO stage_name FROM department_stages WHERE id = NEW.stage_id;
  SELECT title INTO task_title FROM tasks WHERE id = d.task_id;
  what := '"' || d.title || ' · ' || stage_name || '" (' || task_title || ')';
  IF TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO notifications (recipient_profile_id, type, entity_type, entity_id, title, body)
    VALUES (NEW.assigned_to, 'task_assigned', 'task', d.task_id, 'Assigned to you',
      actor_name() || ' gave you ' || what ||
      CASE WHEN NEW.scheduled_date IS NOT NULL THEN ' · ' || to_char(NEW.scheduled_date, 'FMDD Mon') ELSE '' END);
  ELSIF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN
    INSERT INTO notifications (recipient_profile_id, type, entity_type, entity_id, title, body)
    VALUES (NEW.assigned_to, 'task_dates_changed', 'task', d.task_id, 'Date changed',
      what || ' is now ' || coalesce(to_char(NEW.scheduled_date, 'FMDD Mon'), 'unscheduled'));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_deliverable_stage_notify_trigger AFTER UPDATE OF current_stage_id ON task_deliverables
  FOR EACH ROW EXECUTE FUNCTION on_deliverable_stage_notify();
CREATE TRIGGER on_phase_assignment_notify_trigger AFTER INSERT OR UPDATE ON task_deliverable_assignments
  FOR EACH ROW EXECUTE FUNCTION on_phase_assignment_notify();

-- ---------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_project_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  people UUID[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM notify_many('{}', false, 'project_created', 'project', NEW.id, 'New project',
      actor_name() || ' created "' || NEW.name || '"');
  ELSIF (OLD.name, OLD.description, OLD.start_date, OLD.target_end_date, OLD.status)
        IS DISTINCT FROM (NEW.name, NEW.description, NEW.start_date, NEW.target_end_date, NEW.status) THEN
    SELECT coalesce(array_agg(profile_id), '{}') INTO people FROM project_creatives WHERE project_id = NEW.id;
    PERFORM notify_many(people, false, 'project_updated', 'project', NEW.id, 'Project updated',
      actor_name() || ' updated "' || NEW.name || '"');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION on_project_creative_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pname TEXT;
BEGIN
  IF NEW.profile_id = auth.uid() THEN RETURN NEW; END IF;
  SELECT name INTO pname FROM projects WHERE id = NEW.project_id;
  INSERT INTO notifications (recipient_profile_id, type, entity_type, entity_id, title, body)
  VALUES (NEW.profile_id, 'project_assigned', 'project', NEW.project_id, 'Added to a project',
    actor_name() || ' added you to "' || pname || '"');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_notify_trigger AFTER INSERT OR UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION on_project_notify();
CREATE TRIGGER on_project_creative_added_trigger AFTER INSERT ON project_creatives
  FOR EACH ROW EXECUTE FUNCTION on_project_creative_added();

-- ---------------------------------------------------------------
-- Client approvals reach the executives too (the submitter already hears).
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION on_deliverable_revision_execs()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  del deliverables%ROWTYPE;
BEGIN
  SELECT * INTO del FROM deliverables WHERE id = NEW.deliverable_id;
  PERFORM notify_many('{}', true,
    CASE WHEN NEW.action = 'approve' THEN 'deliverable_approved' ELSE 'deliverable_revision' END,
    'deliverable', NEW.deliverable_id,
    CASE WHEN NEW.action = 'approve' THEN 'Client approved' ELSE 'Client wants changes' END,
    '"' || del.title || '"', ARRAY[del.submitted_by]);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_deliverable_revision_execs_trigger AFTER INSERT ON deliverable_revisions
  FOR EACH ROW EXECUTE FUNCTION on_deliverable_revision_execs();

-- ---------------------------------------------------------------
-- Mark done: finish the current step and move to the next stage.
-- ---------------------------------------------------------------

/**
 * For the task's assignee or an executive. Videos still at the task's stage
 * move on together; the task follows its least-advanced video. Returns the
 * task's new stage. The triggers above do the notifying.
 */
CREATE OR REPLACE FUNCTION complete_task_step(p_task_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t tasks%ROWTYPE;
  cur department_stages%ROWTYPE;
  nxt department_stages%ROWTYPE;
  target UUID;
BEGIN
  SELECT * INTO t FROM tasks WHERE id = p_task_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF NOT (current_user_type() = 'employee' AND (is_executive() OR t.assigned_to = auth.uid())) THEN
    RAISE EXCEPTION 'Only the person this task is assigned to can mark it done';
  END IF;

  SELECT * INTO cur FROM department_stages WHERE id = t.current_stage_id;
  IF cur.is_terminal THEN RAISE EXCEPTION 'This task is already done'; END IF;
  SELECT * INTO nxt FROM department_stages
    WHERE department_id = t.department_id AND position > cur.position
    ORDER BY position LIMIT 1;
  IF nxt.id IS NULL THEN RAISE EXCEPTION 'There is no next stage'; END IF;

  IF EXISTS (SELECT 1 FROM task_deliverables WHERE task_id = t.id) THEN
    UPDATE task_deliverables SET current_stage_id = nxt.id
      WHERE task_id = t.id AND current_stage_id = cur.id;
    SELECT s.id INTO target FROM task_deliverables d JOIN department_stages s ON s.id = d.current_stage_id
      WHERE d.task_id = t.id ORDER BY s.position LIMIT 1;
  ELSE
    target := nxt.id;
  END IF;

  UPDATE tasks SET current_stage_id = target WHERE id = t.id AND current_stage_id IS DISTINCT FROM target;
  RETURN (SELECT current_stage_id FROM tasks WHERE id = t.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION complete_task_step(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION complete_task_step(UUID) TO authenticated;

-- ---------------------------------------------------------------
-- Phone push: each pushable notification asks the send-push function to
-- deliver it. The request carries only the id (with the public anon key);
-- send-push loads the row itself and claims it via pushed_at, so a caller
-- can't push arbitrary text or push one twice.
-- ---------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION push_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://hlymjkqauershgkadtwk.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseW1qa3FhdWVyc2hna2FkdHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MzE2MDIsImV4cCI6MjA5NDUwNzYwMn0.uwveppaWQDilunspWpSGpre_1zM09Y5eyOtx3_cvAr8'
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER push_notification_trigger AFTER INSERT ON notifications
  FOR EACH ROW WHEN (NEW.push) EXECUTE FUNCTION push_notification();

REVOKE EXECUTE ON FUNCTION
  actor_name(), task_people(UUID), notify_many(UUID[], BOOLEAN, TEXT, TEXT, UUID, TEXT, TEXT, UUID[]),
  on_task_created_notify(), on_task_changed_notify(), on_task_deleted_notify(),
  on_deliverable_stage_notify(), on_phase_assignment_notify(), on_project_notify(),
  on_project_creative_added(), on_deliverable_revision_execs(), push_notification()
FROM PUBLIC, anon, authenticated;
