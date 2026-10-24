'use client';
import Link from 'next/link';
import { Fragment, useState, type ReactNode } from 'react';
import Icon from '@/components/icons';
import { BorderBeam } from '@/components/magic';
import { Heading, Page } from '@/components/site/Site';

const won = (n: number) => `₩${n.toLocaleString('en-US')}`;
type Plan = { name: string; tag: string; desc: string; month: number; year: number; cta: string; note?: string; pop?: boolean; seats?: [string, number][]; perks: string[] };
const PLANS: Plan[] = [
  { name: 'Free', tag: 'Start for Free', desc: 'Start exploring research with ease, for free.', month: 0, year: 0, cta: 'Get Started', note: '3 free papers per week',
    perks: ['Unlimited document access', 'Limited access to AI features for 3 papers/week'] },
  { name: 'Pro', tag: 'Free 1 Week Trial!', desc: 'Understand academic papers perfectly with AI.', month: 12000, year: 10000, cta: 'Free Trial', pop: true,
    seats: [['1-3', 10000], ['4-15', 7900], ['16-29', 6900]],
    perks: ['Everything in Free', 'Unlimited interactive AI features', 'Infographic explanations included', 'Access to selected advanced AI models'] },
  { name: 'Premium', tag: 'Access to All Models', desc: 'Do research with the most advanced AI model.', month: 59000, year: 49000, cta: 'Subscribe',
    seats: [['1-3', 49000], ['4-15', 39000], ['16-29', 34000]],
    perks: ['Everything in Pro', 'Unlimited access to all AI models'] },
];

const tag = (t: string) => <span className="m-0.5 inline-block rounded-md bg-ai px-2 py-0.5 text-xs font-semibold text-accent">{t}</span>;
const ROWS: (string | number | ReactNode)[][] = [
  ['AI-assisted Papers', '3 free papers per week', 'Unlimited', 'Unlimited'],
  ['Library', 1, 1, 1],
  ['group', 'AI Models'],
  ['Base Models', tag('Claude Haiku 5.5'), tag('Claude Haiku 5.5'), tag('Claude Haiku 5.5')],
  ['Pro Models', '', tag('Claude Sonnet 5.5'), tag('Claude Sonnet 5.5')],
  ['Premium Models', '', '', tag('Claude Opus 5.5')],
  ['group', 'Features'],
  ['Explanation + Chat', 'Limited', 1, 1],
  ['Infographic Explanation', '-', '5/week', '30/week'],
  ['Discussion', 'Limited', 1, 1],
  ['Keywords + Summary', 1, 1, 1],
  ['Translation', 'Limited', 1, 1],
  ['Smart Citation', 'Limited', 1, 1],
  ['Auto Highlight', 'Limited', 1, 1],
  ['Markup', 1, 1, 1],
  ['Preview', 1, 1, 1],
  ['Scholar Deep Search', 1, 1, 1],
  ['group', 'Support'],
  ['Chat Support', 1, 1, 1],
];

export default function Pricing() {
  const [yearly, setYearly] = useState(true);
  return (
    <Page>
      <section className="px-6 pb-24 pt-20 md:px-10">
        <Heading kicker="Pricing" title="Boost your research productivity" sub="Find the perfect plan today. With your own subscription, every feature is already unlocked." />
        <div className="mx-auto mb-12 flex w-fit gap-1 rounded-full border border-line bg-surface p-1" role="tablist" aria-label="Period">
          <button role="tab" aria-selected={yearly} onClick={() => setYearly(true)} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${yearly ? 'bg-fg text-bg' : 'text-muted'}`}>Year <span className={yearly ? 'opacity-70' : 'text-accent'}>· Save 17-20%</span></button>
          <button role="tab" aria-selected={!yearly} onClick={() => setYearly(false)} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${!yearly ? 'bg-fg text-bg' : 'text-muted'}`}>Month</button>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map(p => (
            <div key={p.name} className={`card relative flex flex-col gap-4 p-7 ${p.pop ? 'shadow-soft ring-1 ring-accent' : ''}`}>
              {p.pop && <><BorderBeam duration={7} /><span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">Most Popular</span></>}
              <small className="font-semibold text-muted">{p.tag}</small>
              <h3 className="text-2xl font-bold tracking-tight">{p.name}</h3>
              <p className="text-sm text-muted">{p.desc}</p>
              <div className="text-4xl font-extrabold tracking-tight">
                {yearly && p.month > 0 && <s className="mr-2 text-base font-medium text-muted">{won(p.month)}</s>}{won(yearly ? p.year : p.month)}<small className="text-sm font-medium text-muted">/month</small>
              </div>
              <small className="text-muted">{p.note || (yearly ? '17% off with annual billing' : 'Billed monthly')}</small>
              <Link href="/library/" className={`btn ${p.pop ? 'btn-accent' : 'btn-primary'} h-11`}>{p.cta}</Link>
              {p.seats && (
                <div className="grid gap-1.5 rounded-xl bg-surface-2 p-3 text-[13px]">
                  <b>Team</b>
                  {p.seats.map(([n, v]) => <div key={n} className="flex justify-between"><span>{n} seats</span><span>{won(v)}/user/mo</span></div>)}
                  <div className="flex justify-between"><span>30+</span><span className="text-accent">Enterprise & University</span></div>
                </div>
              )}
              <ul className="grid gap-2.5 text-sm">{p.perks.map(x => <li key={x} className="flex gap-2.5"><Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent" />{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="mt-16 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead><tr className="border-b border-line"><th className="p-4" />{['Free', 'Pro', 'Premium'].map(h => <th key={h} className="p-4 font-bold">{h}</th>)}</tr></thead>
            <tbody>
              {ROWS.map(([label, ...cells]) => label === 'group'
                ? <tr key={String(cells[0])} className="bg-surface-2"><td colSpan={4} className="px-4 py-2.5 font-bold">{cells[0]}</td></tr>
                : <tr key={String(label)} className="border-b border-line last:border-0"><td className="px-4 py-3.5">{label}</td>{cells.map((c, i) => <td key={i} className="px-4 py-3.5 text-center">{c === 1 ? <Icon name="check" size={16} className="mx-auto text-accent" /> : <Fragment>{c}</Fragment>}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-7">
          <div><h3 className="text-xl font-bold">Enterprise</h3><p className="text-muted">For larger teams and organizations.</p></div>
          <a className="btn btn-primary" href="https://github.com/SUNGMYEONGGI/Lunaread/issues">Contact us</a>
        </div>
      </section>
    </Page>
  );
}
