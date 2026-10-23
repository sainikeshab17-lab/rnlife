import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS, SIZE_CHART_OVERSIZED, SIZE_CHART_RELAXED, SIZE_CHART_REGULAR, SIZE_CHART_INDUSTRY_REFERENCE, getVisibleProductCategories } from "../src/data/mock-data.js";

test("eight canonical designs keep their configured IDs and prices with distinct descriptions", () => {
  assert.deepEqual(PRODUCTS.map((p) => p.id), Array.from({ length: 8 }, (_, i) => `rnl-design-0${i + 1}`));
  assert.ok(PRODUCTS.every((p) => p.price === 999 && p.description.trim().length > 60));
  assert.equal(new Set(PRODUCTS.map((p) => p.description)).size, 8);
  assert.ok(PRODUCTS.every((p) => !/prototype|placeholder|developer note/i.test(p.description)));
  assert.ok(PRODUCTS.every((p) => p.colors.every((color) => color.images.every((image) => !/model|lookbook|couple|side-profile/.test(image)))));
});

test("all proposed charts use flat chest widths and all six sizes", () => {
  for (const [chart, chest] of [[SIZE_CHART_OVERSIZED, 52], [SIZE_CHART_RELAXED, 49], [SIZE_CHART_REGULAR, 46]]) {
    assert.deepEqual(chart.map((row) => row.size), ["XS", "S", "M", "L", "XL", "XXL"]);
    assert.equal(chart[0].chestCm, chest);
    assert.ok(chart.every((row) => row.chestCm < 70));
  }
  assert.deepEqual(SIZE_CHART_INDUSTRY_REFERENCE.map((row) => row.size), ["S", "M", "L", "XL", "XXL"]);
  assert.equal(SIZE_CHART_INDUSTRY_REFERENCE[0].chestCm, 45.7);
});

test("empty categories are hidden and become visible when a published product is assigned", () => {
  assert.ok(!getVisibleProductCategories([]).some((category) => category.slug === "relationship-status"));
  assert.ok(getVisibleProductCategories([{ category: "relationship-status" }]).some((category) => category.slug === "relationship-status"));
  assert.ok(!getVisibleProductCategories([{ category: "relationship-status", isPublished: false }]).some((category) => category.slug === "relationship-status"));
});

test("inventory migration initializes each design-size at zero and leaves existing rows intact", async () => {
  const migration = await readFile("supabase/migrations/20261023000000_initialize_design_size_inventory.sql", "utf8");
  assert.match(migration, /SELECT product_id, size, 0, 0/);
  assert.match(migration, /ON CONFLICT \(product_id, size\) DO NOTHING/);
  assert.match(migration, /ARRAY\['XS', 'S', 'M', 'L', 'XL', 'XXL'\]/);
});

test("reviews are hidden below five approved verified purchases and moderation requires admin auth", async () => {
  const publicApi = await readFile("src/app/api/reviews/route.ts", "utf8");
  const adminApi = await readFile("src/app/api/admin/reviews/route.ts", "utf8");
  assert.match(publicApi, /summary\.count < 5/);
  assert.match(publicApi, /status = 'approved' AND verified_purchase = TRUE/);
  assert.match(publicApi, /o\.order_status = 'delivered'/);
  assert.match(adminApi, /requireAdminAuth/);
});

test("size guide displays pending verification and measurement definitions", async () => {
  const modal = await readFile("src/components/product/SizeGuideModal.tsx", "utf8");
  const page = await readFile("src/app/size-guide/page.tsx", "utf8");
  assert.match(modal, /pending verification against physical garments/);
  assert.match(modal, /marked \*/);
  assert.match(modal, /armpit to armpit; do not double/);
  assert.match(page, /not been physically verified against production garments/);
  assert.match(page, /\{row\.sleeveCm\}\* cm/);
  assert.match(page, /SIZE GUIDE — FIND YOUR PERFECT FIT/);
  assert.match(page, /Lay a T-shirt that fits you well on a flat surface/);
  assert.match(page, /A classic, standard silhouette/);
  assert.match(page, /Extra room through the chest and body for everyday comfort/);
  assert.match(page, /wider, boxier silhouette with dropped shoulders/);
  assert.match(page, /size down for a closer fit/);
  assert.match(page, /Measurements may vary slightly between garments due to manufacturing/);
  assert.match(page, /If you are between sizes, consider your preferred fit/);
  assert.match(page, /mailto:\$\{SUPPORT_EMAIL\}/);
  assert.match(page, /Contact our team before placing your order, and we’ll be happy to help/);
  assert.match(page, /SUPPORT_EMAIL/);
});

test("all eight product detail routes expose the shared size guide and full guide link", async () => {
  const productRoute = await readFile("src/app/products/[slug]/page.tsx", "utf8");
  const productDetails = await readFile("src/app/products/[slug]/ProductDetailsClient.tsx", "utf8");
  const selector = await readFile("src/components/product/VariantSelector.tsx", "utf8");
  const modal = await readFile("src/components/product/SizeGuideModal.tsx", "utf8");

  assert.equal(PRODUCTS.length, 8);
  assert.match(productRoute, /generateStaticParams[\s\S]*PRODUCTS\.map/);
  assert.match(productDetails, /<VariantSelector/);
  assert.match(selector, /<SizeGuideModal/);
  assert.match(modal, /href="\/size-guide"/);
});

test("public contact and returns copy do not publish the old email or conflicting 14-day rules", async () => {
  const email = await readFile("src/lib/support-contact.ts", "utf8");
  const returns = await readFile("src/app/returns/page.tsx", "utf8");
  const footer = await readFile("src/components/layout/Footer.tsx", "utf8");
  assert.match(email, /contact@rightnowlife\.com/);
  assert.doesNotMatch(returns, /14 days|14-day/);
  assert.doesNotMatch(footer, /href="\/(?:seller|admin)"/);
});
