# RIGHTNOWLIFE — Phase 1 Frontend UI/UX Implementation

> **Brand Mission:** A premium, modern, fashion-forward independent T-shirt and streetwear label based in India. RightNowLife crafts heavyweight graphic, oversized, and essential T-shirts designed for everyday self-expression.

This is **Phase 1** of the RightNowLife platform build, focusing exclusively on UI/UX design, typography, reusable component architecture, responsive streetwear layouts, and development fixtures.

---

## Supabase PostgreSQL Migration (Phase 5)

The application runtime uses the `pg` PostgreSQL pool in `src/lib/db/index.ts`.
Prisma is not the runtime adapter; `prisma/schema.prisma` is kept aligned as a
schema reference. The local SQLite database remains the authoritative source
until a non-production PostgreSQL target has been reviewed and verified.
See [docs/supabase-reconciliation.md](./docs/supabase-reconciliation.md) for the
table-by-table reconciliation and constraint findings.

### Local configuration

1. Keep `data/rightnowlife.db` unchanged. Create `.env.local` from `.env.example`.
2. Set `DATABASE_URL` to the Supabase runtime/pooler connection URI and
   `DIRECT_URL` to the direct PostgreSQL URI. Keep both server-only; do not use
   either in `NEXT_PUBLIC_*` variables or commit `.env.local`.
3. `DATABASE_URL` is required by application requests. `DIRECT_URL` is required
   by the explicit migration and import scripts. They are intentionally separate
   so runtime pooling does not control DDL/import sessions. Both must be private
   server-side database connection strings; the migration enables RLS and
   revokes table access from Supabase `anon`/`authenticated` roles.
4. Node.js 22 or later is required by the offline SQLite inspection, backup, and
   import utilities (`node:sqlite`).

### Migration and import sequence

Do not point these commands at production without explicit approval. These
commands require `--confirm-non-production`; importing additionally requires
`--schema-reviewed` and a separately verified backup.

```powershell
# Inspect schema/table metadata only; this does not print row contents.
node scripts/inspect-schema.mjs

# Create a new backup path; existing paths are never overwritten.
npm run db:backup -- --output "$env:LOCALAPPDATA\RIGHTNOWLIFE\backups\rightnowlife-pre-supabase.db"

# After independently reviewing the target URL and migration SQL:
npm run db:migrate -- --confirm-non-production

# Only after the target migration succeeds and the backup is verified:
npm run db:import -- --schema-reviewed --confirm-non-production-target `
  --backup "$env:LOCALAPPDATA\RIGHTNOWLIFE\backups\rightnowlife-pre-supabase.db"
