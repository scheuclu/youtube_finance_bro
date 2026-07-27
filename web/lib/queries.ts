import { getDb } from "./db";

export interface FeedItem {
  id: number;
  title: string;
  url: string;
  published_at: string;
  channel: string;
  tldr: string;
  summary_md: string;
  macro_view: string | null;
  overall_sentiment: string;
  mentions: TickerMention[];
}

export interface TickerMention {
  ticker: string;
  stance: string;
  sentiment: string;
  thesis: string | null;
  price_target: number | null;
  price_target_currency: string | null;
  published_at?: string;
  title?: string;
  url?: string;
  channel?: string;
}

export interface PipelineData {
  counts: Record<string, number>;
  channels: { name: string; n: number; done: number; latest: string }[];
  recent: {
    title: string;
    url: string;
    status: string;
    channel: string;
    updated_at: string;
    last_error: string | null;
    has_transcript: number;
  }[];
  lastUpdated: string | null;
  summaryCount: number;
}

function ftsTerms(search: string): string {
  return (search.match(/\w+/g) ?? []).map((t) => `"${t}"`).join(" ");
}

export async function getFeed(search: string, channel: string): Promise<FeedItem[]> {
  const db = await getDb();
  let rows = db
    .prepare(
      `SELECT items.id, items.title, items.url, items.published_at, sources.name AS channel,
              s.tldr, s.summary_md, s.macro_view, s.overall_sentiment
       FROM summaries s JOIN items ON items.id = s.item_id
       JOIN sources ON sources.id = items.source_id
       ${channel ? "WHERE sources.name = ?" : ""}
       ORDER BY items.published_at DESC`
    )
    .all(...(channel ? [channel] : [])) as (FeedItem & { mentions: never })[];

  const terms = search ? ftsTerms(search) : "";
  if (terms) {
    const ids = new Set(
      (db.prepare("SELECT DISTINCT item_id FROM kb_fts WHERE kb_fts MATCH ?").all(terms) as {
        item_id: number;
      }[]).map((r) => r.item_id)
    );
    rows = rows.filter((r) => ids.has(r.id));
  }

  const mentionsStmt = db.prepare("SELECT * FROM ticker_mentions WHERE item_id = ? ORDER BY id");
  return rows.map((r) => ({ ...r, mentions: mentionsStmt.all(r.id) as TickerMention[] }));
}

export async function getChannels(): Promise<string[]> {
  const db = await getDb();
  return (db.prepare("SELECT DISTINCT name FROM sources ORDER BY name").all() as { name: string }[]).map(
    (r) => r.name
  );
}

export async function getTickerMentions(filter: string): Promise<TickerMention[]> {
  const db = await getDb();
  return db
    .prepare(
      `SELECT tm.ticker, tm.stance, tm.sentiment, tm.thesis, tm.price_target, tm.price_target_currency,
              items.published_at, items.title, items.url, sources.name AS channel
       FROM ticker_mentions tm JOIN items ON items.id = tm.item_id
       JOIN sources ON sources.id = items.source_id
       ${filter ? "WHERE tm.ticker LIKE ?" : ""}
       ORDER BY items.published_at DESC`
    )
    .all(...(filter ? [`%${filter.toUpperCase()}%`] : [])) as TickerMention[];
}

export async function getPipeline(): Promise<PipelineData> {
  const db = await getDb();
  const counts = Object.fromEntries(
    (db.prepare("SELECT status, COUNT(*) AS n FROM items GROUP BY status").all() as {
      status: string;
      n: number;
    }[]).map((r) => [r.status, r.n])
  );
  const channels = db
    .prepare(
      `SELECT sources.name, COUNT(*) AS n, SUM(items.status = 'notified') AS done,
              MAX(items.published_at) AS latest
       FROM items JOIN sources ON sources.id = items.source_id
       GROUP BY sources.id ORDER BY latest DESC`
    )
    .all() as PipelineData["channels"];
  const recent = db
    .prepare(
      `SELECT items.title, items.url, items.status, items.updated_at, items.last_error,
              sources.name AS channel,
              (SELECT COUNT(*) FROM transcripts t WHERE t.item_id = items.id) AS has_transcript
       FROM items JOIN sources ON sources.id = items.source_id
       WHERE items.status != 'seen_skipped'
       ORDER BY items.updated_at DESC LIMIT 50`
    )
    .all() as PipelineData["recent"];
  const lastUpdated =
    (db.prepare("SELECT MAX(updated_at) AS t FROM items").get() as { t: string | null }).t ?? null;
  const summaryCount = (db.prepare("SELECT COUNT(*) AS n FROM summaries").get() as { n: number }).n;
  return { counts, channels, recent, lastUpdated, summaryCount };
}

/** Compact context records for the Ask endpoint. */
export async function getAskContext() {
  const db = await getDb();
  const summaries = db
    .prepare(
      `SELECT items.published_at, items.title, sources.name AS channel,
              s.tldr, s.macro_view, s.overall_sentiment
       FROM summaries s JOIN items ON items.id = s.item_id
       JOIN sources ON sources.id = items.source_id
       ORDER BY items.published_at DESC LIMIT 40`
    )
    .all();
  const mentions = db
    .prepare(
      `SELECT items.published_at, items.title, tm.ticker, tm.stance, tm.sentiment, tm.thesis, tm.price_target
       FROM ticker_mentions tm JOIN items ON items.id = tm.item_id
       ORDER BY items.published_at DESC LIMIT 100`
    )
    .all();
  return { summaries, mentions };
}

/** Videos analyzed per day (by publish date) over the last N days. */
export async function getActivity(days = 30): Promise<{ date: string; value: number }[]> {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT substr(items.published_at, 1, 10) AS date, COUNT(*) AS value
       FROM summaries s JOIN items ON items.id = s.item_id
       GROUP BY date`
    )
    .all() as { date: string; value: number }[];
  const byDate = new Map(rows.map((r) => [r.date, r.value]));

  const out: { date: string; value: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: byDate.get(key) ?? 0 });
  }
  return out;
}

/** Most-discussed tickers with their sentiment mix. */
export async function getTopTickers(limit = 8) {
  const db = await getDb();
  return db
    .prepare(
      `SELECT ticker,
              COUNT(*) AS total,
              SUM(sentiment = 'bullish') AS bullish,
              SUM(sentiment = 'bearish') AS bearish,
              SUM(sentiment = 'neutral') AS neutral
       FROM ticker_mentions
       GROUP BY ticker ORDER BY total DESC, ticker ASC LIMIT ?`
    )
    .all(limit) as { ticker: string; total: number; bullish: number; bearish: number; neutral: number }[];
}

/** Overall sentiment distribution across all analyzed videos. */
export async function getSentimentSplit(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = db
    .prepare("SELECT overall_sentiment AS k, COUNT(*) AS n FROM summaries GROUP BY k")
    .all() as { k: string; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.k, r.n]));
}

/** Headline counts for the at-a-glance strip. */
export async function getKbStats() {
  const db = await getDb();
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return {
    videos: one("SELECT COUNT(*) AS n FROM summaries"),
    tickers: one("SELECT COUNT(DISTINCT ticker) AS n FROM ticker_mentions"),
    channels: one("SELECT COUNT(*) AS n FROM sources"),
  };
}
