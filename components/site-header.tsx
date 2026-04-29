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
  return (
    <header className="flex items-center justify-between gap-4 py-5 lg:py-6">
      <Link href="/" className="shrink-0 group flex flex-col items-start transition-opacity hover:opacity-80">
        <span className="font-display text-[2.5rem] font-semibold leading-none text-ink sm:text-[3rem]">RoleReady</span>
        <div className="mt-1.5 flex w-full justify-between text-[9px] font-bold uppercase tracking-normal text-slate/70 sm:text-[10px]">
          {"Mock Interview Coach".split("").map((char, i) => (
            <span key={i}>{char === " " ? "\u00A0" : char}</span>
          ))}
        </div>
      </Link>
      <nav className="ml-auto flex items-center justify-end gap-8 text-base font-semibold sm:gap-10 sm:text-[1.1rem]">
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
    </header>
  );
}
