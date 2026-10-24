'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import Icon from '../icons';
import { LogoMark } from '../site/Site';
import { APP_NAME, isDesktop, openSettings, openThemePicker } from './events';
import { REPO_URL, serverOnline } from '@/lib/api';

const RailLink = ({ href, title, icon }: { href: string; title: string; icon: string }) => (
  <Link href={href} className="icon-btn size-10" title={title} aria-label={title}><Icon name={icon} /></Link>
);

export function Rail({ children }: { children?: ReactNode }) {
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-surface py-3 max-sm:hidden">
      <Link href={isDesktop() ? '/library/' : '/'} title={APP_NAME} className="mb-2 grid size-10 place-items-center"><LogoMark size={28} /></Link>
      <span className="mb-1 h-px w-7 bg-line" />
      <RailLink href="/library/" title="Library" icon="library" />
      <RailLink href="/library/?upload" title="Upload paper" icon="upload" />
      <RailLink href="/library/?scholar" title="Scholar Deep Search" icon="compass" />
      {children}
      <span className="flex-1" />
      <span className="mb-1 h-px w-7 bg-line" />
      <button className="icon-btn size-10" title="Color theme" onClick={openThemePicker}><Icon name="palette" /></button>
      <button className="icon-btn size-10" title="Settings" onClick={openSettings}><Icon name="settings" /></button>
    </nav>
  );
}

// Shown when the local server (which talks to the AI) cannot be reached, e.g. on the GitHub Pages build.
export function ServerBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => { serverOnline().then(setOnline); }, []);
  if (online) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-sm">
      <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Icon name="zap" size={18} /></span>
      <div className="min-w-60 flex-1">
        <b>Connect the Lunaread server to use AI features</b>
        <p className="text-muted">Reading and markup work here already. For AI, run the server on this computer so it can use your Claude / ChatGPT login:</p>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs">git clone {REPO_URL} && cd Lunaread && npm i && npm run build && npm start</code>
      </div>
      <button className="btn btn-outline btn-sm" onClick={() => serverOnline().then(setOnline)}><Icon name="refresh" size={14} />Retry</button>
    </div>
  );
}
