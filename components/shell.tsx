import type { ReactNode } from "react";

import { SiteHeader } from "@/components/site-header";

type ShellProps = {
  badge?: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  aside?: ReactNode;
  current?: "home" | "interview" | "results";
  centered?: boolean;
};

export function Shell({ badge, title, subtitle, children, aside, current = "home", centered = false }: ShellProps) {
  const hasAside = Boolean(aside);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col">
      <div className="absolute left-4 right-4 top-10 z-50 sm:left-6 lg:left-10 lg:right-10">
        <SiteHeader current={current} />
      </div>
      <section className={`mx-auto w-full px-4 pb-8 pt-52 sm:px-6 lg:px-10 ${hasAside ? "grid gap-8 lg:grid-cols-[1.2fr_0.8fr]" : "grid gap-8"}`}>
        <div className={`space-y-6 ${centered ? "flex flex-col items-center" : ""}`}>
          <div className={`space-y-4 ${centered ? "flex flex-col items-center text-center" : ""}`}>
            {badge && (
              <span className="inline-flex rounded-full border border-ink/10 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate">
                {badge}
              </span>
            )}
            <div className={`space-y-3 ${centered ? "flex flex-col items-center" : ""}`}>
              <h1 className={`font-display text-4xl leading-tight text-ink sm:text-5xl ${centered ? "" : "max-w-3xl"}`}>
                {title}
              </h1>
              <p className={`text-base leading-7 text-slate sm:text-lg ${centered ? "max-w-3xl" : "max-w-2xl"}`}>{subtitle}</p>
            </div>
          </div>
          {children}
        </div>
        {hasAside ? <aside className="space-y-4">{aside}</aside> : null}
      </section>
    </main>
  );
}
