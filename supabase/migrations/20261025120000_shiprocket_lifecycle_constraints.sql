-- Additive safeguards for the Shiprocket lifecycle state and provider IDs.
-- NOT VALID lets operators audit any pre-existing rows before validation;
-- PostgreSQL enforces these checks on subsequently inserted or updated rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_shiprocket_state_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_shiprocket_state_check
      CHECK (shiprocket_state IN (
        'not_created', 'failed', 'creating', 'unknown', 'order_created',
        'assigning_awb', 'awb_unknown', 'awb_assigned', 'pickup_requesting',
        'pickup_unknown', 'pickup_requested', 'generating_label',
        'label_unknown', 'label_ready'
      )) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_shiprocket_order_id_positive_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_shiprocket_order_id_positive_check
      CHECK (shiprocket_order_id IS NULL OR shiprocket_order_id > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_shiprocket_shipment_id_positive_check'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_shiprocket_shipment_id_positive_check
      CHECK (shiprocket_shipment_id IS NULL OR shiprocket_shipment_id > 0) NOT VALID;
  END IF;
END
$$;
