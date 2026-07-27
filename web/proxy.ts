/**
 * Supabase Auth gate for the Ask feature ONLY.
 *
 * /ask (UI) and /api/ask (the Gemini-spending endpoint) require a signed-in
 * user; every other route stays public. Accounts are invite-only — sign-ups
 * are disabled in the Supabase dashboard.
 *
 * Local development (`next dev`) and Vercel preview deployments skip the gate
 * so localhost and PR previews never ask for a login; set FORCE_AUTH=1 to
 * re-enable while testing the auth flow itself. DISABLE_AUTH=1 force-disables
 * in any environment. Production is always gated.
 */

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(req: NextRequest) {
  const unGated =
    process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";
  const devSkip = unGated && process.env.FORCE_AUTH !== "1";
  if (devSkip || process.env.DISABLE_AUTH === "1") {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Misconfigured rather than unauthenticated: fail CLOSED (the Ask endpoint
    // spends tokens) but with a clear message instead of a 500 stack trace.
    return req.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Sign-in is not configured on this deployment." }, { status: 503 })
      : NextResponse.redirect(new URL("/login?unconfigured=1", req.url));
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          // Refresh rotated session cookies on both the request (for this
          // pass) and the response (for the browser).
          cookies.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in to use Ask." }, { status: 401 });
    }
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }

  return res;
}

export const config = {
  // Only the Ask surfaces are gated; everything else never enters this middleware.
  matcher: ["/ask", "/api/ask"],
};
