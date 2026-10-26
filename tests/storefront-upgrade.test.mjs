import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS, SIZE_CHART_OVERSIZED, SIZE_CHART_RELAXED, SIZE_CHART_REGULAR, SIZE_CHART_INDUSTRY_REFERENCE, getVisibleProductCategories } from "../src/data/mock-data.js";
import { calculateSizeAvailability } from "../src/services/product-inventory-availability.js";
import { isTransientDatabaseCapacityError, readInventoryWithRetry } from "../src/services/inventory-read.js";
import { confirmGenderSelection, genderDisplayLabel, parseGenderOptionsResponse } from "../src/lib/gender-options.js";

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

test("size stock distinguishes sellable, sold-out, unconfigured, and invalid inventory", () => {
  assert.deepEqual(calculateSizeAvailability(["S", "M", "L"], [
    { size: "S", stock: 8, reserved: 3 },
    { size: "M", stock: 0, reserved: 0 },
  ]), [
    { size: "S", available: 5, status: "low_stock" },
    { size: "M", available: 0, status: "sold_out" },
    { size: "L", available: null, status: "unconfigured" },
  ]);
  assert.throws(() => calculateSizeAvailability(["S"], [{ size: "S", stock: -1, reserved: 0 }]), /invalid stock values/i);
});

test("inventory reads retry only once for transient pool capacity failures", async () => {
  let calls = 0;
  const rows = await readInventoryWithRetry(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("max clients reached in session mode"), { code: "XX000" });
    return [{ size: "S", stock: 10, reserved: 2 }];
  });
  assert.equal(calls, 2);
  assert.deepEqual(rows, [{ size: "S", stock: 10, reserved: 2 }]);
  assert.equal(isTransientDatabaseCapacityError(Object.assign(new Error("denied"), { code: "53300" })), true);
  assert.equal(isTransientDatabaseCapacityError(Object.assign(new Error("internal error"), { code: "XX000" })), false);
  assert.equal(isTransientDatabaseCapacityError(Object.assign(new Error("socket closed"), { code: "ECONNRESET" })), false);

  calls = 0;
  await assert.rejects(readInventoryWithRetry(async () => {
    calls += 1;
    throw Object.assign(new Error("max clients reached in session mode"), { code: "XX000" });
  }), /max clients reached/);
  assert.equal(calls, 2);

  calls = 0;
  await assert.rejects(readInventoryWithRetry(async () => {
    calls += 1;
    throw Object.assign(new Error("column reserved does not exist"), { code: "42703" });
  }), /column reserved/);
  assert.equal(calls, 1);
});

