'use client';
// Marketing chrome: hatched gutters around a bordered center column, as on the reference templates.
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import Icon from '../icons';
import { APP_NAME, openGetStarted } from '../app/events';
import { REPO_URL } from '@/lib/api';

export const LogoMark = ({ size = 26 }: { size?: number }) => (
  <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: 'radial-gradient(circle at 32% 30%, #fff 0 14%, var(--accent) 58%, color-mix(in srgb, var(--accent) 35%, #000) 100%)', boxShadow: 'inset -3px -3px 0 rgba(0,0,0,.18)' }} />
);

export const Logo = () => (
  <Link href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-tight"><LogoMark />{APP_NAME}</Link>
);

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="hatch min-h-screen">
      <div className="mx-auto min-h-screen max-w-[1180px] border-x border-line bg-bg">
        <Nav />
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}

const LINKS: [string, string][] = [['/features/', 'Features'], ['/pricing/', 'Pricing'], ['/#faq', 'FAQ'], ['/library/?scholar', 'Explore']];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 8);
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  return (
    <header className={`sticky top-0 z-40 border-b transition-colors ${scrolled ? 'border-line bg-bg/80 backdrop-blur-xl' : 'border-transparent'}`}>
      <div className="flex h-16 items-center gap-8 px-6 md:px-10">
        <Logo />
        <nav className="hidden gap-7 text-sm text-muted md:flex">
          {LINKS.map(([href, l]) => <Link key={href} href={href} className="transition hover:text-fg">{l}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a className="icon-btn hidden sm:inline-grid" href={REPO_URL} target="_blank" rel="noreferrer" aria-label="GitHub"><Icon name="github" /></a>
          <button className="btn btn-outline btn-sm hidden sm:inline-flex" onClick={openGetStarted}>Sign in</button>
          <Link className="btn btn-primary btn-sm" href="/library/">Open reader</Link>
          <button className="icon-btn md:hidden" onClick={() => setOpen(!open)} aria-label="Menu"><Icon name={open ? 'x' : 'menu'} /></button>
        </div>
      </div>
      {open && (
        <nav className="grid gap-1 border-t border-line bg-bg px-4 py-3 md:hidden">
          {LINKS.map(([href, l]) => <Link key={href} href={href} className="menu-item" onClick={() => setOpen(false)}>{l}</Link>)}
          <a className="menu-item" href={REPO_URL} target="_blank" rel="noreferrer"><Icon name="github" size={16} />GitHub</a>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line px-6 py-12 text-sm text-muted md:px-10">
      <div className="flex flex-wrap justify-between gap-10">
        <div className="max-w-xs space-y-3">
          <Logo />
          <p>Your AI research colleague. An open-source paper reader for the web and desktop.</p>
        </div>
        <div className="flex gap-16">
          <div className="grid content-start gap-2">
            <b className="text-fg">Product</b>
            <Link href="/features/" className="hover:text-fg">Features</Link>
            <Link href="/pricing/" className="hover:text-fg">Pricing</Link>
            <Link href="/library/" className="hover:text-fg">Library</Link>
          </div>
          <div className="grid content-start gap-2">
            <b className="text-fg">Project</b>
            <a href={REPO_URL} className="hover:text-fg" target="_blank" rel="noreferrer">GitHub</a>
            <a href={`${REPO_URL}#readme`} className="hover:text-fg" target="_blank" rel="noreferrer">Docs</a>
            <a href={`${REPO_URL}/issues`} className="hover:text-fg" target="_blank" rel="noreferrer">Issues</a>
          </div>
        </div>
      </div>
      <p className="mt-10 text-xs">© {new Date().getFullYear()} {APP_NAME}. Palettes courtesy of Color Hunt. Not affiliated with Moonlight, Anthropic or OpenAI.</p>
    </footer>
  );
}

// Section heading used across marketing pages.
export function Heading({ kicker, title, sub }: { kicker?: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {kicker && <p className="mb-3 font-mono text-xs uppercase tracking-[.18em] text-accent">{kicker}</p>}
      <h2 className="text-3xl font-bold tracking-tight md:text-[42px] md:leading-[1.1]">{title}</h2>
      {sub && <p className="mt-4 text-base text-muted md:text-lg">{sub}</p>}
    </div>
  );
}
