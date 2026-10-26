import { NextResponse } from "next/server";
import { getProductGenderConfiguration } from "@/services/product-genders";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const configuration = await getProductGenderConfiguration(slug);
    return NextResponse.json(configuration, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(`[product-genders] Unable to load options for ${slug}.`, error);
    return NextResponse.json({ error: "Product options are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
