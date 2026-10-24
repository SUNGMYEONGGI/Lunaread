'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '../icons';
import { Rail, ServerBanner } from './Rail';
import { toast } from './events';
import { listDocs, addPdf, deleteDoc, putDoc } from '@/lib/db';
import { fetchPdf, normalizePaperUrl, scholarSearch, type ScholarPaper } from '@/lib/api';
import { loadPdf, pdfTitle } from '@/lib/pdf';
import type { Doc } from '@/lib/types';

// Adds a PDF to the library: reads the title and renders a first-page thumbnail.
async function importPdf(bytes: Uint8Array, { url, name }: { url?: string; name?: string } = {}) {
  const pdf = await loadPdf(bytes);
  const title = await pdfTitle(pdf, name?.replace(/\.pdf$/i, '') || url || 'Untitled');
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 0.5 });
  const canvas = Object.assign(document.createElement('canvas'), { width: vp.width, height: vp.height });
  await page.render({ canvas, viewport: vp } as never).promise;
  const doc = await addPdf(bytes, { title, url });
  doc.thumb = canvas.toDataURL('image/jpeg', 0.7);
  doc.pages = pdf.numPages;
  await putDoc(doc);
  pdf.loadingTask.destroy();
  return doc;
}

const importUrl = async (input: string) => { const url = normalizePaperUrl(input); return importPdf(await fetchPdf(url), { url }); };

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
        <h2 className="mr-auto text-2xl font-bold tracking-tight">Scholar Deep Search</h2>
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

export default function Library() {
  const router = useRouter();
  const query = useSearchParams();
  const scholar = query.has('scholar');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [newFolder, setNewFolder] = useState<{ doc: Doc; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => listDocs().then(setDocs);
  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (query.has('upload')) setTimeout(() => fileRef.current?.click(), 50); }, [query]);

  const open = (id: string) => router.push(`/read/?id=${id}`);
  const work = async (fn: () => Promise<Doc>) => {
    setBusy(true);
    try { open((await fn()).id); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
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

  const folders = [...new Set(docs.map(d => d.folder).filter(Boolean))].sort();
  const shown = docs.filter(d => (folder === null || d.folder === folder) && d.title.toLowerCase().includes(filter.toLowerCase()));
  // window.prompt is unavailable in Electron, so new folders use a small modal.
  const move = async (doc: Doc, value: string) => {
    if (value === '__new') return setNewFolder({ doc, name: '' });
    await putDoc({ ...doc, folder: value });
    refresh();
  };
  const side = (on: boolean) => `menu-item ${on ? 'on' : ''}`;

  return (
    <div className="flex h-screen overflow-hidden">
      <Rail />
      <aside className="flex w-60 shrink-0 flex-col gap-0.5 overflow-auto border-r border-line px-3 py-6 max-lg:hidden">
        <h4 className="mx-2.5 mb-1.5 font-mono text-[11px] uppercase tracking-[.14em] text-muted">Library</h4>
        <button className={side(!scholar && folder === null)} onClick={() => { setFolder(null); router.push('/library/'); }}><Icon name="library" size={16} />All papers<span className="ml-auto text-xs text-muted">{docs.length}</span></button>
        <button className={side(scholar)} onClick={() => router.push('/library/?scholar')}><Icon name="compass" size={16} />Scholar Deep Search</button>
        <h4 className="mx-2.5 mb-1.5 mt-6 font-mono text-[11px] uppercase tracking-[.14em] text-muted">Folders</h4>
        {folders.map(f => (
          <button key={f} className={side(!scholar && folder === f)} onClick={() => { setFolder(f); router.push('/library/'); }}>
            <Icon name="folder" size={16} />{f}<span className="ml-auto text-xs text-muted">{docs.filter(d => d.folder === f).length}</span>
          </button>
        ))}
        <button className={side(!scholar && folder === '')} onClick={() => { setFolder(''); router.push('/library/'); }}><Icon name="file" size={16} />Unsorted</button>
      </aside>
      <main className="flex-1 overflow-auto px-5 py-7 md:px-10">
        <ServerBanner />
        {scholar ? <Scholar docs={docs} onOpen={u => work(() => importUrl(u))} /> : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2 className="mr-auto text-2xl font-bold tracking-tight">{folder ? folder : folder === '' ? 'Unsorted' : 'All papers'}</h2>
              <div className="relative"><Icon name="search" size={16} className="absolute left-3 top-3 text-muted" /><input className="input w-64 pl-9" placeholder="Search library" value={filter} onChange={e => setFilter(e.target.value)} /></div>
              <button className="btn btn-primary h-10" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} />Upload</button>
            </div>
            <div
              className={`dots mb-8 rounded-3xl border-2 border-dashed p-8 text-center text-sm transition ${over ? 'border-accent bg-ai text-accent' : 'border-line bg-surface text-muted'}`}
              onDragOver={e => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={e => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
            >
              {busy ? <span className="inline-flex items-center gap-2"><span className="spin" />Opening paper…</span> : 'Drop PDF files here, or paste an arXiv ID / PDF link'}
              <form className="mx-auto mt-4 flex max-w-xl gap-2" onSubmit={e => { e.preventDefault(); url.trim() && work(() => importUrl(url)); }}>
                <input className="input h-11 bg-bg" placeholder="e.g. 1706.03762 or https://arxiv.org/abs/1706.03762" value={url} onChange={e => setUrl(e.target.value)} />
                <button className="btn btn-accent h-11" disabled={busy}>Open</button>
              </form>
            </div>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
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
                      <button className="icon-btn size-6" title="Delete" onClick={async () => { if (confirm(`Delete “${d.title}”?`)) { await deleteDoc(d.id); refresh(); } }}><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      {newFolder && (
        <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && setNewFolder(null)}>
          <form className="modal" onSubmit={e => { e.preventDefault(); const name = newFolder.name.trim(); if (name) move(newFolder.doc, name); setNewFolder(null); }}>
            <h3 className="text-lg font-bold">New folder</h3>
            <input autoFocus className="input" placeholder="Folder name" value={newFolder.name} onChange={e => setNewFolder({ ...newFolder, name: e.target.value })} />
            <button className="btn btn-primary justify-self-end">Create</button>
          </form>
        </div>
      )}
    </div>
  );
}
