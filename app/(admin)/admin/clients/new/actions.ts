"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("profile_id", user.id)
    .single();

  const allowed = ["root", "ceo", "cfo", "manager"];
  if (!emp || !allowed.includes(emp.role)) return { error: "Insufficient permissions" };

  const password = generatePassword();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.contact_email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.contact_name, user_type: "client" },
  });
  if (authError) return { error: authError.message };

  const contactUserId = authData.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: contactUserId,
    full_name: input.contact_name,
    user_type: "client",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(contactUserId);
    return { error: profileError.message };
  }

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
  if (clientError) {
    await admin.auth.admin.deleteUser(contactUserId);
    return { error: clientError.message };
  }

  const { error: contactError } = await admin.from("client_contacts").insert({
    client_id: clientData.id,
    profile_id: contactUserId,
    role: "owner",
  });
  if (contactError) {
    await admin.from("clients").delete().eq("id", clientData.id);
    await admin.auth.admin.deleteUser(contactUserId);
    return { error: contactError.message };
  }

  revalidatePath("/admin/clients");
  return { email: input.contact_email, password };
}

export async function getClientContactEmail(clientId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user.id).single();
  if (emp?.role !== "root") return { error: "Only root can view contact details" };
  const { data: client } = await supabase.from("clients").select("primary_contact_profile_id").eq("id", clientId).single();
  if (!client) return { error: "Client not found" };
  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(client.primary_contact_profile_id);
  if (authError) return { error: authError.message };
  return { email: authUser.user.email ?? "" };
}

export async function getClientLoginLink(clientId: string) {
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

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });
  if (error) return { error: error.message };

  // Build the link from hashed_token instead of using action_link: action_link
  // is a plain GET against Supabase's verify endpoint, so chat/email link
  // previews would consume the one-time token before the client clicks it.
  // Our callback page only verifies via JS, which preview bots don't run.
  // Use the request origin so the link works on any host/port (dev servers
  // run on random ports); fall back to the configured site URL.
  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Land on the set-password screen first — it sends clients to /portal once
  // they've chosen a password, which they use for all future logins.
  return {
    link: `${origin}/auth/callback?token_hash=${encodeURIComponent(data.properties.hashed_token)}&next=/update-password`,
  };
}

export async function updateClient(clientId: string, input: {
  company_name: string;
  phone: string;
  notes: string;
  contact_name: string;
  contact_email: string;
}) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: emp } = await supabase.from("employees").select("role").eq("profile_id", user.id).single();
  if (emp?.role !== "root") return { error: "Only root can edit clients" };

  const { data: client } = await supabase.from("clients").select("primary_contact_profile_id").eq("id", clientId).single();
  if (!client) return { error: "Client not found" };

  const { error: authError } = await admin.auth.admin.updateUserById(client.primary_contact_profile_id, {
    email: input.contact_email,
    user_metadata: { full_name: input.contact_name },
  });
  if (authError) return { error: authError.message };

  const { error: profileError } = await admin.from("profiles").update({ full_name: input.contact_name }).eq("id", client.primary_contact_profile_id);
  if (profileError) return { error: profileError.message };

  const { error: clientError } = await admin.from("clients").update({
    company_name: input.company_name,
    phone: input.phone || null,
    notes: input.notes || null,
  }).eq("id", clientId);
  if (clientError) return { error: clientError.message };

  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${clientId}`);
  return { success: true };
}

export async function resetClientPassword(clientId: string) {
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

  const password = generatePassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(
    client.primary_contact_profile_id,
    { password }
  );
  if (updateError) return { error: updateError.message };

  return { email: authUser.user.email, password };
}
