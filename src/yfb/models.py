"""Pydantic models for structured extraction. Field descriptions double as
extraction instructions — the schema is sent to the model."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TickerMention(BaseModel):
    ticker: str = Field(description="Ticker symbol in uppercase, e.g. NVDA. For crypto use the common symbol, e.g. BTC. For assets without a ticker (e.g. 'gold'), use a short uppercase identifier like GOLD.")
    asset_name: str | None = Field(default=None, description="Full asset/company name, e.g. 'NVIDIA Corporation'.")
    stance: Literal["buy", "sell", "hold", "watch", "mentioned"] = Field(description="The creator's actionable stance on this asset. Use 'mentioned' if the asset was discussed without a recommendation.")
    sentiment: Literal["bullish", "bearish", "neutral"] = Field(description="The creator's sentiment toward this asset.")
    thesis: str | None = Field(default=None, description="The creator's investment thesis for this asset in 1-3 sentences, in their own framing.")
    price_target: float | None = Field(default=None, description="Explicit price target if the creator states one, else null.")
    price_target_currency: str | None = Field(default=None, description="Currency of the price target, e.g. USD.")
    time_horizon: Literal["short", "medium", "long", "unspecified"] = Field(default="unspecified", description="Time horizon of the thesis: short (<3 months), medium (3-18 months), long (>18 months).")
    confidence: Literal["low", "medium", "high"] = Field(default="medium", description="How strongly/confidently the creator pushed this view.")
    quote: str | None = Field(default=None, description="A short verbatim quote from the transcript supporting the stance, if a good one exists.")


class VideoAnalysis(BaseModel):
    tldr: str = Field(description="1-2 sentence TL;DR of the video, written for an investor deciding whether to watch it.")
    summary_md: str = Field(description="Concise summary of the video's substantive content as 4-8 markdown bullet points. Focus on investment-relevant claims, data cited, and arguments — skip sponsor reads, channel promo, and filler.")
    overall_sentiment: Literal["bullish", "bearish", "neutral", "mixed"] = Field(description="The video's overall market sentiment.")
    macro_view: str | None = Field(default=None, description="The creator's macro commentary (rates, inflation, recession, Fed, geopolitics) in 1-3 sentences, or null if the video has none.")
    tickers: list[TickerMention] = Field(description="Every specific tradeable asset the creator takes a position on or meaningfully discusses. Empty list if none.")


EXTRACTION_SYSTEM_PROMPT = """You analyze transcripts of YouTube finance videos and produce a structured analysis for an investor's personal knowledge base.

Guidelines:
- Report what the CREATOR claims and recommends — you are extracting their views, not validating them. Do not add your own investment opinions or disclaimers.
- Be precise about stance: 'buy'/'sell' only when the creator makes an actionable recommendation; 'watch' when they flag something to monitor; 'mentioned' for assets discussed in passing.
- Auto-generated captions contain transcription errors — infer the intended ticker/company from context (e.g. 'in video' likely means 'NVIDIA').
- Ignore sponsor segments, merch plugs, and calls to like/subscribe entirely.
- If the transcript is not about finance/investing at all, return an empty tickers list and summarize what it is about."""
