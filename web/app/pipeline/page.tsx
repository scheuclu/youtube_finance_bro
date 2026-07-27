import { CheckCircle2, Clock, Film, XCircle } from "lucide-react";
import { getActivity, getPipeline } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityBars, Sparkline } from "../charts";
import { ChannelAvatar, SectionTitle, StatusBadge } from "../ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [{ counts, channels, recent }, activity] = await Promise.all([getPipeline(), getActivity(30)]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const inflight = (counts.new ?? 0) + (counts.pending_transcript ?? 0) + (counts.summarized ?? 0);
  const failed = (counts.failed ?? 0) + (counts.transcript_failed ?? 0);
  const spark = activity.map((a) => a.value);

  const tiles = [
    { label: "Videos tracked", value: total, icon: Film, tone: "text-primary", spark: true },
    { label: "Delivered", value: counts.notified ?? 0, icon: CheckCircle2, tone: "text-emerald-500", spark: true },
    { label: "In flight", value: inflight, icon: Clock, tone: "text-amber-500", spark: false },
    { label: "Failed", value: failed, icon: XCircle, tone: failed ? "text-red-500" : "text-muted-foreground", spark: false },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="glass lift border-border bg-card py-0">
            <CardContent className="px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
                <t.icon className={cn("size-4", t.tone)} aria-hidden />
              </div>
              <div className="mt-1 text-[32px] font-semibold leading-none tabular tracking-tight">{t.value}</div>
              <div className="mt-3 h-8">
                {t.spark ? <Sparkline values={spark} /> : <div className="rule-fade mt-4" />}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <SectionTitle right={<span className="text-[11px] text-muted-foreground">last 30 days</span>}>
          Coverage
        </SectionTitle>
        <Card className="glass border-border bg-card py-5">
          <CardContent className="px-5">
            <ActivityBars data={activity} />
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionTitle>Channels</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {channels.map((c) => {
            const pct = c.n ? Math.round((c.done / c.n) * 100) : 0;
            return (
              <Card key={c.name} className="glass lift border-border bg-card py-0">
                <CardContent className="flex items-center gap-3 px-5 py-4">
                  <ChannelAvatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      latest {(c.latest ?? "").slice(0, 10)}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular">
                      {c.done}
                      <span className="text-muted-foreground">/{c.n}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">analyzed</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle>Recent activity</SectionTitle>
        {recent.length === 0 ? (
          <Card className="glass border-dashed border-border bg-card">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No processed videos yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="glass overflow-hidden border-border bg-card py-0">
            <CardContent className="divide-y divide-border px-0 py-0">
              {recent.map((i, idx) => (
                <div key={idx} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm font-medium transition-colors hover:text-primary"
                    >
                      {i.title}
                    </a>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span>{i.channel}</span>
                      <span aria-hidden>·</span>
                      <span>{i.has_transcript ? "captions" : "direct video"}</span>
                      <span aria-hidden>·</span>
                      <span className="tabular">{(i.updated_at ?? "").replace("T", " ").replace("Z", "")}</span>
                    </div>
                    {i.last_error && i.status !== "notified" && (
                      <p className="mt-1 text-[11px] text-red-500">{i.last_error}</p>
                    )}
                  </div>
                  <StatusBadge value={i.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
