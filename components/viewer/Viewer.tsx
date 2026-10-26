'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Icon from '../icons';
import { Sidebar } from '../app/Rail';
import { toast } from '../app/events';
import { getDoc, getFile, putDoc } from '@/lib/db';
import { aiJSON, streamAI, getSettings } from '@/lib/api';
import { loadPdf, pageItems, findInItems, pageText } from '@/lib/pdf';
import type { AutoHl, Card, CardType, Doc, Mark, ModelChoice, Rect, Summary } from '@/lib/types';
import PdfPage, { type Link as PdfLink } from './PdfPage';
import { ChatThread, TranslatePanel, NotesPanel, DiscussionPanel, Md, Spin } from './Panels';

type Zoom = number | 'auto' | 'page-fit' | 'page-width';
const ZOOMS: [Zoom, string][] = [['auto', 'Automatic Zoom'], ['page-fit', 'Page Fit'], ['page-width', 'Page Width'], [0.5, '50%'], [0.75, '75%'], [1, '100%'], [1.25, '125%'], [1.5, '150%'], [2, '200%'], [3, '300%']];
const SWATCHES = ['yellow', 'green', 'blue', 'pink', 'purple'];
const CITE_RE = /\[(\d+(?:\s*[,–-]\s*\d+)*)\]|\(([A-Z][\p{L}\-' ]+(?:et al\.)?,? (?:19|20)\d{2}[a-z]?(?:; ?[^()]+)?)\)/gu;
const uid = () => crypto.randomUUID().slice(0, 8);
type Tab = 'translate' | 'notes' | 'discussion';
type Sel = { text: string; page: number; rects: Rect[]; x: number; y: number };

function download(name: string, text: string) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type: 'text/markdown' })), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Viewer() {
  const id = useSearchParams().get('id') || '';
  const [doc, setDoc] = useState<Doc | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Zoom>('auto');
  const [stageSize, setStageSize] = useState({ w: 900, h: 700 });
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab | null>(null);
  const [chat, setChat] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(true);
  const [outline, setOutline] = useState<any[] | null>(null);
  const [showOutline, setShowOutline] = useState(false);
  const [autoOn, setAutoOn] = useState(false);
  const [areaMode, setAreaMode] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [cite, setCite] = useState<{ marker: string; x: number; y: number; body: string; loading: boolean } | null>(null);
  const [preview, setPreview] = useState<{ src: string; x: number; y: number; w: number; page: number; hold?: boolean } | null>(null);
  const [menu, setMenu] = useState<'share' | 'info' | null>(null);
  const [search, setSearch] = useState<{ q: string; results?: { page: number; rects: Rect[] }[]; idx?: number } | null>(null);
  const [flash, setFlash] = useState<{ page: number; rects: Rect[]; key: number } | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errs, setErrs] = useState<Record<string, string | undefined>>({});
  const [draft, setDraft] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const docRef = useRef<Doc | null>(null);
  const pageRef = useRef(1);
  const hoverT = useRef<ReturnType<typeof setTimeout>>(undefined);
  docRef.current = doc;

  // ---------- load ----------
  useEffect(() => {
    let p: PDFDocumentProxy | undefined;
    (async () => {
      const d = await getDoc(id);
      if (!d) return setError('Paper not found in your library.');
      p = await loadPdf(await getFile(id));
      const s = [];
      for (let i = 1; i <= p.numPages; i++) {
        const vp = (await p.getPage(i)).getViewport({ scale: 1 });
        s.push({ w: vp.width, h: vp.height });
      }
      setSizes(s);
      setPdf(p);
      setDoc({ ...d, openedAt: Date.now() });
      pageRef.current = d.lastPage || 1;
      setPage(pageRef.current);
      p.getOutline().then(setOutline);
    })().catch(e => setError(e.message));
    return () => { p?.loadingTask.destroy(); };
  }, [id]);

  // Persist edits (debounced).
  useEffect(() => {
    if (!doc) return;
    const t = setTimeout(() => putDoc(doc), 400);
    return () => clearTimeout(t);
  }, [doc]);
  const patch = useCallback((fn: (d: Doc) => Partial<Doc>) => setDoc(d => d && ({ ...d, ...fn(d) })), []);
  const setB = (k: string, v: boolean) => setBusy(b => ({ ...b, [k]: v }));
  const setE = (k: string, v?: string) => setErrs(e => ({ ...e, [k]: v }));

  // ---------- layout / zoom ----------
  useEffect(() => {
    if (!stage.current) return;
    const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, [pdf, pdfOpen]);
  const base = sizes[0] || { w: 612, h: 792 };
  const fitW = (stageSize.w - 48) / base.w;
  const scale = zoom === 'page-width' ? fitW : zoom === 'page-fit' ? Math.min(fitW, (stageSize.h - 36) / base.h) : zoom === 'auto' ? Math.min(fitW, 1.5) : zoom;
  const step = (d: number) => setZoom(z => Math.round(Math.min(4, Math.max(0.3, (typeof z === 'number' ? z : scale) + d)) * 100) / 100);

  const jump = useCallback((n: number, rects?: Rect[], tries = 0) => {
    const st = stage.current;
    const el = st?.querySelector<HTMLElement>(`.page[data-page="${n}"]`);
    // The PDF canvas may be closed: open it, then retry once it has laid out.
    if (!st || !el) { setPdfOpen(true); if (tries < 5) setTimeout(() => jump(n, rects, tries + 1), 120); return; }
    const y = rects?.[0] ? rects[0].y * el.offsetHeight - st.clientHeight / 3 : -12;
    st.scrollTo({ top: el.offsetTop + y, behavior: rects ? 'smooth' : 'auto' });
    if (rects) setFlash({ page: n, rects, key: Date.now() });
  }, []);
  // Keep the reading position when the scale changes.
  useLayoutEffect(() => { if (pdf && pdfOpen) jump(pageRef.current); }, [scale, pdf, pdfOpen]);

  const onScroll = () => {
    const st = stage.current!;
    const mid = st.scrollTop + st.clientHeight / 3;
    let n = 1;
    for (const el of st.querySelectorAll<HTMLElement>('.page')) { if (el.offsetTop <= mid) n = +el.dataset.page!; else break; }
    if (n !== pageRef.current) { pageRef.current = n; setPage(n); patch(() => ({ lastPage: n })); }
    setSel(null); setPreview(null);
  };

  // ---------- AI cards ----------
  const runCard = useCallback(async (type: CardType, { task, text = '', src, image, page: pg, extra }: { task: string; text?: string; src?: string; image?: string; page?: number; extra?: Record<string, unknown> }) => {
    const cid = uid();
    const card: Card = { id: cid, type, src, image, page: pg, at: Date.now(), pending: true };
    const upd = (c: Partial<Card>) => patch(d => ({ cards: d.cards.map(x => x.id === cid ? { ...x, ...c } : x) }));
    patch(d => ({ cards: [...(d.cards || []), card] }));
    setChat(true);
    try {
      const body = { task, text, extra, ...(image && { image: image.split(',')[1] }) };
      await streamAI(task === 'translate' || task === 'infographic' ? null : docRef.current, body, t => upd({ body: t }));
      upd({ pending: false });
    } catch (e) {
      upd({ pending: false, error: (e as Error).message });
    }
  }, [patch]);

  const explain = (text: string, pg: number) => runCard('explain', { task: 'explain', text, src: text, page: pg });
  const translate = (text: string, pg: number) => runCard('translate', { task: 'translate', text, src: text, page: pg });
  const explainImage = useCallback((pg: number, image: string) => { setAreaMode(false); runCard('image', { task: 'explainImage', image, page: pg }); }, [runCard]);
  const infographic = (c: Card) => {
    const css = getComputedStyle(document.documentElement);
    const palette = (['accent', 'text', 'ai', 'bg'] as const).map(k => `${css.getPropertyValue(`--${k}`).trim()} (${k === 'ai' ? 'highlight' : k === 'bg' ? 'background' : k})`).join(', ');
    runCard('infographic', { task: 'infographic', extra: { palette }, text: `${c.src ? `Passage: ${c.src}\n\n` : ''}Explanation: ${c.body}`, src: c.src, page: c.page });
  };

  const ask = async (q: string, { model, refs = [] }: { model: ModelChoice; refs: Doc[] }) => {
    const at = Date.now();
    const history = [...(docRef.current!.chat || []).filter(m => m.content && !m.error).map(({ role, content }) => ({ role, content })), { role: 'user', content: q }];
    patch(d => ({ chat: [...(d.chat || []), { role: 'user', content: q, at }, { role: 'assistant', content: '', at: at + 1 }] }));
    const upd = (c: { content?: string; error?: string }) => patch(d => ({ chat: d.chat.map(m => m.at === at + 1 ? { ...m, ...c } : m) }));
    setB('chat', true);
    try {
      await streamAI(docRef.current, { task: 'chat', history, ...model, refs: refs.map(r => ({ id: r.id })) }, t => upd({ content: t }));
    } catch (e) { upd({ error: (e as Error).message }); }
    setB('chat', false);
  };

  const summarize = async () => {
    setB('summary', true);
    try { const summary = await aiJSON<Summary>(docRef.current, { task: 'summary' }); patch(() => ({ summary })); }
    catch (e) { toast((e as Error).message); }
    setB('summary', false);
  };

  // Auto Highlight: ask for verbatim key sentences, then locate them in the text.
  const autoHighlight = async () => {
    if (docRef.current!.auto) return setAutoOn(v => !v);
    setB('auto', true);
    try {
      const { highlights } = await aiJSON<{ highlights: AutoHl[] }>(docRef.current, { task: 'autoHighlight' });
      const found: AutoHl[] = [];
      for (const h of highlights) {
        let hit: { page: number; rects: Rect[] } | null = null;
        for (let n = 1; n <= pdf!.numPages && !hit; n++) {
          const r = findInItems(await pageItems(pdf!, n), h.text)[0];
          if (r) hit = { page: n, rects: r };
        }
        found.push({ ...h, ...hit });
      }
      patch(() => ({ auto: found }));
      setAutoOn(true);
      toast(`Highlighted ${found.filter(f => f.page).length} key sentences`);
    } catch (e) { toast((e as Error).message); }
    setB('auto', false);
  };

  const translatePage = async () => {
    const n = page;
    setB('tr', true); setE('tr');
    try {
      const text = pageText(await pageItems(pdf!, n));
      await streamAI(null, { task: 'translate', text }, t => patch(d => ({ translations: { ...d.translations, [n]: t } })));
    } catch (e) { setE('tr', (e as Error).message); }
    setB('tr', false);
  };

  const discuss = async () => {
    setB('disc', true); setE('disc');
    try { await streamAI(docRef.current, { task: 'discussion' }, t => patch(() => ({ discussion: t }))); }
    catch (e) { setE('disc', (e as Error).message); }
    setB('disc', false);
  };

  // ---------- selection, markup, citations ----------
  const onMouseUp = (e: MouseEvent) => {
    if ((e.target as Element).closest('.popover')) return;
    setTimeout(() => {
      const s = getSelection();
      const text = s?.toString().trim();
      if (!s || !text || !s.rangeCount) return;
      const range = s.getRangeAt(0);
      const pg = (range.startContainer.parentElement || (range.startContainer as Element)).closest?.<HTMLElement>('.page');
      if (!pg) return;
      const pr = pg.getBoundingClientRect();
      const rects = [...range.getClientRects()]
        .filter(r => r.width > 1 && r.height > 1 && r.top >= pr.top - 2 && r.bottom <= pr.bottom + 2)
        .map(r => ({ x: (r.left - pr.left) / pr.width, y: (r.top - pr.top) / pr.height, w: r.width / pr.width, h: r.height / pr.height }));
      const b = range.getBoundingClientRect();
      setSel({ text, page: +pg.dataset.page!, rects, x: b.left + b.width / 2, y: b.top < 120 ? b.bottom + 10 : b.top - 50 });
    });
  };

  const addMark = (color: string) => {
    const m: Mark = { id: uid(), page: sel!.page, rects: sel!.rects, text: sel!.text, color, note: '', at: Date.now() };
    patch(d => ({ marks: [...(d.marks || []), m] }));
    getSelection()?.removeAllRanges();
    setSel(null);
  };

  const openCitation = async (marker: string, context: string, x: number, y: number) => {
    const key = marker.slice(0, 80);
    const cached = docRef.current!.citations?.[key];
    setCite({ marker, x: Math.min(x, innerWidth - 440), y: Math.min(y + 16, innerHeight - 380), body: cached || '', loading: !cached });
    if (cached) return;
    try {
      const body = await streamAI(docRef.current, { task: 'citation', text: marker, extra: { context } }, t => setCite(c => c && c.marker === marker ? { ...c, body: t } : c));
      patch(d => ({ citations: { ...d.citations, [key]: body } }));
    } catch (e) { setCite(c => c && { ...c, body: `⚠️ ${(e as Error).message}` }); }
    setCite(c => c && { ...c, loading: false });
  };

  // Clicking a citation marker inside the text layer.
  const onClick = (e: MouseEvent) => {
    const layerEl = (e.target as Element).closest('.textLayer');
    if (getSelection()?.toString() || !layerEl) return;
    const pos = (document as any).caretRangeFromPoint?.(e.clientX, e.clientY) as Range | undefined;
    const node = pos?.startContainer;
    if (!pos || node?.nodeType !== 3) return;
    const str = node.textContent || '';
    for (const m of str.matchAll(CITE_RE)) {
      if (pos.startOffset >= m.index! && pos.startOffset <= m.index! + m[0].length) {
        const layer = layerEl.textContent || '';
        const at = layer.indexOf(str);
        openCitation(m[0], layer.slice(Math.max(0, at - 200), at + str.length + 200), e.clientX, e.clientY);
        return;
      }
    }
  };

  const resolveDest = async (dest: PdfLink['dest']) => {
    const explicit: any = typeof dest === 'string' ? await pdf!.getDestination(dest) : dest;
    if (!explicit) return null;
    const idx = typeof explicit[0] === 'object' ? await pdf!.getPageIndex(explicit[0]) : explicit[0];
    const kind = explicit[1]?.name;
    const top = kind === 'XYZ' ? explicit[3] : kind === 'FitH' || kind === 'FitBH' ? explicit[2] : kind === 'FitR' ? explicit[5] : null;
    return { page: idx + 1, y: top == null ? 0 : Math.min(1, Math.max(0, 1 - top / sizes[idx].h)) };
  };

  const linkText = async (l: PdfLink, n: number) => (await pageItems(pdf!, n)).filter(i => i.y < l.y + l.h && i.y + i.h > l.y).map(i => i.str).join(' ');

  const onLinkClick = useCallback(async (l: PdfLink, n: number, e: MouseEvent) => {
    const { clientX: x, clientY: y } = e;
    if (typeof l.dest === 'string' && /^cite\./i.test(l.dest)) {
      const context = await linkText(l, n);
      return openCitation(`${l.dest.replace(/^cite\./i, '')} (as cited in: "${context.slice(0, 120)}")`, context, x, y);
    }
    const d = await resolveDest(l.dest);
    if (d) jump(d.page, [{ x: 0, y: d.y, w: 1, h: 0.02 }]);
  }, [pdf, sizes]);

  // Preview: hovering an internal link renders the destination region.
  const onLinkEnter = useCallback((l: PdfLink, _n: number, e: MouseEvent) => {
    const { clientX: x, clientY: y } = e;
    clearTimeout(hoverT.current);
    hoverT.current = setTimeout(async () => {
      const d = await resolveDest(l.dest);
      if (!d) return;
      const pg = await pdf!.getPage(d.page);
      const vp = pg.getViewport({ scale: 1.4 });
      const full = Object.assign(document.createElement('canvas'), { width: vp.width, height: vp.height });
      await pg.render({ canvas: full, viewport: vp } as never).promise;
      const top = Math.max(0, d.y * vp.height - 16), h = Math.min(300, vp.height - top);
      const out = Object.assign(document.createElement('canvas'), { width: vp.width, height: h });
      out.getContext('2d')!.drawImage(full, 0, top, vp.width, h, 0, 0, vp.width, h);
      const w = Math.min(520, innerWidth - 32);
      setPreview({ src: out.toDataURL(), x: Math.min(Math.max(16, x - w / 2), innerWidth - w - 16), y: y + 300 > innerHeight ? y - (h * w / vp.width) - 20 : y + 18, w, page: d.page });
    }, 350);
  }, [pdf, sizes]);
  const onLinkLeave = useCallback(() => { clearTimeout(hoverT.current); setTimeout(() => setPreview(p => p?.hold ? p : null), 150); }, []);

  // ---------- search ----------
  const runSearch = async (q: string, dir = 1) => {
    if (!q.trim()) return;
    let { results, idx } = search?.q === q && search.results ? search : { results: undefined, idx: -1 };
    if (!results) {
      results = [];
      for (let n = 1; n <= pdf!.numPages; n++) for (const r of findInItems(await pageItems(pdf!, n), q)) results.push({ page: n, rects: r });
    }
    idx = results.length ? ((idx ?? -1) + dir + results.length) % results.length : -1;
    setSearch({ q, results, idx });
    if (idx >= 0) jump(results[idx].page, results[idx].rects);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); setSearch(s => s || { q: '' }); }
      if (e.key === 'Escape') { setSel(null); setCite(null); setPreview(null); setMenu(null); setAreaMode(false); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, []);

  const exportNotes = () => {
    const marks = [...(doc!.marks || [])].sort((a, b) => a.page - b.page);
    download(`${doc!.title.slice(0, 60)} - notes.md`, `# ${doc!.title}\n\n${doc!.url ? `Source: ${doc!.url}\n\n` : ''}${marks.map(m => `### p.${m.page}\n> ${m.text}\n${m.note ? `\n${m.note}\n` : ''}`).join('\n')}`);
  };

  if (error || !doc || !pdf) return (
    <div className="flex h-screen"><Sidebar /><div className="grid flex-1 place-items-center bg-surface text-muted">{error ? <span>{error} <Link className="text-accent" href="/library/">Back to library</Link></span> : <Spin />}</div></div>
  );

  const marksFor = (n: number) => [
    ...(doc.marks || []).filter(m => m.page === n),
    ...(autoOn ? (doc.auto || []).filter(h => h.page === n).map((h, i) => ({ id: `a${i}`, rects: h.rects!, color: h.category })) : []),
  ];
  const near = (n: number) => Math.abs(n - page) <= 2;
  const tabs: [Tab, string, string][] = [['translate', 'languages', 'Translate Page'], ['notes', 'pen', 'Markup & Notes'], ['discussion', 'chat', 'Discussion']];
  // Chat and PDF can each be hidden, but never both.
  const toggleChat = () => { if (chat && !pdfOpen) setPdfOpen(true); setChat(!chat); };
  const togglePdf = () => { if (pdfOpen && !chat) setChat(true); setPdfOpen(!pdfOpen); };
  const rail = (on: boolean) => `icon-btn size-10 border ${on ? 'border-line bg-bg text-fg shadow-sm' : 'border-transparent'}`;
  const tool = (on: boolean) => `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] font-medium transition ${on ? 'bg-accent-soft text-accent' : 'hover:bg-surface-2'}`;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 bg-surface">
        {chat && (
          <section className={`flex min-w-0 flex-col ${pdfOpen ? 'w-[clamp(360px,36vw,560px)] shrink-0 border-r border-line' : 'flex-1'}`}>
            <header className="flex h-14 shrink-0 items-center gap-2 px-4">
              <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold" title={doc.title}>{doc.title}</h1>
            </header>
            <ChatThread doc={doc} summary={doc.summary} summarizing={busy.summary} onSummarize={summarize} onAsk={ask} chatBusy={busy.chat}
              onRemoveCard={cid => patch(d => ({ cards: d.cards.filter(c => c.id !== cid) }))} onInfographic={infographic} onJump={jump} draft={draft} setDraft={setDraft}
              pdfOpen={pdfOpen} onShowPdf={() => pdfOpen ? jump(1) : setPdfOpen(true)}
              actions={[['highlighter', doc.auto ? 'Toggle Auto Highlight' : 'Auto Highlight', autoHighlight], ['chat', 'Discussion', () => setTab('discussion')], ['languages', 'Translate this page', () => setTab('translate')]]} />
          </section>
        )}
        {pdfOpen && (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-surface px-3 *:shrink-0 [&>:first-child]:ml-auto [&>:last-child]:mr-auto">
          <button className={`icon-btn ${showOutline ? 'on' : ''}`} title="Outline" onClick={() => setShowOutline(v => !v)}><Icon name="sidebar" /></button>
          <button className="icon-btn max-md:hidden" title="Document info" onClick={() => setMenu(menu === 'info' ? null : 'info')}><Icon name="info" /></button>
          <button className={`icon-btn ${search ? 'on' : ''}`} title="Search (⌘F)" onClick={() => setSearch(s => s ? null : { q: '' })}><Icon name="search" /></button>
          {search && (
            <form onSubmit={e => { e.preventDefault(); runSearch(search.q); }} className="flex items-center gap-1">
              <input autoFocus className="input h-8 w-44" placeholder="Find in paper" value={search.q}
                onChange={e => setSearch({ q: e.target.value })} onKeyDown={e => e.key === 'Enter' && e.shiftKey && (e.preventDefault(), runSearch(search.q, -1))} />
              {search.results && <small className="text-muted">{search.results.length ? `${search.idx! + 1}/${search.results.length}` : '0'}</small>}
            </form>
          )}
          <select className="select h-8 font-medium" value={String(zoom)} onChange={e => setZoom(isNaN(+e.target.value) ? e.target.value as Zoom : +e.target.value)} aria-label="Zoom">
            {typeof zoom === 'number' && !ZOOMS.some(z => z[0] === zoom) && <option value={zoom}>{Math.round(zoom * 100)}%</option>}
            {ZOOMS.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
          </select>
          <button className="icon-btn max-md:hidden" title="Zoom out" onClick={() => step(-0.1)}><Icon name="minus" /></button>
          <button className="icon-btn max-md:hidden" title="Zoom in" onClick={() => step(0.1)}><Icon name="plus" /></button>
          <div className="flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-line px-2 text-sm font-medium">
            <input className="w-8 bg-transparent text-right font-semibold outline-none" aria-label="Page" value={page} onChange={e => { const n = +e.target.value; if (n >= 1 && n <= pdf.numPages) { pageRef.current = n; setPage(n); jump(n); } }} />
            <span className="text-muted">/ {pdf.numPages}</span>
          </div>
          <span className="mx-1.5 h-5 w-px bg-line" />
          <button className={tool(autoOn)} onClick={autoHighlight} disabled={busy.auto} title="Auto Highlight">{busy.auto ? <Spin /> : <Icon name="highlighter" size={16} />}<span className="hidden 2xl:inline">Auto Highlight</span></button>
          <button className={tool(areaMode)} onClick={() => setAreaMode(v => !v)} title="Drag over a figure (or ⌘/Ctrl + drag)"><Icon name="image" size={16} /><span className="hidden 2xl:inline">Image Explanation</span></button>
        </div>

        <div className="flex min-h-0 flex-1">
          {showOutline && (
            <aside className="w-64 shrink-0 overflow-auto border-r border-line bg-surface p-2 text-[13px]">
              <b className="block px-2.5 pb-2 pt-1">Outline</b>
              {outline?.length ? <OutlineTree items={outline} onGo={async dest => { const d = await resolveDest(dest); if (d) jump(d.page, [{ x: 0, y: d.y, w: 1, h: 0.02 }]); }} />
                : Array.from({ length: pdf.numPages }, (_, i) => <button key={i} className="menu-item py-1.5 text-[13px]" onClick={() => jump(i + 1)}>Page {i + 1}</button>)}
            </aside>
          )}
          <div className="relative flex min-w-0 flex-1">
            <div className="flex-1 overflow-auto bg-surface-2" ref={stage} onScroll={onScroll} onMouseUp={onMouseUp} onClick={onClick}>
              <div className="flex w-max min-w-full flex-col items-center gap-4 px-5 pb-20 pt-5">
                {sizes.map((s, i) => (
                  <PdfPage key={i} pdf={pdf} n={i + 1} size={s} scale={scale} near={near(i + 1)}
                    marks={marksFor(i + 1)} flash={flash?.page === i + 1 ? Object.assign([...flash.rects], { key: flash.key }) : null}
                    areaMode={areaMode} onArea={explainImage}
                    onLinkEnter={onLinkEnter} onLinkLeave={onLinkLeave} onLinkClick={onLinkClick} />
                ))}
              </div>
            </div>
            {tab !== 'translate' && (
              <button onClick={() => setTab('translate')} className="absolute right-0 top-16 z-[5] flex items-center gap-1.5 rounded-l-xl border border-r-0 border-line bg-surface px-1.5 py-3 text-xs font-semibold text-muted transition [writing-mode:vertical-rl] hover:pr-2.5 hover:text-accent">
                <Icon name="languages" size={14} className="rotate-90" />Translate Page
              </button>
            )}
          </div>
        </div>
      </div>
        )}
          {tab && (
            <section className="flex w-[380px] shrink-0 flex-col border-l border-line bg-surface max-lg:fixed max-lg:bottom-0 max-lg:right-[52px] max-lg:top-0 max-lg:z-30 max-lg:w-[min(380px,calc(100vw-52px))] max-lg:shadow-soft">
              <div className="flex h-14 shrink-0 items-center border-b border-line px-4 font-semibold">{tabs.find(t => t[0] === tab)![2]}
                <button className="icon-btn ml-auto" onClick={() => setTab(null)} title="Close panel"><Icon name="x" size={16} /></button>
              </div>
              {tab === 'translate' && <TranslatePanel page={page} text={doc.translations?.[page]} busy={busy.tr} error={errs.tr} onTranslate={translatePage} />}
              {tab === 'notes' && <NotesPanel marks={doc.marks || []} onJump={jump} onExport={exportNotes}
                onUpdate={(mid, c) => patch(d => ({ marks: d.marks.map(m => m.id === mid ? { ...m, ...c } : m) }))}
                onDelete={mid => patch(d => ({ marks: d.marks.filter(m => m.id !== mid) }))} />}
              {tab === 'discussion' && <DiscussionPanel text={doc.discussion} busy={busy.disc} error={errs.disc} onRun={discuss} />}
            </section>
          )}
          <nav className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 border-l border-line bg-surface py-2.5">
            <button title="AI Colleague" aria-pressed={chat} onClick={toggleChat} className={rail(chat)}><Icon name="bot" /></button>
            <button title="PDF" aria-pressed={pdfOpen} onClick={togglePdf} className={rail(pdfOpen)}><Icon name="file" /></button>
            <span className="my-1 h-px w-6 bg-line" />
            {tabs.map(([k, icon, label]) => (
              <button key={k} title={label} aria-pressed={tab === k} onClick={() => setTab(tab === k ? null : k)} className={rail(tab === k)}><Icon name={icon} /></button>
            ))}
            <span className="flex-1" />
            <button className={rail(menu === 'share')} title="Share & export" onClick={() => setMenu(menu === 'share' ? null : 'share')}><Icon name="share" /></button>
          </nav>
      </div>

      {sel && (
        <div className="popover flex items-center gap-0.5 p-1" style={{ left: Math.min(Math.max(8, sel.x - 230), innerWidth - 470), top: sel.y }} onMouseDown={e => e.preventDefault()}>
          <button className={tool(false)} onClick={() => { explain(sel.text, sel.page); setSel(null); }}><Icon name="sparkles" size={15} />Explain</button>
          <button className={tool(false)} onClick={() => { translate(sel.text, sel.page); setSel(null); }}><Icon name="languages" size={15} />Translate</button>
          <button className={tool(false)} onClick={() => { setChat(true); setDraft(`"${sel.text.slice(0, 600)}"\n\n`); setSel(null); }}><Icon name="chat" size={15} />Ask</button>
          <span className="mx-1 h-5 w-px bg-line" />
          {SWATCHES.map(c => <button key={c} className="icon-btn size-7" title={`Highlight ${c}`} onClick={() => addMark(c)}><span className="size-[18px] rounded-full ring-2 ring-surface" style={{ background: `var(--hl-${c})`, boxShadow: '0 0 0 3px var(--border)' }} /></button>)}
          <button className="icon-btn" title="Highlight + note" onClick={() => { addMark('yellow'); setTab('notes'); }}><Icon name="note" size={15} /></button>
          <button className="icon-btn" title="Copy" onClick={() => { navigator.clipboard.writeText(sel.text); setSel(null); toast('Copied'); }}><Icon name="copy" size={15} /></button>
        </div>
      )}

      {cite && (
        <div className="popover max-h-96 w-[420px] overflow-auto p-4 text-[13.5px]" style={{ left: cite.x, top: cite.y }}>
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-accent"><Icon name="quote" size={14} />Smart Citation
            <button className="icon-btn ml-auto size-6" onClick={() => setCite(null)}><Icon name="x" size={13} /></button>
          </div>
          {cite.body ? <Md text={cite.body} /> : <Spin />}
        </div>
      )}

      {preview && (
        <div className="popover p-1.5" style={{ left: preview.x, top: preview.y }} onMouseEnter={() => setPreview(p => p && ({ ...p, hold: true }))} onMouseLeave={() => setPreview(null)}>
          <img src={preview.src} alt={`Preview of page ${preview.page}`} style={{ width: preview.w }} className="block rounded-lg" />
        </div>
      )}

      {menu === 'share' && (
        <div className="popover bottom-3 right-[60px] w-64 p-1.5">
          {doc.url && <button className="menu-item" onClick={() => { navigator.clipboard.writeText(doc.url!); toast('Paper link copied'); setMenu(null); }}><Icon name="link" size={15} />Copy paper link</button>}
          <button className="menu-item" onClick={() => { exportNotes(); setMenu(null); }}><Icon name="download" size={15} />Export notes (Markdown)</button>
          {doc.summary && <button className="menu-item" onClick={() => { download(`${doc.title.slice(0, 60)} - summary.md`, `# ${doc.title}\n\n${doc.summary!.summary}`); setMenu(null); }}><Icon name="sparkles" size={15} />Export summary</button>}
        </div>
      )}
      {menu === 'info' && (
        <div className="popover left-[120px] top-14 grid w-80 gap-1.5 p-4 text-[13px]">
          <b>{doc.title}</b>
          <span className="text-muted">{pdf.numPages} pages · added {new Date(doc.addedAt).toLocaleDateString()}</span>
          {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="break-all text-accent">{doc.url}</a>}
          <span className="text-muted">AI language: {getSettings().lang}</span>
        </div>
      )}
    </div>
  );
}

function OutlineTree({ items, onGo, depth = 0 }: { items: any[]; onGo: (dest: any) => void; depth?: number }) {
  return items.map((it, i) => (
    <div key={i}>
      <button className="menu-item py-1.5 text-[13px]" style={{ paddingLeft: 10 + depth * 14, fontWeight: depth ? 400 : 600 }} onClick={() => it.dest && onGo(it.dest)}>{it.title}</button>
      {it.items?.length > 0 && <OutlineTree items={it.items} onGo={onGo} depth={depth + 1} />}
    </div>
  ));
}
