// Pure text-geometry helpers (no pdf.js), so they can be tested in Node.
import type { Block, Item, Rect } from './types.ts';

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Find `query` in the page; returns item boxes covering each match.
export function findInItems(items: Item[], query: string): Rect[][] {
  const q = norm(query);
  if (q.length < 3) return [];
  let full = '';
  const owner: number[] = [];
  items.forEach((it, idx) => { const s = norm(it.str); full += s; for (let k = 0; k < s.length; k++) owner.push(idx); });
  const hits: Rect[][] = [];
  for (let at = full.indexOf(q); at !== -1; at = full.indexOf(q, at + q.length)) {
    const ids = [...new Set(owner.slice(at, at + q.length))];
    hits.push(ids.map(i => box(items[i])));
  }
  return hits;
}
const box = (i: Rect): Rect => ({ x: i.x, y: i.y, w: i.w, h: i.h });

export const pageText = (items: Item[]) => items.map(i => i.str + (i.eol ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').replace(/-\n(?=\p{Ll})/gu, '');

// Group items into paragraph-like blocks (the unit of translation).
// ponytail: proximity heuristic, no real layout analysis; tables and figures get rough blocks.
export function blocks(items: Item[]): Block[] {
  const out: Block[] = [];
  let cur: Block | undefined;
  for (const it of items) {
    if (!it.str.trim()) continue;
    const gap = cur ? it.y - (cur.y + cur.h) : 0;
    const sameCol = cur && it.x < cur.x + cur.w && it.x + it.w > cur.x - 0.02;
    if (cur && sameCol && gap > -cur.lineH && gap < cur.lineH * 0.9) {
      const r = Math.max(cur.x + cur.w, it.x + it.w), b = Math.max(cur.y + cur.h, it.y + it.h);
      cur.x = Math.min(cur.x, it.x); cur.y = Math.min(cur.y, it.y); cur.w = r - cur.x; cur.h = b - cur.y;
      cur.text += (cur.text.endsWith('-') ? '' : ' ') + it.str;
    } else {
      cur = { ...box(it), lineH: it.h, text: it.str };
      out.push(cur);
    }
  }
  return out.filter(b => b.text.trim().length > 1).map(b => ({ ...b, text: b.text.replace(/-\s(?=\p{Ll})/gu, '').trim() }));
}

// Citations, cross-references and URLs are swapped for ⟦n⟧ placeholders before translation and put back after,
// so models cannot mangle "[12]", "Fig. 3(a)" or "(Smith et al., 2020)".
const PROTECT = new RegExp([
  String.raw`\[\d+(?:\s*[,–-]\s*\d+)*\]`, // [12], [3, 5–7]
  String.raw`\((?:[A-Z][\p{L}'-]+(?: (?:et al\.|and|&) ?[A-Z]?[\p{L}'-]*)*,? (?:19|20)\d{2}[a-z]?(?:; ?)?)+\)`, // (Smith et al., 2020; Lee, 2021)
  String.raw`\b(?:Fig(?:ure)?s?|Tab(?:le)?s?|Eqs?|Equations?|Sec(?:tion)?s?|Alg(?:orithm)?|Appendix)\.? ?\(?[A-Z]?\d+(?:\.\d+)*\)?(?:\s?\([a-z]\))?`, // Fig. 3(a), Eq. (2), Table 1
  String.raw`https?://\S+`,
].join('|'), 'gu');

export function mask(text: string) {
  const tokens: string[] = [];
  return { text: text.replace(PROTECT, m => `⟦${tokens.push(m) - 1}⟧`), tokens };
}
export const unmask = (text: string, tokens: string[]) => text.replace(/⟦\s*(\d+)\s*⟧/g, (m, i) => tokens[+i] ?? m);

// Glossary lines: "term" keeps the term untranslated, "term = translation" fixes its translation.
export function glossaryRules(...texts: (string | undefined)[]) {
  return texts.join('\n').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => {
    const [term, tr] = l.split(/\s*=\s*/, 2);
    return tr ? `- "${term}" → "${tr}"` : `- "${term}": keep untranslated`;
  }).join('\n');
}

// Library retrieval for "ask across papers": split stored paper text into chunks and rank them by keyword overlap.
// ponytail: TF-IDF over words, no embeddings; good for terms and names, weak for paraphrases.
export type Chunk = { title: string; page: number; text: string };
const STOP = new Set('the and for are with that this from what which how does into have has was were its can not but our their about than then them they these those when where who why will would should could also more most such using used between paper'.split(' '));
const words = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(w => !STOP.has(w));

export function chunkPaper(title: string, fullText: string, size = 1200): Chunk[] {
  const out: Chunk[] = [];
  for (const part of fullText.split(/\[Page (\d+)\]\n/).reduce<[number, string][]>((acc, s, i, a) => (i % 2 ? [...acc, [+s, a[i + 1] || '']] : acc), [])) {
    const [page, text] = part;
    for (let i = 0; i < text.length; i += size) out.push({ title, page, text: text.slice(i, i + size) });
  }
  return out;
}

export function topChunks(question: string, chunks: Chunk[], k = 8): Chunk[] {
  const q = [...new Set(words(question))];
  const tf = chunks.map(c => { const m = new Map<string, number>(); for (const w of words(c.text)) m.set(w, (m.get(w) || 0) + 1); return m; });
  const idf = new Map(q.map(w => [w, Math.log(1 + chunks.length / (1 + tf.filter(t => t.has(w)).length))]));
  return chunks.map((c, i) => ({ c, s: q.reduce((s, w) => s + Math.log(1 + (tf[i].get(w) || 0)) * idf.get(w)!, 0) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map(x => x.c);
}

// Subsequence match: every query character appears in order. Earlier, tighter matches rank higher.
export function fuzzy(q: string, s: string) {
  q = q.toLowerCase(); s = s.toLowerCase();
  let at = -1, score = 0;
  for (const c of q) { const i = s.indexOf(c, at + 1); if (i < 0) return -1; score += i - at; at = i; }
  return score;
}
