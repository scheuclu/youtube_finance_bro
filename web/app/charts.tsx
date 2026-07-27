/**
 * Lightweight SVG data-viz. Server-renderable (no hooks, no chart library).
 * Conventions: thin marks, rounded data-ends, recessive axes, no dual scales.
 */

import { cn } from "@/lib/utils";

/** Compact area+line trend, sized to its container. */
export function Sparkline({
  values,
  className,
  stroke = "var(--primary)",
}: {
  values: number[];
  className?: string;
  stroke?: string;
}) {
  const W = 120;
  const H = 30;
  const pad = 3;
  const pts = values.length ? values : [0, 0];
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const span = max - min || 1;
  const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);

  const line = pts.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const gradId = `spark-${stroke.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Vertical bars for per-day activity. Labels only at the ends (recessive axis). */
export function ActivityBars({
  data,
  className,
}: {
  data: { date: string; value: number }[];
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-28 items-end gap-[3px]">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.value}`}
              className="group relative flex-1 rounded-[3px] bg-foreground/[0.045] transition-colors hover:bg-foreground/[0.08]"
              style={{ height: "100%" }}
            >
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 rounded-[3px] transition-[height,opacity] duration-300",
                  d.value ? "bg-primary/85 group-hover:bg-primary" : "bg-transparent"
                )}
                style={{ height: `${Math.max(pct, d.value ? 6 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

const SENTIMENT_BAR: Record<string, string> = {
  bullish: "bg-emerald-500/80",
  bearish: "bg-red-500/80",
  neutral: "bg-zinc-400/70",
  mixed: "bg-amber-500/80",
};

/** Horizontal ranked bars — one row per ticker, split by sentiment mix. */
export function TickerBars({
  data,
  className,
}: {
  data: { ticker: string; total: number; bullish: number; bearish: number; neutral: number }[];
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);
  if (!data.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No ticker mentions yet.</p>;
  }
  return (
    <div className={cn("space-y-2.5", className)}>
      {data.map((d) => (
        <div key={d.ticker} className="flex items-center gap-3">
          <span className="w-16 shrink-0 truncate font-mono text-xs font-semibold">{d.ticker}</span>
          <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="flex h-full gap-px" style={{ width: `${(d.total / max) * 100}%` }}>
              {(["bullish", "neutral", "bearish"] as const).map((k) =>
                d[k] ? (
                  <div
                    key={k}
                    className={cn("h-full first:rounded-l-full last:rounded-r-full", SENTIMENT_BAR[k])}
                    style={{ flexGrow: d[k] }}
                    title={`${d[k]} ${k}`}
                  />
                ) : null
              )}
            </div>
          </div>
          <span className="w-6 shrink-0 text-right text-xs tabular text-muted-foreground">{d.total}</span>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-[11px] text-muted-foreground">
        {(["bullish", "neutral", "bearish"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", SENTIMENT_BAR[k])} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Single stacked bar showing the overall sentiment split. */
export function SentimentSplit({ counts }: { counts: Record<string, number> }) {
  const order = ["bullish", "mixed", "neutral", "bearish"] as const;
  const total = order.reduce((a, k) => a + (counts[k] ?? 0), 0);
  if (!total) return null;
  return (
    <div className="space-y-2">
      <div className="flex h-2.5 gap-px overflow-hidden rounded-full bg-muted">
        {order.map((k) =>
          counts[k] ? (
            <div
              key={k}
              className={cn("h-full first:rounded-l-full last:rounded-r-full", SENTIMENT_BAR[k])}
              style={{ flexGrow: counts[k] }}
              title={`${counts[k]} ${k}`}
            />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {order.map((k) =>
          counts[k] ? (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", SENTIMENT_BAR[k])} />
              {k} <span className="tabular text-foreground/70">{counts[k]}</span>
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}
