-- Departments
CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Employees
CREATE TABLE employees (
  profile_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role          employee_role NOT NULL DEFAULT 'employee',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  title         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Clients
CREATE TABLE clients (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name               TEXT NOT NULL,
  primary_contact_profile_id UUID NOT NULL REFERENCES profiles(id),
  phone                      TEXT,
  notes                      TEXT,
  created_by                 UUID NOT NULL REFERENCES profiles(id),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Client contacts (additional portal users per client company)
CREATE TABLE client_contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'viewer', -- 'owner' | 'viewer'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, profile_id)
);

ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
