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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: emp } = await supabase
    .from("employees")
    .select("role, departments(can_add_clients)")
    .eq("profile_id", user.id)
    .single();

  const deptCanAdd = (emp?.departments as unknown as { can_add_clients: boolean } | null)?.can_add_clients ?? false;
  const allowed = ["root", "ceo", "cfo", "manager"];
  if (!emp || (!allowed.includes(emp.role) && !deptCanAdd)) return { error: "Insufficient permissions" };

  const password = generatePassword();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.contact_email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.contact_name, user_type: "client" },
  });
  if (authError) return { error: authError.message };

  const contactUserId = authData.user.id;

  await admin.from("profiles").upsert({
    id: contactUserId,
    full_name: input.contact_name,
    user_type: "client",
  });

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

  await admin.from("client_contacts").insert({
    client_id: clientData.id,
    profile_id: contactUserId,
    role: "owner",
  });

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

  return { success: true };
}

export async function resetClientPassword(clientId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: emp } = await supabase.from("employees").select("role, departments(can_add_clients)").eq("profile_id", user.id).single();
  const deptCanAdd = (emp?.departments as unknown as { can_add_clients: boolean } | null)?.can_add_clients ?? false;
  const allowed = ["root", "ceo", "cfo", "manager"];
  if (!emp || (!allowed.includes(emp.role) && !deptCanAdd)) return { error: "Insufficient permissions" };

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
