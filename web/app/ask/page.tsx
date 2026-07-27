"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authConfigured, supabaseBrowser } from "@/lib/supabase";

const SUGGESTIONS = [
  "What's the current view on China?",
  "Any bullish calls this month?",
  "Where do the creators disagree?",
  "Summarize the macro outlook",
];

function SessionBar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!authConfigured) return;
    try {
      supabaseBrowser()
        .auth.getUser()
        .then(({ data }) => setEmail(data.user?.email ?? null))
        .catch(() => setEmail(null));
    } catch {
      setEmail(null);
    }
  }, []);

  if (!email) return null; // dev/preview (gate skipped) or not yet loaded
  return (
    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
      {email}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 rounded-full px-2 text-[11px]"
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

/** Minimal markdown renderer for model output: headings, lists, bold, italics. */
function inline(text: string): React.ReactNode[] {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
    i % 2 ? (
      <b key={i} className="font-semibold text-foreground">
        {part}
      </b>
    ) : (
      // Leftover single asterisks are italics — render the text without them.
      <span key={i}>{part.replace(/\*([^*\n]+)\*/g, "$1")}</span>
    )
  );
}

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={i} className="relative pl-4">
        <span className="absolute left-0 top-[0.62em] size-1 rounded-full bg-primary/50" />
        {inline(it)}
      </li>
    ));
    blocks.push(
      <ul key={`l${blocks.length}`} className="space-y-1.5">
        {items}
      </ul>
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push(
        <h3 key={`h${blocks.length}`} className="pt-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {inline(heading[1].replace(/^\d+[.)]\s*/, ""))}
        </h3>
      );
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flush();
      blocks.push(<div key={`r${blocks.length}`} className="rule-fade my-1" />);
      continue;
    }
    const bullet = /^\s*[-*\u2022]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const item = (bullet ?? numbered)![1];
      if (!list) list = { ordered: Boolean(numbered), items: [] };
      list.items.push(item);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    flush();
    blocks.push(
      <p key={`p${blocks.length}`} className="leading-relaxed">
        {inline(line)}
      </p>
    );
  }
  flush();
  return <div className="space-y-3">{blocks}</div>;
}

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setQuestion(q);
    setAsked(q);
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
    <div className="mx-auto max-w-3xl space-y-5">
      <SessionBar />

      <div className="text-center">
        <div className="brand-mark mx-auto flex size-11 items-center justify-center rounded-2xl">
          <Sparkles className="size-5 text-white" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Ask the knowledge base</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Grounded in every video summary and ticker thesis collected so far.
        </p>
      </div>

      <div className="glass flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="e.g. what do they think about China?"
          className="h-10 border-0 bg-transparent text-[15px] shadow-none focus-visible:ring-0"
        />
        <Button
          onClick={() => ask()}
          disabled={busy || !question.trim()}
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          aria-label="Ask"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>

      {!asked && (
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {busy && (
        <Card className="glass border-border bg-card">
          <CardContent className="space-y-2.5 py-5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-3/4" />
          </CardContent>
        </Card>
      )}

      {answer !== null && !busy && (
        <Card className="glass border-border bg-card">
          <CardContent className="py-5">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Gemini · grounded answer
              </span>
            </div>
            <div className="text-[14.5px] leading-relaxed text-foreground/85">
              <Markdown text={answer} />
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Synthesized from knowledge-base records only — creators&apos; opinions, not verified facts.
      </p>
    </div>
  );
}
