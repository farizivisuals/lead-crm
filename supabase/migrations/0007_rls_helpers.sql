-- Helper functions used in RLS policies

CREATE OR REPLACE FUNCTION current_employee_role()
RETURNS employee_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM employees WHERE profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_department_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM employees WHERE profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_user_type()
RETURNS user_type LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_type FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_root_or_exec()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_employee_role() IN ('root', 'ceo', 'cfo');
$$;

-- True if the calling user can see the project
CREATE OR REPLACE FUNCTION can_see_project(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects pr
    WHERE pr.id = p_project_id
    AND (
      -- Root/exec see all
      is_root_or_exec()
      -- Employee in a department assigned to this project
      OR EXISTS (
        SELECT 1 FROM project_departments pd
        WHERE pd.project_id = p_project_id
          AND pd.department_id = current_department_id()
      )
      -- Client contact for this project's client
      OR EXISTS (
        SELECT 1 FROM client_contacts cc
        WHERE cc.client_id = pr.client_id
          AND cc.profile_id = auth.uid()
      )
    )
  );
$$;
