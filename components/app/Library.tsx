'use client';
import Modal from './Modal';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '../icons';
import { Sidebar, ServerBanner } from './Rail';
import { LogoMark } from '../site/Site';
import { docsChanged, toast } from './events';
import { listDocs, deleteDoc, putDoc } from '@/lib/db';
import { scholarSearch, type ScholarPaper } from '@/lib/api';
import { bibLinks, importPdf, importUrl, toBibtex } from '@/lib/library';
import type { Doc } from '@/lib/types';

function Scholar({ docs, onOpen }: { docs: Doc[]; onOpen: (url: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ScholarPaper[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (query: string) => {
    setBusy(true);
    try { setResults(await scholarSearch(query)); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  // Deep Search from the library: search with the titles of recently read papers and merge.
  const recommend = async () => {
    if (!docs.length) return toast('Add papers to your library first');
    setBusy(true);
    try {
      const lists = await Promise.all(docs.slice(0, 3).map(d => scholarSearch(d.title).catch(() => [] as ScholarPaper[])));
      const seen = new Set(docs.map(d => d.title.toLowerCase()));
      const merged: ScholarPaper[] = [];
      for (let i = 0; i < 12; i++) for (const l of lists) {
        const r = l[i];
        if (r && !seen.has(r.title.toLowerCase())) { seen.add(r.title.toLowerCase()); merged.push(r); }
      }
      setResults(merged);
    } finally { setBusy(false); }
  };
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-2xl font-semibold tracking-tight">Scholar Deep Search</h2>
        <form className="relative" onSubmit={e => { e.preventDefault(); q.trim() && run(q); }}>
          <Icon name="search" size={16} className="absolute left-3 top-3 text-muted" />
          <input className="input w-72 pl-9" placeholder="Search papers on Semantic Scholar" value={q} onChange={e => setQ(e.target.value)} />
        </form>
        <button className="btn btn-accent btn-sm h-10" onClick={recommend}><Icon name="sparkles" size={15} />Recommend from my library</button>
      </div>
      {busy && <div className="grid place-items-center py-20"><span className="spin" /></div>}
      {!busy && results && !results.length && <p className="py-20 text-center text-muted">No results.</p>}
      {!busy && !results && <p className="py-20 text-center text-muted">Search for papers, or get recommendations based on your library.</p>}
      <div className="grid gap-3">
        {!busy && results?.map(r => {
          const pdf = r.openAccessPdf?.url || (r.externalIds?.ArXiv && `https://arxiv.org/pdf/${r.externalIds.ArXiv}`);
          return (
            <div className="card grid gap-2 p-5" key={r.paperId}>
              <h4 className="font-semibold leading-snug">{r.title}</h4>
              <div className="text-xs text-muted">{r.authors?.slice(0, 4).map(a => a.name).join(', ')}{(r.authors?.length ?? 0) > 4 && ' et al.'} · {r.year} {r.venue && `· ${r.venue}`} · {r.citationCount ?? 0} citations</div>
              {r.abstract && <p className="line-clamp-3 text-sm text-muted">{r.abstract}</p>}
              <div className="flex gap-2">
                {pdf && <button className="btn btn-primary btn-sm" onClick={() => onOpen(pdf)}>Open in reader</button>}
                <a className="btn btn-outline btn-sm" href={r.url} target="_blank" rel="noreferrer">Semantic Scholar</a>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// Chatbot-style home: one big composer that takes a PDF, an arXiv ID or a link.
function Home({ busy, onUrl, onPick, onDrop, recent, onOpen }: { busy: boolean; onUrl: (u: string) => void; onPick: () => void; onDrop: (f: FileList) => void; recent: Doc[]; onOpen: (id: string) => void }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [over, setOver] = useState(false);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const submit = () => url.trim() && !busy && onUrl(url.trim());
  const SUGGEST: [string, string, () => void][] = [
    ['upload', 'Upload a PDF', onPick],
    ['file', 'Attention Is All You Need', () => onUrl('1706.03762')],
    ['file', 'BERT', () => onUrl('1810.04805')],
    ['compass', 'Find papers', () => router.push('/library/?scholar')],
  ];
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center pb-24 pt-10"
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); onDrop(e.dataTransfer.files); }}>
      <h1 className="mb-8 flex items-center justify-center gap-3 text-center text-[32px] font-semibold tracking-tight"><LogoMark size={34} />{greet}. What are we reading?</h1>
      <div className={`rounded-[28px] border bg-surface p-3 shadow-[0_2px_12px_rgba(0,0,0,.06)] transition ${over ? 'border-accent ring-4 ring-accent-soft' : 'border-line focus-within:border-fg/30'}`}>
        <textarea autoFocus rows={2} className="block max-h-40 w-full resize-none bg-transparent px-2 pt-1 text-[16px] outline-none placeholder:text-muted"
          placeholder={over ? 'Drop the PDF to start' : 'Paste an arXiv ID or PDF link, or drop a PDF here'} value={url} onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        <div className="mt-2 flex items-center gap-2">
          <button className="icon-btn size-9 rounded-full border border-line" title="Upload PDF" onClick={onPick}><Icon name="plus" size={18} /></button>
          <span className="text-xs text-muted">PDF · arXiv · DOI links to open-access PDFs</span>
          <button className="ml-auto grid size-9 place-items-center rounded-full bg-fg text-bg transition disabled:opacity-30" disabled={!url.trim() || busy} onClick={submit} aria-label="Open paper">
            {busy ? <span className="spin border-bg/30 border-t-bg" /> : <Icon name="arrowRight" size={17} className="-rotate-90" />}
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGGEST.map(([icon, label, fn]) => <button key={label} disabled={busy} onClick={fn} className="chip h-9 px-4 text-[13px]"><Icon name={icon} size={14} />{label}</button>)}
      </div>
      {!!recent.length && (
        <div className="mt-14">
          <h3 className="mb-3 px-1 text-sm font-medium text-muted">Recent papers</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {recent.slice(0, 3).map(d => (
              <button key={d.id} onClick={() => onOpen(d.id)} className="card group flex items-center gap-3 p-2.5 text-left transition hover:bg-surface-2">
                <span className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-line bg-surface-2">{d.thumb && <img src={d.thumb} alt="" className="size-full object-cover object-top" />}</span>
                <span className="min-w-0"><span className="line-clamp-2 text-[13px] font-medium leading-snug">{d.title}</span><span className="text-xs text-muted">{d.pages ? `${d.pages} pages` : 'PDF'}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Library() {
  const router = useRouter();
  const query = useSearchParams();
  const scholar = query.has('scholar');
  const all = query.has('all');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [newFolder, setNewFolder] = useState<{ doc: Doc; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bibRef = useRef<HTMLInputElement>(null);

  const refresh = () => listDocs().then(setDocs);
  useEffect(() => { refresh(); addEventListener('docs-changed', refresh); return () => removeEventListener('docs-changed', refresh); }, []);
  useEffect(() => { if (query.has('upload')) setTimeout(() => fileRef.current?.click(), 50); }, [query]);

  const open = (id: string) => router.push(`/read/?id=${id}`);
  const work = async (fn: () => Promise<Doc>) => {
    setBusy(true);
    try { const d = await fn(); docsChanged(); open(d.id); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const addFiles = (files: FileList | null) => {
    const pdfs = [...(files || [])].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) return toast('Please choose a PDF file');
    work(async () => {
      let last!: Doc;
      for (const f of pdfs) last = await importPdf(new Uint8Array(await f.arrayBuffer()), { name: f.name });
      return last;
    });
  };

  const exportBib = () => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([toBibtex(shown)], { type: 'application/x-bibtex' })), download: 'lunaread-library.bib' });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importBib = async (file?: File) => {
    if (!file) return;
    const { links, skipped } = bibLinks(await file.text());
    if (!links.length) return toast('No arXiv or PDF links found in this file');
    setBusy(true);
    let ok = 0;
    for (const l of links) { try { await importUrl(l); ok++; docsChanged(); } catch { /* counted below */ } }
    setBusy(false);
    toast(`Imported ${ok} of ${links.length} papers${skipped ? ` · ${skipped} entries had no PDF link` : ''}`);
  };

  const folders = [...new Set(docs.map(d => d.folder).filter(Boolean))].sort();
  const shown = docs.filter(d => (folder === null || d.folder === folder) && d.title.toLowerCase().includes(filter.toLowerCase()));
  // window.prompt is unavailable in Electron, so new folders use a small modal.
  const move = async (doc: Doc, value: string) => {
    if (value === '__new') return setNewFolder({ doc, name: '' });
    await putDoc({ ...doc, folder: value });
    refresh();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-surface px-5 py-7 md:px-10">
        <div className="mx-auto max-w-5xl"><ServerBanner /></div>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={bibRef} type="file" accept=".bib,application/x-bibtex,text/plain" hidden onChange={e => { importBib(e.target.files?.[0]); e.target.value = ''; }} />
        {scholar ? <div className="mx-auto max-w-4xl"><Scholar docs={docs} onOpen={u => work(() => importUrl(u))} /></div>
          : !all ? <Home busy={busy} onUrl={u => work(() => importUrl(u))} onPick={() => fileRef.current?.click()} onDrop={addFiles} recent={docs} onOpen={open} />
          : (
          <div className="mx-auto max-w-5xl">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h2 className="mr-auto text-2xl font-semibold tracking-tight">Library</h2>
              <div className="relative"><Icon name="search" size={16} className="absolute left-3 top-3 text-muted" /><input className="input w-64 pl-9" placeholder="Search library" value={filter} onChange={e => setFilter(e.target.value)} /></div>
              <button className="btn btn-outline h-10" disabled={busy} onClick={() => bibRef.current?.click()} title="Import arXiv / PDF links from a BibTeX file"><Icon name="upload" size={15} />BibTeX</button>
              <button className="btn btn-outline h-10" disabled={!shown.length} onClick={exportBib} title="Export these papers with highlights and notes (Zotero-compatible)"><Icon name="download" size={15} />Export .bib</button>
              <button className="btn btn-primary h-10" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? <span className="spin" /> : <Icon name="upload" size={15} />}Upload</button>
            </div>
            <div className="mb-6 flex flex-wrap gap-2">
              {([[null, 'All', docs.length], ...folders.map(f => [f, f, docs.filter(d => d.folder === f).length]), ['', 'Unsorted', docs.filter(d => !d.folder).length]] as [string | null, string, number][]).map(([v, label, n]) => (
                <button key={label} className={`chip h-8 px-3.5 ${folder === v ? 'on' : ''}`} onClick={() => setFolder(v)}>{v ? <Icon name="folder" size={13} /> : null}{label}<span className="text-muted">{n}</span></button>
              ))}
            </div>
            {!shown.length && <p className="py-16 text-center text-muted">No papers yet.</p>}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {shown.map(d => (
                <div key={d.id} onClick={() => open(d.id)} className="group card flex cursor-pointer flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-soft">
                  <div className="grid h-40 place-items-center overflow-hidden border-b border-line bg-surface-2">{d.thumb ? <img src={d.thumb} alt="" className="w-full object-cover object-top transition group-hover:scale-[1.02]" /> : <Icon name="file" size={32} className="text-muted" />}</div>
                  <div className="grid gap-2 p-3.5">
                    <div className="line-clamp-2 text-sm font-semibold leading-snug">{d.title}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted" onClick={e => e.stopPropagation()}>
                      {d.pages && <span>{d.pages}p</span>}
                      <span>· {new Date(d.openedAt || d.addedAt).toLocaleDateString()}</span>
                      <select className="ml-auto max-w-[110px] rounded-md border border-line bg-bg px-1 py-0.5 text-xs" value={d.folder} onChange={e => move(d, e.target.value)} aria-label="Folder">
                        <option value="">No folder</option>
                        {folders.map(f => <option key={f}>{f}</option>)}
                        <option value="__new">+ New folder…</option>
                      </select>
                      <button className="icon-btn size-6" title="Delete" onClick={async () => { if (confirm(`Delete “${d.title}”?`)) { await deleteDoc(d.id); docsChanged(); } }}><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      {newFolder && (
        <Modal onClose={() => setNewFolder(null)} label="New folder">
          <form className="modal" onSubmit={e => { e.preventDefault(); const name = newFolder.name.trim(); if (name) move(newFolder.doc, name); setNewFolder(null); }}>
            <h3 className="text-lg font-bold">New folder</h3>
            <input autoFocus className="input" placeholder="Folder name" value={newFolder.name} onChange={e => setNewFolder({ ...newFolder, name: e.target.value })} />
            <button className="btn btn-primary justify-self-end">Create</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