```

Migrations are ordered by their 14-digit version, checksum-recorded in
`rightnowlife_schema_migrations`, serialized with a PostgreSQL advisory lock,
and applied transactionally. Applied migration files are forward-only: edits
after application fail checksum validation; add a new migration for corrections.
The initial migration is safe for an empty Supabase database and creates the
16 application tables. It does not drop tables or enable extensions.

The importer checks that source and backup have matching table counts and that
the backup passes SQLite integrity checks; verifies the target schema columns;
preserves primary keys and recorded fields; uses a transaction and row
savepoints; skips only identical existing rows; checks foreign-key relationships;
and reports imported, skipped, and failed counts without printing row values.
Failed rows cause a non-zero exit; rerunning the importer is safe for rows already
imported. `notification_jobs.html_content`, `retry_count`, and `max_retries` map
to PostgreSQL's `body_html`, `attempts`, and `max_attempts`; the separate returns
note columns and refund amount-in-paisa are retained distinctly.

### Backup, restore, and rollback

Before import, retain both the original SQLite file and a verified copy. The
backup command refuses overwrite and checks SQLite integrity plus per-table row
counts. Store backups outside the repository with access controls because they
contain customer, payment-reference, and password-hash data.

Before migration/import, take a Supabase backup using the project's approved
Supabase backup/PITR process. Restore PostgreSQL from that snapshot using the
Supabase recovery procedure; never roll back by dropping tables or replaying a
destructive SQL script. The schema runner is forward-only. The application
should continue using the previous database configuration until imports, checks,
and application flows have been validated; no traffic switch is performed by
these scripts.

### Reconciliation notes and verification boundary

The SQLite source has 16 runtime tables. The PostgreSQL migration preserves
`returns.customer_note` and `customer_notes` (and both admin note variants),
`return_items.product_name`, `color`, and `price`, and `refund_records.amount`,
`amount_paisa`, `idempotency_key`, and `raw_response` as separate columns. The
SQLite notification queue's `html_content`/retry fields are intentionally
translated to the service's `body_html`/attempt fields. The source currently has
duplicate non-null Razorpay refund IDs, so the PostgreSQL schema deliberately
uses a non-unique index for that provider reference and does not discard existing
records.

No schema application, import, PostgreSQL query, provider API call, deployment,
or production traffic change is authorized or performed by the local code
changes alone. Full PostgreSQL integration and critical-flow verification
requires an explicitly approved non-production Supabase target and test-mode
provider configuration.

---

## 1. Technical Architecture

- **Framework:** Next.js (App Router, Turbopack)
- **Language:** TypeScript (Strict mode)
- **Styling:** Tailwind CSS (v4) with custom streetwear tokens
- **Component Primitives:** Accessible, headless patterns inspired by shadcn/ui
- **Icons:** Lucide Icons & optimized SVG inline brand vectors
- **State Management:** Custom React Contexts with LocalStorage persistence (`CartProvider`, `WishlistProvider`, `AuthProvider`, `ToastProvider`)
- **No Third-Party Hosted Engines:** Zero dependencies on Shopify, Shopify Hydrogen, WooCommerce, WordPress, Wix, or Squarespace.

---

## 2. Brand Visual Identity & Color System

- **Primary Black:** `#111111`
- **Main White:** `#FFFFFF`
- **Soft Editorial Background:** `#F5F4F0`
- **Secondary Gray:** `#858585`
- **Border Neutral:** `#E5E5E5`
- **Optional Streetwear Accent:** `#B8FF3B` (Electric Lime)
- **Typography:** Inter sans-serif paired with bold editorial display treatments for campaign headlines.

---

## 3. Implemented Routes & Pages

### Storefront Experiences
| Route | Description |
|---|---|
| `/` | Full-width campaign hero, Shop the Collection tiles, New Arrivals, Signature Graphics, The Oversized Edit, Raw Essentials, Brand Manifesto, Community Instagram Grid, Footer |
| `/shop` | Complete catalog listing with T-shirt filters (Fit, Size, Color, Sleeve, Design type), sorting, live search params, and load-more pagination |
| `/categories` | Curated archive presenting visual cards for all drop series |
| `/collections/[slug]` | Dedicated series drop pages (`new-drops`, `graphic-tees`, `oversized-tees`, `essentials`, `statement-prints`) with campaign headers and filtered catalog |
| `/products/[slug]` | Complete product details: Multi-image gallery with zoom/lightbox, variant selector (color swatches & size buttons), Size Guide modal (cm measurements), Delivery PIN code checker, Fabric & Care accordions, demo reviews, related items, and mobile sticky purchase bar |
| `/search` | Live interactive search page with real-time query matching, filter sidebar, and empty states |
| `/cart` | Full shopping bag page with item thumbnails, size/color variant controls, quantity stepper, coupon input (`DROP20`, `RNLFIRST`), free shipping progress meter, and checkout link |
| `/checkout` | 4-step checkout sequence: Address form / saved addresses, order review, Razorpay payment selector preview, and demo order confirmation |

### Customer Account UI
| Route | Description |
|---|---|
| `/account` | Customer dashboard overview: recent dispatches, default delivery address, and quick metrics |
| `/account/orders` | Complete order history with status filters (All, In Transit, Delivered, Placed) |
| `/account/orders/[id]` | Order details with real-time air courier tracking timeline, itemized table, and address |
| `/account/addresses` | Saved address book with Add New Address modal, edit, delete, and default toggling |
| `/account/wishlist` | Saved favorite T-shirts with quick add to bag and remove actions |
| `/login` | Customer login with validation and demo customer auto-fill |
| `/register` | Customer registration form with input validation |
| `/forgot-password` | Account recovery prototype with link dispatch feedback |
| `/reset-password` | Password update interface with validation |

