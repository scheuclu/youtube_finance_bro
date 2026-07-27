import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { MonitorPlay } from "lucide-react";
import { getPipeline } from "@/lib/queries";
import { Tabs, ThemeToggle } from "./nav";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Finance Bro KB",
  description: "YouTube finance channel summaries and investment knowledge base",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let meta = "";
  try {
    const { summaryCount, lastUpdated } = await getPipeline();
    meta = `${summaryCount} summaries · updated ${
      lastUpdated ? lastUpdated.replace("T", " ").replace("Z", " UTC") : "never"
    }`;
  } catch {
    meta = "knowledge base unavailable";
  }

  return (
    <html lang="en" suppressHydrationWarning className={geist.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
              <MonitorPlay className="size-6 text-primary" aria-hidden />
              <div className="flex flex-col">
                <span className="text-base font-bold leading-tight tracking-tight">
                  Finance Bro <span className="text-primary">KB</span>
                </span>
                <span className="text-xs text-muted-foreground">{meta}</span>
              </div>
              <div className="flex-1" />
              <ThemeToggle />
            </div>
            <div className="mx-auto max-w-5xl px-6">
              <Tabs />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-6 py-8 pb-24">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
