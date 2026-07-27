"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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
