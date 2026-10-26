'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '../icons';
import { md, getSettings, saveSettings } from '@/lib/api';
import { trModel } from '@/lib/translate';
import { ModelSelect } from '../app/Pickers';
import { listDocs } from '@/lib/db';
import { LogoMark } from '../site/Site';
import type { Card as CardT, ChatMsg, Doc, Mark, ModelChoice, Para, Rect, Summary } from '@/lib/types';
import type { Scope } from '@/lib/library';

export type AskOpts = { model: ModelChoice; refs: Doc[]; scope: Scope };

export const Md = ({ text }: { text: string }) => <div className="md" dangerouslySetInnerHTML={{ __html: md(text) }} />;
const svgOf = (text: string) => text.match(/<svg[\s\S]*<\/svg>/i)?.[0];
export const Spin = () => <span className="spin" />;

const CARD_ASK: Record<string, [string, string]> = { explain: ['sparkles', 'Explain'], translate: ['languages', 'Translate'], image: ['image', 'Explain this figure'], citation: ['quote', 'Smart Citation'], infographic: ['layers', 'Draw an infographic'] };

// One chat turn: the user's bubble on the right, the assistant's answer on the left.
const User = ({ children }: { children: ReactNode }) => (
  <div className="flex justify-end" style={{ animation: 'fade-up .16s var(--ease)' }}><div className="max-w-[85%] rounded-3xl bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed">{children}</div></div>
);
function Bot({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="group flex gap-3" style={{ animation: 'fade-up .16s var(--ease)' }}>
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface"><LogoMark size={16} /></span>
      <div className="min-w-0 flex-1 text-[15px] leading-relaxed">
        {children}
        {actions && <div className="mt-2 flex flex-wrap items-center gap-0.5 text-muted opacity-70 transition group-hover:opacity-100">{actions}</div>}
      </div>
    </div>
  );
}
const Act = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
  <button className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs hover:bg-surface-2 hover:text-fg" title={label} onClick={onClick}><Icon name={icon} size={14} />{label}</button>
);
const Copy = ({ text }: { text: string }) => <Act icon="copy" label="Copy" onClick={() => navigator.clipboard.writeText(text)} />;

function CardTurn({ c, onRemove, onInfographic, onFollow, onJump }: { c: CardT; onRemove: () => void; onInfographic: (c: CardT) => void; onFollow: (c: CardT) => void; onJump: (page: number) => void }) {
  const [icon, label] = CARD_ASK[c.type];
  const svg = c.type === 'infographic' && !c.pending && svgOf(c.body || '');
  const bg = typeof window !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--bg') : '#fff';
  return (
    <>
      <User>
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted"><Icon name={icon} size={13} />{label}{c.page && <span className="font-normal">· p.{c.page}</span>}</div>
        {c.image && <img className="max-h-48 max-w-full rounded-xl border border-line" src={c.image} alt="Selected region" />}
        {c.src && <div className="line-clamp-4 text-[14px] italic text-fg/80">“{c.src}”</div>}
      </User>
      <Bot actions={!c.pending && <>
        {c.body && <Copy text={c.body} />}
        {['explain', 'image'].includes(c.type) && !c.error && <><Act icon="chat" label="Follow up" onClick={() => onFollow(c)} /><Act icon="layers" label="Infographic" onClick={() => onInfographic(c)} /></>}
        {c.page && <Act icon="file" label={`Page ${c.page}`} onClick={() => onJump(c.page!)} />}
        <Act icon="trash" label="Remove" onClick={onRemove} />
      </>}>
        {c.type === 'infographic'
          ? (svg ? <iframe className="aspect-[4/3] w-full rounded-xl border border-line" sandbox="" title="Infographic" srcDoc={`<body style="margin:0;background:${bg}">${svg.replace('<svg', '<svg width="100%" height="100%"')}</body>`} /> : c.error ? null : <Spin />)
          : c.body ? <Md text={c.body} /> : !c.error && <Spin />}
        {c.error && <div className="text-[13px] text-red-600">{c.error}</div>}
      </Bot>
    </>
  );
}

