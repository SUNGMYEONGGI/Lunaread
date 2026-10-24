'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Icon from '../icons';
import { md, getSettings } from '@/lib/api';
import { ModelSelect } from '../app/Pickers';
import { listDocs } from '@/lib/db';
import type { Card as CardT, ChatMsg, Doc, Mark, ModelChoice, Rect, Summary } from '@/lib/types';

export const Md = ({ text }: { text: string }) => <div className="md" dangerouslySetInnerHTML={{ __html: md(text) }} />;
const svgOf = (text: string) => text.match(/<svg[\s\S]*<\/svg>/i)?.[0];
export const Spin = () => <span className="spin" />;

const CARD_LABEL: Record<string, [string, string]> = { explain: ['sparkles', 'Explanation'], translate: ['languages', 'Translation'], image: ['image', 'Image Explanation'], citation: ['quote', 'Smart Citation'], infographic: ['layers', 'Infographic'] };

function Section({ icon, title, action, open = true, children }: { icon: string; title: string; action?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="group shrink-0 border-b border-line pb-2" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <Icon name="chevron" size={14} className="-rotate-90 text-muted transition group-open:rotate-0" /><Icon name={icon} size={15} />{title}
        {action && <span className="ml-auto" onClick={e => e.preventDefault()}>{action}</span>}
      </summary>
      <div className="pb-2 pt-1">{children}</div>
    </details>
  );
}

function Card({ c, onRemove, onInfographic, onAsk, onJump }: { c: CardT; onRemove: () => void; onInfographic: (c: CardT) => void; onAsk: (c: CardT) => void; onJump: (page: number) => void }) {
  const [icon, label] = CARD_LABEL[c.type];
  const svg = c.type === 'infographic' && !c.pending && svgOf(c.body || '');
  const bg = typeof window !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--bg') : '#fff';
  return (
    <div className="ai-bubble">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-accent"><Icon name={icon} size={14} />{label}
        {c.page && <button className="font-medium text-muted hover:text-fg" onClick={() => onJump(c.page!)}>· p.{c.page}</button>}
        <button className="icon-btn ml-auto size-6" title="Remove" onClick={onRemove}><Icon name="x" size={13} /></button>
      </div>
      {c.image && <img className="mb-2 max-w-full rounded-lg border border-line" src={c.image} alt="Selected region" />}
      {c.src && <div className="mb-2 line-clamp-3 border-l-[3px] border-accent pl-2.5 text-[12.5px] text-muted">{c.src}</div>}
      {c.type === 'infographic'
        ? (svg ? <iframe className="aspect-[4/3] w-full rounded-lg border-0" sandbox="" title="Infographic" srcDoc={`<body style="margin:0;background:${bg}">${svg.replace('<svg', '<svg width="100%" height="100%"')}</body>`} /> : c.error ? null : <Spin />)
        : c.body ? <Md text={c.body} /> : !c.error && <Spin />}
      {c.error && <div className="text-[13px] text-red-600">{c.error}</div>}
      {!c.pending && !c.error && ['explain', 'image'].includes(c.type) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button className="chip" onClick={() => onAsk(c)}><Icon name="chat" size={13} />Ask follow-up</button>
          <button className="chip" onClick={() => onInfographic(c)}><Icon name="layers" size={13} />Infographic</button>
          <button className="chip" onClick={() => navigator.clipboard.writeText(c.body || '')}><Icon name="copy" size={13} />Copy</button>
        </div>
      )}
    </div>
  );
}

