'use client';
import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/icons';
import { BlurFade } from '@/components/magic';
import { Heading, Page } from '@/components/site/Site';
import { FeatureScene } from '@/components/site/Mocks';

// [label, icon, title, description, how-to, scene]
const TABS: Record<string, [string, string, string, string, string, string][]> = {
  'Your AI Colleague': [
    ['Explanation · Text', 'sparkles', 'Understand complex ideas with AI explanations', 'AI breaks hard sentences and formulas into clear, simple explanations, walking you through the concepts and context step by step.', 'Select text and click Explain on the selection toolbar.', 'explain'],
    ['Explanation · Image', 'image', 'Let AI explain charts and formulas too', 'Tables, figures and equations are no problem. Select the area and AI explains it in detail.', 'Turn on Image Explanation in the top bar, or Cmd/Ctrl + drag over the area.', 'image'],
    ['Auto Highlight', 'highlighter', 'See the key points of the paper automatically', 'AI highlights the main innovations, methods and results in three colors, so complex content stays easy to follow.', 'Click Auto Highlight in the top bar.', 'highlight'],
    ['Translation', 'languages', 'Quickly understand tough papers with translation', 'Translate just the part you need, the whole page, or overlay the translation on the original layout.', 'Click Translate on the selection toolbar, or open the Translate Page tab.', 'translate'],
    ['Chat', 'chat', "Ask AI when you're curious", 'Chat about the paper for summaries, concept explanations or quick answers, and add other papers as references.', 'Type in “Ask me anything.” at the bottom of the AI panel.', 'chat'],
  ],
  Navigation: [
    ['Smart Citation', 'quote', 'Know what a citation is without scrolling', 'Click a citation like [12] to see the full reference, what that work is about and why it is cited here.', 'Click any citation number in the paper.', 'citation'],
    ['Preview', 'search', 'Peek at figures and sections in place', 'Hover a figure, table or section link to preview its target without losing your place.', 'Hover an internal link in the paper.', 'image'],
    ['Outline & Search', 'list', 'Jump anywhere in the paper', 'Use the outline to move between sections, and search the full text with ⌘F.', 'Open the sidebar from the top bar.', 'highlight'],
  ],
  'Mark Up': [
    ['Highlight', 'highlighter', 'Mark what matters in five colors', 'Highlight passages as you read; every highlight is kept with the paper.', 'Select text and choose a color.', 'highlight'],
    ['Notes', 'pen', 'Leave your thoughts next to the text', 'Attach notes to highlights and review them all in the Markup & Notes tab.', 'Select text and click the note icon.', 'explain'],
  ],
  'Save & Share': [
    ['Library', 'library', 'Keep every paper in one place', 'Upload PDFs or open arXiv links, organize them into folders, and pick up where you left off.', 'Open the Library from the left rail.', 'citation'],
    ['Scholar Deep Search', 'compass', 'Find related papers', 'Search the literature and get recommendations based on your library.', 'Open Scholar Deep Search from the left rail.', 'chat'],
    ['Export', 'download', 'Take your notes with you', 'Export highlights, notes and summaries as Markdown.', 'Click Share in the top bar.', 'translate'],
  ],
};

export default function Features() {
  const [tab, setTab] = useState('Your AI Colleague');
  return (
    <Page>
      <section className="px-6 pb-24 pt-20 md:px-10">
        <Heading kicker="Features" title="Everything Lunaread can do" sub="Built around the way researchers actually read." />
        <div className="mx-auto mb-16 flex w-fit flex-wrap justify-center gap-1 rounded-full border border-line bg-surface p-1" role="tablist" aria-label="Feature Category">
          {Object.keys(TABS).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === t ? 'bg-fg text-bg' : 'text-muted hover:text-fg'}`}>{t}</button>
          ))}
        </div>
        <div role="tabpanel" aria-label={tab} className="grid gap-20" key={tab}>
          {TABS[tab].map(([label, icon, title, desc, how, scene], i) => (
            <BlurFade key={label} className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
              <div className={i % 2 ? 'md:order-2' : ''}>
                <p className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[.16em] text-accent"><Icon name={icon} size={15} />{label}</p>
                <h3 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">{title}</h3>
                <p className="mt-3 text-muted md:text-lg">{desc}</p>
                <div className="mt-5 flex items-baseline gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm"><b className="font-mono text-xs text-accent">HOW</b>{how}</div>
              </div>
              <div className="dots grid min-h-80 place-items-center rounded-3xl border border-line bg-surface-2/40 p-8"><div className="w-full max-w-md"><FeatureScene id={scene} /></div></div>
            </BlurFade>
          ))}
        </div>
      </section>
      <section className="px-6 py-20 text-center md:px-10">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Lunaread supports your research</h2>
        <Link href="/library/?upload" className="btn btn-primary mt-8 h-12 px-7"><Icon name="upload" size={16} />Upload paper</Link>
      </section>
    </Page>
  );
}
