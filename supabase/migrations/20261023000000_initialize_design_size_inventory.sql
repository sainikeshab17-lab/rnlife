-- Initialize each existing RIGHTNOWLIFE design/size pair as unavailable.
-- Zero is intentionally used until verified physical counts are entered by staff.
INSERT INTO inventory (product_id, size, stock, reserved)
SELECT product_id, size, 0, 0
FROM unnest(ARRAY[
  'rnl-design-01', 'rnl-design-02', 'rnl-design-03', 'rnl-design-04',
  'rnl-design-05', 'rnl-design-06', 'rnl-design-07', 'rnl-design-08'
]::TEXT[]) AS products(product_id)
CROSS JOIN unnest(ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL']::TEXT[]) AS sizes(size)
ON CONFLICT (product_id, size) DO NOTHING;

CREATE TABLE IF NOT EXISTS product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  moderated_by TEXT,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_public
  ON product_reviews(product_id, status, verified_purchase, created_at DESC);
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE product_reviews FROM anon, authenticated;
