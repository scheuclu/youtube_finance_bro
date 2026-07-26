# Project instructions

## Workflow: all changes via PR

Never commit or push directly to `main`. For every change: create a feature
branch, commit there, push, and open a PR for review.

**Exception:** the scheduled GitHub Actions workflow commits `data/kb.sqlite3`
(pipeline state) directly to `main` — that is by design and must stay.

## PR conventions

- **Every PR that touches `docs/` (the dashboard) must include a branch
  preview link at the top of the description:**

  ```
  Preview: https://raw.githack.com/scheuclu/youtube_finance_bro/<branch>/docs/index.html
  ```

  This works because the dashboard is a self-contained HTML file — the DB and
  sql.js load from absolute URLs, so any branch version runs directly in the
  browser with no build or deploy.

- For UI changes, also verify rendering in a headless browser before opening
  the PR and mention what was checked.

## Architecture notes

- The committed `data/kb.sqlite3` is both the pipeline state and the knowledge
  base; the dashboard (GitHub Pages, `docs/index.html`) reads it client-side.
- Summarization uses Gemini (`google-genai` SDK). Caption transcripts are the
  cheap preferred path; when YouTube blocks caption downloads (always the case
  on GitHub runner IPs), the pipeline falls back to direct YouTube video
  ingestion by URL in the same run.
- Tests: `.venv/bin/python -m pytest -q` (run before every PR).
