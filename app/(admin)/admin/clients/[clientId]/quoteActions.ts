"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ponytail: these mutations run as the calling user (not service-role), so the
// RLS policies in 0013_quotes.sql (owner-or-exec write, employee-only read) are
// the actual authorization — no app-level role check needed here.

interface LineItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
}

interface CreateQuoteInput {
  clientId: string;
  title: string;
  valid_until: string | null;
  notes: string | null;
  line_items: LineItemInput[];
}

export async function createQuote(input: CreateQuoteInput): Promise<{ quoteId?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      client_id: input.clientId,
      title: input.title,
      valid_until: input.valid_until || null,
      notes: input.notes || null,
      status: "sent",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (quoteError) return { error: quoteError.message };

  if (input.line_items.length > 0) {
    const { error: itemsError } = await supabase
      .from("quote_line_items")
      .insert(
        input.line_items.map((item) => ({
          quote_id: quote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          position: item.position,
        }))
      );

    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath(`/admin/clients/${input.clientId}`);
  return { quoteId: quote.id };
}

export async function deleteQuote(quoteId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) return { error: error.message };
  revalidatePath("/admin/clients/[clientId]", "page");
  return {};
}

interface UpdateQuoteInput {
  quoteId: string;
  title: string;
  valid_until: string | null;
  notes: string | null;
  line_items: LineItemInput[];
}

export async function updateQuote(input: UpdateQuoteInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error: quoteError } = await supabase
    .from("quotes")
    .update({
      title: input.title,
      valid_until: input.valid_until || null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.quoteId);

  if (quoteError) return { error: quoteError.message };

  const { error: deleteError } = await supabase
    .from("quote_line_items")
    .delete()
    .eq("quote_id", input.quoteId);

  if (deleteError) return { error: deleteError.message };

  if (input.line_items.length > 0) {
    const { error: itemsError } = await supabase
      .from("quote_line_items")
      .insert(
        input.line_items.map((item) => ({
          quote_id: input.quoteId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          position: item.position,
        }))
      );

    if (itemsError) return { error: itemsError.message };
  }

  revalidatePath("/admin/clients/[clientId]", "page");
  return {};
}
