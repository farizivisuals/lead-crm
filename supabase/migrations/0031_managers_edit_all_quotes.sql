-- 0031: Managers can edit and delete everyone's quotes, like root/CEO/CFO.
-- These five policies named the roles; they now use is_executive() like the
-- rest of the schema. Anyone can still edit the quotes they created.

ALTER POLICY employees_update_quotes ON quotes
  USING (current_user_type() = 'employee' AND (created_by = auth.uid() OR is_executive()));

ALTER POLICY employees_delete_quotes ON quotes
  USING (current_user_type() = 'employee' AND (created_by = auth.uid() OR is_executive()));

ALTER POLICY employees_insert_line_items ON quote_line_items
  WITH CHECK (EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_line_items.quote_id
    AND (q.created_by = auth.uid() OR is_executive())));

ALTER POLICY employees_update_line_items ON quote_line_items
  USING (EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_line_items.quote_id
    AND (q.created_by = auth.uid() OR is_executive())))
  WITH CHECK (EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_line_items.quote_id
    AND (q.created_by = auth.uid() OR is_executive())));

ALTER POLICY employees_delete_line_items ON quote_line_items
  USING (EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_line_items.quote_id
    AND (q.created_by = auth.uid() OR is_executive())));
