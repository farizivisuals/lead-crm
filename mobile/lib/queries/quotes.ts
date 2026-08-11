import { supabase } from '../supabase';
import type { QuoteLineItem } from './clients';

/**
 * A line item while it is being edited. Quantities and prices are held as the
 * raw strings the user typed — parsing on every keystroke would fight the
 * keyboard (you could never type "1." on the way to "1.5").
 */
export type DraftLineItem = {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
};

/**
 * Kuwaiti dinar is a three-decimal currency: 1 KD = 1000 fils. Migration 0020
 * widened storage to NUMERIC(12,3) to match, so this is now what actually
 * round-trips rather than a display flourish over 2dp storage.
 */
export function formatKD(amount: number): string {
  return `KD ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

/**
 * The web parses with `parseFloat(q) || 1`, which turns a deliberate quantity
 * of 0 into 1 — `0 || 1` is `1`. An empty or unparseable field means "not
 * filled in yet" and defaults to 1; an explicit 0 stays 0.
 */
export function parseQuantity(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 1;
}

export function parsePrice(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Quote total: sum of quantity x unit price across every line. */
export function quoteTotal(items: { quantity: number; unit_price: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
}

/** The same total over rows still being edited, for the running subtotal. */
export function draftTotal(items: DraftLineItem[]): number {
  return quoteTotal(
    items.map((i) => ({ quantity: parseQuantity(i.quantity), unit_price: parsePrice(i.unit_price) }))
  );
}

/** Drops blank rows and freezes each row's position from its final order. */
export function toLineItemPayload(items: DraftLineItem[]): QuoteLineItem[] {
  return items
    .filter((i) => i.description.trim().length > 0)
    .map((i, position) => ({
      description: i.description.trim(),
      quantity: parseQuantity(i.quantity),
      unit_price: parsePrice(i.unit_price),
      position,
    }));
}

export type SaveQuoteInput = {
  clientId: string;
  title: string;
  valid_until: string;
  notes: string;
  items: DraftLineItem[];
  userId: string;
};

/**
 * Web parity: quotes are created as 'sent'. Nothing in the product writes
 * 'accepted' or 'declined' — that belongs to the client portal in Phase 4 —
 * so the status is shown but not editable here.
 */
export async function createQuote(input: SaveQuoteInput): Promise<string> {
  const { data, error } = await supabase
    .from('quotes')
    .insert({
      client_id: input.clientId,
      title: input.title,
      valid_until: input.valid_until || null,
      notes: input.notes || null,
      status: 'sent',
      created_by: input.userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Quote insert returned no row');

  const quoteId = data.id as string;
  const items = toLineItemPayload(input.items);
  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('quote_line_items')
      .insert(items.map((i) => ({ ...i, quote_id: quoteId })));
    if (itemsError) {
      // Unlike the web, don't leave an empty quote behind on a partial failure.
      await supabase.from('quotes').delete().eq('id', quoteId);
      throw itemsError;
    }
  }
  return quoteId;
}

export type UpdateQuoteInput = {
  quoteId: string;
  title: string;
  valid_until: string;
  notes: string;
  items: DraftLineItem[];
};

/**
 * Line items go through the replace_quote_line_items RPC (migration 0020),
 * which does the delete and the insert in ONE transaction. The web does them
 * as two statements, so a failure between them leaves the quote with no line
 * items and no way back.
 */
export async function updateQuote(input: UpdateQuoteInput) {
  const { error } = await supabase
    .from('quotes')
    .update({
      title: input.title,
      valid_until: input.valid_until || null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.quoteId);
  if (error) throw error;

  const { error: itemsError } = await supabase.rpc('replace_quote_line_items', {
    p_quote_id: input.quoteId,
    p_items: toLineItemPayload(input.items),
  });
  if (itemsError) throw itemsError;
}

export async function deleteQuote(quoteId: string) {
  const { error } = await supabase.from('quotes').delete().eq('id', quoteId);
  if (error) throw error;
}
