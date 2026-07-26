"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed" },
  { href: "/tickers", label: "Tickers" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/ask", label: "Ask" },
];

export function Tabs() {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={pathname === t.href ? "active" : ""}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function ThemeToggle() {
  return (
    <button
      title="Toggle theme"
      onClick={() => {
        const el = document.documentElement;
        const current =
          el.dataset.theme ||
          (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        const next = current === "dark" ? "light" : "dark";
        el.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {}
      }}
    >
      ◐
    </button>
  );
}
