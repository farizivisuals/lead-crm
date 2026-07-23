-- =============================================================
-- 0019: Employees can belong to multiple departments
-- =============================================================
-- Replaces employees.department_id with an employee_departments
-- junction table. Backfills existing memberships, rewrites the two
-- places that still referenced the single column (stages_manage,
-- is_creative), then drops the column and its helper.

CREATE TABLE employee_departments (
  profile_id    UUID NOT NULL REFERENCES employees(profile_id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, department_id)
);

ALTER TABLE employee_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_departments_select" ON employee_departments
  FOR SELECT TO authenticated
  USING (current_user_type() = 'employee');

-- Mirrors employees_manage (0016): the executive tier manages memberships
CREATE POLICY "employee_departments_manage" ON employee_departments
  FOR ALL TO authenticated
  USING (is_executive())
  WITH CHECK (is_executive());

-- Backfill current single-department memberships
INSERT INTO employee_departments (profile_id, department_id)
SELECT profile_id, department_id FROM employees WHERE department_id IS NOT NULL;

-- Membership test for policies
CREATE OR REPLACE FUNCTION in_department(p_department_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM employee_departments
    WHERE profile_id = auth.uid() AND department_id = p_department_id
  );
$$;
REVOKE EXECUTE ON FUNCTION in_department(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION in_department(UUID) TO authenticated;

-- Managers can manage stages of any department they belong to
DROP POLICY IF EXISTS "stages_manage" ON department_stages;
CREATE POLICY "stages_manage" ON department_stages FOR ALL TO authenticated
  USING (
    current_employee_role() = 'root'
    OR (current_employee_role() = 'manager' AND in_department(department_id))
  )
  WITH CHECK (
    current_employee_role() = 'root'
    OR (current_employee_role() = 'manager' AND in_department(department_id))
  );

-- Creative = role 'employee' with membership in the creatives department
CREATE OR REPLACE FUNCTION is_creative()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM employee_departments ed
    JOIN employees e ON e.profile_id = ed.profile_id
    JOIN departments d ON d.id = ed.department_id
    WHERE ed.profile_id = auth.uid()
      AND e.role = 'employee'
      AND d.slug = 'creatives'
  );
$$;

-- Single-department era leftovers
DROP FUNCTION IF EXISTS current_department_id();
ALTER TABLE employees DROP COLUMN department_id;
