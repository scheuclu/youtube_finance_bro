import { getPipeline } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "../ui";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { counts, channels, recent } = await getPipeline();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const inflight = (counts.new ?? 0) + (counts.pending_transcript ?? 0) + (counts.summarized ?? 0);
  const tiles: [string, number][] = [
    ["Videos tracked", total],
    ["Delivered", counts.notified ?? 0],
    ["In flight", inflight],
    ["Failed", (counts.failed ?? 0) + (counts.transcript_failed ?? 0)],
    ["Skipped (pre-history)", counts.seen_skipped ?? 0],
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <Card key={label} className="py-4">
            <CardContent className="px-4">
              <div className="text-3xl font-bold tracking-tight">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Channels</h2>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Videos</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Latest video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="tabular-nums">{c.n}</TableCell>
                  <TableCell className="tabular-nums">{c.done}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{(c.latest ?? "").slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No processed videos yet.</p>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((i, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="max-w-md">
                      <a
                        href={i.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="whitespace-normal font-medium hover:text-primary hover:underline"
                      >
                        {i.title}
                      </a>
                      <span className="text-xs text-muted-foreground"> · {i.channel}</span>
                      {i.last_error && i.status !== "notified" && (
                        <p className="mt-1 whitespace-normal text-xs text-red-600 dark:text-red-400">{i.last_error}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={i.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {i.has_transcript ? "captions" : "video (direct)"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {(i.updated_at ?? "").replace("T", " ").replace("Z", "")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
