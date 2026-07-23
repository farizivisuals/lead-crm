"use server";
import { headers } from "next/headers";
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

// A caller may only act on themselves or an employee they outrank (root can
// act on anyone) — otherwise a manager could reset the root password or
// change a superior's email and take over the account. Self-edits are safe:
// role changes are still capped by canAssignRole.
async function requireOutranks(callerId: string, callerRole: EmployeeRole, targetProfileId: string) {
  if (callerId === targetProfileId) return { error: null };
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("employees").select("role").eq("profile_id", targetProfileId).single();
  if (!target) return { error: "Employee not found" as const };
  if (callerRole !== "root" && roleLevel(callerRole) <= roleLevel(target.role as EmployeeRole)) {
    return { error: "You cannot manage an employee at or above your own rank" as const };
  }
  return { error: null };
}

export async function getEmployeeEmail(profileId: string) {
  const { error, user, role } = await requireExec();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };
  const rankError = await requireOutranks(user.id, role, profileId);
  if (rankError.error) return { error: rankError.error };
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
  const rankError = await requireOutranks(user.id, role, profileId);
  if (rankError.error) return { error: rankError.error };
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

export async function deleteEmployee(profileId: string) {
  const { error, user, role } = await requireExec();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };
  if (user.id === profileId) return { error: "You cannot delete your own account" };
  const rankError = await requireOutranks(user.id, role, profileId);
  if (rankError.error) return { error: rankError.error };
  const admin = createAdminClient();

  // Cascades auth.users → profiles → employees. Fails (FK restrict) if they
  // still own projects/tasks/etc — surfaced to the caller rather than
  // silently orphaning records.
  const { error: delError } = await admin.auth.admin.deleteUser(profileId);
  if (delError) return { error: delError.message };

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

export async function getEmployeeLoginLink(profileId: string) {
  const { error, user, role } = await requireExec();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };
  const rankError = await requireOutranks(user.id, role, profileId);
  if (rankError.error) return { error: rankError.error };
  const admin = createAdminClient();

  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError || !authUser.user.email) return { error: "User not found" };

  const { data, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });
  if (linkError) return { error: linkError.message };

  // Built from hashed_token (not action_link) so link-preview bots can't
  // consume the one-time token; verified client-side on /auth/callback.
  // Lands on /update-password, which routes employees to /admin/dashboard.
  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const setupLink = `${origin}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&next=/update-password`;

  return {
    message: [
      "Welcome to the lead. dashboard!",
      "",
      "1. Click this one-time link to create your password:",
      setupLink,
      "",
      `2. After that, log in anytime at ${origin}/login using your email (${authUser.user.email}) and your new password.`,
    ].join("\n"),
  };
}

export async function resetEmployeePassword(profileId: string) {
  const { error, user, role } = await requireExec();
  if (error || !user || !role) return { error: error ?? "Unauthorized" };
  const rankError = await requireOutranks(user.id, role, profileId);
  if (rankError.error) return { error: rankError.error };
  const admin = createAdminClient();

  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError || !authUser.user.email) return { error: "User not found" };

  const password = generatePassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(profileId, { password });
  if (updateError) return { error: updateError.message };

  return { email: authUser.user.email, password };
}
