CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

CREATE TABLE quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  quote_number  TEXT NOT NULL DEFAULT ('QT-' || LPAD(nextval('quote_number_seq')::text, 4, '0')),
  title         TEXT NOT NULL,
  valid_until   DATE,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  created_by    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quote_line_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quote_line_items_quote ON quote_line_items(quote_id);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select_quotes" ON quotes
  FOR SELECT TO authenticated
  USING (current_user_type() = 'employee');

CREATE POLICY "employees_insert_quotes" ON quotes
  FOR INSERT TO authenticated
  WITH CHECK (current_user_type() = 'employee' AND created_by = auth.uid());

CREATE POLICY "employees_update_quotes" ON quotes
  FOR UPDATE TO authenticated
  USING (
    current_user_type() = 'employee' AND (
      created_by = auth.uid() OR current_employee_role() IN ('root', 'ceo', 'cfo')
    )
  );

CREATE POLICY "employees_delete_quotes" ON quotes
  FOR DELETE TO authenticated
  USING (
    current_user_type() = 'employee' AND (
      created_by = auth.uid() OR current_employee_role() IN ('root', 'ceo', 'cfo')
    )
  );

CREATE POLICY "employees_select_line_items" ON quote_line_items
  FOR SELECT TO authenticated
  USING (current_user_type() = 'employee');

CREATE POLICY "employees_insert_line_items" ON quote_line_items
  FOR INSERT TO authenticated
  WITH CHECK (current_user_type() = 'employee');

CREATE POLICY "employees_update_line_items" ON quote_line_items
  FOR UPDATE TO authenticated
  USING (current_user_type() = 'employee');

CREATE POLICY "employees_delete_line_items" ON quote_line_items
  FOR DELETE TO authenticated
  USING (current_user_type() = 'employee');
