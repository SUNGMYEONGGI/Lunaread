'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '../icons';
import { BlurFade, BorderBeam, Marquee, ShinyText } from '../magic';
import { Heading, Page } from './Site';
import { FeatureScene, PALETTES, PaletteChip, ProductMock } from './Mocks';
import { openGetStarted } from '../app/events';
import { REPO_URL } from '@/lib/api';

const WORKS_WITH: [string, string][] = [['sparkles', 'Claude'], ['bot', 'ChatGPT'], ['file', 'arXiv'], ['compass', 'Semantic Scholar'], ['palette', 'Color Hunt'], ['layers', 'PDF.js']];

const FEATURES = [
  { id: 'explain', icon: 'sparkles', title: 'Explanation', desc: 'Select a sentence or formula and get a plain-language walkthrough in your language.' },
  { id: 'image', icon: 'image', title: 'Figure explanation', desc: 'Drag over a chart, table or equation (⌘/Ctrl + drag) and AI explains how to read it.' },
  { id: 'highlight', icon: 'highlighter', title: 'Auto Highlight', desc: 'Key novelty, method and result sentences, marked in three colors.' },
  { id: 'translate', icon: 'languages', title: 'Translation', desc: 'Translate a selection, the whole page, or overlay it on the original layout.' },
  { id: 'citation', icon: 'quote', title: 'Smart Citation', desc: 'Click [12] to see the reference and why it is cited, without scrolling.' },
  { id: 'chat', icon: 'chat', title: 'Chat', desc: 'Ask anything about the paper, and add other papers as references.' },
];

const FAQ: [string, string][] = [
  ['Do I need an API key?', 'No. Lunaread uses the Claude Code or Codex CLI already logged in on your computer, so requests run on the Claude or ChatGPT subscription you already have. API keys work too, if you prefer.'],
  ['Why does the web version need a local server?', 'Your subscription login lives on your computer, so a small Lunaread server runs there (npm start, or the desktop app). This site talks to it at 127.0.0.1; nothing goes through a Lunaread cloud.'],
  ['Where are my papers stored?', 'Papers, highlights, notes and chats stay in your browser or desktop app (IndexedDB). Paper content is sent only to the AI you choose.'],
  ['Which papers can I open?', 'Any PDF: upload a file, drop it in, or paste an arXiv ID or PDF link.'],
  ['Which languages are supported?', 'Explanations and translations in Korean, English, Japanese, Chinese, Spanish, French, German and Vietnamese.'],
  ['Is it free?', 'Lunaread is open source. You only pay for the AI subscription or API usage you already have.'],
];

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-20 text-center md:pt-28">
      <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[420px] max-w-3xl rounded-full bg-accent/15 blur-3xl" />
      <BlurFade>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="relative mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-[13px] font-medium shadow-sm transition hover:border-accent">
          <i className="size-2 rounded-full bg-accent" />Runs on your Claude & ChatGPT subscriptions<Icon name="arrowRight" size={13} className="text-muted" />
        </a>
      </BlurFade>
      <BlurFade delay={0.08}>
        <h1 className="relative mx-auto mt-7 max-w-4xl text-[44px] font-extrabold leading-[1.02] tracking-[-.045em] sm:text-6xl md:text-[80px]">
          Read any paper<br />with an AI colleague<br /><span className="text-gradient">right beside you.</span>
        </h1>
      </BlurFade>
      <BlurFade delay={0.16}>
        <p className="relative mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted md:text-xl">
          Explanations, figure walkthroughs, translation, auto highlights and smart citations in one PDF reader. It runs on the subscription you already pay for, with no API keys and no cloud account.
        </p>
      </BlurFade>
      <BlurFade delay={0.24}>
        <div className="relative mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/library/" className="btn btn-primary h-12 px-7 text-[15px]">Open the reader<Icon name="arrowRight" size={16} /></Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn btn-outline h-12 px-7 text-[15px]"><Icon name="github" size={16} />View source</a>
        </div>
        <p className="mt-5 text-[13px] text-muted">Free and open source · Web, macOS and Windows · Your papers stay on your device</p>
      </BlurFade>
      <BlurFade delay={0.32} className="relative mx-auto mt-16 max-w-5xl">
        <div className="relative rounded-[18px] border border-line bg-surface-2/60 p-2 shadow-soft">
          <ProductMock />
          <BorderBeam />
        </div>
      </BlurFade>
    </section>
  );
}

