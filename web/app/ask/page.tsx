"use client";

import { useState } from "react";

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer("thinking…");
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
    <>
      <div className="toolbar">
        <input
          type="search"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Ask the knowledge base… e.g. what do they think about China?"
          style={{ flex: 1 }}
        />
        <button onClick={ask} disabled={busy}>
          {busy ? "Thinking…" : "Ask"}
        </button>
      </div>
      <div className="meta">
        Answers are synthesized by Gemini from the knowledge-base records only — creators&apos; opinions,
        not verified facts.
      </div>
      {answer !== null && <div className="answer">{answer}</div>}
    </>
  );
}
