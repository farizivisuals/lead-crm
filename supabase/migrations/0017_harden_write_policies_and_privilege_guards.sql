-- =============================================================
-- 0017: Close broken-access-control gaps found in security audit
-- =============================================================
-- C2: block self-escalation via profiles.user_type / is_active
-- C3: enforce the client revision cap + status guard in the DB, not just the UI
-- H2: scope quote_line_items writes to the parent quote's owner/exec
-- M1: checklist writes must respect project visibility (SELECT already does)
-- M2: comment inserts must respect entity visibility (SELECT already does)
-- M3: tasks/deliverables UPDATE need an explicit WITH CHECK, not just USING
-- M4: client_contacts SELECT scoped to assigned projects, not all employees

-- -------------------------------------------------------------
-- C2. profiles: prevent changing user_type/is_active except via an
-- executive session or a service-role/SQL-editor context (auth.uid() IS NULL
-- there, matching the bootstrap flow documented in CLAUDE.md).
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_profile_privilege_columns()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.user_type IS DISTINCT FROM OLD.user_type OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND auth.uid() IS NOT NULL
     AND NOT is_executive()
  THEN
    RAISE EXCEPTION 'Not authorized to change user_type or is_active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privilege_columns ON profiles;
CREATE TRIGGER profiles_guard_privilege_columns BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_privilege_columns();

-- -------------------------------------------------------------
-- C3. deliverable_revisions: only allow revisions while the deliverable is
-- actually in client_review, and cap request_revision at 2 (mirrors
-- REVISION_LIMIT in ClientRevisionForm.tsx — bump both if the cap changes).
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_deliverable_revision()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status deliverable_status;
  v_revision_count INT;
BEGIN
  SELECT status INTO v_status FROM deliverables WHERE id = NEW.deliverable_id;

  IF v_status IS DISTINCT FROM 'client_review' THEN
    RAISE EXCEPTION 'Deliverable is not awaiting client review';
  END IF;

  IF NEW.action = 'request_revision' THEN
    SELECT count(*) INTO v_revision_count
    FROM deliverable_revisions
    WHERE deliverable_id = NEW.deliverable_id AND action = 'request_revision';

    IF v_revision_count >= 2 THEN
      RAISE EXCEPTION 'Revision limit reached for this deliverable';
    END IF;
  END IF;

  UPDATE deliverables
  SET status = CASE NEW.action
    WHEN 'approve' THEN 'approved'::deliverable_status
    WHEN 'request_revision' THEN 'revision_requested'::deliverable_status
  END,
  updated_at = now()
  WHERE id = NEW.deliverable_id;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------
-- H2. quote_line_items: writes scoped to the parent quote's owner/exec,
-- matching the quotes table's own update/delete policies (0013).
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "employees_insert_line_items" ON quote_line_items;
CREATE POLICY "employees_insert_line_items" ON quote_line_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.created_by = auth.uid() OR current_employee_role() IN ('root', 'ceo', 'cfo'))
    )
  );

DROP POLICY IF EXISTS "employees_update_line_items" ON quote_line_items;
CREATE POLICY "employees_update_line_items" ON quote_line_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.created_by = auth.uid() OR current_employee_role() IN ('root', 'ceo', 'cfo'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.created_by = auth.uid() OR current_employee_role() IN ('root', 'ceo', 'cfo'))
    )
  );

DROP POLICY IF EXISTS "employees_delete_line_items" ON quote_line_items;
CREATE POLICY "employees_delete_line_items" ON quote_line_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.created_by = auth.uid() OR current_employee_role() IN ('root', 'ceo', 'cfo'))
    )
  );

-- -------------------------------------------------------------
-- M1. task_checklist_items: writes must respect project visibility, same as
-- checklist_select already does.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "checklist_manage" ON task_checklist_items;
CREATE POLICY "checklist_manage" ON task_checklist_items FOR ALL TO authenticated
  USING (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  )
  WITH CHECK (
    current_user_type() = 'employee'
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

-- -------------------------------------------------------------
-- M2. comments: inserts must respect entity visibility, same as
-- comments_select already does (0014).
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "comments_insert" ON comments;
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated
  WITH CHECK (
    author_profile_id = auth.uid()
    AND (
      (entity_type = 'project' AND can_see_project(entity_id))
      OR (entity_type = 'task' AND EXISTS (
        SELECT 1 FROM tasks t WHERE t.id = entity_id AND can_see_project(t.project_id)
      ))
      OR (entity_type = 'deliverable' AND EXISTS (
        SELECT 1 FROM deliverables d WHERE d.id = entity_id AND can_see_project(d.project_id)
      ))
    )
  );

-- -------------------------------------------------------------
-- M3. tasks/deliverables UPDATE: add the WITH CHECK that was missing
-- (Postgres otherwise reuses USING, which doesn't validate the new row).
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks FOR UPDATE TO authenticated
  USING (
    current_user_type() = 'employee'
    AND (is_executive() OR assigned_to = auth.uid())
  )
  WITH CHECK (
    current_user_type() = 'employee'
    AND (is_executive() OR assigned_to = auth.uid())
  );

DROP POLICY IF EXISTS "deliverables_update" ON deliverables;
CREATE POLICY "deliverables_update" ON deliverables FOR UPDATE TO authenticated
  USING (
    is_executive()
    OR (is_creative() AND can_see_project(project_id))
  )
  WITH CHECK (
    is_executive()
    OR (is_creative() AND can_see_project(project_id))
  );

-- -------------------------------------------------------------
-- Low-severity consistency fixes found alongside the above.
-- -------------------------------------------------------------
-- comments_update_own had no WITH CHECK, so an owner could retarget their own
-- comment to a different entity_id/entity_type/is_client_visible.
DROP POLICY IF EXISTS "comments_update_own" ON comments;
CREATE POLICY "comments_update_own" ON comments FOR UPDATE TO authenticated
  USING (author_profile_id = auth.uid())
  WITH CHECK (author_profile_id = auth.uid());

-- task_history_insert had no project-visibility check, allowing an employee
-- to forge stage-history rows for tasks in projects they can't see.
DROP POLICY IF EXISTS "task_history_insert" ON task_stage_history;
CREATE POLICY "task_history_insert" ON task_stage_history FOR INSERT TO authenticated
  WITH CHECK (
    current_user_type() = 'employee'
    AND moved_by = auth.uid()
    AND EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND can_see_project(t.project_id))
  );

-- -------------------------------------------------------------
-- M4. client_contacts: scope employee visibility to assigned projects,
-- matching the assignment-based model introduced in 0014.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "client_contacts_select" ON client_contacts;
CREATE POLICY "client_contacts_select" ON client_contacts FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid()
    OR is_executive()
    OR (
      current_user_type() = 'employee'
      AND EXISTS (
        SELECT 1 FROM projects p
        WHERE p.client_id = client_contacts.client_id AND can_see_project(p.id)
      )
    )
  );
