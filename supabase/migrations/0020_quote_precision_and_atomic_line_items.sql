-- Kuwaiti dinar has three decimals (1 KD = 1000 fils), and every screen already
-- formats quotes to 3dp. Storage was NUMERIC(10,2), so Postgres silently rounded
-- on insert and a price of 12.345 came back as 12.350. Widening to (12,3) also
-- keeps more integer headroom than (10,3) would.
ALTER TABLE quote_line_items
  ALTER COLUMN quantity   TYPE NUMERIC(12,3),
  ALTER COLUMN unit_price TYPE NUMERIC(12,3);

-- Editing a quote previously deleted every line item and re-inserted them as two
-- separate statements. A failure between the two left the quote with zero line
-- items and no way back. This does both in one transaction.
CREATE OR REPLACE FUNCTION public.replace_quote_line_items(
  p_quote_id UUID,
  p_items    JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM quote_line_items WHERE quote_id = p_quote_id;

  INSERT INTO quote_line_items (quote_id, description, quantity, unit_price, position)
  SELECT
    p_quote_id,
    item->>'description',
    (item->>'quantity')::NUMERIC(12,3),
    (item->>'unit_price')::NUMERIC(12,3),
    (item->>'position')::INTEGER
  FROM jsonb_array_elements(p_items) AS item;
END;
$$;

-- SECURITY INVOKER: the caller's own RLS on quote_line_items governs both the
-- delete and the insert, so this grants no privilege the caller lacks.
COMMENT ON FUNCTION public.replace_quote_line_items(UUID, JSONB) IS
  'Atomically replaces a quote''s line items. Runs as the caller, under their RLS.';
