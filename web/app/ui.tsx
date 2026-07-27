import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TickerMention } from "@/lib/queries";

/* ---------- tokens ---------- */

export const SENTIMENT_TONE: Record<string, string> = {
  bullish: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  bearish: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/25",
  neutral: "text-muted-foreground bg-muted border-border",
  mixed: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
};

export const SENTIMENT_DOT: Record<string, string> = {
  bullish: "bg-emerald-500",
  bearish: "bg-red-500",
  neutral: "bg-zinc-400",
  mixed: "bg-amber-500",
};

export const STANCE_TONE: Record<string, string> = {
  buy: "text-emerald-600 dark:text-emerald-400",
  sell: "text-red-600 dark:text-red-400",
  hold: "text-amber-600 dark:text-amber-400",
  watch: "text-amber-600 dark:text-amber-400",
  mentioned: "text-muted-foreground",
};

export const STANCE_DOT: Record<string, string> = {
  buy: "bg-emerald-500",
  sell: "bg-red-500",
  hold: "bg-amber-500",
  watch: "bg-amber-500",
  mentioned: "bg-zinc-400",
};

const STATUS_TONE: Record<string, { label: string; cls: string; dot: string }> = {
  notified: {
    label: "delivered",
    cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    dot: "bg-emerald-500",
  },
  summarized: { label: "sending", cls: "text-primary bg-primary/10 border-primary/25", dot: "bg-primary" },
  new: {
    label: "processing",
    cls: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
    dot: "bg-amber-500 animate-pulse",
  },
  pending_transcript: {
    label: "processing",
    cls: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
    dot: "bg-amber-500 animate-pulse",
  },
  failed: { label: "failed", cls: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/25", dot: "bg-red-500" },
  transcript_failed: {
    label: "no summary",
    cls: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/25",
    dot: "bg-red-500",
  },
  seen_skipped: { label: "skipped", cls: "text-muted-foreground bg-muted border-border", dot: "bg-zinc-400" },
};

/* ---------- pills ---------- */

function Pill({ tone, dot, children }: { tone: string; dot: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize",
        tone
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function SentimentBadge({ value }: { value: string }) {
  return (
    <Pill tone={SENTIMENT_TONE[value] ?? SENTIMENT_TONE.neutral} dot={SENTIMENT_DOT[value] ?? SENTIMENT_DOT.neutral}>
      {value}
    </Pill>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const s = STATUS_TONE[value] ?? { label: value, cls: SENTIMENT_TONE.neutral, dot: "bg-zinc-400" };
  return (
    <Pill tone={s.cls} dot={s.dot}>
      {s.label}
    </Pill>
  );
}

/** Ticker pill — mono symbol, stance dot, optional price target. */
export function TickerChip({ m }: { m: TickerMention }) {
  return (
    <Link
      href={`/tickers?t=${encodeURIComponent(m.ticker)}`}
      title={m.thesis ?? undefined}
      className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <span className={cn("size-1.5 rounded-full", STANCE_DOT[m.stance] ?? STANCE_DOT.mentioned)} />
      <span className="font-mono font-semibold tracking-tight">{m.ticker}</span>
      <span className={cn("capitalize", STANCE_TONE[m.stance])}>{m.stance}</span>
      {m.price_target ? (
        <span className="tabular text-muted-foreground">
          {m.price_target}
          {m.price_target_currency ? ` ${m.price_target_currency}` : ""}
        </span>
      ) : null}
    </Link>
  );
}

/** Channel monogram. */
export function ChannelAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-[10px] font-bold text-muted-foreground">
      {initials}
    </span>
  );
}

/** summary_md bullets with a custom marker and **bold** support. */
export function Bullets({ md }: { md: string }) {
  const lines = (md || "")
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <ul className="mt-3.5 space-y-2">
      {lines.map((l, i) => (
        <li key={i} className="relative pl-4 text-[13.5px] leading-relaxed text-muted-foreground">
          <span className="absolute left-0 top-[0.6em] size-1 rounded-full bg-primary/50" />
          {l.split(/\*\*([^*]+)\*\*/g).map((part, j) =>
            j % 2 ? (
              <b key={j} className="font-semibold text-foreground/85">
                {part}
              </b>
            ) : (
              part
            )
          )}
        </li>
      ))}
    </ul>
  );
}

/** Section heading with a fading rule. */
export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h2>
      <div className="rule-fade flex-1" />
      {right}
    </div>
  );
}
