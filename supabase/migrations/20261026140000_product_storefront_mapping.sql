-- Link an administrative product row to a canonical static storefront product
-- without changing its database slug or any existing order snapshots.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS storefront_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_storefront_slug_unique
  ON products (storefront_slug)
  WHERE storefront_slug IS NOT NULL;
