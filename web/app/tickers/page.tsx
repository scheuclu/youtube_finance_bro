import { Filter } from "lucide-react";
import { getTickerMentions } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SentimentBadge, STANCE_STYLE } from "../ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TickersPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t = "" } = await searchParams;
  const rows = await getTickerMentions(t);

  return (
    <div className="space-y-4">
      <form className="flex gap-2" method="GET">
        <Input type="search" name="t" defaultValue={t} placeholder="Filter by ticker, e.g. NVDA…" className="max-w-xs" />
        <Button type="submit" variant="secondary">
          <Filter className="size-4" /> Filter
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No ticker mentions{t ? " match" : " yet"}.</p>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Stance</TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead>PT</TableHead>
                <TableHead>Thesis · video</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {(m.published_at ?? "").slice(0, 10)}
                  </TableCell>
                  <TableCell className="font-bold">{m.ticker}</TableCell>
                  <TableCell>
                    <span className={cn("font-medium", STANCE_STYLE[m.stance])}>{m.stance}</span>
                  </TableCell>
                  <TableCell>
                    <SentimentBadge value={m.sentiment} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {m.price_target
                      ? `${m.price_target}${m.price_target_currency ? ` ${m.price_target_currency}` : ""}`
                      : "–"}
                  </TableCell>
                  <TableCell className="max-w-md">
                    {m.thesis && <p className="mb-1 whitespace-normal text-muted-foreground">{m.thesis}</p>}
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-normal text-xs hover:text-primary hover:underline"
                    >
                      {m.title}
                    </a>
                    <span className="text-xs text-muted-foreground"> · {m.channel}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
