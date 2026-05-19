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

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: generatePassword(),
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/update-password` },
  });

  return { link: linkData?.properties?.action_link ?? `Login: ${input.email}` };
}

export async function regenerateEmployeeLink(profileId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user.id).single();
  if (emp?.role !== "root") return { error: "Only root can regenerate links" };

  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profileId);
  if (userError || !authUser.user.email) return { error: "User not found" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: authUser.user.email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/update-password` },
  });
  if (linkError) return { error: linkError.message };

  return { link: linkData.properties.action_link };
}
