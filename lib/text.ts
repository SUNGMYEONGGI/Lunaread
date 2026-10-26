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
