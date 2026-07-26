"""Configuration: channels.yaml + environment secrets."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CHANNELS_FILE = REPO_ROOT / "channels.yaml"
DEFAULT_DB_PATH = REPO_ROOT / "data" / "kb.sqlite3"


@dataclass
class Channel:
    channel_id: str
    name: str | None = None

    @property
    def feed_url(self) -> str:
        return f"https://www.youtube.com/feeds/videos.xml?channel_id={self.channel_id}"


@dataclass
class Settings:
    max_video_age_days: int = 3


@dataclass
class Config:
    channels: list[Channel] = field(default_factory=list)
    settings: Settings = field(default_factory=Settings)
    db_path: Path = DEFAULT_DB_PATH

    # Secrets from environment
    gemini_api_key: str | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None
    webshare_proxy_username: str | None = None
    webshare_proxy_password: str | None = None


def load_config(channels_file: Path = DEFAULT_CHANNELS_FILE, db_path: Path = DEFAULT_DB_PATH) -> Config:
    raw = yaml.safe_load(channels_file.read_text()) or {}

    channels = [
        Channel(channel_id=c["channel_id"], name=c.get("name"))
        for c in (raw.get("channels") or [])
    ]
    settings_raw = raw.get("settings") or {}
    settings = Settings(
        max_video_age_days=int(settings_raw.get("max_video_age_days", 3)),
    )

    return Config(
        channels=channels,
        settings=settings,
        db_path=db_path,
        gemini_api_key=os.environ.get("GEMINI_API_KEY"),
        telegram_bot_token=os.environ.get("TELEGRAM_BOT_TOKEN"),
        telegram_chat_id=os.environ.get("TELEGRAM_CHAT_ID"),
        webshare_proxy_username=os.environ.get("WEBSHARE_PROXY_USERNAME"),
        webshare_proxy_password=os.environ.get("WEBSHARE_PROXY_PASSWORD"),
    )
