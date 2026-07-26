import { NextRequest, NextResponse } from "next/server";
import { getAskContext } from "@/lib/queries";

const MODEL = "gemini-3.6-flash";
const SYSTEM = [
  "You answer questions from a personal knowledge base of YouTube finance video analyses.",
  "Base your answer ONLY on the provided records; cite the video title and date for each claim.",
  "Note disagreements between creators. These are creators' opinions, not verified facts — reflect that framing.",
].join(" ");

// Best-effort rate limit (per warm serverless instance). The GEMINI_API_KEY
// should additionally be a free-tier/quota-capped key so worst case is $0.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "rate limited — try again in a minute" }, { status: 429 });

  let question: string;
  try {
    const body = await req.json();
    question = String(body.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (!question || question.length > 500) {
    return NextResponse.json({ error: "question must be 1-500 characters" }, { status: 400 });
  }

  const context = await getAskContext();
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `<summaries>\n${JSON.stringify(context.summaries)}\n</summaries>\n<ticker_mentions>\n${JSON.stringify(context.mentions)}\n</ticker_mentions>\n\nQuestion: ${question}`,
              },
            ],
          },
        ],
      }),
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    return NextResponse.json(
      { error: data.error?.message ?? `upstream error ${resp.status}` },
      { status: 502 }
    );
  }
  const answer =
    data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
    "(empty response)";
  return NextResponse.json({ answer });
}