function WorksWith() {
  return (
    <section className="border-y border-line">
      <p className="py-5 text-center font-mono text-xs uppercase tracking-[.18em] text-muted">Works with the tools you already use</p>
      <div className="grid grid-cols-2 border-t border-line sm:grid-cols-3 md:grid-cols-6">
        {WORKS_WITH.map(([icon, name], i) => (
          <div key={name} className={`flex h-20 items-center justify-center gap-2 text-[15px] font-semibold text-muted transition hover:bg-surface hover:text-fg ${i ? 'border-l border-line' : ''}`}>
            <Icon name={icon} size={18} />{name}
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureSwitcher() {
  const [active, setActive] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return;
    const t = setInterval(() => setActive(a => (a + 1) % FEATURES.length), 5000);
    return () => clearInterval(t);
  }, [hold]);
  return (
    <section className="px-6 py-24 md:px-10" id="features">
      <Heading kicker="Your AI colleague" title="Everything you need to understand a paper" sub="Select, drag or click. The answer shows up next to the text, in your language." />
      <div className="grid overflow-hidden rounded-3xl border border-line md:grid-cols-[380px_1fr]" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
        <div className="grid content-start gap-1.5 border-b border-line p-3 md:border-b-0 md:border-r">
          {FEATURES.map((f, i) => (
            <button key={f.id} onClick={() => setActive(i)} className={`relative overflow-hidden rounded-2xl p-4 text-left transition ${active === i ? 'bg-surface shadow-soft ring-1 ring-line' : 'hover:bg-surface/60'}`}>
              <div className="flex items-center gap-2.5 font-semibold"><span className={`grid size-8 place-items-center rounded-lg ${active === i ? 'bg-accent text-white' : 'bg-surface-2 text-muted'}`}><Icon name={f.icon} size={16} /></span>{f.title}</div>
              {active === i && <p className="mt-2 text-sm text-muted">{f.desc}</p>}
              {active === i && !hold && <span key={active} className="absolute bottom-0 left-0 h-0.5 bg-accent" style={{ animation: 'grow 5s linear forwards' }} />}
            </button>
          ))}
        </div>
        <div className="dots relative grid min-h-[420px] place-items-center bg-surface-2/40 p-8">
          <div key={active} className="w-full max-w-md" style={{ animation: 'fade-up .3s var(--ease)' }}><FeatureScene id={FEATURES[active].id} /></div>
        </div>
      </div>
      <style>{'@keyframes grow { from { width: 0 } to { width: 100% } }'}</style>
    </section>
  );
}

function Bento() {
  const cell = 'card relative overflow-hidden p-6 transition hover:shadow-soft';
  return (
    <section className="border-t border-line px-6 py-24 md:px-10">
      <Heading kicker="Built for deep reading" title="A reader that keeps up with your research" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className={`${cell} md:col-span-2`}>
          <Icon name="library" className="text-accent" />
          <h3 className="mt-4 text-lg font-bold">Library & folders</h3>
          <p className="mt-1 max-w-md text-sm text-muted">Drop PDFs or paste arXiv links. Lunaread reads the title, renders a thumbnail and remembers where you stopped.</p>
          <div className="mt-6 flex gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 w-24 shrink-0 rounded-lg border border-line bg-white p-2.5 shadow-sm" style={{ transform: `rotate(${(i - 1.5) * 3}deg)` }}><div className="mb-2 h-1.5 w-3/4 rounded bg-black/70" />{[1, 2, 3, 4, 5].map(j => <div key={j} className="mb-1.5 h-1 rounded bg-black/10" />)}</div>)}</div>
        </div>
        <div className={cell}>
          <Icon name="compass" className="text-accent" />
          <h3 className="mt-4 text-lg font-bold">Scholar Deep Search</h3>
          <p className="mt-1 text-sm text-muted">Search the literature or get recommendations based on what is in your library.</p>
          <div className="mt-5 grid gap-2">{['Attention is all you need', 'BERT: Pre-training…', 'Vision Transformer'].map(t => <div key={t} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs"><Icon name="file" size={13} className="text-muted" />{t}<Icon name="arrowRight" size={12} className="ml-auto text-muted" /></div>)}</div>
        </div>
        <div className={cell}>
          <Icon name="pen" className="text-accent" />
          <h3 className="mt-4 text-lg font-bold">Markup & notes</h3>
          <p className="mt-1 text-sm text-muted">Five highlight colors, notes on every highlight, Markdown export.</p>
          <div className="mt-5 flex gap-2">{['yellow', 'green', 'blue', 'pink', 'purple'].map(c => <span key={c} className="size-7 rounded-full ring-2 ring-surface" style={{ background: `var(--hl-${c})` }} />)}</div>
        </div>
        <div className={`${cell} md:col-span-2`}>
          <Icon name="palette" className="text-accent" />
          <h3 className="mt-4 text-lg font-bold">Every Color Hunt palette, as your theme</h3>
          <p className="mt-1 text-sm text-muted">Browse thousands of palettes live. Colors adjust automatically so text stays readable in light and dark.</p>
          <Marquee className="mt-6" duration={45} gap=".75rem">{PALETTES.map(p => <PaletteChip key={p} code={p} />)}</Marquee>
        </div>
        <div className={cell}>
          <Icon name="monitor" className="text-accent" />
          <h3 className="mt-4 text-lg font-bold">Web and desktop</h3>
          <p className="mt-1 text-sm text-muted">The same app in your browser or as a native macOS / Windows window.</p>
        </div>
        <div className={`${cell} md:col-span-2`}>
          <Icon name="shield" className="text-accent" />
          <h3 className="mt-4 text-lg font-bold">Your subscription, your data</h3>
          <p className="mt-1 text-sm text-muted">Claude Agent SDK and Codex SDK under the hood. Papers stay on your device; only the AI you pick sees the text.</p>
          <div className="mt-5 flex flex-wrap gap-2">{['Claude (my subscription)', 'ChatGPT / Codex (my subscription)', 'Anthropic API key', 'OpenAI API key'].map(p => <span key={p} className="chip h-8">{p}</span>)}</div>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps: [string, string, string][] = [
    ['download', 'Run Lunaread', 'Open the desktop app, or run npm start. It uses the Claude Code or Codex login already on your computer.'],
    ['upload', 'Open a paper', 'Upload a PDF or paste an arXiv ID. Everything is stored locally.'],
    ['sparkles', 'Read with AI', 'Select, drag or ask. Explanations and translations appear right next to the text.'],
  ];
  return (
    <section className="border-t border-line px-6 py-24 md:px-10">
      <Heading kicker="How it works" title="Up and running in a minute" />
      <div className="relative grid gap-6 md:grid-cols-3">
        <div className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-line to-transparent md:block" />
        {steps.map(([icon, t, d], i) => (
          <BlurFade key={t} delay={i * 0.1} className="relative text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-line bg-surface shadow-soft"><Icon name={icon} size={22} className="text-accent" /></div>
            <p className="mt-5 font-mono text-xs text-muted">STEP {i + 1}</p>
            <h3 className="mt-1 text-lg font-bold">{t}</h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{d}</p>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="border-t border-line px-6 py-24 md:px-10" id="faq">
      <Heading kicker="FAQ" title="Questions, answered" />
      <div className="mx-auto max-w-3xl divide-y divide-line border-y border-line">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">{q}<Icon name="plus" size={18} className="shrink-0 text-muted transition group-open:rotate-45" /></summary>
            <p className="mt-3 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="border-t border-line p-6 md:p-10">
      <div className="relative overflow-hidden rounded-3xl bg-fg px-6 py-20 text-center text-bg">
        <div className="dots absolute inset-0 opacity-20" />
        <div className="absolute left-1/2 top-0 h-56 w-[60%] -translate-x-1/2 rounded-full bg-accent/50 blur-3xl" />
        <h2 className="relative text-3xl font-bold tracking-tight md:text-5xl">Start reading smarter today.</h2>
        <p className="relative mx-auto mt-4 max-w-xl opacity-70">Open your first paper in seconds. No sign-up, no API key.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/library/" className="btn h-12 bg-bg px-7 text-fg hover:opacity-90">Open the reader<Icon name="arrowRight" size={16} /></Link>
          <button onClick={openGetStarted} className="btn h-12 border border-bg/25 px-7 hover:bg-bg/10">Connect my AI</button>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <Page>
      <Hero />
      <WorksWith />
      <FeatureSwitcher />
      <Bento />
      <Steps />
      <Faq />
      <Cta />
      <div className="px-6 pb-4 text-center md:px-10"><ShinyText className="text-xs">Made for people who read papers for a living.</ShinyText></div>
    </Page>
  );
}
