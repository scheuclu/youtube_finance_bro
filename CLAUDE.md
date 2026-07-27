# Project instructions

## Workflow: all changes via PR

Never commit or push directly to `main`. For every change: create a feature
branch, commit there, push, and open a PR for review.

**Exception:** the scheduled GitHub Actions workflow commits `data/kb.sqlite3`
(pipeline state) directly to `main` — that is by design and must stay.

## PR conventions

- The dashboard is a Next.js app in `web/`, deployed on Vercel. Vercel
  creates a preview deployment for every PR automatically — point the user
  at the preview link from the PR checks for UI review.
- For UI changes, verify `cd web && npm run build` passes and render the
  pages in a headless browser before opening the PR; mention what was checked.

## Architecture notes

- The committed `data/kb.sqlite3` is both the pipeline state and the knowledge
  base; the dashboard (`web/`, Next.js on Vercel) fetches it server-side with
  a short TTL cache and queries it with better-sqlite3.
- The Ask feature calls Gemini from `web/app/api/ask/route.ts` using the
  `GEMINI_API_KEY` env var on Vercel — keep that key free-tier/quota-capped.
- Summarization uses Gemini (`google-genai` SDK). Caption transcripts are the
  cheap preferred path; when YouTube blocks caption downloads (always the case
  on GitHub runner IPs), the pipeline falls back to direct YouTube video
  ingestion by URL in the same run.
- Tests: `.venv/bin/python -m pytest -q` (run before every PR).

## Auth (Ask tab only)

- Supabase Auth (`@supabase/ssr`), same invite-only model as the AssetTracker
  project: sign-ups disabled in the Supabase dashboard; owner creates accounts.
- Only `/ask` and `/api/ask` are gated (see `web/proxy.ts` matcher);
  the rest of the dashboard is public.
- Dev and Vercel previews skip the gate (`FORCE_AUTH=1` re-enables,
  `DISABLE_AUTH=1` force-disables). Production always gated.
- Vercel env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
