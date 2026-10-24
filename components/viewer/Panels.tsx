'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '../icons';
import { md, getSettings } from '@/lib/api';
import { ModelSelect } from '../app/Pickers';
import { listDocs } from '@/lib/db';
import { LogoMark } from '../site/Site';
import type { Card as CardT, ChatMsg, Doc, Mark, ModelChoice, Rect, Summary } from '@/lib/types';

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

function RefPicker({ doc, refs, setRefs }: { doc: Doc; refs: Doc[]; setRefs: (r: Doc[]) => void }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  useEffect(() => { if (open) listDocs().then(d => setDocs(d.filter(x => x.id !== doc.id))); }, [open]);
  return (
    <span className="relative">
      <button className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition ${refs.length ? 'border-accent text-accent' : 'border-line text-muted hover:bg-surface-2 hover:text-fg'}`} title="Add other papers as references" onClick={() => setOpen(!open)}><Icon name="plus" size={16} />{refs.length ? `${refs.length} reference${refs.length > 1 ? 's' : ''}` : 'Reference'}</button>
      {open && (
        <div className="popover absolute bottom-11 left-0 max-h-72 w-72 overflow-auto p-1.5">
          {!docs.length && <div className="p-2.5 text-[13px] text-muted">Add more papers to your library to reference them.</div>}
          {docs.map(d => {
            const on = refs.some(r => r.id === d.id);
            return (
              <button key={d.id} className="menu-item text-[13px]" onClick={() => setRefs(on ? refs.filter(r => r.id !== d.id) : [...refs, d])}>
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
  onAsk: (q: string, o: { model: ModelChoice; refs: Doc[] }) => void; onRemoveCard: (id: string) => void; onInfographic: (c: CardT) => void;
  onJump: (page: number, rects?: Rect[]) => void; chatBusy?: boolean; draft: string; setDraft: (s: string) => void;
  actions: [string, string, () => void][]; pdfOpen: boolean; onShowPdf: () => void;
};

// The paper as a chat: attachment, AI summary, explanation cards and Q&A in one thread.
export function ChatThread({ doc, summary, summarizing, onSummarize, onAsk, onRemoveCard, onInfographic, onJump, chatBusy, draft, setDraft, actions, pdfOpen, onShowPdf }: ChatProps) {
  const [kw, setKw] = useState<Summary['keywords'][number] | null>(null);
  const [model, setModel] = useState<ModelChoice>(() => { const { provider, model } = getSettings(); return { provider, model }; });
  const [refs, setRefs] = useState<Doc[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  type Feed = (CardT & { kind: 'card' }) | (ChatMsg & { kind: 'msg' });
  const feed: Feed[] = [...(doc.cards || []).map(c => ({ ...c, kind: 'card' as const })), ...(doc.chat || []).map((m, i) => ({ ...m, kind: 'msg' as const, at: m.at ?? i }))].sort((a, b) => (a.at || 0) - (b.at || 0));
  const last = feed.at(-1);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [feed.length, chatBusy, !!summary, last && (last.kind === 'card' ? last.body : last.content)?.length]);
  useEffect(() => { if (draft) input.current?.focus(); }, [draft]);
  const send = (q: string) => { if (q.trim() && !chatBusy) { onAsk(q.trim(), { model, refs }); setDraft(''); } };
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
              ? <User key={`m${f.at}`}><span className="whitespace-pre-wrap">{f.content}</span></User>
              : <Bot key={`m${f.at}`} actions={f.content && !chatBusy ? <Copy text={f.content} /> : undefined}>{f.content ? <Md text={f.content} /> : !f.error && <Spin />}{f.error && <div className="text-[13px] text-red-600">{f.error}</div>}</Bot>)}
          {summary?.questions && !chatBusy && (
            <div className="grid gap-2 pl-10">
              {summary.questions.map(q => <button key={q} onClick={() => send(q)} className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-left text-[13.5px] transition hover:bg-surface-2"><Icon name="arrowRight" size={14} className="shrink-0 text-muted" />{q}</button>)}
            </div>
          )}
          <div ref={end} />
        </div>
      </div>
      <div className={`${col} shrink-0 pb-3`}>
        <div className="rounded-[26px] border border-line bg-surface p-2.5 shadow-[0_2px_12px_rgba(0,0,0,.06)] transition focus-within:border-fg/30">
          <textarea ref={input} className="block max-h-48 min-h-11 w-full resize-none bg-transparent px-2.5 pt-1.5 text-[15px] outline-none placeholder:text-muted" value={draft} placeholder="Ask anything about this paper" rows={1}
            onChange={e => { setDraft(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }} />
          <div className="mt-1 flex items-center gap-1.5">
            <RefPicker doc={doc} refs={refs} setRefs={setRefs} />
            <ModelSelect className="ml-auto h-9 max-w-44 truncate rounded-full bg-transparent px-2.5 text-[13px] font-medium text-muted outline-none hover:bg-surface-2" value={model} onChange={setModel} />
            <button className="grid size-9 place-items-center rounded-full bg-fg text-bg transition disabled:opacity-25" disabled={!draft.trim() || chatBusy} onClick={() => send(draft)} aria-label="Send">{chatBusy ? <span className="size-3 rounded-[3px] bg-bg" /> : <Icon name="arrowRight" size={17} className="-rotate-90" />}</button>
          </div>
        </div>
        <p className="mt-2 text-center text-[11.5px] text-muted">AI can make mistakes. Check important claims against the paper.</p>
      </div>
    </div>
  );
}

const Body = ({ children }: { children: ReactNode }) => <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-3">{children}</div>;

export function TranslatePanel({ page, text, busy, error, onTranslate }: { page: number; text?: string; busy?: boolean; error?: string; onTranslate: () => void }) {
  return (
    <Body>
      <div className="flex items-center gap-2">
        <b>Page {page}</b>
        <button className="btn btn-accent btn-sm ml-auto" disabled={busy} onClick={onTranslate}>{busy ? <Spin /> : <Icon name="languages" size={14} />}{text ? 'Re-translate' : 'Translate page'}</button>
      </div>
      {error && <div className="text-[13px] text-red-600">{error}</div>}
      {text ? <div className="ai-bubble whitespace-pre-wrap leading-7">{text}</div> : !busy && <p className="text-sm text-muted">Translate the current page into {getSettings().lang}. Change the language in Settings.</p>}
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
