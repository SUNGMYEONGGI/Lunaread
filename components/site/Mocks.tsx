'use client';
// Illustrations of the reader built from markup (no screenshots), reused by the landing and features pages.
import { useEffect, useState } from 'react';
import Icon from '../icons';
import { splitCode } from '@/lib/theme';

const Bar = ({ w, hl }: { w: string; hl?: string }) => (
  <div className="h-[7px] rounded-full" style={{ width: w, background: hl ? `var(--hl-${hl})` : 'color-mix(in srgb, #1b1b1f 13%, transparent)' }} />
);

export function useTyping(text: string, speed = 18) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = setInterval(() => setN(v => (v >= text.length ? (clearInterval(t), v) : v + 2)), speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

const EXPLAIN = 'Scaled dot-product attention compares every word with every other word. Dividing by √dₖ keeps the scores from growing with the vector size, so the softmax stays smooth and gradients stay healthy.';

export function PaperPage({ selection = true }: { selection?: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-[460px] rounded-md bg-white p-7 text-[#1b1b1f] shadow-[0_1px_3px_rgba(0,0,0,.1),0_12px_30px_-12px_rgba(0,0,0,.25)]">
      <div className="mx-auto mb-2 h-3 w-3/4 rounded-full bg-[#1b1b1f]/80" />
      <div className="mx-auto mb-5 h-2 w-1/2 rounded-full bg-[#1b1b1f]/25" />
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-[7px]">
          <Bar w="92%" /><Bar w="100%" /><Bar w="86%" hl="novelty" /><Bar w="100%" hl="novelty" /><Bar w="64%" /><Bar w="100%" /><Bar w="95%" /><Bar w="72%" hl="result" /><Bar w="100%" /><Bar w="88%" />
        </div>
        <div className="grid content-start gap-[7px]">
          <div className="mb-1 grid h-20 place-items-center rounded border border-dashed border-[#1b1b1f]/25 bg-[#1b1b1f]/[.03]">
            <svg viewBox="0 0 120 50" className="h-12 w-28 text-[#1b1b1f]/40"><path d="M5 45 L25 30 L45 35 L65 15 L85 22 L115 5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 45 L25 38 L45 40 L65 30 L85 34 L115 26" fill="none" stroke="var(--accent)" strokeWidth="2" /></svg>
          </div>
          <Bar w="100%" /><Bar w="78%" hl="method" /><Bar w="100%" /><Bar w="90%" /><Bar w="60%" />
        </div>
      </div>
      {selection && (
        <div className="absolute left-1/2 top-[44%] flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-line bg-surface p-1 text-fg shadow-soft">
          {[['sparkles', 'Explain'], ['languages', 'Translate'], ['chat', 'Ask']].map(([i, l]) => (
            <span key={l} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${l === 'Explain' ? 'bg-accent-soft text-accent' : ''}`}><Icon name={i} size={13} />{l}</span>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          {['yellow', 'green', 'blue', 'pink'].map(c => <span key={c} className="size-4 rounded-full ring-2 ring-surface" style={{ background: `var(--hl-${c})` }} />)}
        </div>
      )}
    </div>
  );
}

export function ProductMock() {
  const { shown, done } = useTyping(EXPLAIN);
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface text-left">
      <div className="flex h-11 items-center gap-2 border-b border-line px-4">
        <span className="flex gap-1.5">{['#ff5f57', '#febc2e', '#28c840'].map(c => <i key={c} className="size-3 rounded-full" style={{ background: c }} />)}</span>
        <div className="mx-auto hidden items-center gap-1 text-xs text-muted sm:flex">
          <span className="rounded-md border border-line px-2 py-1">Automatic Zoom</span><span className="rounded-md border border-line px-2 py-1">3 / 15</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-1 text-accent"><Icon name="highlighter" size={12} />Auto Highlight</span>
          <span className="inline-flex items-center gap-1 px-2 py-1"><Icon name="image" size={12} />Image Explanation</span>
          <span className="inline-flex items-center gap-1 px-2 py-1"><Icon name="languages" size={12} />Layout Translate</span>
        </div>
      </div>
      <div className="grid md:grid-cols-[1fr_340px]">
        <div className="bg-surface-2 p-6 md:p-10"><PaperPage /></div>
        <div className="hidden flex-col gap-3 border-l border-line p-4 md:flex">
          <b className="text-[13px]">Keyword Dictionary</b>
          <div className="flex flex-wrap gap-1.5">{['Transformer', 'Self-Attention', 'Multi-Head', 'Positional Encoding', 'Softmax'].map(k => <span key={k} className="rounded-full bg-ai px-2.5 py-1 text-[11.5px] font-semibold text-accent">{k}</span>)}</div>
          <div className="ai-bubble">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-accent"><Icon name="sparkles" size={12} />Explanation · p.3</div>
            <p className={`text-[12.5px] ${done ? '' : 'typing'}`}>{shown}</p>
          </div>
          <div className="mt-auto rounded-xl border border-line p-2.5">
            <p className="text-xs text-muted">Ask me anything.</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="chip h-6 text-[11px]"><Icon name="link" size={11} />Add Reference</span>
              <span className="chip h-6 text-[11px]">Opus 5.5 · my subscription</span>
              <span className="ml-auto grid size-6 place-items-center rounded-full bg-accent text-white"><Icon name="send" size={12} /></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PALETTES = ['e3fdfdcbf1f5a6e3e971c9ce', 'f9f7f7dbe2ef3f72af112d4e', 'fff5e4ffe3e1ffd1d1ff9494', 'f9f5f6f8e8eefdcedff2bed1', 'ad8b73ceab93e3caa5fffbe9', 'ffc7c7ffe2e2f6f6f68785a2', '222831393e4600adb5eeeeee', 'f4eeffdcd6f7a6b1e1424874', '1b262c0f4c753282b8bbe1fa', '27374d526d829db2bfdde6ed', '08d9d6252a34ff2e63eaeaea', 'b1b2ffaac4ffd2daffeef1ff'];
export const PaletteChip = ({ code }: { code: string }) => (
  <div className="flex h-16 w-28 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5">{splitCode(code).map(c => <span key={c} className="flex-1" style={{ background: c }} />)}</div>
);

// Small per-feature scenes for the feature switcher.
export function FeatureScene({ id }: { id: string }) {
  const card = 'rounded-2xl border border-line bg-surface p-5 shadow-soft';
  if (id === 'explain' || id === 'image') return (
    <div className="grid gap-4">
      <div className={card}>
        {id === 'image'
          ? <div className="relative grid h-28 place-items-center rounded-lg bg-surface-2"><svg viewBox="0 0 120 50" className="h-16 w-40 text-muted"><path d="M5 45 L25 30 L45 35 L65 15 L85 22 L115 5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 45 L25 38 L45 40 L65 30 L85 34 L115 26" fill="none" stroke="var(--accent)" strokeWidth="2" /></svg><div className="absolute inset-3 rounded border-2 border-accent bg-accent-soft" /></div>
          : <p className="border-l-[3px] border-accent pl-3 text-sm text-muted">“We scale the dot products by 1/√dₖ to counteract small gradients in the softmax.”</p>}
      </div>
      <div className="ai-bubble"><div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-accent"><Icon name={id === 'image' ? 'image' : 'sparkles'} size={13} />{id === 'image' ? 'Image Explanation' : 'Explanation'}</div>
        {id === 'image' ? 'The blue line (ours) stays below the baseline at every training step: lower loss, reached sooner.' : 'Large dot products push softmax into flat regions where gradients vanish. Dividing by √dₖ keeps scores in a healthy range.'}
      </div>
    </div>
  );
  if (id === 'highlight') return (
    <div className={`${card} grid gap-2.5`}>
      {[['novelty', '96%'], [null, '100%'], ['method', '82%'], [null, '90%'], ['result', '70%'], [null, '100%'], ['novelty', '58%']].map(([c, w], i) => <div key={i} className="h-2.5 rounded-full" style={{ width: w!, background: c ? `var(--hl-${c})` : 'var(--surface-2)' }} />)}
      <div className="mt-2 flex gap-3 text-xs text-muted">{['novelty', 'method', 'result'].map(c => <span key={c} className="inline-flex items-center gap-1.5 capitalize"><i className="size-2.5 rounded-full" style={{ background: `var(--hl-${c})` }} />{c}</span>)}</div>
    </div>
  );
  if (id === 'translate') return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={card}><p className="mb-2 font-mono text-[11px] text-muted">EN</p><p className="text-sm">The Transformer relies entirely on attention, dispensing with recurrence.</p></div>
      <div className={`${card} bg-ai`}><p className="mb-2 font-mono text-[11px] text-accent">KO</p><p className="text-sm">트랜스포머는 순환 구조 없이 전적으로 어텐션에 의존합니다.</p></div>
    </div>
  );
  if (id === 'citation') return (
    <div className="grid gap-3">
      <div className={card}><p className="text-sm text-muted">…following the encoder-decoder structure <span className="rounded bg-accent-soft px-1 font-semibold text-accent">[5]</span> of most competitive models.</p></div>
      <div className={`${card} ml-8`}>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-accent"><Icon name="quote" size={13} />Smart Citation</div>
        <p className="text-sm"><b>Reference:</b> Cho et al., Learning phrase representations using RNN encoder-decoder, 2014.</p>
        <p className="mt-1 text-sm text-muted">Cited as the standard sequence-to-sequence design this paper replaces.</p>
      </div>
    </div>
  );
  return (
    <div className="grid gap-3">
      <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-fg px-4 py-2.5 text-sm text-bg">How is this different from an RNN?</div>
      <div className="ai-bubble max-w-[90%]">RNNs read tokens one after another. The Transformer looks at all tokens at once through self-attention, so it trains in parallel and links distant words directly.</div>
      <div className="flex gap-2"><span className="chip">Why multiple heads?</span><span className="chip">Main limitations?</span></div>
    </div>
  );
}
