import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { ProductGrid } from "@/components/product/ProductGrid";
import { BRAND_INFO, COLLECTIONS, PRODUCTS } from "@/data/mock-data";

const allProducts = PRODUCTS;
const featuredCollections = COLLECTIONS.slice(0, 3).map((collection) => ({
  ...collection,
  image: PRODUCTS.find((product) => product.collectionSlug === collection.slug)?.colors[0]?.images[0],
}));
const heroProduct = PRODUCTS[0];

export default function HomePage() {
  return (
    <StoreLayout>
      {/* ── HERO ── */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[.9fr_1.1fr] md:items-center md:gap-14 md:py-12 lg:px-8">
        <div className="order-2 md:order-1">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-neutral-500">
            Right now / Every day
          </p>
          <h1 className="max-w-xl text-5xl font-black uppercase leading-[.9] tracking-[-.06em] sm:text-6xl lg:text-7xl">
            Wear what<br />you feel.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-neutral-600">
            T-shirts for the person you are, right now. 8 designs. One price: ₹999.
          </p>
          <Link
            href="/shop"
            className="btn-morph btn-yellow mt-7 inline-flex min-h-12 items-center gap-4 px-5 text-xs font-bold uppercase tracking-wider"
          >
            Shop all designs <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-7 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
            01 — {heroProduct.name}
          </p>
        </div>
        <Link
          href={`/products/${heroProduct.slug}`}
          className="group relative order-1 aspect-[4/3] overflow-hidden bg-[#FFFFFF] md:order-2 md:aspect-[5/4]"
        >
          <Image
  src="/images/hero-raglan-campaign.png"
  alt="RIGHTNOWLIFE Phirse bolo raglan T-shirt campaign"
            fill
            loading="eager"
            className="img-morph object-contain object-center"
            sizes="(max-width: 768px) 100vw, 55vw"
          />
          <span className="absolute bottom-3 right-3 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
            View the tee <ArrowRight className="ml-2 inline h-3.5 w-3.5" />
          </span>
        </Link>
      </section>

      {/* ── COLLECTIONS ── */}
      <section id="collections" className="border-y border-[#E5E5E5] bg-[#FFFFFF]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-neutral-500">
                Shop by edit
              </p>
              <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Find your fit</h2>
            </div>
            <Link href="/categories" className="text-xs font-semibold text-[#0876A8] hover:underline">
              All collections <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {featuredCollections.map((collection, index) => (
              <Link
                key={collection.id}
                href={`/collections/${collection.slug}`}
                className="group relative aspect-[1.65] overflow-hidden bg-white sm:aspect-[1.12]"
              >
                {collection.image && (
                  <Image
                    src={collection.image}
                    alt=""
                    fill
                    className="img-morph object-cover object-center"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between text-white">
                  <span>
                    <span className="mb-1 block text-[9px] font-mono uppercase tracking-widest text-white/75">
                      0{index + 1} / Collection
                    </span>
                    <span className="text-lg font-bold uppercase tracking-tight">{collection.name}</span>
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-white/70 transition-colors group-hover:border-[#FFB900] group-hover:bg-[#FFB900] group-hover:text-[#111111]">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── ALL DESIGNS ── */}
      <section id="all-designs" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-neutral-500">
              RIGHTNOWLIFE / 08 designs
            </p>
            <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
              Shop all 8 designs — ₹999 each
            </h2>
          </div>
          <Link href="/shop" className="text-xs font-semibold text-[#0876A8] hover:underline">
            Shop all <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Link>
        </div>
        <ProductGrid products={allProducts} columns={4} />
      </section>

      {/* ── BRAND STATEMENT ── */}
      <section className="border-y border-[#E5E5E5] bg-[#FFFFFF]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between md:py-12 lg:px-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-neutral-500">
              A note from RIGHTNOWLIFE
            </p>
            <h2 className="text-2xl font-black uppercase leading-tight tracking-tight sm:text-3xl">
              {BRAND_INFO.tagline}
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{BRAND_INFO.manifesto}</p>
          </div>
          <Link
            href="/about"
            className="btn-morph inline-flex min-h-11 w-fit items-center gap-3 border border-[#111111] px-4 text-xs font-bold uppercase tracking-wider hover:bg-[#111111] hover:text-white"
          >
            Our story <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </StoreLayout>
  );
}