### Brand Policy & Support Pages
| Route | Description |
|---|---|
| `/about` | Editorial About page: Brand Manifesto, Philosophy, Craft Pillars (260 GSM, tactile prints, Lycra collars) |
| `/size-guide` | Interactive size manual with centimeter tables for Oversized, Relaxed, and Regular fits plus how-to-measure guide |
| `/shipping` | Shipping & air dispatch policies, courier partnerships (Delhivery, BlueDart), and transit timeframes |
| `/returns` | 7-day size exchange guarantee and return condition guidelines |
| `/contact` | Customer support desk, studio details, hours, and inquiry form |
| `/faq` | Interactive accordion FAQs covering sizing, GSM, care, courier tracking, and payment |

### Internal Staff Seller Portal (`/seller`)
| Route | Description |
|---|---|
| `/seller` | Staff seller dashboard: catalog metrics, published vs. draft products, low-stock variant warnings, recent activity |
| `/seller/products` | Product management table with search, series filter, edit, archive, and live preview |
| `/seller/products/new` | Comprehensive Add T-Shirt form: name, slug, series, description, front/back image previews, size matrix, SKU, price, GSM, fit, sleeve, print technique, and publish controls |
| `/seller/products/[id]/edit` | Pre-populated garment editing interface |
| `/seller/inventory` | Warehouse inventory matrix with inline quick stock adjustment buttons (`-5`, `+5`, `+20`) and health badges |

### Central Admin Control Center (`/admin`)
| Route | Description |
|---|---|
| `/admin` | Executive dashboard: Gross sales summary (₹ INR), total orders, pending dispatches, low stock alerts, pipeline table |
| `/admin/products` | Global product catalog governance and status oversight |
| `/admin/collections` | Curated drop series management with product counters |
| `/admin/orders` | Central fulfillment operations: order status updates (Placed, Confirmed, Shipped, Delivered) and tracking management |
| `/admin/inventory` | Warehouse stock valuation and unit metrics |
| `/admin/staff` | Staff directory: role assignments (`Store Admin`, `Catalog Lead`, `Fulfillment Lead`, `Support Agent`), permissions list, and account activation/deactivation |

---

## 4. Reusable Component Design System

- **Layout:** `Navbar` (with announcement marquee, search trigger, account menu, wishlist counter, bag drawer trigger, mobile drawer), `Footer`, `StoreLayout`, `AccountLayout`, `SellerLayout`, `AdminLayout`
- **Product:** `ProductCard`, `ProductGrid`, `ProductGallery` (with zoom lightbox), `VariantSelector`, `SizeGuideModal`, `DeliveryPinChecker`, `FilterSidebar`
- **Cart:** `CartDrawer` (slide-out mini bag with free shipping progress bar), `CartPage`
- **Common:** `Breadcrumbs`, `StatusBadge`, `PrototypeNotice`, `SearchModal`

---

## 5. Development & Installation Guide

### Prerequisites
- Node.js (v18+ or v20+)
- npm (v9+)

### Installation
```bash
# Navigate to project root
cd c:\rnlife

# Install dependencies
npm install --legacy-peer-deps
```

### Running Locally
```bash
# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm run start
```

---

## 6. Phase 1 Prototype Behaviors

1. **Shopping Bag & Wishlist:** Fully functional in-browser shopping experience with local storage persistence. Adding, removing, updating quantities, and applying promo codes (`DROP20`, `RNLFIRST`) calculate accurate totals.
2. **Demo User Session:** Default active customer *Arjun Verma* with pre-configured Indiranagar, Bengaluru shipping address.
3. **Razorpay Checkout Preview:** Multi-step delivery address -> review -> Razorpay preview. Generates realistic order numbers without executing real financial transactions.
4. **Staff Perspective Switcher:** Account menu allows seamless previewing between Customer Dashboard, Staff Seller Portal, and Admin Dashboard.

---

## 7. Deferred to Phase 2 (Backend & Database)

The following production integrations are intentionally isolated behind service abstractions for Phase 2:
- Custom NestJS API microservices
- PostgreSQL database schema with Prisma ORM
- Live Razorpay payment webhook gateway and signature verification
- Production JWT authentication guards and server-side RBAC
- Production cloud image storage (AWS S3 / Cloudinary) for seller file uploads
- Live shipping partner API integrations (Delhivery / BlueDart AWB generation)
