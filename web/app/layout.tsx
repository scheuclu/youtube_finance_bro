import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { MonitorPlay } from "lucide-react";
import { getPipeline } from "@/lib/queries";
import { Tabs, ThemeToggle } from "./nav";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Finance Bro KB",
  description: "YouTube finance channel summaries and investment knowledge base",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = Date.parse(iso.replace(" ", "T"));
  if (Number.isNaN(then)) return iso;
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let summaryCount = 0;
  let synced = "unavailable";
  try {
    const p = await getPipeline();
    summaryCount = p.summaryCount;
    synced = relativeTime(p.lastUpdated);
  } catch {
    /* header degrades to "unavailable" */
  }

  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/60 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 pt-4">
              <div className="brand-mark flex size-9 items-center justify-center rounded-xl">
                <MonitorPlay className="size-[18px] text-white" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold leading-tight tracking-tight">
                  Finance Bro <span className="text-primary">KB</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {summaryCount} {summaryCount === 1 ? "summary" : "summaries"} analyzed
                </div>
              </div>
              <div className="flex-1" />
              <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                synced {synced}
              </span>
              <ThemeToggle />
            </div>
            <div className="mx-auto max-w-6xl px-6 py-3">
              <Tabs />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8 pb-28">{children}</main>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
