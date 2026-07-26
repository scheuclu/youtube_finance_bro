import type { Metadata } from "next";
import { getPipeline } from "@/lib/queries";
import { Tabs, ThemeToggle } from "./nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Bro KB",
  description: "YouTube finance channel summaries and investment knowledge base",
};

// Theme is applied before paint to avoid a light-mode flash for dark users.
const themeInit = `
try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch {}
`;

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <header className="site">
          <h1>
            📺 Finance Bro <span>KB</span>
          </h1>
          <span className="meta">{meta}</span>
          <div className="spacer" />
          <ThemeToggle />
        </header>
        <Tabs />
        <main>{children}</main>
      </body>
    </html>
  );
}
