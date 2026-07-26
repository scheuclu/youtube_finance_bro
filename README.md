# youtube_finance_bro

Watches selected YouTube finance channels, sends an AI summary of every new
video to Telegram, and builds a queryable investment knowledge base over time.

## How it works

A GitHub Actions workflow runs every 30 minutes:

1. Polls each channel's free RSS feed for new videos (no YouTube API key).
2. Fetches the video's captions (`youtube-transcript-api`) — and when YouTube
   blocks the runner's IP, Gemini ingests the video directly by URL instead.
3. Gemini (`gemini-3.6-flash`) returns a summary **and** structured data in
   one call: tickers, stance (buy/sell/hold/watch), sentiment, thesis, price
   targets, macro view.
4. Stores everything in `data/kb.sqlite3` (committed back to the repo — the
   DB is the pipeline state and the knowledge base).
5. Sends a formatted summary to your Telegram.

Failures at any step are resumed on the next run via a per-video status state
machine — nothing is summarized or notified twice.

## Setup

### 1. Telegram bot

- Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the **bot token**.
- Send any message to your new bot, then open
  `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy the **chat id**
  from the response.

### 2. Channels

Add channel IDs to `channels.yaml`:

```yaml
channels:
  - channel_id: UCxxxxxxxxxxxxxxxxxxxxxx
    name: "Some Finance Bro"
```

Find a channel ID in the channel page source (search `channelId`) or with
`yt-dlp --print channel_id <any video URL>`.

### 3. GitHub repo secrets

Settings → Secrets and variables → Actions:

| Secret | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Gemini summarization ([get one](https://aistudio.google.com/apikey)) |
| `TELEGRAM_BOT_TOKEN` | yes | notifications |
| `TELEGRAM_CHAT_ID` | yes | notifications |
| `WEBSHARE_PROXY_USERNAME` / `..._PASSWORD` | no | residential proxy for transcript fetching, if YouTube blocks the runner IPs persistently |

### 4. First run

Push to `main`, then trigger the **poll** workflow manually (Actions →
poll → Run workflow). The first sighting of each channel records its recent
videos **without** summarizing them (no cost, no notification flood); only
videos published afterwards are processed. To summarize recent history:

```sh
python -m yfb backfill --limit 5   # queue the 5 most recent skipped videos
```

## Local usage

```sh
pip install -e .
python -m yfb init-db        # create data/kb.sqlite3
python -m yfb run            # run the pipeline once (needs env secrets)
python -m yfb backfill --channel UC... --limit 3
```

## Querying the knowledge base

```sh
python -m yfb query --ticker NVDA --since 30d
python -m yfb query "what's the recent sentiment on NVDA"
python -m yfb query "is anyone bearish on tech?" --answer   # Gemini-synthesized answer with citations
```

Search is SQLite FTS5 today; the schema has an `embeddings` table reserved
for semantic search (planned: Gemini embeddings + sqlite-vec — same API key).

## Notes & limitations

- **Transcript blocking:** YouTube often blocks caption requests from
  datacenter IPs. When that happens the pipeline falls back to Gemini's
  direct YouTube video ingestion in the same run — slower and more input
  tokens (~100/sec of video at low media resolution) but still well under a
  cent per video on flash pricing. The optional Webshare proxy secrets make
  the cheap caption path work in CI too. Note: Gemini video ingestion only
  works for public videos, and the free API tier caps it at 8 hours of video
  per day.
- RSS only exposes a channel's ~15 most recent videos; deeper backfill is out
  of scope.
- Scheduled workflows are disabled by GitHub after 60 days without repo
  activity; the bot's DB commits keep the repo active.
- Don't edit `data/kb.sqlite3` on `main` by hand — the workflow's concurrency
  group assumes it is the only writer.
- Extending with other sources (podcasts, articles) is anticipated: the DB
  uses a generic `sources`/`items` model — add a new fetcher and a `kind`.

## Dashboard

A static dashboard (GitHub Pages) reads `data/kb.sqlite3` directly in your
browser via sql.js — no backend, always shows the latest committed state:
**https://scheuclu.github.io/youtube_finance_bro/**

- **Feed** — all video summaries with full-text search and channel filter
- **Tickers** — every ticker mention with stance, sentiment, price targets
- **Pipeline** — ingestion status, per-channel stats, errors
- **Ask** — Gemini-synthesized answers (your API key stays in the browser's localStorage)