test("PostgreSQL pool is process-reused, conservative, and releases transaction clients", async () => {
  const db = await readFile("src/lib/db/index.ts", "utf8");
  const diagnostics = await readFile("src/lib/db/sql.ts", "utf8");
  assert.match(db, /globalThis\.rightnowlifePostgresPool/);
  assert.match(db, /max,\s*idleTimeoutMillis: 5_000,\s*connectionTimeoutMillis: 5_000/);
  assert.match(db, /Math\.min\(configuredMax, 2\)/);
  assert.match(db, /finally\s*\{\s*client\.release\(\)/);
  assert.match(diagnostics, /severity: typeof record\.severity/);
  assert.match(diagnostics, /code === "28P01"/);
  assert.match(diagnostics, /code\.startsWith\("08"\)/);
  assert.match(diagnostics, /code\.startsWith\("XX"\)/);
  assert.match(diagnostics, /category: "capacity"/);
});

test("admin login treats client IP as optional while requiring the email rate-limit bucket", async () => {
  const limiter = await readFile("src/lib/auth/admin-login-rate-limit.ts", "utf8");
  const route = await readFile("src/services/admin-login-route.ts", "utf8");
  assert.match(limiter, /platform === "1"[\s\S]*x-vercel-forwarded-for/);
  assert.match(limiter, /clientIp \? \[\{ kind: "ip"/);
  assert.match(limiter, /kind: "email", value: email\?\.trim\(\)\.toLowerCase\(\) \|\| "__missing_email__"/);
  assert.match(route, /claimAttempt\(email && email\.length <= 254 \? email : null, clientIp\)/);
  assert.doesNotMatch(route, /ADMIN_LOGIN_TRUSTED_IP_HEADER is unset/);
  assert.match(route, /attempt = await deps\.claimAttempt[\s\S]*passwordValid = deps\.verifyPassword/);
});

test("inventory query errors are shown as unavailable and never turn missing stock into positive stock", async () => {
  const api = await readFile("src/app/api/products/[productId]/inventory/route.ts", "utf8");
  const detail = await readFile("src/components/product/VariantSelector.tsx", "utf8");
  const card = await readFile("src/components/product/ProductCard.tsx", "utf8");
  const reservation = await readFile("src/lib/db/orders.ts", "utf8");
  const inventoryReader = await readFile("src/app/api/products/[productId]/inventory/route.ts", "utf8");
  assert.match(api, /rows\.length === 0[\s\S]*status: 503/);
  assert.match(api, /calculateSizeAvailability/);
  assert.match(detail, /availabilityError[\s\S]*Stock availability could not be checked/);
  assert.match(card, /availabilityError[\s\S]*Stock availability is unavailable/);
  assert.doesNotMatch(reservation, /VALUES \(\?, \?, 20, 0\)/);
  assert.match(reservation, /Stock is not configured for one or more selected sizes/);
  assert.match(inventoryReader, /readInventoryWithRetry/);
  assert.match(inventoryReader, /SELECT size, stock, reserved FROM inventory WHERE product_id = \?/);
  assert.match(inventoryReader, /status: 503/);
  assert.match(inventoryReader, /database_capacity/);
});

test("product-card quick add uses configured genders and does not bypass confirmation", async () => {
  const card = await readFile("src/components/product/ProductCard.tsx", "utf8");
  const genderApi = await readFile("src/app/api/product-genders/[slug]/route.ts", "utf8");
  const detail = await readFile("src/components/product/VariantSelector.tsx", "utf8");
  const productRoute = await readFile("src/app/products/[slug]/page.tsx", "utf8");
  const adminProducts = await readFile("src/app/api/admin/products/route.ts", "utf8");
  const adminDashboard = await readFile("src/app/admin/products/page.tsx", "utf8");
  const mappingMigration = await readFile("supabase/migrations/20261026140000_product_storefront_mapping.sql", "utf8");
  assert.match(card, /api\/product-genders/);
  assert.match(card, /genderOptions\.length > 0[\s\S]*setIsGenderDialogOpen\(true\)/);
  assert.match(card, /confirmGenderSelection\(genderOptions, selectedGender/);
  assert.match(card, /role="dialog" aria-modal="true"/);
  assert.match(card, /parseGenderOptionsResponse\(data\)/);
  assert.doesNotMatch(card, /data\.genders \?\? product\.genders/);
  assert.match(detail, /genders\.length > 0[\s\S]*setIsGenderDialogOpen\(true\)/);
  assert.match(detail, /genderDisplayLabel\(gender\)/);
  assert.match(detail, /const handleBuyNow = \(\) => \{[\s\S]*genders\.length > 0[\s\S]*setGenderIntent\("buy"\)[\s\S]*setIsGenderDialogOpen\(true\)/);
  assert.match(detail, /if \(genderIntent === "buy"\)[\s\S]*router\.push\("\/checkout"\)/);
  assert.match(card, /const handleQuickAdd[\s\S]*genderOptions\.length > 0[\s\S]*setIsGenderDialogOpen\(true\)/);
  assert.match(productRoute, /getConfiguredProductGenders\(product\.slug\)/);
  assert.match(genderApi, /getProductGenderConfiguration\(slug\)/);
  assert.match(genderApi, /status: 503/);
  assert.match(adminProducts, /genders: input\.genders \?\? \[\]/);
  assert.match(adminDashboard, /Storefront Products &amp; Gender Configuration/);
  assert.match(adminDashboard, /id="storefront-product-configuration"/);
  assert.match(adminDashboard, /PRODUCTS\.map\(\(storefrontProduct\)/);
  assert.ok(PRODUCTS.every((product) => product.slug && product.slug.length > 0), "every canonical product needs a storefront slug");
  assert.match(adminDashboard, /Database products could not be loaded\. The canonical catalog is shown below/);
  assert.match(adminDashboard, /reviewedDraftChoices\[storefrontProduct\.slug\]/);
  assert.match(adminDashboard, /No gender selector/);
  assert.match(adminDashboard, /storefront_slug: storefrontProduct\.slug/);
  assert.match(adminDashboard, /genders, stock: 0, is_active: false/);
  assert.match(adminDashboard, /Duplicate mapping detected/);
  assert.match(adminDashboard, /Link that record instead of creating a duplicate/);
  assert.match(adminDashboard, /Only the storefront mapping and gender options will change/);
  assert.match(adminProducts, /matching database product already exists/);
  assert.match(adminProducts, /storefront_slug: z\.string\(\)/);
  assert.match(adminProducts, /await requireAdminAuth\(req\)/);
  assert.match(adminProducts, /user\.role !== "admin"/);
  assert.match(adminProducts, /input\.storefront_slug/);
  assert.match(adminProducts, /Gender options cannot contain duplicates/);
  assert.match(adminProducts, /storefront_slug: input\.storefront_slug \?\? null/);
  assert.match(mappingMigration, /ADD COLUMN IF NOT EXISTS storefront_slug TEXT/);
  assert.match(mappingMigration, /CREATE UNIQUE INDEX IF NOT EXISTS products_storefront_slug_unique/);
});

test("gender API contract distinguishes an unconfigured slug and rejects malformed or invalid options", () => {
  assert.deepEqual(parseGenderOptionsResponse({ productFound: true, genders: ["Men", "Women"] }), { productFound: true, genders: ["Men", "Women"] });
  assert.deepEqual(parseGenderOptionsResponse({ productFound: true, genders: ["Unisex"] }), { productFound: true, genders: ["Unisex"] });
  assert.deepEqual(parseGenderOptionsResponse({ productFound: false, genders: [] }), { productFound: false, genders: [] });
  assert.throws(() => parseGenderOptionsResponse({ genders: [] }), /Invalid product gender options response/);
  assert.throws(() => parseGenderOptionsResponse({ productFound: true, genders: ["Other"] }), /Invalid product gender options response/);

  const added = [];
  assert.equal(confirmGenderSelection(["Men", "Women"], null, (gender) => added.push(gender)), false);
  assert.equal(confirmGenderSelection(["Men", "Women"], "Men", (gender) => added.push(gender)), true);
  assert.equal(confirmGenderSelection(["Men", "Women"], "Women", (gender) => added.push(gender)), true);
  assert.equal(genderDisplayLabel("Men"), "Male");
  assert.equal(genderDisplayLabel("Women"), "Female");
  assert.equal(genderDisplayLabel("Unisex"), "Unisex");
  assert.deepEqual(added, ["Men", "Women"]);
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
