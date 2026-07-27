import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock,
  Minus,
  Scale,
  Send,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TickerMention } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const STANCE_STYLE: Record<string, string> = {
  buy: "text-emerald-600 dark:text-emerald-400",
  sell: "text-red-600 dark:text-red-400",
  hold: "text-amber-600 dark:text-amber-400",
  watch: "text-amber-600 dark:text-amber-400",
  mentioned: "text-muted-foreground",
};

export function SentimentBadge({ value }: { value: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    bullish: {
      icon: <ArrowUpRight className="size-3" />,
      cls: "text-emerald-600 dark:text-emerald-400 border-emerald-600/30",
    },
    bearish: {
      icon: <ArrowDownRight className="size-3" />,
      cls: "text-red-600 dark:text-red-400 border-red-600/30",
    },
    neutral: { icon: <Minus className="size-3" />, cls: "text-muted-foreground" },
    mixed: { icon: <Scale className="size-3" />, cls: "text-amber-600 dark:text-amber-400 border-amber-600/30" },
  };
  const m = map[value] ?? map.neutral;
  return (
    <Badge variant="outline" className={cn("gap-1", m.cls)}>
      {m.icon}
      {value}
    </Badge>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    notified: {
      icon: <CheckCircle2 className="size-3" />,
      label: "delivered",
      cls: "text-emerald-600 dark:text-emerald-400 border-emerald-600/30",
    },
    summarized: { icon: <Send className="size-3" />, label: "sending", cls: "text-primary border-primary/30" },
    new: {
      icon: <Clock className="size-3" />,
      label: "processing",
      cls: "text-amber-600 dark:text-amber-400 border-amber-600/30",
    },
    pending_transcript: {
      icon: <Clock className="size-3" />,
      label: "processing",
      cls: "text-amber-600 dark:text-amber-400 border-amber-600/30",
    },
    failed: {
      icon: <XCircle className="size-3" />,
      label: "failed",
      cls: "text-red-600 dark:text-red-400 border-red-600/30",
    },
    transcript_failed: {
      icon: <XCircle className="size-3" />,
      label: "no summary",
      cls: "text-red-600 dark:text-red-400 border-red-600/30",
    },
    seen_skipped: { icon: <CircleDashed className="size-3" />, label: "skipped", cls: "text-muted-foreground" },
  };
  const m = map[value] ?? { icon: <CircleDashed className="size-3" />, label: value, cls: "text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap", m.cls)}>
      {m.icon}
      {m.label}
    </Badge>
  );
}

export function TickerChip({ m }: { m: TickerMention }) {
  const pt = m.price_target
    ? ` · PT ${m.price_target}${m.price_target_currency ? ` ${m.price_target_currency}` : ""}`
    : "";
  return (
    <Link href={`/tickers?t=${encodeURIComponent(m.ticker)}`} title={m.thesis ?? ""}>
      <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 transition-colors hover:bg-secondary/60">
        <span className={cn("font-bold", STANCE_STYLE[m.stance])}>{m.ticker}</span>
        <span className="text-muted-foreground">
          {m.stance}
          {pt}
        </span>
      </Badge>
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
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
      {lines.map((l, i) => (
        <li key={i}>
          {l.split(/\*\*([^*]+)\*\*/g).map((part, j) =>
            j % 2 ? (
              <b key={j} className="font-semibold text-foreground/80">
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
