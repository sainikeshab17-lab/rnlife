export const PRODUCT_CATEGORIES = [
  {
    name: "Hot Girl Stuff",
    slug: "hot-girl-stuff",
    image: "/products/rightnowlife-designs/design_08_02_front.png",
  },
  {
    name: "Monday to Friday",
    slug: "monday-to-friday",
    image: "/products/rightnowlife-designs/design_02_02_front.png",
  },
  {
    name: "Social Battery",
    slug: "social-battery",
    image: "/products/rightnowlife-designs/design_07_02_front.png",
  },
  {
    name: "Relationship Status",
    slug: "relationship-status",
    image: "/products/rightnowlife-designs/design_01_02_front.png",
  },
  {
    name: "Brutally Honest",
    slug: "brutally-honest",
    image: "/products/rightnowlife-designs/design_07_02_front.png",
  },
  {
    name: "Everyday Chaos",
    slug: "everyday-chaos",
    image: "/products/rightnowlife-designs/design_05_02_front.png",
  },
  {
    name: "Friday Mode",
    slug: "friday-mode",
    image: "/products/rightnowlife-designs/design_02_02_front.png",
  },
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["slug"];

const normalizeCategoryValue = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function normalizeProductCategory(value: string | null): ProductCategory | null {
  if (value === null) return null;

  const normalizedValue = normalizeCategoryValue(value);
  return (
    PRODUCT_CATEGORIES.find(
      ({ name, slug }) =>
        slug === normalizedValue || normalizeCategoryValue(name) === normalizedValue
    )?.slug ?? null
  );
}
