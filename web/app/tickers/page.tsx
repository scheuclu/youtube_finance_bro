import { Search } from "lucide-react";
import { getTickerMentions, getTopTickers } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TickerBars } from "../charts";
import { SectionTitle, SentimentBadge, STANCE_DOT, STANCE_TONE } from "../ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TickersPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t = "" } = await searchParams;
  const [rows, top] = await Promise.all([getTickerMentions(t), getTopTickers(10)]);

  return (
    <div className="space-y-6">
      <Card className="glass border-border bg-card py-5">
        <CardContent className="px-5">
          <SectionTitle right={<span className="text-[11px] text-muted-foreground">by mentions</span>}>
            Coverage by ticker
          </SectionTitle>
          <TickerBars data={top} />
        </CardContent>
      </Card>

      <form className="flex gap-2" method="GET">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="t"
            defaultValue={t}
            placeholder="Filter by ticker…"
            className="h-10 rounded-xl border-border bg-card pl-9 font-mono"
          />
        </div>
        <Button type="submit" className="h-10 rounded-xl">
          Filter
        </Button>
      </form>

      {rows.length === 0 ? (
        <Card className="glass border-dashed border-border bg-card">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No ticker mentions{t ? " match" : " yet"}.
          </CardContent>
        </Card>
      ) : (
        <Card className="glass overflow-hidden border-border bg-card py-0">
          <CardContent className="divide-y divide-border px-0 py-0">
            {rows.map((m, i) => (
              <div key={i} className="flex gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                <div className="w-24 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", STANCE_DOT[m.stance] ?? STANCE_DOT.mentioned)} />
                    <span className="font-mono text-sm font-bold tracking-tight">{m.ticker}</span>
                  </div>
                  <div className={cn("mt-0.5 text-[11px] font-medium capitalize", STANCE_TONE[m.stance])}>
                    {m.stance}
                  </div>
                  <div className="tabular mt-0.5 text-[11px] text-muted-foreground">
                    {m.price_target
                      ? `PT ${m.price_target}${m.price_target_currency ? ` ${m.price_target_currency}` : ""}`
                      : (m.published_at ?? "").slice(0, 10)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  {m.thesis && <p className="text-[13.5px] leading-relaxed text-foreground/80">{m.thesis}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-md truncate transition-colors hover:text-primary"
                    >
                      {m.title}
                    </a>
                    <span aria-hidden>·</span>
                    <span>{m.channel}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular">{(m.published_at ?? "").slice(0, 10)}</span>
                  </div>
                </div>

                <div className="shrink-0 self-start">
                  <SentimentBadge value={m.sentiment} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
