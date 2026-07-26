import { getChannels, getFeed } from "@/lib/queries";
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
    <>
      <form className="toolbar" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search summaries and theses (full-text)…"
        />
        <select name="channel" defaultValue={channel}>
          <option value="">All channels</option>
          {channels.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button type="submit">Search</button>
      </form>

      {items.length === 0 ? (
        <div className="notice">
          No summaries{q || channel ? " match your filters" : " yet — they appear here as videos are processed"}.
        </div>
      ) : (
        items.map((r) => (
          <article className="card" key={r.id}>
            <h3>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.title}
              </a>
            </h3>
            <div className="sub">
              {r.channel} · {r.published_at.slice(0, 10)} <SentimentBadge value={r.overall_sentiment} />
            </div>
            <div>{r.tldr}</div>
            <Bullets md={r.summary_md} />
            {r.mentions.length > 0 && (
              <div className="chips">
                {r.mentions.map((m, i) => (
                  <TickerChip m={m} key={i} />
                ))}
              </div>
            )}
            {r.macro_view && <div className="macro">🌍 {r.macro_view}</div>}
          </article>
        ))
      )}
    </>
  );
}
