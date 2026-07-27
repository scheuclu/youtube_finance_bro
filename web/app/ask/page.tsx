"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseBrowser } from "@/lib/supabase";

function SessionBar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  if (!email) return null; // dev/preview (gate skipped) or not yet loaded
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
      {email}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={async () => {
          await supabaseBrowser().auth.signOut();
          router.replace("/");
          router.refresh();
        }}
      >
        <LogOut className="size-3" /> Sign out
      </Button>
    </div>
  );
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer(null);
    try {
      const resp = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await resp.json();
      setAnswer(resp.ok ? data.answer : `Error: ${data.error ?? resp.status}`);
    } catch (e) {
      setAnswer(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SessionBar />
      <div className="flex gap-2">
        <Input
          type="search"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask the knowledge base… e.g. what do they think about China?"
          className="flex-1"
        />
        <Button onClick={ask} disabled={busy || !question.trim()}>
          <Sparkles className="size-4" />
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Answers are synthesized by Gemini from the knowledge-base records only — creators&apos; opinions, not
        verified facts.
      </p>

      {busy && (
        <Card>
          <CardContent className="space-y-2 py-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </CardContent>
        </Card>
      )}
      {answer !== null && !busy && (
        <Card>
          <CardContent className="whitespace-pre-wrap py-5 text-sm leading-relaxed">
            {answer.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
              i % 2 ? (
                <b key={i} className="font-semibold">
                  {part}
                </b>
              ) : (
                part.replace(/(^|\s)\*(\S[^*]*\S)\*(?=\s|$|[.,;:])/g, "$1$2")
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
