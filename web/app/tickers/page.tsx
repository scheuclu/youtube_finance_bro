import { getTickerMentions } from "@/lib/queries";
import { SENTIMENT, STANCE } from "../ui";

export const dynamic = "force-dynamic";

export default async function TickersPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t = "" } = await searchParams;
  const rows = await getTickerMentions(t);

  return (
    <>
      <form className="toolbar" method="GET">
        <input type="search" name="t" defaultValue={t} placeholder="Filter by ticker, e.g. NVDA…" />
        <button type="submit">Filter</button>
      </form>

      {rows.length === 0 ? (
        <div className="notice">No ticker mentions{t ? " match" : " yet"}.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Ticker</th>
              <th>Stance</th>
              <th>Sentiment</th>
              <th>PT</th>
              <th>Thesis · video</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i}>
                <td className="num">{(m.published_at ?? "").slice(0, 10)}</td>
                <td>
                  <b>{m.ticker}</b>
                </td>
                <td>
                  {STANCE[m.stance] ?? "⚪️"} {m.stance}
                </td>
                <td>
                  <span className={`badge ${m.sentiment}`}>{SENTIMENT[m.sentiment] ?? m.sentiment}</span>
                </td>
                <td className="num">
                  {m.price_target ? `${m.price_target}${m.price_target_currency ? ` ${m.price_target_currency}` : ""}` : "–"}
                </td>
                <td>
                  {m.thesis && <div className="thesis">{m.thesis}</div>}
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    {m.title}
                  </a>
                  <span className="meta"> · {m.channel}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
