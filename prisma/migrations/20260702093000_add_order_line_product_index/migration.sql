-- Index order_lines by product so the per-product sales history (and COGS
-- roll-ups) don't scan the whole table. Additive, safe on existing data.
CREATE INDEX IF NOT EXISTS "order_lines_product_id_idx" ON "order_lines"("product_id");
