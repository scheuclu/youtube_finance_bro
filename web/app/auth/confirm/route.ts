/**
 * Magic-link landing: establishes the session cookie, then sends the user to
 * the Ask tab. Handles BOTH link styles:
 *  - ?code=...        — Supabase's default email template (PKCE exchange)
 *  - ?token_hash=...  — the customized template from the @supabase/ssr docs
 */

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const code = req.nextUrl.searchParams.get("code");
  const type = (req.nextUrl.searchParams.get("type") ?? "email") as EmailOtpType;

  const dest = req.nextUrl.clone();
  dest.pathname = "/ask";
  dest.search = "";
  const res = NextResponse.redirect(dest);

  if (!tokenHash && !code) {
    dest.pathname = "/login";
    return NextResponse.redirect(dest);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  );

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ type, token_hash: tokenHash! });
  if (error) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return res;
}