function RefPicker({ doc, refs, setRefs }: { doc: Doc; refs: Doc[]; setRefs: (r: Doc[]) => void }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  useEffect(() => { if (open) listDocs().then(d => setDocs(d.filter(x => x.id !== doc.id))); }, [open]);
  return (
    <span className="relative">
      <button className={`chip ${refs.length ? 'on' : ''}`} onClick={() => setOpen(!open)}><Icon name="link" size={13} />{refs.length ? `${refs.length} reference${refs.length > 1 ? 's' : ''}` : 'Add Reference'}</button>
      {open && (
        <div className="popover absolute bottom-9 left-0 max-h-72 w-72 overflow-auto p-1.5">
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

type AiProps = {
  doc: Doc; summary?: Summary; summarizing?: boolean; onSummarize: (force?: boolean) => void;
  onAsk: (q: string, o: { model: ModelChoice; refs: Doc[] }) => void; onRemoveCard: (id: string) => void; onInfographic: (c: CardT) => void;
  onJump: (page: number, rects?: Rect[]) => void; chatBusy?: boolean; draft: string; setDraft: (s: string) => void;
};

export function AiPanel({ doc, summary, summarizing, onSummarize, onAsk, onRemoveCard, onInfographic, onJump, chatBusy, draft, setDraft }: AiProps) {
  const [kw, setKw] = useState<Summary['keywords'][number] | null>(null);
  const [model, setModel] = useState<ModelChoice>(() => { const { provider, model } = getSettings(); return { provider, model }; });
  const [refs, setRefs] = useState<Doc[]>([]);
  const [tips, setTips] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  type Feed = (CardT & { kind: 'card' }) | (ChatMsg & { kind: 'msg' });
  const feed: Feed[] = [...(doc.cards || []).map(c => ({ ...c, kind: 'card' as const })), ...(doc.chat || []).map((m, i) => ({ ...m, kind: 'msg' as const, at: m.at ?? i }))].sort((a, b) => (a.at || 0) - (b.at || 0));
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [feed.length, chatBusy]);
  const send = (q: string) => { if (q.trim() && !chatBusy) { onAsk(q.trim(), { model, refs }); setDraft(''); } };

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-3">
        <Section icon="list" title="Keyword Dictionary" action={summary && <button className="icon-btn size-6" title="Regenerate" onClick={() => onSummarize(true)}><Icon name="refresh" size={13} /></button>}>
          {summary ? <>
            <div className="flex flex-wrap gap-1.5">{summary.keywords.map(k => <button key={k.term} onClick={() => setKw(kw?.term === k.term ? null : k)} className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition ${kw?.term === k.term ? 'bg-accent text-white' : 'bg-ai text-accent'}`}>{k.term}</button>)}</div>
            {kw && <div className="mt-2.5 rounded-xl bg-surface-2 p-3 text-[13px]"><b>{kw.term}</b> — {kw.definition}</div>}
          </> : summarizing ? <Spin /> : <button className="btn btn-accent btn-sm" onClick={() => onSummarize()}><Icon name="sparkles" size={14} />Generate keywords & summary</button>}
        </Section>
        {summary && <Section icon="sparkles" title="Summary" open={false}><div className="text-[13.5px]"><Md text={summary.summary} /></div></Section>}
        {!!doc.auto?.length && (
          <Section icon="highlighter" title={`Auto Highlights (${doc.auto.length})`} open={false}>
            <div className="grid gap-2">
              {(['novelty', 'method', 'result'] as const).map(cat => doc.auto!.filter(h => h.category === cat).map((h, i) => (
                <button key={cat + i} className="grid gap-1 rounded-xl border border-line p-2.5 text-left hover:border-accent" style={{ borderLeft: `4px solid var(--hl-${cat})` }} onClick={() => h.page && onJump(h.page, h.rects)}>
                  <small className="font-bold capitalize text-muted">{cat}{h.page ? ` · p.${h.page}` : ''}</small>
                  <span className="text-[13px]">{h.text}</span>
                </button>
              )))}
            </div>
          </Section>
        )}
        {feed.map(f => f.kind === 'card'
          ? <Card key={f.id} c={f} onRemove={() => onRemoveCard(f.id)} onInfographic={onInfographic} onJump={onJump} onAsk={c => setDraft(`About this ${c.type === 'image' ? 'figure' : 'passage'}: `)} />
          : f.role === 'user'
            ? <div key={`m${f.at}`} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-fg px-3.5 py-2.5 text-[13.5px] text-bg">{f.content}</div>
            : <div key={`m${f.at}`} className="ai-bubble">{f.content ? <Md text={f.content} /> : <Spin />}{f.error && <div className="text-[13px] text-red-600">{f.error}</div>}</div>)}
        {summary?.questions && tips && (
          <div className="flex flex-wrap gap-1.5">{summary.questions.map(q => <button key={q} onClick={() => send(q)} className="rounded-xl border border-line bg-surface px-3 py-2 text-left text-[12.5px] transition hover:border-accent hover:text-accent">{q}</button>)}</div>
        )}
        <div ref={end} />
      </div>
      <div className="m-3 mt-0 shrink-0 rounded-2xl border border-line bg-surface p-3 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-soft">
        <div className="flex items-start gap-1.5">
          <textarea className="min-h-10 max-h-40 flex-1 resize-none bg-transparent text-sm outline-none" value={draft} placeholder="Ask me anything." rows={2} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }} />
          <button className={`grid size-7 place-items-center rounded-full border transition ${tips ? 'border-accent text-accent' : 'border-line text-muted hover:text-accent'}`} title="Suggested questions" onClick={() => summary ? setTips(!tips) : onSummarize()}><Icon name="bulb" size={14} /></button>
          <button className="grid size-7 place-items-center rounded-full bg-accent text-white disabled:opacity-35" disabled={!draft.trim() || chatBusy} onClick={() => send(draft)} aria-label="Send"><Icon name="send" size={14} /></button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <RefPicker doc={doc} refs={refs} setRefs={setRefs} />
          <ModelSelect className="h-7 max-w-48 rounded-full border border-line bg-surface px-2.5 text-xs font-semibold text-muted outline-none" value={model} onChange={setModel} />
        </div>
      </div>
    </>
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
