import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EmployeeRole } from "@/lib/types";

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireEmployee(minRole?: EmployeeRole) {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, employees(*)")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_type !== "employee") redirect("/portal");

  // `employees` is embedded via a PK foreign key, so Supabase returns it as a
  // single object (one-to-one), not an array. Normalize for either shape.
  const employee = (Array.isArray(profile.employees)
    ? profile.employees[0]
    : profile.employees) as { role?: EmployeeRole } | undefined;

  if (minRole) {
    const hierarchy: EmployeeRole[] = ["employee", "manager", "cfo", "ceo", "root"];
    const userLevel = hierarchy.indexOf(employee?.role ?? "employee");
    const requiredLevel = hierarchy.indexOf(minRole);
    if (userLevel < requiredLevel) redirect("/admin/dashboard");
  }

  return { user, profile, employee };
}

// Executive tier (root/ceo/cfo/manager) — full admin access.
export async function requireExecutive() {
  return requireEmployee("manager");
}

export async function requireClient() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, client_contacts(*, clients(*))")
    .eq("id", user.id)
    .single();

  if (!profile || profile.user_type !== "client") redirect("/admin/dashboard");

  return { user, profile };
}

export async function getSessionProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, employees(*)")
    .eq("id", user.id)
    .single();

  return profile;
}
