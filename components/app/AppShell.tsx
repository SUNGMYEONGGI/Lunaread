'use client';
import Modal from './Modal';
// Global dialogs (settings, theme picker, get started) and toasts, mounted once in the root layout.
import { useEffect, useState } from 'react';
import { LANGS, getSettings, saveSettings, apiBase } from '@/lib/api';
import type { Settings as S } from '@/lib/types';
import Icon from '../icons';
import { GetStarted, ModelSelect, ThemePicker, loadModels } from './Pickers';
import { openThemePicker, toast } from './events';
import Palette from './Palette';

function Settings({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<S>(getSettings);
  const [fresh, setFresh] = useState(0);
  const set = (k: keyof S) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS({ ...s, [k]: e.target.value });
  // Keys and the server address change which models exist, so reload the list when they are edited.
  const saveConn = () => { saveSettings({ ...getSettings(), apiKey: s.apiKey, openaiKey: s.openaiKey, server: s.server }); loadModels(true); setFresh(f => f + 1); };
  return (
    <Modal onClose={onClose} label="Settings">
      <div className="modal max-w-lg">
        <div className="flex items-center"><h3 className="text-lg font-bold tracking-tight">Settings</h3><button className="icon-btn ml-auto" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button></div>
        <label className="label">AI model
          <ModelSelect value={s} fresh={fresh} onChange={v => setS({ ...s, ...v })} />
          <small className="font-normal text-muted">“My subscription” uses the Claude Code / Codex CLI logged in on this computer (<code className="font-mono">claude</code>, <code className="font-mono">codex login</code>). Use API keys for a shared deployment.</small>
        </label>
        <details className="grid gap-3 rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-muted">Connection & API keys</summary>
          <label className="label mt-3">Lunaread server
            <input className="input" value={s.server} onChange={set('server')} onBlur={saveConn} placeholder={apiBase() || 'Same origin'} />
            <small className="font-normal text-muted">The local server that talks to the AI. Default: {process.env.NEXT_PUBLIC_API_BASE || 'this site'}.</small>
          </label>
          <label className="label">Anthropic API key
            <input className="input" type="password" value={s.apiKey} onChange={set('apiKey')} onBlur={saveConn} placeholder="sk-ant-…" autoComplete="off" />
          </label>
          <label className="label">OpenAI API key
            <input className="input" type="password" value={s.openaiKey} onChange={set('openaiKey')} onBlur={saveConn} placeholder="sk-…" autoComplete="off" />
          </label>
          <small className="text-muted">Stored only in this browser and sent only to your Lunaread server.</small>
        </details>
        <label className="label">Translation & explanation language
          <select className="select h-10" value={s.lang} onChange={set('lang')}>{LANGS.map(l => <option key={l}>{l}</option>)}</select>
        </label>
        <label className="label">Global glossary
          <textarea className="input min-h-20 py-2 font-mono text-[12px]" value={s.glossary} onChange={e => setS({ ...s, glossary: e.target.value })} placeholder={'Transformer\nattention = 어텐션'} />
          <small className="font-normal text-muted">Applied to every translation. “term” keeps it untranslated, “term = translation” fixes it.</small>
        </label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={s.hoverTranslate} onChange={e => setS({ ...s, hoverTranslate: e.target.checked })} />Translate the paragraph under the pointer while holding Alt (⌥)</label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={s.darkPdf} onChange={e => setS({ ...s, darkPdf: e.target.checked })} />Dark PDF pages in dark theme</label>
        <div className="flex items-center gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => { onClose(); openThemePicker(); }}><Icon name="palette" size={15} />Color theme…</button>
          <span className="flex-1" />
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={() => { saveSettings({ ...getSettings(), ...s }); onClose(); toast('Settings saved'); }}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState<'settings' | 'theme' | 'start' | 'palette' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    saveSettings(getSettings()); // apply the saved theme
    let t: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => { setMsg((e as CustomEvent).detail); clearTimeout(t); t = setTimeout(() => setMsg(null), 2600); };
    const on: [string, () => void][] = [['open-settings', () => setOpen('settings')], ['theme-picker', () => setOpen('theme')], ['get-started', () => setOpen('start')]];
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => o === 'palette' ? null : 'palette'); } };
    addEventListener('keydown', onKey);
    addEventListener('toast', onToast);
    on.forEach(([k, f]) => addEventListener(k, f));
    return () => { removeEventListener('keydown', onKey); removeEventListener('toast', onToast); on.forEach(([k, f]) => removeEventListener(k, f)); };
  }, []);
  const close = () => setOpen(null);
  return (
    <>
      {open === 'settings' && <Settings onClose={close} />}
      {open === 'theme' && <ThemePicker onClose={close} />}
      {open === 'start' && <GetStarted onClose={close} />}
      {open === 'palette' && <Palette onClose={close} />}
      {msg && <div role="status" className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-bg shadow-soft" style={{ animation: 'fade-up .15s var(--ease)' }}>{msg}</div>}
    </>
  );
}
