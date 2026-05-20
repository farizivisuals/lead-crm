import type { EmployeeRole } from "@/lib/types";

const HIERARCHY: EmployeeRole[] = ["employee", "manager", "cfo", "ceo", "root"];

export function roleLevel(role: EmployeeRole): number {
  return HIERARCHY.indexOf(role);
}

export function hasMinRole(userRole: EmployeeRole, minRole: EmployeeRole): boolean {
  return roleLevel(userRole) >= roleLevel(minRole);
}

export function isExec(role: EmployeeRole): boolean {
  return hasMinRole(role, "cfo");
}

export function canManageClients(role: EmployeeRole): boolean {
  return hasMinRole(role, "manager");
}

export function canManageTeam(role: EmployeeRole): boolean {
  return role === "root";
}

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  root: "Root Admin",
  ceo: "CEO",
  cfo: "CFO",
  manager: "Department Manager",
  employee: "Employee",
};

export const DELIVERABLE_TYPE_LABELS = {
  photo: "Photography",
  video: "Video",
  pr: "PR",
} as const;

export const DELIVERABLE_STATUS_LABELS = {
  draft: "Draft",
  internal_review: "Internal Review",
  client_review: "Client Review",
  approved: "Approved",
  revision_requested: "Revision Requested",
} as const;

export const PROJECT_STATUS_LABELS = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  delivered: "Delivered",
} as const;

export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const;

export const DEPT_COLORS: Record<string, string> = {
  video: "#6366f1",
  photo: "#ec4899",
  pr: "#f59e0b",
};
