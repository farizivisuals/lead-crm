"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePassword } from "@/lib/utils";
import { roleLevel } from "@/lib/rbac";
import type { EmployeeRole } from "@/lib/types";

const EXECUTIVE_ROLES = ["root", "ceo", "cfo", "manager"];

async function requireExec() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, user: null, role: null, supabase: null };
  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user.id).single();
  if (!emp || !EXECUTIVE_ROLES.includes(emp.role)) {
    return { error: "Only executives can perform this action" as const, user: null, role: null, supabase: null };
  }
  return { error: null, user, role: emp.role as EmployeeRole, supabase };
}

// A caller may only grant a role at or below their own level — otherwise a
// manager could mint/elevate a peer straight to root.
function canAssignRole(callerRole: EmployeeRole, targetRole: EmployeeRole) {
  return roleLevel(callerRole) >= roleLevel(targetRole);
}

export async function getEmployeeEmail(profileId: string) {
  const { error, user } = await requireExec();
  if (error || !user) return { error: error ?? "Unauthorized" };
  const admin = createAdminClient();
  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(profileId);
  if (authError) return { error: authError.message };
  return { email: authUser.user.email ?? "" };
}

export async function updateEmployee(profileId: string, input: {
  full_name: string;
  email: string;
  role: EmployeeRole;
  department_id: string;
  title: string;
}) {
  const { error, user, role } = await requireExec();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };
  if (!canAssignRole(role, input.role)) {
    return { error: "You cannot assign a role higher than your own" };
  }
  const admin = createAdminClient();

  const { error: authError } = await admin.auth.admin.updateUserById(profileId, {
    email: input.email,
    user_metadata: { full_name: input.full_name },
  });
  if (authError) return { error: authError.message };

  const { error: profileError } = await admin.from("profiles").update({ full_name: input.full_name }).eq("id", profileId);
  if (profileError) return { error: profileError.message };

  const { error: empError } = await admin.from("employees").update({
    role: input.role,
    department_id: input.department_id || null,
    title: input.title || null,
  }).eq("profile_id", profileId);
  if (empError) return { error: empError.message };

  revalidatePath("/admin/team");
  return { success: true };
}

export async function addEmployee(input: {
  full_name: string;
  email: string;
  role: EmployeeRole;
  department_id: string;
  title: string;
}) {
  const { error, user, role } = await requireExec();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };
  if (!canAssignRole(role, input.role)) {
    return { error: "You cannot assign a role higher than your own" };
  }

  const admin = createAdminClient();
  const password = generatePassword();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, user_type: "employee" },
  });
  if (authError) return { error: authError.message };

  const newUserId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: newUserId,
    full_name: input.full_name,
    user_type: "employee",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(newUserId);
    return { error: profileError.message };
  }

  const { error: empError } = await admin.from("employees").insert({
    profile_id: newUserId,
    role: input.role,
    department_id: input.department_id || null,
    title: input.title || null,
  });
  if (empError) {
    await admin.auth.admin.deleteUser(newUserId);
    return { error: empError.message };
  }

  revalidatePath("/admin/team");
  return { email: input.email, password };
}

export async function resetEmployeePassword(profileId: string) {
  const { error, user } = await requireExec();
  if (error || !user) return { error: error ?? "Unauthorized" };
  const admin = createAdminClient();

  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError || !authUser.user.email) return { error: "User not found" };

  const password = generatePassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(profileId, { password });
  if (updateError) return { error: updateError.message };

  return { email: authUser.user.email, password };
}
