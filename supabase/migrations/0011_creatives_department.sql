-- =============================================================
-- 0011: Add Creatives department with cross-department access
-- =============================================================

-- 1. Add can_add_clients capability flag to departments
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS can_add_clients BOOLEAN NOT NULL DEFAULT false;

-- 2. Create department cross-access table
--    Employees in source_department_id can see projects assigned to target_department_id
CREATE TABLE IF NOT EXISTS department_cross_access (
  source_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  target_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (source_department_id, target_department_id),
  CHECK (source_department_id <> target_department_id)
);

ALTER TABLE department_cross_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dept_cross_access_select" ON department_cross_access
  FOR SELECT TO authenticated
  USING (current_user_type() = 'employee');

CREATE POLICY "dept_cross_access_manage" ON department_cross_access
  FOR ALL TO authenticated
  USING (current_employee_role() = 'root')
  WITH CHECK (current_employee_role() = 'root');

-- 3. Insert Creatives department
INSERT INTO departments (name, slug, can_add_clients)
VALUES ('Creatives', 'creatives', true)
ON CONFLICT (slug) DO UPDATE SET can_add_clients = true;

-- 4. Cross-access: Creatives employees can see Photo and Video projects
INSERT INTO department_cross_access (source_department_id, target_department_id)
SELECT c.id, p.id
FROM departments c, departments p
WHERE c.slug = 'creatives' AND p.slug = 'photo'
ON CONFLICT DO NOTHING;

INSERT INTO department_cross_access (source_department_id, target_department_id)
SELECT c.id, v.id
FROM departments c, departments v
WHERE c.slug = 'creatives' AND v.slug = 'video'
ON CONFLICT DO NOTHING;

-- 5. Creatives department stages
WITH dept AS (SELECT id FROM departments WHERE slug = 'creatives')
INSERT INTO department_stages (department_id, name, position, is_terminal, color)
SELECT dept.id, stage.name, stage.pos, stage.terminal, stage.color
FROM dept, (VALUES
  ('Concept',         1, false, '#7c3aed'),
  ('Production',      2, false, '#8b5cf6'),
  ('Post-Production', 3, false, '#d946ef'),
  ('Delivered',       4, true,  '#22c55e')
) AS stage(name, pos, terminal, color)
ON CONFLICT (department_id, position) DO NOTHING;

-- 6. Update can_see_project() to honour cross-department access
CREATE OR REPLACE FUNCTION can_see_project(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects pr
    WHERE pr.id = p_project_id
    AND (
      is_root_or_exec()
      OR EXISTS (
        SELECT 1 FROM project_departments pd
        WHERE pd.project_id = p_project_id
          AND pd.department_id = current_department_id()
      )
      OR EXISTS (
        SELECT 1 FROM project_departments pd
        JOIN department_cross_access dca
          ON dca.target_department_id = pd.department_id
        WHERE pd.project_id = p_project_id
          AND dca.source_department_id = current_department_id()
      )
      OR EXISTS (
        SELECT 1 FROM client_contacts cc
        WHERE cc.client_id = pr.client_id
          AND cc.profile_id = auth.uid()
      )
    )
  );
$$;

-- 7. Update clients_select to include cross-department access
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated
  USING (
    is_root_or_exec()
    OR (
      current_user_type() = 'employee'
      AND EXISTS (
        SELECT 1 FROM projects p
        JOIN project_departments pd ON pd.project_id = p.id
        WHERE p.client_id = clients.id
          AND (
            pd.department_id = current_department_id()
            OR EXISTS (
              SELECT 1 FROM department_cross_access dca
              WHERE dca.source_department_id = current_department_id()
                AND dca.target_department_id = pd.department_id
            )
          )
      )
    )
    OR EXISTS (
      SELECT 1 FROM client_contacts cc
      WHERE cc.client_id = clients.id AND cc.profile_id = auth.uid()
    )
  );

-- 8. Allow departments with can_add_clients to INSERT new clients
CREATE POLICY "clients_insert_dept" ON clients FOR INSERT TO authenticated
  WITH CHECK (
    current_user_type() = 'employee'
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.profile_id = auth.uid() AND d.can_add_clients = true
    )
  );

-- 9. Allow departments with can_add_clients to INSERT client contacts
CREATE POLICY "client_contacts_insert_dept" ON client_contacts FOR INSERT TO authenticated
  WITH CHECK (
    current_user_type() = 'employee'
    AND EXISTS (
      SELECT 1 FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.profile_id = auth.uid() AND d.can_add_clients = true
    )
  );

-- 10. Update projects_manage so cross-access managers can manage Photo/Video projects
DROP POLICY IF EXISTS "projects_manage" ON projects;
CREATE POLICY "projects_manage" ON projects FOR ALL TO authenticated
  USING (
    is_root_or_exec()
    OR (
      current_employee_role() = 'manager'
      AND EXISTS (
        SELECT 1 FROM project_departments pd
        WHERE pd.project_id = id
          AND (
            pd.department_id = current_department_id()
            OR EXISTS (
              SELECT 1 FROM department_cross_access dca
              WHERE dca.source_department_id = current_department_id()
                AND dca.target_department_id = pd.department_id
            )
          )
      )
    )
  )
  WITH CHECK (
    is_root_or_exec()
    OR current_employee_role() = 'manager'
  );
