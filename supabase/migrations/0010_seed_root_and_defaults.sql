-- Seed default departments
INSERT INTO departments (name, slug) VALUES
  ('Video', 'video'),
  ('Photo', 'photo'),
  ('PR', 'pr')
ON CONFLICT (slug) DO NOTHING;

-- Seed default stages per department
-- Video stages
WITH dept AS (SELECT id FROM departments WHERE slug = 'video')
INSERT INTO department_stages (department_id, name, position, is_terminal, color)
SELECT dept.id, stage.name, stage.pos, stage.terminal, stage.color
FROM dept, (VALUES
  ('Pre-production', 1, false, '#6366f1'),
  ('Shoot',         2, false, '#8b5cf6'),
  ('Post-production',3,false, '#a78bfa'),
  ('Delivered',     4, true,  '#22c55e')
) AS stage(name, pos, terminal, color)
ON CONFLICT (department_id, position) DO NOTHING;

-- Photo stages
WITH dept AS (SELECT id FROM departments WHERE slug = 'photo')
INSERT INTO department_stages (department_id, name, position, is_terminal, color)
SELECT dept.id, stage.name, stage.pos, stage.terminal, stage.color
FROM dept, (VALUES
  ('Pre-shoot', 1, false, '#ec4899'),
  ('Shoot',     2, false, '#f472b6'),
  ('Editing',   3, false, '#fb7185'),
  ('Delivered', 4, true,  '#22c55e')
) AS stage(name, pos, terminal, color)
ON CONFLICT (department_id, position) DO NOTHING;

-- PR stages
WITH dept AS (SELECT id FROM departments WHERE slug = 'pr')
INSERT INTO department_stages (department_id, name, position, is_terminal, color)
SELECT dept.id, stage.name, stage.pos, stage.terminal, stage.color
FROM dept, (VALUES
  ('Drafting',         1, false, '#f59e0b'),
  ('Internal Review',  2, false, '#fbbf24'),
  ('Distribution',     3, false, '#fcd34d'),
  ('Reporting',        4, true,  '#22c55e')
) AS stage(name, pos, terminal, color)
ON CONFLICT (department_id, position) DO NOTHING;

-- NOTE: Root user must be created manually:
-- 1. Sign up via Supabase Auth (dashboard or admin API) with your email
-- 2. Then run:
--   INSERT INTO employees (profile_id, role) VALUES ('<your-auth-uid>', 'root');
-- A CLAUDE.md comment in the project documents this bootstrap step.
