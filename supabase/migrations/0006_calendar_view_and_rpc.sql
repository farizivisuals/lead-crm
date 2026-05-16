-- Calendar events view — unions tasks, projects, and deliverables
CREATE OR REPLACE VIEW calendar_events AS
  -- Tasks
  SELECT
    t.id                                        AS entity_id,
    'task'::TEXT                                AS entity_type,
    t.title,
    t.start_date::TEXT                          AS start,
    t.due_date::TEXT                            AS "end",
    COALESCE(ds.color, '#6366f1')              AS color,
    t.department_id,
    p.client_id,
    t.project_id
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN department_stages ds ON ds.id = t.current_stage_id
  WHERE t.start_date IS NOT NULL OR t.due_date IS NOT NULL

  UNION ALL

  -- Projects
  SELECT
    p.id,
    'project',
    p.name,
    p.start_date::TEXT,
    p.target_end_date::TEXT,
    '#10b981',
    NULL,
    p.client_id,
    p.id
  FROM projects p
  WHERE p.start_date IS NOT NULL OR p.target_end_date IS NOT NULL

  UNION ALL

  -- Deliverables submitted for client review
  SELECT
    d.id,
    'deliverable',
    d.title,
    d.submitted_at::TEXT,
    NULL,
    '#f59e0b',
    NULL,
    p.client_id,
    d.project_id
  FROM deliverables d
  JOIN projects p ON p.id = d.project_id
  WHERE d.status IN ('client_review', 'approved', 'revision_requested');

-- RPC to get calendar events with date range filter (RLS applied via underlying tables)
CREATE OR REPLACE FUNCTION get_calendar_events(
  p_start DATE DEFAULT NULL,
  p_end   DATE DEFAULT NULL
)
RETURNS TABLE (
  entity_id   UUID,
  entity_type TEXT,
  title       TEXT,
  start       TEXT,
  "end"       TEXT,
  color       TEXT,
  department_id UUID,
  client_id   UUID,
  project_id  UUID
)
LANGUAGE sql SECURITY INVOKER AS $$
  SELECT * FROM calendar_events
  WHERE (p_start IS NULL OR "end"::DATE >= p_start OR start::DATE >= p_start)
    AND (p_end   IS NULL OR start::DATE <= p_end);
$$;
