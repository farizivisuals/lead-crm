export type UserType = "employee" | "client";
export type EmployeeRole = "root" | "ceo" | "cfo" | "manager" | "employee";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type DeliverableType = "photo" | "video" | "pr";
export type DeliverableStatus =
  | "draft"
  | "internal_review"
  | "client_review"
  | "approved"
  | "revision_requested";
export type RevisionAction = "approve" | "request_revision";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  user_type: UserType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface DepartmentStage {
  id: string;
  department_id: string;
  name: string;
  position: number;
  is_terminal: boolean;
  color: string | null;
}

export interface Employee {
  profile_id: string;
  role: EmployeeRole;
  department_id: string | null;
  title: string | null;
  profiles?: Profile;
  departments?: Department;
}

export interface Client {
  id: string;
  company_name: string;
  primary_contact_profile_id: string;
  phone: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  profiles?: Profile;
}

export interface ClientContact {
  id: string;
  client_id: string;
  profile_id: string;
  role: string;
  profiles?: Profile;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  owner_profile_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  clients?: Client;
  profiles?: Profile;
  project_departments?: ProjectDepartment[];
}

export interface ProjectDepartment {
  project_id: string;
  department_id: string;
  is_primary: boolean;
  departments?: Department;
}

export interface Task {
  id: string;
  project_id: string;
  department_id: string;
  current_stage_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  department_stages?: DepartmentStage;
  departments?: Department;
  employees?: { profiles?: Profile };
}

export interface TaskStageHistory {
  id: string;
  task_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  moved_by: string;
  moved_at: string;
  note: string | null;
  from_stage?: DepartmentStage;
  to_stage?: DepartmentStage;
  profiles?: Profile;
}

export interface Deliverable {
  id: string;
  project_id: string;
  task_id: string | null;
  type: DeliverableType;
  title: string;
  dropbox_url: string;
  thumbnail_url: string | null;
  version: number;
  status: DeliverableStatus;
  submitted_by: string;
  submitted_at: string;
  created_at: string;
  projects?: Project;
  profiles?: Profile;
}

export interface DeliverableRevision {
  id: string;
  deliverable_id: string;
  actor_profile_id: string;
  action: RevisionAction;
  note: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface Comment {
  id: string;
  entity_type: "project" | "task" | "deliverable";
  entity_id: string;
  author_profile_id: string;
  body: string;
  is_client_visible: boolean;
  created_at: string;
  profiles?: Profile;
}

export interface Notification {
  id: string;
  recipient_profile_id: string;
  type: string;
  entity_type: string;
  entity_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  actor_profile_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profiles?: Profile;
}

export interface CalendarEvent {
  id: string;
  entity_type: "task" | "project" | "deliverable";
  entity_id: string;
  title: string;
  start: string;
  end: string | null;
  color: string;
  department_id: string | null;
  client_id: string | null;
  project_id: string | null;
}
