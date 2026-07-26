import Link from "next/link";
import type { TickerMention } from "@/lib/queries";

export const STANCE: Record<string, string> = {
  buy: "🟢",
  sell: "🔴",
  hold: "🟡",
  watch: "🟡",
  mentioned: "⚪️",
};

export const SENTIMENT: Record<string, string> = {
  bullish: "▲ bullish",
  bearish: "▼ bearish",
  neutral: "◆ neutral",
  mixed: "± mixed",
};

export const STATUS_LABEL: Record<string, string> = {
  notified: "✓ delivered",
  summarized: "✉ sending",
  new: "⏳ processing",
  pending_transcript: "⏳ processing",
  failed: "✗ failed",
  transcript_failed: "✗ no summary",
  seen_skipped: "– skipped",
};

export function SentimentBadge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{SENTIMENT[value] ?? value}</span>;
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge st-${value}`}>{STATUS_LABEL[value] ?? value}</span>;
}

export function TickerChip({ m }: { m: TickerMention }) {
  const pt = m.price_target
    ? ` · PT ${m.price_target}${m.price_target_currency ? ` ${m.price_target_currency}` : ""}`
    : "";
  return (
    <Link className="chip" href={`/tickers?t=${encodeURIComponent(m.ticker)}`} title={m.thesis ?? ""}>
      {STANCE[m.stance] ?? "⚪️"} <b>{m.ticker}</b> {m.stance}
      {pt}
    </Link>
  );
}

/** Render summary_md bullets: strip list markers, honor **bold**. */
export function Bullets({ md }: { md: string }) {
  const lines = (md || "")
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <ul>
      {lines.map((l, i) => (
        <li key={i}>
          {l.split(/\*\*([^*]+)\*\*/g).map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part))}
        </li>
      ))}
    </ul>
  );
}
