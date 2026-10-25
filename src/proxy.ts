
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminLoginProxyHeaders } from "@/lib/auth/admin-login-rate-limit";

export async function proxy(request: NextRequest) {
  let requestHeaders = getAdminLoginProxyHeaders(
    request.headers,
    request.nextUrl.pathname,
    process.env.NODE_ENV,
    request.nextUrl.hostname,
  );
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        requestHeaders = getAdminLoginProxyHeaders(
          request.headers,
          request.nextUrl.pathname,
          process.env.NODE_ENV,
          request.nextUrl.hostname,
        );
        response = NextResponse.next({ request: { headers: requestHeaders } });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
