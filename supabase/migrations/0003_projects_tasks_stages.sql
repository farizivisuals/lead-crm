-- Department stages (configurable per department)
CREATE TABLE department_stages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  position      INTEGER NOT NULL,
  is_terminal   BOOLEAN NOT NULL DEFAULT false,
  color         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, position)
);

ALTER TABLE department_stages ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE TABLE projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  status            project_status NOT NULL DEFAULT 'planning',
  start_date        DATE,
  target_end_date   DATE,
  owner_profile_id  UUID NOT NULL REFERENCES profiles(id),
  created_by        UUID NOT NULL REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Project <-> Department join (enables cross-dept visibility)
CREATE TABLE project_departments (
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (project_id, department_id)
);

ALTER TABLE project_departments ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  department_id    UUID NOT NULL REFERENCES departments(id),
  current_stage_id UUID NOT NULL REFERENCES department_stages(id),
  title            TEXT NOT NULL,
  description      TEXT,
  priority         task_priority NOT NULL DEFAULT 'medium',
  start_date       DATE,
  due_date         DATE,
  assigned_to      UUID REFERENCES employees(profile_id) ON DELETE SET NULL,
  created_by       UUID NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Task stage history (audit trail)
CREATE TABLE task_stage_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_stage_id UUID REFERENCES department_stages(id),
  to_stage_id   UUID NOT NULL REFERENCES department_stages(id),
  moved_by      UUID NOT NULL REFERENCES profiles(id),
  moved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  note          TEXT
);

ALTER TABLE task_stage_history ENABLE ROW LEVEL SECURITY;

-- Task checklist items
CREATE TABLE task_checklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  is_done    BOOLEAN NOT NULL DEFAULT false,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;
