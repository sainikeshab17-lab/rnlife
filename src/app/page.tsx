import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { ProductGrid } from "@/components/product/ProductGrid";
import { BRAND_INFO, COLLECTIONS, PRODUCTS, getVisibleProductCategories } from "@/data/mock-data";

const allProducts = PRODUCTS;
const heroProduct = (() => {
  const product = PRODUCTS.find((candidate) => candidate.slug === "phirse-bolo");
  if (!product) {
    throw new Error("The Phirse Bolo? hero product is missing from the product catalog");
  }
  return product;
})();
const heroColor = heroProduct.colors[0];
const heroImageIndex = heroColor.images.findIndex((image) =>
  image.endsWith("/design_05_02_front.png")
);
if (heroImageIndex === -1) {
  throw new Error("The Phirse Bolo? product image is missing from its gallery");
}
const heroImage = heroColor.images[heroImageIndex];
const heroImageAlt = heroColor.imageAlts?.[heroImageIndex] ?? heroProduct.name;
const essentialsCollection = COLLECTIONS.find((collection) => collection.slug === "essentials");
if (!essentialsCollection) {
  throw new Error("The Essential Tees collection is missing from the catalog");
}
const essentialsImage = essentialsCollection.heroImage;
const essentialsImageAlt = PRODUCTS.flatMap((product) =>
  product.colors.flatMap((color) => color.images.map((image, index) => ({
    image,
    alt: color.imageAlts?.[index],
  })))
).find((entry) => entry.image === essentialsImage)?.alt ?? essentialsCollection.name;
const categoryCards = getVisibleProductCategories(PRODUCTS).map((category) => ({
  ...category,
  count: PRODUCTS.filter((product) => product.category === category.slug).length,
}));

export default function HomePage() {
  return (
    <StoreLayout>
      {/* ── HERO ── */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[.9fr_1.1fr] md:items-center md:gap-14 md:py-12 lg:px-8">
        <div className="order-2 md:order-1">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[.18em] text-neutral-500">
            RIGHT NOW / EVERY DAY
          </p>
          <h1 className="max-w-xl text-5xl font-black uppercase leading-[.9] tracking-[-.06em] sm:text-6xl lg:text-7xl">
            WEAR WHAT<br />YOU FEEL.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-neutral-600">
            T-shirts for the person you are, right now. 8 designs. One price: ₹999.
          </p>
          <Link
            href="/shop"
            className="btn-morph btn-yellow mt-7 inline-flex min-h-12 items-center gap-4 px-5 text-xs font-bold uppercase tracking-wider"
          >
            SHOP ALL DESIGNS <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Link
          href={`/products/${heroProduct.slug}`}
          className="group relative order-1 aspect-[4/3] overflow-hidden bg-[#FFFFFF] md:order-2 md:aspect-[5/4]"
        >
          <Image
            src={heroImage}
            alt={heroImageAlt}
            fill
            loading="eager"
            className="img-morph object-contain object-center"
            sizes="(max-width: 768px) 100vw, 55vw"
          />
          <span className="absolute bottom-3 right-3 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider">
            View the Tee <ArrowRight className="ml-2 inline h-3.5 w-3.5" />
          </span>
        </Link>
      </section>

      <section aria-labelledby="wear-your-mood-title" className="bg-[#111111] text-white">
        <div className="mx-auto grid max-w-7xl md:grid-cols-2">
          <div className="flex flex-col items-start justify-center px-5 py-8 sm:px-8 sm:py-10 md:px-12 md:py-12 lg:px-16">
            <p className="mb-3 text-[10px] font-mono font-semibold uppercase tracking-[.2em] text-white/55">RIGHTNOWLIFE / CUSTOM STUDIO</p>
            <h2 id="wear-your-mood-title" className="text-4xl font-black uppercase leading-[.9] tracking-[-.055em] sm:text-5xl lg:text-6xl">
              WEAR<br /><span className="text-[#FFB900]">YOUR MOOD</span>
            </h2>
            <p className="mt-4 text-base font-medium italic text-[#FFB900] sm:text-lg">Your vibe. Your statement. Your rules.</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/70 sm:text-base">
              Choose a mood, find your words, and preview a custom tee design.
            </p>
            <Link href="/wear-your-mood" className="btn-morph btn-yellow mt-6 inline-flex min-h-12 items-center gap-4 px-5 text-xs font-bold uppercase tracking-wider">
              EXPLORE YOUR VIBE <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
          <Link href="/wear-your-mood" aria-label="Create your custom Wear Your Mood tee" className="group relative order-first aspect-[4/3] overflow-hidden bg-[#F4F2EE] md:order-none md:aspect-[5/4]">
            <Image
              src="/products/wear-your-mood-hero.png"
              alt="RIGHTNOWLIFE custom tee preview"
              fill
              className="img-morph object-contain p-5 sm:p-8"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </Link>
        </div>
      </section>

      {/* ── ESSENTIAL TEES EDITORIAL ── */}
      <section className="bg-[#111111] text-white">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:grid-cols-[1fr_220px] sm:items-center sm:px-8 sm:py-7 md:px-12 lg:px-16">
          <div className="flex flex-col items-start">
            <p className="mb-2 text-[10px] font-mono font-semibold uppercase tracking-[.2em] text-white/55">
              The everyday edit
            </p>
            <h2 className="text-3xl font-black uppercase leading-[.92] tracking-[-.05em] sm:text-4xl">
              ESSENTIAL TEES
            </h2>
            <p className="mt-2 text-base font-medium italic text-[#FFB900] sm:text-lg">
              The everyday kind of essential.
            </p>
            <p className="mt-2 max-w-md text-sm leading-5 text-white/70">
              Clean style. Everyday comfort. Made to be worn on repeat.
            </p>
            <Link
              href="/collections/essentials"
              className="btn-morph btn-yellow mt-4 inline-flex min-h-11 items-center gap-4 px-5 text-xs font-bold uppercase tracking-wider"
            >
              EXPLORE ESSENTIALS <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <Link
            href="/collections/essentials"
            aria-label="Explore Essential Tees"
            className="group relative order-first aspect-[2/1] max-h-36 overflow-hidden bg-[#F4F2EE] sm:order-none sm:aspect-[4/3] sm:max-h-none"
          >
            <Image
              src={essentialsImage}
              alt={essentialsImageAlt}
              fill
              className="img-morph object-contain p-2 sm:p-4"
              sizes="(max-width: 640px) 100vw, 220px"
            />
          </Link>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section id="categories" className="border-y border-[#E5E5E5] bg-[#FFFFFF]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-12 lg:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="mb-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-neutral-500">
                Shop by vibe
              </p>
              <h2 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">Categories</h2>
            </div>
            <Link href="/shop" className="text-xs font-semibold text-[#0876A8] hover:underline">
              Browse the shop <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {categoryCards.map((category) => (
              <Link
                key={category.slug}
                href={`/shop?category=${category.slug}`}
                className="group relative aspect-[1.3] overflow-hidden bg-white"
              >
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  className="img-morph object-cover object-center"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 text-white">
                  <div className="mb-1 flex items-center justify-between gap-3 text-[9px] font-mono uppercase tracking-widest text-white/80">
                    <span>{category.count} {category.count === 1 ? "tee" : "tees"}</span>
                    <span>Explore</span>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <span className="text-lg font-bold uppercase tracking-tight">{category.name}</span>
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-white/70 transition-colors group-hover:border-[#FFB900] group-hover:bg-[#FFB900] group-hover:text-[#111111]">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
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
