"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePassword } from "@/lib/utils";

interface CreateClientInput {
  company_name: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  notes: string;
}

export async function createClientWithPortal(input: CreateClientInput) {
  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify caller is an employee with manager+ role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("profile_id", user.id)
    .single();

  const allowed = ["root", "ceo", "cfo", "manager"];
  if (!emp || !allowed.includes(emp.role)) {
    return { error: "Insufficient permissions" };
  }

  // 1. Create auth user for the client contact
  const tempPassword = generatePassword();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.contact_email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: input.contact_name,
      user_type: "client",
    },
  });

  if (authError) return { error: authError.message };

  const contactUserId = authData.user.id;

  // 2. Ensure profile row exists (trigger usually handles it, but be explicit)
  await admin
    .from("profiles")
    .upsert({
      id: contactUserId,
      full_name: input.contact_name,
      user_type: "client",
    });

  // 3. Create client record
  const { data: clientData, error: clientError } = await admin
    .from("clients")
    .insert({
      company_name: input.company_name,
      primary_contact_profile_id: contactUserId,
      phone: input.phone || null,
      notes: input.notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (clientError) return { error: clientError.message };

  // 4. Create client_contact link
  await admin.from("client_contacts").insert({
    client_id: clientData.id,
    profile_id: contactUserId,
    role: "owner",
  });

  // 5. Generate one-time password reset link
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: input.contact_email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/update-password` },
  });

  if (linkError) {
    // Client was created; return success with fallback message
    return { link: `Password: ${tempPassword} (save this — link generation failed)` };
  }

  return { link: linkData.properties.action_link };
}

export async function regenerateClientLink(clientId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user.id).single();
  const allowed = ["root", "ceo", "cfo", "manager"];
  if (!emp || !allowed.includes(emp.role)) return { error: "Insufficient permissions" };

  const { data: client } = await supabase
    .from("clients")
    .select("primary_contact_profile_id")
    .eq("id", clientId)
    .single();
  if (!client) return { error: "Client not found" };

  const { data: authUser, error: userError } = await admin.auth.admin.getUserById(
    client.primary_contact_profile_id
  );
  if (userError || !authUser.user.email) return { error: "Contact user not found" };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: authUser.user.email,
    options: { redirectTo: `${siteUrl}/auth/callback?next=/update-password` },
  });
  if (linkError) return { error: linkError.message };

  return { link: linkData.properties.action_link };
}
