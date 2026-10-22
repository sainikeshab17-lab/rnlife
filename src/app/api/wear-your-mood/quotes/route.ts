import { NextRequest, NextResponse } from "next/server";
import { generateMoodQuotes, MOOD_QUOTE_REQUEST_SCHEMA } from "@/services/mood-quotes";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a mood and quote style to continue." }, { status: 400 });
  }

  const parsed = MOOD_QUOTE_REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check your mood, quote style, and story length." }, { status: 400 });
  }

  // Stories are used only for this deterministic response and are never logged or persisted.
  return NextResponse.json({ quotes: generateMoodQuotes(parsed.data), source: "deterministic" });
}
