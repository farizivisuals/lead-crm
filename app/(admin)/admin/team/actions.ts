"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePassword } from "@/lib/utils";
import type { EmployeeRole } from "@/lib/types";

export async function addEmployee(input: {
  full_name: string;
  email: string;
  role: EmployeeRole;
  department_id: string;
  title: string;
}) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user.id).single();
  if (emp?.role !== "root") return { error: "Only root can add employees" };

  const password = generatePassword();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, user_type: "employee" },
  });
  if (authError) return { error: authError.message };

  const newUserId = authData.user.id;

  await admin.from("profiles").upsert({
    id: newUserId,
    full_name: input.full_name,
    user_type: "employee",
  });

  const { error: empError } = await admin.from("employees").insert({
    profile_id: newUserId,
    role: input.role,
    department_id: input.department_id || null,
    title: input.title || null,
  });
  if (empError) return { error: empError.message };

  return { email: input.email, password };
}

export async function resetEmployeePassword(profileId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user.id).single();
  if (emp?.role !== "root") return { error: "Only root can reset passwords" };

  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError || !authUser.user.email) return { error: "User not found" };

  const password = generatePassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(profileId, { password });
  if (updateError) return { error: updateError.message };

  return { email: authUser.user.email, password };
}
