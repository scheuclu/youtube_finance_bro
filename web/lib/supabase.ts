/**
 * Supabase Auth helpers (@supabase/ssr) — same access-control model as the
 * AssetTracker project: sign-ups are DISABLED in the Supabase dashboard
 * (Authentication → Sign In / Up → "Allow new users to sign up" off), so the
 * only accounts are the ones the owner creates there. A valid session IS the
 * allowlist.
 *
 * In this project only the Ask tab (/ask + /api/ask) is gated — the rest of
 * the dashboard is public. See proxy.ts.
 */

import { createBrowserClient } from "@supabase/ssr";

/** False when the deployment has no Supabase env vars (auth can't work). */
export const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
