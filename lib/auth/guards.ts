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

  if (minRole) {
    const hierarchy: EmployeeRole[] = ["employee", "manager", "cfo", "ceo", "root"];
    const userLevel = hierarchy.indexOf(profile.employees?.[0]?.role ?? "employee");
    const requiredLevel = hierarchy.indexOf(minRole);
    if (userLevel < requiredLevel) redirect("/admin/dashboard");
  }

  return { user, profile, employee: profile.employees?.[0] };
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
