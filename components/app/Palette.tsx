'use client';
// Cmd/Ctrl+K: jump to a paper or run an action. Reader actions are handled by the open reader (window event).
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Icon from '../icons';
import Modal from './Modal';
import { listDocs } from '@/lib/db';
import { getSettings, saveSettings } from '@/lib/api';
import type { Doc } from '@/lib/types';
import { fuzzy } from '@/lib/text';
import { openSettings, openSetup, openThemePicker } from './events';

export const readerAction = (id: string) => window.dispatchEvent(new CustomEvent('reader-action', { detail: id }));
type Item = { icon: string; label: string; hint?: string; run: () => void };

export default function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inReader = usePathname().startsWith('/read');
  const [q, setQ] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => { listDocs().then(setDocs); }, []);
  const go = (href: string) => () => router.push(href);
  const items: Item[] = [
    ...(inReader ? ([
      ['sparkles', 'Summarize this paper', 'summarize'], ['languages', 'Translate this page', 'translate-page'], ['languages', 'Translate the whole paper', 'translate-paper'],
      ['highlighter', 'Auto Highlight', 'auto-highlight'], ['chat', 'Export chat (Markdown)', 'export-chat'],
    ] as const).map(([icon, label, id]) => ({ icon, label, hint: 'Reader', run: () => readerAction(id) })) : []),
    { icon: 'pen', label: 'New chat', run: go('/library/') },
    { icon: 'library', label: 'Library', run: go('/library/?all') },
    { icon: 'compass', label: 'Scholar Deep Search', run: go('/library/?scholar') },
    { icon: 'settings', label: 'Settings', run: openSettings },
    { icon: 'zap', label: 'Connect AI server', run: openSetup },
    { icon: 'palette', label: 'Color theme', run: openThemePicker },
    { icon: 'moon', label: 'Toggle dark mode', run: () => { const s = getSettings(); saveSettings({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }); } },
    ...docs.map(d => ({ icon: 'file', label: d.title, hint: 'Paper', run: go(`/read/?id=${d.id}`) })),
  ];
  const shown = (q ? items.map(it => ({ it, s: fuzzy(q, it.label) })).filter(x => x.s >= 0).sort((a, b) => a.s - b.s).map(x => x.it) : items).slice(0, 50);
  const pick = (it?: Item) => { if (it) { onClose(); it.run(); } };
  return (
    <Modal onClose={onClose} label="Command palette">
      <div className="modal max-w-xl gap-2 p-2">
        <input autoFocus className="input h-11 border-0 text-[15px] focus:ring-0" placeholder="Search papers and actions…" value={q} role="combobox" aria-expanded aria-controls="palette-list"
          onChange={e => { setQ(e.target.value); setI(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI(n => Math.min(n + 1, shown.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI(n => Math.max(n - 1, 0)); }
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) pick(shown[i]);
          }} />
        <div id="palette-list" role="listbox" className="max-h-96 overflow-auto">
          {!shown.length && <p className="p-3 text-sm text-muted">No matches.</p>}
          {shown.map((it, n) => (
            <button key={it.label + n} role="option" aria-selected={n === i} className={`menu-item text-[14px] ${n === i ? 'bg-surface-2' : ''}`} onMouseEnter={() => setI(n)} onClick={() => pick(it)}>
              <Icon name={it.icon} size={15} /><span className="truncate">{it.label}</span>{it.hint && <small className="ml-auto text-muted">{it.hint}</small>}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
