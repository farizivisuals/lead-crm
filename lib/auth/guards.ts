import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Employee, EmployeeRole } from "@/lib/types";

// Reads the user from the JWT (verified locally — no network round trip, unlike
// auth.getUser()). The proxy refreshes the session on every request, and real
// authorization lives in Postgres RLS. cache() dedupes across layout + page.
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return { id: claims.sub as string, email: claims.email as string | undefined };
});

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

// One profile+employee fetch per request, shared by every guard/layout/page.
const getEmployeeProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, employees(*, departments(name, slug))")
    .eq("id", userId)
    .single();
  return profile;
});

export async function requireEmployee(minRole?: EmployeeRole) {
  const user = await requireAuth();
  const profile = await getEmployeeProfile(user.id);

  if (!profile || profile.user_type !== "employee") redirect("/portal");

  // `employees` is embedded via a PK foreign key, so Supabase returns it as a
  // single object (one-to-one), not an array. Normalize for either shape.
  const employee = (Array.isArray(profile.employees)
    ? profile.employees[0]
    : profile.employees) as
    | (Employee & { departments?: { name: string; slug: string } | null })
    | undefined;

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

const getClientProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, client_contacts(*, clients(*))")
    .eq("id", userId)
    .single();
  return profile;
});

export async function requireClient() {
  const user = await requireAuth();
  const profile = await getClientProfile(user.id);

  if (!profile || profile.user_type !== "client") redirect("/admin/dashboard");

  return { user, profile };
}
