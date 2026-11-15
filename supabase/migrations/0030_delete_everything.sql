-- =============================================================
-- 0030: Executives can delete clients, projects, tasks and employees.
--
-- Deleting an employee hands their open work to someone the executive picks
-- and keeps everything they did: the "who did it" columns below become empty
-- (shown as "Deleted employee") instead of blocking the delete or taking
-- comments and history with them.
--
-- Deleting a project or client sends one notice, not one per task.
-- =============================================================

ALTER TABLE tasks                        ALTER COLUMN created_by       DROP NOT NULL;
ALTER TABLE projects                     ALTER COLUMN created_by       DROP NOT NULL;
ALTER TABLE projects                     ALTER COLUMN owner_profile_id DROP NOT NULL;
ALTER TABLE clients                      ALTER COLUMN created_by       DROP NOT NULL;
ALTER TABLE quotes                       ALTER COLUMN created_by       DROP NOT NULL;
ALTER TABLE task_stage_history           ALTER COLUMN moved_by         DROP NOT NULL;
ALTER TABLE deliverables                 ALTER COLUMN submitted_by     DROP NOT NULL;
ALTER TABLE deliverable_revisions        ALTER COLUMN actor_profile_id DROP NOT NULL;
ALTER TABLE comments                     ALTER COLUMN author_profile_id DROP NOT NULL;
ALTER TABLE activity_log                 ALTER COLUMN actor_profile_id DROP NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT tasks_created_by_fkey,
  ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE projects DROP CONSTRAINT projects_created_by_fkey,
  ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE projects DROP CONSTRAINT projects_owner_profile_id_fkey,
  ADD CONSTRAINT projects_owner_profile_id_fkey FOREIGN KEY (owner_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE clients DROP CONSTRAINT clients_created_by_fkey,
  ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE quotes DROP CONSTRAINT quotes_created_by_fkey,
  ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE task_stage_history DROP CONSTRAINT task_stage_history_moved_by_fkey,
  ADD CONSTRAINT task_stage_history_moved_by_fkey FOREIGN KEY (moved_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE deliverables DROP CONSTRAINT deliverables_submitted_by_fkey,
  ADD CONSTRAINT deliverables_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE deliverable_revisions DROP CONSTRAINT deliverable_revisions_actor_profile_id_fkey,
  ADD CONSTRAINT deliverable_revisions_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE task_deliverable_assignments DROP CONSTRAINT task_deliverable_assignments_assigned_by_fkey,
  ADD CONSTRAINT task_deliverable_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE comments DROP CONSTRAINT comments_author_profile_id_fkey,
  ADD CONSTRAINT comments_author_profile_id_fkey FOREIGN KEY (author_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE activity_log DROP CONSTRAINT activity_log_actor_profile_id_fkey,
  ADD CONSTRAINT activity_log_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------
-- Quiet cascades
-- ---------------------------------------------------------------

-- A task removed because its project went: the project notice covers it.
CREATE OR REPLACE FUNCTION on_task_deleted_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id = OLD.project_id) THEN RETURN OLD; END IF;
  PERFORM notify_many(task_people(OLD.id), false, 'task_deleted', 'project', OLD.project_id, 'Task deleted',
    actor_name() || ' deleted "' || OLD.title || '"');
  RETURN OLD;
END;
$$;

-- A project removed because its client went needs no notice of its own.
CREATE OR REPLACE FUNCTION on_project_deleted_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  people UUID[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clients WHERE id = OLD.client_id) THEN RETURN OLD; END IF;
  SELECT coalesce(array_agg(profile_id), '{}') INTO people FROM project_creatives WHERE project_id = OLD.id;
  PERFORM notify_many(people, false, 'project_deleted', 'project', OLD.id, 'Project deleted',
    actor_name() || ' deleted "' || OLD.name || '"');
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_project_deleted_notify_trigger BEFORE DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION on_project_deleted_notify();

-- Same as 0029, except a task losing its assignee because that employee was
-- deleted says nothing (the employee is gone; telling them would fail).
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

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
     AND NOT (NEW.assigned_to IS NULL AND NOT EXISTS (SELECT 1 FROM employees WHERE profile_id = OLD.assigned_to)) THEN
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

-- ---------------------------------------------------------------
-- Delete an employee: hand over their open work, then remove the login
-- (which cascades profile → employee → memberships).
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_employee(p_profile_id UUID, p_handover UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ranks CONSTANT employee_role[] := ARRAY['employee', 'manager', 'cfo', 'ceo', 'root']::employee_role[];
  me employee_role := current_employee_role();
  target employee_role;
  moved INTEGER;
  open_ids UUID[];
BEGIN
  IF NOT is_executive() THEN RAISE EXCEPTION 'Only executives can delete employees'; END IF;
  IF p_profile_id = auth.uid() THEN RAISE EXCEPTION 'You cannot delete your own account'; END IF;
  SELECT role INTO target FROM employees WHERE profile_id = p_profile_id;
  IF target IS NULL THEN RAISE EXCEPTION 'Employee not found'; END IF;
  IF me <> 'root' AND array_position(ranks, me) <= array_position(ranks, target) THEN
    RAISE EXCEPTION 'You cannot delete an employee at or above your own rank';
  END IF;
  IF p_handover IS NULL OR p_handover = p_profile_id
     OR NOT EXISTS (SELECT 1 FROM employees WHERE profile_id = p_handover) THEN
    RAISE EXCEPTION 'Pick someone to take over their work';
  END IF;

  -- Open = the task isn't at its final stage. Finished work just loses its name.
  SELECT coalesce(array_agg(t.id), '{}') INTO open_ids
    FROM tasks t JOIN department_stages s ON s.id = t.current_stage_id WHERE NOT s.is_terminal;

  UPDATE tasks SET assigned_to = p_handover
    WHERE assigned_to = p_profile_id AND id = ANY (open_ids);
  GET DIAGNOSTICS moved = ROW_COUNT;

  UPDATE task_deliverable_assignments a SET assigned_to = p_handover
    FROM task_deliverables d
    WHERE a.deliverable_id = d.id AND a.assigned_to = p_profile_id AND d.task_id = ANY (open_ids);

  INSERT INTO task_creatives (task_id, profile_id)
    SELECT task_id, p_handover FROM task_creatives
    WHERE profile_id = p_profile_id AND task_id = ANY (open_ids)
    ON CONFLICT DO NOTHING;

  INSERT INTO project_creatives (project_id, profile_id)
    SELECT pc.project_id, p_handover FROM project_creatives pc JOIN projects p ON p.id = pc.project_id
    WHERE pc.profile_id = p_profile_id AND p.status NOT IN ('completed', 'cancelled', 'delivered')
    ON CONFLICT DO NOTHING;

  UPDATE projects SET owner_profile_id = p_handover WHERE owner_profile_id = p_profile_id;

  DELETE FROM auth.users WHERE id = p_profile_id;
  RETURN moved;
END;
$$;

-- ---------------------------------------------------------------
-- Delete a client: projects, quotes and contacts cascade; then the portal
-- logins go (never an employee's, should one ever be linked).
-- ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_client(p_client_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  logins UUID[];
BEGIN
  IF NOT is_executive() THEN RAISE EXCEPTION 'Only executives can delete clients'; END IF;
  SELECT array_agg(DISTINCT id) INTO logins FROM (
    SELECT primary_contact_profile_id AS id FROM clients WHERE id = p_client_id
    UNION SELECT profile_id FROM client_contacts WHERE client_id = p_client_id
  ) x;
  IF logins IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;

  DELETE FROM clients WHERE id = p_client_id;
  DELETE FROM auth.users u WHERE u.id = ANY (logins)
    AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.profile_id = u.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_employee(UUID, UUID), delete_client(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION delete_employee(UUID, UUID), delete_client(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION on_project_deleted_notify() FROM PUBLIC, anon, authenticated;
