"use client";

/**
 * Sign-in page for the Ask feature. Accounts are invite-only (created in the
 * Supabase dashboard); there is deliberately no sign-up path here.
 */

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, MailCheck, MonitorPlay, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  async function signInWithPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/ask");
    router.refresh();
  }

  async function sendMagicLink() {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setLinkSent(true);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <MonitorPlay className="size-5" aria-hidden />
            <span className="text-sm font-bold text-foreground">
              Finance Bro <span className="text-primary">KB</span>
            </span>
          </div>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            The Ask tab needs an account — everything else is open. Access is invite-only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkSent ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-600/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
              <MailCheck className="mt-0.5 size-4 shrink-0" />
              Check your inbox — if that address has an account, a sign-in link is on its way.
            </div>
          ) : (
            <form onSubmit={signInWithPassword} className="space-y-3">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
              />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
              {error && (
                <p className="rounded-lg border border-red-600/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy || !email || !password}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                Sign in
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void sendMagicLink()}
              >
                <Send className="size-4" />
                Email me a sign-in link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
