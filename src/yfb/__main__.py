"""CLI entry point: python -m yfb <command>."""

from __future__ import annotations

import argparse
import logging
import sys

from . import db
from .config import load_config


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    parser = argparse.ArgumentParser(prog="yfb", description="YouTube finance knowledge base")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init-db", help="create the database")
    sub.add_parser("run", help="run the full pipeline once")

    p_backfill = sub.add_parser("backfill", help="queue skipped videos for processing")
    p_backfill.add_argument("--channel", help="limit to one channel_id")
    p_backfill.add_argument("--limit", type=int, help="max videos to queue")

    p_query = sub.add_parser("query", help="search the knowledge base")
    p_query.add_argument("text", nargs="?", help="free-text query")
    p_query.add_argument("--ticker", help="exact ticker lookup, e.g. NVDA")
    p_query.add_argument("--since", type=_parse_since, default=None, metavar="30d",
                         help="only include mentions from the last N days")
    p_query.add_argument("--answer", action="store_true",
                         help="synthesize an answer with Gemini")

    args = parser.parse_args(argv)
    config = load_config()

    if args.command == "init-db":
        conn = db.connect(config.db_path)
        conn.close()
        print(f"database ready at {config.db_path}")
        return 0

    if args.command == "run":
        from . import pipeline

        if not config.channels:
            print("no channels configured in channels.yaml", file=sys.stderr)
            return 1
        pipeline.run(config)
        return 0

    if args.command == "backfill":
        from . import pipeline

        count = pipeline.backfill(config, args.channel, args.limit)
        print(f"queued {count} video(s) for processing on the next run")
        return 0

    if args.command == "query":
        from . import query

        if not args.text and not args.ticker:
            print("provide a query string or --ticker", file=sys.stderr)
            return 1
        query.run_query(config, args.text, args.ticker, args.since, args.answer)
        return 0

    return 1


def _parse_since(value: str) -> int:
    return int(value.rstrip("d"))


if __name__ == "__main__":
    raise SystemExit(main())
