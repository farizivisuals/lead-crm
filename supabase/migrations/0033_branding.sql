-- =============================================================
-- 0033: Branding department
--
-- Nobody belongs to Branding. Graphic designers do Branding projects: they
-- are the project's people (project_creatives) instead of creatives, and they
-- take its tasks. That rule lives in lib/graphics.ts (staffSlug,
-- projectPeople); existing policies already cover it, since visibility comes
-- from project_creatives and task assignment, not department membership.
-- Stages follow the Graphic Design flow (no automatic dates); edit them in
-- Settings → Departments.
-- =============================================================

INSERT INTO departments (name, slug) VALUES ('Branding', 'branding')
ON CONFLICT (slug) DO NOTHING;

-- Blue family, dark -> light by position; the done stage gets its own green.
WITH dept AS (SELECT id FROM departments WHERE slug = 'branding')
INSERT INTO department_stages (department_id, name, position, is_terminal, color)
SELECT dept.id, s.name, s.pos, s.terminal, s.color
FROM dept, (VALUES
  ('Assigned',     1, false, '#1d4ed8'),
  ('Consultation', 2, false, '#2563eb'),
  ('Moodboard',    3, false, '#3b82f6'),
  ('In Process',   4, false, '#60a5fa'),
  ('Submission',   5, true,  '#4ade80')
) AS s(name, pos, terminal, color)
ON CONFLICT (department_id, position) DO NOTHING;
