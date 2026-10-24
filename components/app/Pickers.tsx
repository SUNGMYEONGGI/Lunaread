'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchModels, fetchPalettes, getSettings, saveSettings } from '@/lib/api';
import { applyTheme, splitCode } from '@/lib/theme';
import type { ModelChoice, Provider, ProviderInfo } from '@/lib/types';
import Icon, { Brand } from '../icons';
import { APP_NAME } from './events';

let modelsCache: Promise<ProviderInfo[]> | null = null;
export const loadModels = (fresh?: boolean | number) => (!fresh && modelsCache) || (modelsCache = fetchModels().catch(e => { modelsCache = null; throw e; }));

// One <select> over every provider's models.
export function ModelSelect({ value, onChange, fresh, className = 'select' }: { value: ModelChoice; onChange: (v: ModelChoice) => void; fresh?: number; className?: string }) {
  const [list, setList] = useState<ProviderInfo[] | null>(null);
  useEffect(() => { loadModels(fresh).then(setList, () => setList([])); }, [fresh]);
  const v = `${value.provider}|${value.model}`;
  return (
    <select className={className} value={v} aria-label="AI model" onChange={e => { const [provider, model] = e.target.value.split('|'); onChange({ provider: provider as Provider, model }); }}>
      {!list?.some(p => p.models.some(m => `${p.id}|${m.id}` === v)) && <option value={v}>{value.model}</option>}
      {list?.map(p => (
        <optgroup key={p.id} label={p.error ? `${p.label} — ${p.error}` : p.label}>
          {p.models.map(m => <option key={m.id} value={`${p.id}|${m.id}`}>{m.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

const SORTS = [['popular', 'Popular'], ['new', 'New'], ['random', 'Random']];
const TAGS = ['pastel', 'vintage', 'retro', 'neon', 'gold', 'light', 'dark', 'warm', 'cold', 'summer', 'fall', 'winter', 'spring', 'happy', 'nature', 'earth', 'night', 'space', 'rainbow', 'gradient', 'sunset', 'sky', 'sea', 'kids', 'skin', 'food', 'cream', 'coffee', 'wedding', 'christmas', 'halloween'];
export const DEFAULT_SWATCH = ['#FAFAFA', '#EEF4FF', '#2563EB', '#0A0A0B'];

function Swatch({ colors, on, onClick, children, title }: { colors: string[]; on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} title={title} className={`grid gap-1.5 rounded-2xl border-2 p-1.5 text-left transition hover:-translate-y-0.5 ${on ? 'border-accent' : 'border-transparent'}`}>
      <div className="grid h-28 grid-rows-[2fr_1.4fr_1fr_.8fr] overflow-hidden rounded-xl ring-1 ring-black/5">{colors.map(c => <span key={c} style={{ background: c }} />)}</div>
      <small className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-muted">{children}</small>
    </button>
  );
}

// Browses the live Color Hunt feed (through the Lunaread server) and previews each palette on the whole app.
export function ThemePicker({ onClose }: { onClose: () => void }) {
  const start = useRef(getSettings());
  const [sel, setSel] = useState({ theme: start.current.theme, palette: start.current.palette });
  const [sort, setSort] = useState('popular');
  const [tag, setTag] = useState('');
  const [items, setItems] = useState<{ code: string; likes: string }[]>([]);
  const [state, setState] = useState({ step: 0, busy: false, end: false, error: '' });
  const more = useRef<HTMLDivElement>(null);

  const load = async (step: number, reset?: boolean) => {
    setState(s => ({ ...s, busy: true, error: '' }));
    try {
      const page = await fetchPalettes(step, sort, tag);
      setItems(it => reset ? page : [...it, ...page.filter(p => !it.some(q => q.code === p.code))]);
      setState({ step: step + 1, busy: false, end: !page.length, error: '' });
    } catch (e) { setState(s => ({ ...s, busy: false, error: (e as Error).message })); }
  };
  useEffect(() => { setItems([]); load(0, true); }, [sort, tag]);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !state.busy && !state.end && !state.error) load(state.step); });
    if (more.current) io.observe(more.current);
    return () => io.disconnect();
  });
  useEffect(() => { applyTheme(sel); }, [sel]);

  const cancel = () => { applyTheme(start.current); onClose(); };
  const save = () => { saveSettings({ ...getSettings(), ...sel }); onClose(); };

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && cancel()}>
      <div className="modal grid max-h-[min(780px,calc(100vh-32px))] max-w-[880px] grid-rows-[auto_auto_1fr_auto]" role="dialog" aria-label="Color theme">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-bold tracking-tight">Color theme</h3>
          <div className="inline-flex gap-0.5 rounded-full bg-surface-2 p-1">
            {([['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']] as const).map(([k, ic, l]) => (
              <button key={k} onClick={() => setSel({ ...sel, theme: k })} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold transition ${sel.theme === k ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}><Icon name={ic} size={14} />{l}</button>
            ))}
          </div>
          <button className="icon-btn ml-auto" onClick={cancel} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SORTS.map(([k, l]) => <button key={k} className={`chip ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>{l}</button>)}
          <select className="select h-7 rounded-full text-xs" value={tag} onChange={e => setTag(e.target.value)} aria-label="Palette tag">
            <option value="">All tags</option>{TAGS.map(t => <option key={t}>{t}</option>)}
          </select>
          <small className="ml-auto text-muted">Palettes from <a className="text-accent" href="https://colorhunt.co" target="_blank" rel="noreferrer">Color Hunt</a></small>
        </div>
        <div className="grid min-h-52 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 overflow-auto p-1">
          <Swatch colors={DEFAULT_SWATCH} on={!sel.palette} onClick={() => setSel({ ...sel, palette: null })}>Default</Swatch>
          {items.map(p => (
            <Swatch key={p.code} colors={splitCode(p.code)} on={sel.palette === p.code} onClick={() => setSel({ ...sel, palette: p.code })} title={splitCode(p.code).join(' ')}>
              <Icon name="heart" size={11} />{Number(p.likes).toLocaleString()}
            </Swatch>
          ))}
          <div ref={more} className="col-span-full grid min-h-10 place-items-center text-sm">
            {state.busy ? <span className="spin" /> : state.error ? <span className="text-red-600">{state.error} <button className="chip ml-1" onClick={() => load(state.step)}>Retry</button></span> : null}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn btn-outline btn-sm" onClick={cancel}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save}>Apply theme</button>
        </div>
      </div>
    </div>
  );
}

// "Get started" dialog: pick which AI account powers the reader (there are no app accounts).
export function GetStarted({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [list, setList] = useState<ProviderInfo[] | null>(null);
  const [key, setKey] = useState('');
  useEffect(() => { loadModels().then(setList, () => setList([])); }, []);
  const pick = (provider: Provider, extra = {}) => {
    saveSettings({ ...getSettings(), provider, model: provider === 'anthropic-api' ? 'claude-opus-5-5' : 'default', ...extra });
    loadModels(true);
    onClose();
    router.push('/library/');
  };
  const sub = (id: Provider) => list?.find(p => p.id === id);
  const SubButton = ({ id, label, icon }: { id: Provider; label: string; icon: string }) => (
    <button className="btn btn-outline h-12 w-full" disabled={!sub(id)?.models.length} onClick={() => pick(id)} title={sub(id)?.error}>
      <Brand name={icon} size={18} />{label}{list && !sub(id)?.models.length && <small className="font-normal text-muted">· not connected</small>}
    </button>
  );
  const ant = key.trim().startsWith('sk-ant-');
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="grid w-full max-w-[900px] overflow-hidden rounded-3xl border border-line bg-surface shadow-soft md:grid-cols-[380px_1fr]" role="dialog" aria-label="Get started" style={{ animation: 'fade-up .2s var(--ease)' }}>
        <div className="relative hidden flex-col justify-between overflow-hidden bg-fg p-8 text-bg md:flex">
          <div className="dots absolute inset-0 opacity-30" />
          <div className="absolute -right-24 -top-24 size-72 rounded-full bg-accent/60 blur-3xl" />
          <button className="relative inline-flex w-fit items-center gap-2 text-sm font-medium" onClick={onClose}><Icon name="arrowLeft" size={16} />Back to website</button>
          <div className="relative">
            <h2 className="text-3xl font-bold leading-tight tracking-tight">Your AI colleague,<br />{APP_NAME}</h2>
            <p className="mt-3 text-sm opacity-75">Read research papers quickly and deeply, on the AI subscription you already pay for.</p>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3 p-8 md:p-12">
          <h2 className="mb-4 text-center text-2xl font-bold tracking-tight">Get started in seconds</h2>
          <SubButton id="claude-sub" label="Continue with my Claude subscription" icon="claude" />
          <SubButton id="codex-sub" label="Continue with my ChatGPT subscription" icon="openai" />
          {list && !list.length && <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">The Lunaread server is not running on this computer. Run <code className="font-mono">npm start</code> in the project folder, or use the desktop app.</p>}
          <div className="my-2 flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or use an API key</div>
          <input className="input h-12" type="password" placeholder="sk-ant-… or sk-…" value={key} onChange={e => setKey(e.target.value)} autoComplete="off" />
          <button className="btn btn-primary h-12 w-full" disabled={!key.trim()} onClick={() => pick(ant ? 'anthropic-api' : 'openai-api', ant ? { apiKey: key.trim() } : { openaiKey: key.trim(), model: 'gpt-5' })}>Continue</button>
          <small className="text-center text-xs text-muted">Subscriptions use the Claude Code / Codex CLI logged in on this computer. Keys stay in this browser.</small>
        </div>
      </div>
    </div>
  );
}
