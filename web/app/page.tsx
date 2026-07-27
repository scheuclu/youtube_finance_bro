import { ExternalLink, Globe, Search } from "lucide-react";
import { getChannels, getFeed, getKbStats, getSentimentSplit, getTopTickers } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SentimentSplit, TickerBars } from "./charts";
import { Bullets, ChannelAvatar, SectionTitle, SentimentBadge, TickerChip } from "./ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RAIL: Record<string, string> = {
  bullish: "bg-gradient-to-b from-emerald-400 to-emerald-600",
  bearish: "bg-gradient-to-b from-red-400 to-red-600",
  mixed: "bg-gradient-to-b from-amber-400 to-amber-600",
  neutral: "bg-gradient-to-b from-zinc-400 to-zinc-600",
};

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; channel?: string }>;
}) {
  const { q = "", channel = "" } = await searchParams;
  const [items, channels, split, topTickers, stats] = await Promise.all([
    getFeed(q, channel),
    getChannels(),
    getSentimentSplit(),
    getTopTickers(5),
    getKbStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* At-a-glance strip */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="glass border-border bg-card py-5 lg:col-span-2">
          <CardContent className="px-5">
            <SectionTitle>Sentiment mix</SectionTitle>
            <SentimentSplit counts={split} />
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
              {[
                ["Videos", stats.videos],
                ["Tickers", stats.tickers],
                ["Channels", stats.channels],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dd className="tabular text-xl font-semibold leading-none">{value}</dd>
                  <dt className="mt-1 text-[11px] text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card className="glass border-border bg-card py-5 lg:col-span-3">
          <CardContent className="px-5">
            <SectionTitle>Most discussed</SectionTitle>
            <TickerBars data={topTickers} />
          </CardContent>
        </Card>
      </div>

      <form className="flex flex-wrap gap-2" method="GET">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search summaries and theses…"
            className="h-10 rounded-xl border-border bg-card pl-9"
          />
        </div>
        <select
          name="channel"
          defaultValue={channel}
          className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
        >
          <option value="">All channels</option>
          {channels.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button type="submit" className="h-10 rounded-xl">
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <Card className="glass border-dashed border-border bg-card">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No summaries{q || channel ? " match your filters" : " yet — they appear here as videos are processed"}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <Card key={r.id} className="glass lift relative overflow-hidden border-border bg-card py-0">
              <div className={cn("absolute inset-y-0 left-0 w-[3px]", RAIL[r.overall_sentiment] ?? RAIL.neutral)} />
              <CardContent className="px-6 py-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <ChannelAvatar name={r.channel} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground/80">{r.channel}</div>
                    <div className="tabular text-[11px] text-muted-foreground">{r.published_at.slice(0, 10)}</div>
                  </div>
                  <SentimentBadge value={r.overall_sentiment} />
                </div>

                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-start gap-1.5 text-[17px] font-semibold leading-snug tracking-tight transition-colors hover:text-primary"
                >
                  {r.title}
                  <ExternalLink className="mt-1.5 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                </a>

                <p className="mt-2 text-sm leading-relaxed text-foreground/75">{r.tldr}</p>
                <Bullets md={r.summary_md} />

                {r.mentions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {r.mentions.map((m, i) => (
                      <TickerChip m={m} key={i} />
                    ))}
                  </div>
                )}

                {r.macro_view && (
                  <div className="mt-4 flex gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
                    <Globe className="mt-0.5 size-4 shrink-0 text-primary/70" aria-hidden />
                    <p className="text-[13px] leading-relaxed text-muted-foreground">{r.macro_view}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
