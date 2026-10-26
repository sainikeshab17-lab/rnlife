-- Optional gender option list for seller managed products; empty preserves legacy behavior.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS genders TEXT[] NOT NULL DEFAULT '{}';

-- Persist the customer's selected option on the order line. Existing orders remain NULL.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_gender_check
  CHECK (gender IS NULL OR gender IN ('Men', 'Women', 'Unisex'));
