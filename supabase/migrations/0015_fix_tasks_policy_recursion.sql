-- =============================================================
-- 0015: Fix infinite recursion between tasks and task_creatives RLS
-- =============================================================
-- tasks_select (0014) had a subquery on task_creatives, and
-- task_creatives_select (0012) has a subquery on tasks. Policy-level
-- subqueries run as the calling user (RLS applies), so the two policies
-- referenced each other endlessly. We move the task_creatives lookup into
-- a SECURITY DEFINER helper (runs as postgres / BYPASSRLS), breaking the loop.

CREATE OR REPLACE FUNCTION is_task_creative(p_task_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_creatives tc
    WHERE tc.task_id = p_task_id AND tc.profile_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
  USING (
    -- Clients keep portal timeline visibility for their own projects
    (current_user_type() = 'client' AND can_see_project(project_id))
    OR (
      current_user_type() = 'employee'
      AND (
        -- Executives and creatives see all tasks in projects they can see
        ((is_executive() OR is_creative()) AND can_see_project(project_id))
        -- Team members see only the tasks assigned to them
        OR assigned_to = auth.uid()
        OR is_task_creative(id)
      )
    )
  );
