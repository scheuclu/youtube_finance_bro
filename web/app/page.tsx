import { Globe, Search } from "lucide-react";
import { getChannels, getFeed } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bullets, SentimentBadge, TickerChip } from "./ui";

export const dynamic = "force-dynamic";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; channel?: string }>;
}) {
  const { q = "", channel = "" } = await searchParams;
  const [items, channels] = await Promise.all([getFeed(q, channel), getChannels()]);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" method="GET">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search summaries and theses (full-text)…"
          className="min-w-56 flex-1"
        />
        <select
          name="channel"
          defaultValue={channel}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs dark:bg-input/30"
        >
          <option value="">All channels</option>
          {channels.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          <Search className="size-4" /> Search
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No summaries{q || channel ? " match your filters" : " yet — they appear here as videos are processed"}.
        </p>
      ) : (
        items.map((r) => (
          <Card key={r.id} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base leading-snug">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:underline"
                >
                  {r.title}
                </a>
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                {r.channel} · {r.published_at.slice(0, 10)} <SentimentBadge value={r.overall_sentiment} />
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{r.tldr}</p>
              <Bullets md={r.summary_md} />
              {r.mentions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.mentions.map((m, i) => (
                    <TickerChip m={m} key={i} />
                  ))}
                </div>
              )}
              {r.macro_view && (
                <div className="mt-4 flex gap-2 rounded-lg border-l-2 border-primary/40 bg-muted/40 p-3 text-sm text-muted-foreground">
                  <Globe className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{r.macro_view}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
