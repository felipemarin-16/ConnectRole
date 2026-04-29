import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="w-full border-t border-ink/10 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(246,242,255,0.4))] py-12 text-center sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="font-display text-lg font-semibold text-ink">
          RoleReady — AI Mock Interview Coach
        </p>
        <p className="mt-2 text-sm text-slate/80">Built by Felipe Marin © 2026</p>

        <div className="mt-8 flex items-center justify-center gap-6 text-ink/40">
          <Link href="https://github.com/felipemarin-16" target="_blank" rel="noopener noreferrer" className="transition hover:text-ink/80" aria-label="GitHub">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.02c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A4.8 4.8 0 0 0 8 18v4" />
            </svg>
          </Link>
          <Link href="https://www.linkedin.com/in/wilson-felipe-marin/" target="_blank" rel="noopener noreferrer" className="transition hover:text-ink/80" aria-label="LinkedIn">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect x="2" y="9" width="4" height="12" />
              <circle cx="4" cy="4" r="2" />
            </svg>
          </Link>
          <Link href="mailto:felipe.marin.1697@gmail.com" className="transition hover:text-ink/80" aria-label="Email">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </Link>
        </div>
      </div>
    </footer>
  );
}
