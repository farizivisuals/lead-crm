"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const admin = createAdminClient();

  const { data: quote, error: quoteError } = await admin
    .from("quotes")
    .insert({
      client_id: input.clientId,
      title: input.title,
      valid_until: input.valid_until || null,
      notes: input.notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (quoteError) return { error: quoteError.message };

  if (input.line_items.length > 0) {
    const { error: itemsError } = await admin
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

  return { quoteId: quote.id };
}
