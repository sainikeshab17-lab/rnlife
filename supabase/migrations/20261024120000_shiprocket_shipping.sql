-- Additive Shiprocket references and operation state. Apply manually after review.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shiprocket_order_id BIGINT,
  ADD COLUMN IF NOT EXISTS shiprocket_shipment_id BIGINT,
  ADD COLUMN IF NOT EXISTS shiprocket_state TEXT NOT NULL DEFAULT 'not_created',
  ADD COLUMN IF NOT EXISTS shiprocket_label_url TEXT,
  ADD COLUMN IF NOT EXISTS shiprocket_last_error TEXT,
  ADD COLUMN IF NOT EXISTS shiprocket_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shiprocket_order_id
  ON orders(shiprocket_order_id) WHERE shiprocket_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shiprocket_shipment_id
  ON orders(shiprocket_shipment_id) WHERE shiprocket_shipment_id IS NOT NULL;
