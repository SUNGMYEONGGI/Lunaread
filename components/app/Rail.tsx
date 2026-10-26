'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import Icon, { Brand } from '../icons';
import Modal from './Modal';
import { LogoMark } from '../site/Site';
import { APP_NAME, docsChanged, isDesktop, openSettings, openSetup, openThemePicker, toast } from './events';
import { deleteDoc, listDocs } from '@/lib/db';
import type { Doc } from '@/lib/types';
import { DOWNLOADS, REPO_URL, apiBase, serverOnline } from '@/lib/api';

type Group = [string, Doc[]];
// Papers grouped like chat history: Today, Previous 7 days, Older.
function groups(docs: Doc[]): Group[] {
  const day = 864e5, now = Date.now(), at = (d: Doc) => d.openedAt || d.addedAt;
  const g: Group[] = [['Today', docs.filter(d => now - at(d) < day)], ['Previous 7 days', docs.filter(d => now - at(d) >= day && now - at(d) < 7 * day)], ['Older', docs.filter(d => now - at(d) >= 7 * day)]];
  return g.filter(([, l]) => l.length);
}

// ChatGPT/Claude-style sidebar: every paper is a conversation.
export function Sidebar() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const active = path.startsWith('/read') ? params.get('id') : null;
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(true);
  const [drawer, setDrawer] = useState(false); // phones: the sidebar slides over the page
  useEffect(() => setDrawer(false), [path, params]);
  useEffect(() => {
    try { const v = localStorage.getItem('sidebar'); setOpen(v ? v === '1' : innerWidth >= 1400); } catch { /* private mode */ }
    const load = () => listDocs().then(setDocs);
    load();
    addEventListener('docs-changed', load);
    return () => removeEventListener('docs-changed', load);
  }, []);
  const toggle = () => setOpen(o => { try { localStorage.setItem('sidebar', o ? '0' : '1'); } catch { /* private mode */ } return !o; });
  const remove = async (d: Doc) => {
    if (!confirm(`Delete “${d.title}”?`)) return;
    await deleteDoc(d.id);
    docsChanged();
    if (d.id === active) router.push('/library/');
  };
  const item = (on: boolean) => `menu-item h-9 py-0 text-[14px] ${on ? 'bg-surface-2 font-medium' : ''}`;

  const menu = <button className="icon-btn fixed left-2 top-2.5 z-40 size-9 bg-surface md:hidden" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Icon name="menu" /></button>;
  if (!open && !drawer) return (<>{menu}
    <nav className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-line bg-bg py-2.5 max-md:hidden">
      <button className="icon-btn size-9" title="Open sidebar" onClick={toggle}><Icon name="sidebar" /></button>
      <Link href="/library/" className="icon-btn size-9" title="New chat"><Icon name="pen" /></Link>
      <Link href="/library/?scholar" className="icon-btn size-9" title="Scholar Deep Search"><Icon name="compass" /></Link>
      <Link href="/library/?all" className="icon-btn size-9" title="Library"><Icon name="library" /></Link>
      <span className="flex-1" />
      <button className="icon-btn size-9" title="Color theme" onClick={openThemePicker}><Icon name="palette" /></button>
      <button className="icon-btn size-9" title="Settings" onClick={openSettings}><Icon name="settings" /></button>
    </nav>
  </>);

  const shown = docs.filter(d => d.title.toLowerCase().includes(q.toLowerCase()));
  return (<>{menu}
    {drawer && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setDrawer(false)} />}
    <nav className={`flex w-[260px] shrink-0 flex-col border-r border-line bg-bg ${drawer ? 'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-soft' : 'max-md:hidden'}`}>
      <div className="flex h-14 items-center gap-2 px-3">
        <Link href={isDesktop() ? '/library/' : '/'} className="flex items-center gap-2 rounded-lg px-1.5 py-1 font-bold tracking-tight hover:bg-surface-2"><LogoMark size={22} />{APP_NAME}</Link>
        <button className="icon-btn ml-auto size-9" title="Close sidebar" onClick={() => drawer ? setDrawer(false) : toggle()}><Icon name="sidebar" /></button>
      </div>
      <div className="grid gap-0.5 px-2">
        <Link href="/library/" className={item(path.startsWith('/library') && !params.has('scholar') && !params.has('all'))}><Icon name="pen" size={17} />New chat</Link>
        <Link href="/library/?scholar" className={item(params.has('scholar'))}><Icon name="compass" size={17} />Scholar Deep Search</Link>
        <Link href="/library/?all" className={item(params.has('all'))}><Icon name="library" size={17} />Library<span className="ml-auto text-xs text-muted">{docs.length}</span></Link>
        <label className="relative mt-1">
          <Icon name="search" size={15} className="absolute left-2.5 top-2.5 text-muted" />
          <input className="h-9 w-full rounded-lg bg-transparent pl-8 pr-2 text-sm outline-none placeholder:text-muted hover:bg-surface-2 focus:bg-surface-2" placeholder="Search chats" value={q} onChange={e => setQ(e.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex-1 overflow-auto px-2 pb-3">
        {!docs.length && <p className="px-2.5 py-2 text-[13px] text-muted">Your papers show up here.</p>}
        {groups(shown).map(([label, list]) => (
          <div key={label} className="mb-3">
            <h4 className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted">{label}</h4>
            {list.map(d => (
              <div key={d.id} className={`group flex items-center rounded-lg ${d.id === active ? 'bg-surface-2' : 'hover:bg-surface-2'}`}>
                <Link href={`/read/?id=${d.id}`} className="min-w-0 flex-1 truncate px-2.5 py-2 text-[14px]" title={d.title}>{d.title}</Link>
                <button className="icon-btn mr-1 size-7 opacity-0 group-hover:opacity-100" title="Delete" onClick={() => remove(d)}><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 border-t border-line p-2">
        <button className="menu-item h-10 flex-1 py-0" onClick={openSettings}><span className="grid size-7 place-items-center rounded-full bg-fg text-bg"><Icon name="user" size={14} /></span>Settings</button>
        <button className="icon-btn size-9" title="Color theme" onClick={openThemePicker}><Icon name="palette" /></button>
      </div>
    </nav>
  </>);
}

// Shown when the local server (which talks to the AI) cannot be reached, e.g. on the GitHub Pages build.
export function ServerBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    serverOnline().then(ok => {
      setOnline(ok);
      // First visit without a server: walk the reader through connecting one.
      try { if (!ok && !localStorage.getItem('setupSeen')) { localStorage.setItem('setupSeen', '1'); openSetup(); } } catch { /* private mode */ }
    });
    addEventListener('server-online', () => setOnline(true));
  }, []);
  if (online) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-sm">
      <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent"><Icon name="zap" size={18} /></span>
      <div className="min-w-60 flex-1">
        <b>Connect the Lunaread server to use AI features</b>
        <p className="text-muted">Reading and markup work here already. AI runs through a small server on your computer that uses your Claude / ChatGPT login.</p>
      </div>
      <button className="btn btn-primary btn-sm" onClick={openSetup}>Set up</button>
    </div>
  );
}

const CMD = `git clone ${REPO_URL} && cd Lunaread && npm i && npm run build && npm start`;

// Step-by-step connection guide; polls the server and finishes by itself once it answers.
export function SetupDialog({ onClose }: { onClose: () => void }) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (stop) return;
      if (await serverOnline()) { setOnline(true); dispatchEvent(new Event('server-online')); return; }
      setTimeout(tick, 2000);
    };
    tick();
    return () => { stop = true; };
  }, []);
  const Step = ({ n, title, children }: { n: number; title: string; children: ReactNode }) => (
    <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold">{n}</span><div className="grid min-w-0 flex-1 gap-1.5"><b className="text-[14px]">{title}</b>{children}</div></li>
  );
  return (
    <Modal onClose={onClose} label="Connect AI">
      <div className="modal max-w-lg">
        <div className="flex items-center"><h3 className="text-lg font-bold tracking-tight">Connect your AI</h3><button className="icon-btn ml-auto" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button></div>
        <ol className="grid gap-4 text-[13px] text-muted">
          <Step n={1} title="Easiest: use the desktop app">
            <span>It has the server built in, so nothing else is needed.</span>
            <div className="flex flex-wrap gap-2"><a className="btn btn-outline btn-sm" href={DOWNLOADS.mac}><Brand name="apple" size={14} />macOS</a><a className="btn btn-outline btn-sm" href={DOWNLOADS.win}><Brand name="windows" size={14} />Windows</a><a className="btn btn-outline btn-sm" href={DOWNLOADS.linux}><Brand name="linux" size={14} />Linux</a></div>
          </Step>
          <Step n={2} title="Or run the server from source">
            <span>Needs Node.js 22.18+. Log in to <code className="font-mono">claude</code> or <code className="font-mono">codex</code> once to use your subscription.</span>
            <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2"><code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-fg">{CMD}</code><button className="icon-btn size-7" title="Copy" onClick={() => { navigator.clipboard.writeText(CMD); toast('Copied'); }}><Icon name="copy" size={14} /></button></div>
          </Step>
          <Step n={3} title="Allow local network access">
            <span>If the browser asks whether this site may access devices on your local network, choose Allow. It only talks to the server on this computer (127.0.0.1).</span>
          </Step>
        </ol>
        <div className={`flex items-center gap-2 rounded-xl p-3 text-[13px] font-medium ${online ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted'}`} role="status">
          {online ? <><Icon name="check" size={16} />Connected. AI features are ready.</> : <><span className="spin" />Waiting for the server on {apiBase() || location.origin}…</>}
          {online && <button className="btn btn-primary btn-sm ml-auto" onClick={onClose}>Done</button>}
        </div>
      </div>
    </Modal>
  );
}
