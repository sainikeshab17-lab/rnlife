import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "signup" | "email" | "recovery" | null;
  const next = searchParams.get("next") || "/account";

  // Sanitize next destination to prevent open redirect vulnerabilities
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}?verified=true`);
    }
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type === "signup" ? "signup" : "email",
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}?verified=true`);
    }
  }

  // If verification failed, code is expired or invalid
  return NextResponse.redirect(
    `${origin}/register?error=verification_failed&reason=expired_or_invalid`
  );
}
