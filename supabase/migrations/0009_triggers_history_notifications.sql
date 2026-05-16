-- Auto-log task stage history when current_stage_id changes
CREATE OR REPLACE FUNCTION log_task_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id THEN
    INSERT INTO task_stage_history (task_id, from_stage_id, to_stage_id, moved_by)
    VALUES (NEW.id, OLD.current_stage_id, NEW.current_stage_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_stage_changed
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_stage_change();

-- Notification helpers
CREATE OR REPLACE FUNCTION notify_user(
  p_recipient UUID,
  p_type      TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_title     TEXT,
  p_body      TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_recipient IS NOT NULL AND p_recipient != auth.uid() THEN
    INSERT INTO notifications (recipient_profile_id, type, entity_type, entity_id, title, body)
    VALUES (p_recipient, p_type, p_entity_type, p_entity_id, p_title, p_body);
  END IF;
END;
$$;

-- Notify assignee when a task is assigned / reassigned
CREATE OR REPLACE FUNCTION on_task_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assigner_name TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    SELECT full_name INTO assigner_name FROM profiles WHERE id = auth.uid();
    PERFORM notify_user(
      NEW.assigned_to,
      'task_assigned',
      'task',
      NEW.id,
      'Task assigned to you',
      assigner_name || ' assigned "' || NEW.title || '" to you'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_assigned_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION on_task_assigned();

-- Notify submitter when deliverable status changes (e.g. client approved)
CREATE OR REPLACE FUNCTION on_deliverable_revision_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor_name TEXT;
  del_title  TEXT;
  submitter  UUID;
BEGIN
  SELECT full_name INTO actor_name FROM profiles WHERE id = NEW.actor_profile_id;
  SELECT title, submitted_by INTO del_title, submitter FROM deliverables WHERE id = NEW.deliverable_id;

  IF NEW.action = 'approve' THEN
    PERFORM notify_user(
      submitter,
      'deliverable_approved',
      'deliverable',
      NEW.deliverable_id,
      'Deliverable approved',
      actor_name || ' approved "' || del_title || '"'
    );
  ELSE
    PERFORM notify_user(
      submitter,
      'deliverable_revision',
      'deliverable',
      NEW.deliverable_id,
      'Revision requested',
      actor_name || ' requested changes on "' || del_title || '"'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_deliverable_revision_notify_trigger
  AFTER INSERT ON deliverable_revisions
  FOR EACH ROW EXECUTE FUNCTION on_deliverable_revision_notify();

-- Notify project owner when a comment is added
CREATE OR REPLACE FUNCTION on_comment_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor_name   TEXT;
  owner_id     UUID;
  entity_label TEXT;
BEGIN
  SELECT full_name INTO actor_name FROM profiles WHERE id = NEW.author_profile_id;

  IF NEW.entity_type = 'project' THEN
    SELECT owner_profile_id INTO owner_id FROM projects WHERE id = NEW.entity_id;
    entity_label := 'project';
  ELSIF NEW.entity_type = 'task' THEN
    SELECT p.owner_profile_id INTO owner_id
    FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = NEW.entity_id;
    entity_label := 'task';
  ELSE
    entity_label := 'deliverable';
  END IF;

  PERFORM notify_user(
    owner_id,
    'comment_added',
    NEW.entity_type,
    NEW.entity_id,
    'New comment',
    actor_name || ' commented on a ' || entity_label
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_notify_trigger
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION on_comment_notify();
