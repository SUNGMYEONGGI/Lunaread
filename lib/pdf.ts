// pdf.js is browser-only, so it is loaded on first use instead of at import time (pages are prerendered).
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Item } from './types.ts';
export { findInItems, pageText, blocks } from './text.ts';

let lib: Promise<typeof import('pdfjs-dist')> | undefined;
export function pdfjs() {
  lib ??= import('pdfjs-dist').then(m => {
    m.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return m;
  });
  return lib;
}

export const loadPdf = async (bytes: Uint8Array) => (await pdfjs()).getDocument({ data: bytes.slice() }).promise;

export async function pdfTitle(pdf: PDFDocumentProxy, fallback: string) {
  const { info } = (await pdf.getMetadata().catch(() => ({ info: {} }))) as { info: { Title?: string } };
  if ((info?.Title?.trim().length ?? 0) > 4) return info.Title!.trim();
  // Otherwise the largest-font line on page 1 is usually the title.
  const items = (await pageItems(pdf, 1)).filter(i => !i.rot && i.str.trim()); // skip rotated arXiv stamps
  const max = Math.max(...items.map(i => i.h), 0);
  const title = items.filter(i => i.h >= max * 0.95).map(i => i.str).join(' ').trim();
  return title.length > 4 ? title.slice(0, 200) : fallback;
}

// Text items of a page with boxes normalized to 0..1 of the page size.
const cache = new WeakMap<PDFDocumentProxy, Map<number, Promise<Item[]>>>();
export async function pageItems(pdf: PDFDocumentProxy, n: number): Promise<Item[]> {
  if (!cache.has(pdf)) cache.set(pdf, new Map());
  const c = cache.get(pdf)!;
  if (!c.has(n)) {
    c.set(n, (async () => {
      const { Util } = await pdfjs();
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const { items } = await page.getTextContent();
      return (items as any[]).filter(i => i.str).map(i => {
        const t = Util.transform(vp.transform, i.transform);
        const h = Math.hypot(t[2], t[3]);
        return { str: i.str, eol: i.hasEOL, rot: Math.abs(t[1]) > 0.01, x: t[4] / vp.width, y: (t[5] - h) / vp.height, w: i.width / vp.width, h: h / vp.height };
      });
    })());
  }
  return c.get(n)!;
}