// What the chat can see besides this paper: picked reference papers, or a folder / the whole library (retrieval).
function ContextPicker({ doc, refs, setRefs, scope, setScope }: { doc: Doc; refs: Doc[]; setRefs: (r: Doc[]) => void; scope: Scope; setScope: (s: Scope) => void }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  useEffect(() => { if (open) listDocs().then(d => setDocs(d.filter(x => x.id !== doc.id))); }, [open]);
  const scopes: [Scope, string][] = [['paper', 'This paper'], ...(doc.folder ? [[`folder:${doc.folder}`, `Folder “${doc.folder}”`] as [Scope, string]] : []), ['library', 'Whole library']];
  const label = scope !== 'paper' ? scopes.find(s => s[0] === scope)?.[1] : refs.length ? `${refs.length} reference${refs.length > 1 ? 's' : ''}` : 'Context';
  return (
    <span className="relative">
      <button className={`inline-flex h-9 max-w-44 items-center gap-1.5 rounded-full border px-3 text-[13px] transition ${refs.length || scope !== 'paper' ? 'border-accent text-accent' : 'border-line text-muted hover:bg-surface-2 hover:text-fg'}`} title="Ask across other papers" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="plus" size={16} /><span className="truncate">{label}</span></button>
      {open && (
        <div className="popover absolute bottom-11 left-0 max-h-80 w-72 overflow-auto p-1.5">
          <div className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted">Search in</div>
          {scopes.map(([v, l]) => <button key={v} className="menu-item text-[13px]" onClick={() => { setScope(v); if (v !== 'paper') setRefs([]); }}><Icon name={scope === v ? 'check' : v === 'paper' ? 'file' : v === 'library' ? 'library' : 'folder'} size={14} />{l}</button>)}
          <div className="px-2.5 pb-1 pt-3 text-xs font-medium text-muted">Or attach whole papers</div>
          {!docs.length && <div className="p-2.5 text-[13px] text-muted">Add more papers to your library to reference them.</div>}
          {docs.map(d => {
            const on = refs.some(r => r.id === d.id);
            return (
              <button key={d.id} className="menu-item text-[13px]" onClick={() => { setScope('paper'); setRefs(on ? refs.filter(r => r.id !== d.id) : [...refs, d]); }}>
                <Icon name={on ? 'check' : 'file'} size={14} /><span className="truncate">{d.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

type ChatProps = {
  doc: Doc; summary?: Summary; summarizing?: boolean; onSummarize: (force?: boolean) => void;
  onAsk: (q: string, o: AskOpts, from?: number) => void; onStop: () => void; onRemoveCard: (id: string) => void; onInfographic: (c: CardT) => void;
  onJump: (page: number, rects?: Rect[]) => void; chatBusy?: boolean; draft: string; setDraft: (s: string) => void;
  actions: [string, string, () => void][]; pdfOpen: boolean; onShowPdf: () => void;
};

// The paper as a chat: attachment, AI summary, explanation cards and Q&A in one thread.
export function ChatThread({ doc, summary, summarizing, onSummarize, onAsk, onStop, onRemoveCard, onInfographic, onJump, chatBusy, draft, setDraft, actions, pdfOpen, onShowPdf }: ChatProps) {
  const [kw, setKw] = useState<Summary['keywords'][number] | null>(null);
  const [model, setModel] = useState<ModelChoice>(() => { const { provider, model } = getSettings(); return { provider, model }; });
  const [refs, setRefs] = useState<Doc[]>([]);
  const [scope, setScope] = useState<Scope>('paper');
  const [editing, setEditing] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  type Feed = (CardT & { kind: 'card' }) | (ChatMsg & { kind: 'msg'; i: number });
  const feed: Feed[] = [...(doc.cards || []).map(c => ({ ...c, kind: 'card' as const })), ...(doc.chat || []).map((m, i) => ({ ...m, kind: 'msg' as const, i, at: m.at ?? i }))].sort((a, b) => (a.at || 0) - (b.at || 0));
  const last = feed.at(-1);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [feed.length, chatBusy, !!summary, last && (last.kind === 'card' ? last.body : last.content)?.length]);
  useEffect(() => { if (draft) input.current?.focus(); }, [draft]);
  const send = (q: string, from = editing ?? undefined) => { if (q.trim() && !chatBusy) { onAsk(q.trim(), { model, refs, scope }, from); setDraft(''); setEditing(null); } };
  const lastUser = doc.chat?.findLastIndex(m => m.role === 'user') ?? -1;
  const col = pdfOpen ? 'px-5' : 'mx-auto w-full max-w-3xl px-6';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-auto">
        <div className={`${col} flex flex-col gap-6 py-6`}>
          <div className="flex justify-end">
            <button onClick={onShowPdf} className="flex w-72 max-w-[85%] items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 text-left transition hover:bg-surface-2" title={pdfOpen ? 'Go to the first page' : 'Show the PDF'}>
              <span className="grid h-12 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-red-500 text-[10px] font-bold text-white">{doc.thumb ? <img src={doc.thumb} alt="" className="size-full object-cover object-top" /> : 'PDF'}</span>
              <span className="min-w-0"><span className="line-clamp-2 text-[13px] font-semibold leading-snug">{doc.title}</span><span className="text-xs text-muted">PDF{doc.pages ? ` · ${doc.pages} pages` : ''}</span></span>
            </button>
          </div>
          <Bot>
            <p>I have <b>{doc.title}</b> open. Ask me anything about it, or select text in the PDF to explain, translate or highlight it.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!summary && <button className="chip h-8 px-3.5 text-[13px]" disabled={summarizing} onClick={() => onSummarize()}>{summarizing ? <Spin /> : <Icon name="sparkles" size={14} />}Summarize with keywords</button>}
              {actions.map(([icon, label, fn]) => <button key={label} className="chip h-8 px-3.5 text-[13px]" onClick={fn}><Icon name={icon} size={14} />{label}</button>)}
            </div>
          </Bot>
          {summary && (
            <Bot actions={<><Copy text={summary.summary} /><Act icon="refresh" label="Regenerate" onClick={() => onSummarize(true)} /></>}>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Keyword Dictionary</div>
              <div className="flex flex-wrap gap-1.5">{summary.keywords.map(k => <button key={k.term} onClick={() => setKw(kw?.term === k.term ? null : k)} className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition ${kw?.term === k.term ? 'bg-accent text-white' : 'bg-ai text-accent'}`}>{k.term}</button>)}</div>
              {kw && <div className="mt-2.5 rounded-xl bg-surface-2 p-3 text-[13.5px]"><b>{kw.term}</b> — {kw.definition}</div>}
              <div className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Summary</div>
              <Md text={summary.summary} />
            </Bot>
          )}
          {!!doc.auto?.length && (
            <Bot>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Auto Highlights · {doc.auto.length}</div>
              <div className="grid gap-2">
                {(['novelty', 'method', 'result'] as const).map(cat => doc.auto!.filter(h => h.category === cat).map((h, i) => (
                  <button key={cat + i} className="grid gap-0.5 rounded-xl border border-line p-2.5 text-left text-[13.5px] hover:bg-surface-2" style={{ borderLeft: `4px solid var(--hl-${cat})` }} onClick={() => h.page && onJump(h.page, h.rects)}>
                    <small className="font-semibold capitalize text-muted">{cat}{h.page ? ` · p.${h.page}` : ''}</small>{h.text}
                  </button>
                )))}
              </div>
            </Bot>
          )}
          {feed.map(f => f.kind === 'card'
            ? <CardTurn key={f.id} c={f} onRemove={() => onRemoveCard(f.id)} onInfographic={onInfographic} onJump={onJump} onFollow={c => setDraft(`About this ${c.type === 'image' ? 'figure' : 'passage'}: `)} />
            : f.role === 'user'
              ? <div key={`m${f.at}`} className="group grid justify-items-end gap-1">
                  <User><span className="whitespace-pre-wrap">{f.content}</span></User>
                  {!chatBusy && <div className="flex text-muted opacity-0 transition group-hover:opacity-100"><Act icon="pen" label="Edit" onClick={() => { setEditing(f.i); setDraft(f.content); }} /><Copy text={f.content} /></div>}
                </div>
              : <Bot key={`m${f.at}`} actions={!chatBusy && (f.content || f.error) ? <>{f.content && <Copy text={f.content} />}{f.i === lastUser + 1 && <Act icon="refresh" label="Regenerate" onClick={() => send(doc.chat[lastUser].content, lastUser)} />}</> : undefined}>{f.content ? <Md text={f.content} /> : !f.error && <Spin />}{f.error && <div className="text-[13px] text-red-600">{f.error}</div>}</Bot>)}
          {summary?.questions && !chatBusy && (
            <div className="grid gap-2 pl-10">
              {summary.questions.map(q => <button key={q} onClick={() => send(q)} className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-left text-[13.5px] transition hover:bg-surface-2"><Icon name="arrowRight" size={14} className="shrink-0 text-muted" />{q}</button>)}
            </div>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className={`${col} shrink-0 pb-3`}>
        {editing !== null && <div className="mb-1.5 flex items-center gap-2 px-3 text-xs text-muted"><Icon name="pen" size={12} />Editing a message. Sending replaces the conversation from there.<button className="ml-auto underline" onClick={() => { setEditing(null); setDraft(''); }}>Cancel</button></div>}
        <div className="rounded-[26px] border border-line bg-surface p-2.5 shadow-[0_2px_12px_rgba(0,0,0,.06)] transition focus-within:border-fg/30">
          <textarea ref={input} className="block max-h-48 min-h-11 w-full resize-none bg-transparent px-2.5 pt-1.5 text-[15px] outline-none placeholder:text-muted" value={draft} placeholder="Ask anything about this paper" rows={1}
            onChange={e => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }} />
          <div className="mt-1 flex items-center gap-1.5">
            <ContextPicker doc={doc} refs={refs} setRefs={setRefs} scope={scope} setScope={setScope} />
            <ModelSelect className="ml-auto h-9 max-w-44 truncate rounded-full bg-transparent px-2.5 text-[13px] font-medium text-muted outline-none hover:bg-surface-2" value={model} onChange={setModel} />
            {chatBusy
              ? <button className="grid size-9 place-items-center rounded-full bg-fg text-bg transition" onClick={onStop} aria-label="Stop generating" title="Stop"><span className="size-3 rounded-[3px] bg-bg" /></button>
              : <button className="grid size-9 place-items-center rounded-full bg-fg text-bg transition disabled:opacity-25" disabled={!draft.trim()} onClick={() => send(draft)} aria-label="Send"><Icon name="arrowRight" size={17} className="-rotate-90" /></button>}
          </div>
        </div>
        <p className="mt-2 text-center text-[11.5px] text-muted">AI can make mistakes. Check important claims against the paper.</p>
      </div>
    </div>
  );
}

const Body = ({ children }: { children: ReactNode }) => <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-3">{children}</div>;

export type TrAll = { done: number; total: number; failed: number[]; running: boolean };
type TrProps = {
  page: number; paras?: Para[]; busy?: boolean; error?: string; all: TrAll | null; translated: number; pages: number;
  onTranslate: (force?: boolean) => void; onAll: () => void; onStop: () => void; onRetranslate: (i: number) => void; onJump: (r: Rect) => void;
  glossary: string; setGlossary: (g: string) => void; keywords?: string[];
};

// Paragraph translator: the current page side by side with the original, the whole paper in the background.
export function TranslatePanel({ page, paras, busy, error, all, translated, pages, onTranslate, onAll, onStop, onRetranslate, onJump, glossary, setGlossary, keywords }: TrProps) {
  const [both, setBoth] = useState(true);
  const [model, setModel] = useState(trModel);
  const pickModel = (m: ModelChoice) => { setModel(m); saveSettings({ ...getSettings(), trModel: m }); };
  const seed = () => setGlossary([glossary.trim(), ...(keywords || []).filter(k => !glossary.split('\n').some(l => l.split('=')[0].trim() === k))].filter(Boolean).join('\n'));
  return (
    <Body>
      <div className="grid gap-2 rounded-xl border border-line p-3">
        <div className="flex items-center gap-2 text-[13px]">
          <b>Whole paper</b><span className="text-muted">{translated}/{pages} pages</span>
          {all?.running
            ? <button className="btn btn-outline btn-sm ml-auto" onClick={onStop}><span className="size-2.5 rounded-[2px] bg-fg" />Stop</button>
            : <button className="btn btn-accent btn-sm ml-auto" disabled={translated === pages} onClick={onAll}><Icon name="languages" size={14} />{translated ? 'Translate the rest' : 'Translate paper'}</button>}
        </div>
        {all && <div className="h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent transition-all" style={{ width: `${(all.done / all.total) * 100}%` }} /></div>}
        {all && !all.running && !!all.failed.length && <div className="text-[12.5px] text-red-600">Pages {all.failed.join(', ')} failed. <button className="underline" onClick={onAll}>Retry</button></div>}
        <ModelSelect className="select h-8 text-[12.5px]" value={model} onChange={pickModel} />
      </div>
      <details className="rounded-xl border border-line p-3 text-[13px]" open={!!glossary}>
        <summary className="cursor-pointer font-semibold">Glossary</summary>
        <textarea className="mt-2 min-h-20 w-full rounded-lg border border-line bg-bg px-2 py-1.5 font-mono text-[12px] outline-none" value={glossary} onChange={e => setGlossary(e.target.value)}
          placeholder={'Transformer\nattention = 어텐션'} aria-label="Glossary" />
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="flex-1">One term per line. “term” keeps it untranslated, “term = translation” fixes it. A global glossary lives in Settings.</span>
          {!!keywords?.length && <button className="chip h-7 shrink-0 px-2.5 text-xs" onClick={seed}>Add keywords</button>}
        </div>
      </details>
      <div className="flex items-center gap-2">
        <b>Page {page}</b>
        <div className="inline-flex rounded-full bg-surface-2 p-0.5 text-xs font-semibold">
          {([[true, 'Bilingual'], [false, 'Translation']] as const).map(([v, l]) => <button key={l} aria-pressed={both === v} onClick={() => setBoth(v)} className={`rounded-full px-2.5 py-1 ${both === v ? 'bg-surface shadow-sm' : 'text-muted'}`}>{l}</button>)}
        </div>
        <button className="btn btn-outline btn-sm ml-auto" disabled={busy} onClick={() => onTranslate(!!paras)}>{busy ? <Spin /> : <Icon name={paras ? 'refresh' : 'languages'} size={14} />}{paras ? 'Redo' : 'Translate'}</button>
      </div>
      {error && <div className="text-[13px] text-red-600">{error}</div>}
      {!paras && !busy && <p className="text-sm text-muted">Translate this page into {getSettings().lang}, paragraph by paragraph. Hold Alt (⌥) and point at a paragraph in the PDF for a quick translation.</p>}
      {paras?.map((p, i) => (
        <div key={i} className="group grid cursor-pointer gap-1 rounded-xl p-2 text-[14px] leading-relaxed hover:bg-surface-2" onClick={() => onJump(p)}>
          {both && p.tr !== p.src && <p className="text-[12.5px] leading-snug text-muted">{p.src}</p>}
          <p>{p.tr}</p>
          <div className="hidden gap-0.5 text-muted group-hover:flex group-focus-within:flex" onClick={e => e.stopPropagation()}>
            <Act icon="refresh" label="Retranslate" onClick={() => onRetranslate(i)} /><Copy text={p.tr} />
          </div>
        </div>
      ))}
    </Body>
  );
}

export function NotesPanel({ marks, onJump, onUpdate, onDelete, onExport }: { marks: Mark[]; onJump: (p: number, r?: Rect[]) => void; onUpdate: (id: string, c: Partial<Mark>) => void; onDelete: (id: string) => void; onExport: () => void }) {
  const sorted = [...marks].sort((a, b) => a.page - b.page || a.rects[0].y - b.rects[0].y);
  return (
    <Body>
      <div className="flex items-center">
        <span className="text-sm text-muted">{marks.length} highlight{marks.length === 1 ? '' : 's'}</span>
        <button className="btn btn-outline btn-sm ml-auto" onClick={onExport} disabled={!marks.length}><Icon name="download" size={14} />Export Markdown</button>
      </div>
      {!marks.length && <p className="text-sm text-muted">Select text in the paper and pick a color to highlight. Add notes to your highlights here.</p>}
      {sorted.map(m => (
        <div key={m.id} className="grid cursor-pointer gap-1.5 rounded-xl border border-line p-3 hover:border-accent" style={{ borderLeft: `4px solid var(--hl-${m.color})` }} onClick={() => onJump(m.page, m.rects)}>
          <div className="flex items-center gap-1.5">
            <small className="text-muted">p.{m.page}</small>
            <button className="icon-btn ml-auto size-6" title="Delete" onClick={e => { e.stopPropagation(); onDelete(m.id); }}><Icon name="trash" size={13} /></button>
          </div>
          <span className="text-[13px]">{m.text}</span>
          <textarea className="min-h-9 w-full resize-y rounded-lg border border-line bg-bg px-2 py-1.5 text-[13px] outline-none" placeholder="Add a note…" defaultValue={m.note} onClick={e => e.stopPropagation()} onBlur={e => e.target.value !== (m.note || '') && onUpdate(m.id, { note: e.target.value })} />
        </div>
      ))}
    </Body>
  );
}

export function DiscussionPanel({ text, busy, error, onRun }: { text?: string; busy?: boolean; error?: string; onRun: () => void }) {
  return (
    <Body>
      <button className="btn btn-accent btn-sm self-start" disabled={busy} onClick={onRun}>{busy ? <Spin /> : <Icon name="chat" size={14} />}{text ? 'Regenerate discussion' : 'Start discussion'}</button>
      {error && <div className="text-[13px] text-red-600">{error}</div>}
      {text ? <div className="ai-bubble"><Md text={text} /></div> : !busy && <p className="text-sm text-muted">Get a reviewer-style discussion: strengths, weaknesses, related work and follow-up ideas.</p>}
    </Body>
  );
}
