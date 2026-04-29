"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  current?: "home" | "interview" | "results";
};

const LINKS = [
  { label: "How It Works", href: "/#how-it-works", key: "how-it-works" },
  { label: "Try Demo", href: "/#try-demo", key: "try-demo" },
  { label: "Contact", href: "mailto:felipe.marin.1697@gmail.com", key: "contact" },
] as const;

export function SiteHeader({ current = "home" }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [current]);

  return (
    <header className="relative flex items-start justify-between gap-4 py-4 sm:items-center sm:py-5 lg:py-6">
      <Link href="/" className="group flex shrink-0 flex-col items-start transition-opacity hover:opacity-80">
        <span className="font-display text-[1.9rem] font-semibold leading-none text-ink sm:text-[2.6rem] lg:text-[3rem]">ConnectRole</span>
        <div className="mt-1 flex w-full justify-between text-[7px] font-bold uppercase tracking-normal text-slate/70 sm:mt-1.5 sm:text-[9px] lg:text-[10px]">
          {"Mock Interview Coach".split("").map((char, i) => (
            <span key={i}>{char === " " ? "\u00A0" : char}</span>
          ))}
        </div>
      </Link>

      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="site-nav"
        onClick={() => setMenuOpen((currentOpen) => !currentOpen)}
        className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white/80 text-ink shadow-sm backdrop-blur transition hover:border-ink/20 hover:bg-white md:hidden"
      >
        <span className="sr-only">Toggle navigation menu</span>
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              className={cn(
                "block h-[2px] w-4 rounded-full bg-current transition-transform duration-200",
                menuOpen && item === 0 && "translate-y-[7px] rotate-45",
                menuOpen && item === 1 && "opacity-0",
                menuOpen && item === 2 && "-translate-y-[7px] -rotate-45",
              )}
            />
          ))}
        </div>
      </button>

      <nav className="ml-auto hidden items-center justify-end gap-8 text-base font-semibold sm:gap-10 sm:text-[1.1rem] md:flex">
        {LINKS.map((link) => {
          return (
            <Link
              key={link.key}
              href={link.href}
              className="transition text-ink/75 hover:text-ink"
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <nav
        id="site-nav"
        className={cn(
          "absolute left-0 right-0 top-full z-30 mt-3 origin-top rounded-[24px] border border-white/80 bg-white/92 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-200 md:hidden",
          menuOpen ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-[0.98] opacity-0",
        )}
      >
        <div className="grid gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-ink/80 transition hover:bg-ink/[0.04] hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
