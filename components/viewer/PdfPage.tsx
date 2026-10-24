'use client';
import { memo, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { pdfjs } from '@/lib/pdf';
import type { LayoutBlock, Rect } from '@/lib/types';

const COLORS: Record<string, string> = { yellow: 'var(--hl-yellow)', green: 'var(--hl-green)', blue: 'var(--hl-blue)', pink: 'var(--hl-pink)', purple: 'var(--hl-purple)', novelty: 'var(--hl-novelty)', method: 'var(--hl-method)', result: 'var(--hl-result)' };
const pct = (r: Rect) => ({ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` });

export type Link = Rect & { dest?: string | unknown[]; url?: string };
export type PageMark = { id: string; rects: Rect[]; color: string; note?: string };

// Link annotations as normalized rects, with internal destinations resolved lazily.
async function pageLinks(page: PDFPageProxy): Promise<Link[]> {
  const vp = page.getViewport({ scale: 1 });
  const annots = await page.getAnnotations();
  return annots.filter((a: any) => a.subtype === 'Link' && (a.dest || a.url)).map((a: any) => {
    const [x1, y1] = vp.convertToViewportPoint(a.rect[0], a.rect[1]);
    const [x2, y2] = vp.convertToViewportPoint(a.rect[2], a.rect[3]);
    return { x: Math.min(x1, x2) / vp.width, y: Math.min(y1, y2) / vp.height, w: Math.abs(x2 - x1) / vp.width, h: Math.abs(y2 - y1) / vp.height, dest: a.dest, url: a.url };
  });
}

function fitFont(b: LayoutBlock, H: number, W: number) {
  const line = b.lineH * H;
  const area = b.w * W * b.h * H;
  return Math.max(6, Math.min(line * 0.92, Math.sqrt(area / (b.tr.length * 0.62 + 1))));
}

type Props = {
  pdf: PDFDocumentProxy; n: number; size: { w: number; h: number }; scale: number; near: boolean;
  marks: PageMark[]; flash: (Rect[] & { key?: number }) | null; layout: LayoutBlock[] | null | undefined; areaMode: boolean;
  onArea: (page: number, image: string) => void;
  onLinkEnter: (l: Link, n: number, e: MouseEvent) => void; onLinkLeave: () => void; onLinkClick: (l: Link, n: number, e: MouseEvent) => void;
};

export default memo(function PdfPage({ pdf, n, size, scale, near, marks, flash, layout, areaMode, onArea, onLinkEnter, onLinkLeave, onLinkClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [box, setBox] = useState<Rect | null>(null);
  const W = size.w * scale, H = size.h * scale;

  useEffect(() => {
    if (!near) return;
    let cancelled = false, task: any, textLayer: any;
    const el = ref.current!;
    (async () => {
      const { TextLayer } = await pdfjs();
      const page = await pdf.getPage(n);
      if (cancelled) return;
      const vp = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.className = 'render';
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      task = page.render({ canvas, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined } as never);
      await task.promise.catch(() => {});
      if (cancelled) return;
      el.querySelector('canvas.render')?.remove();
      el.prepend(canvas);
      const div = document.createElement('div');
      div.className = 'textLayer';
      textLayer = new TextLayer({ textContentSource: page.streamTextContent(), container: div, viewport: vp });
      await textLayer.render().catch(() => {});
      if (cancelled) return;
      el.querySelector('.textLayer')?.remove();
      el.querySelector('.overlay')!.after(div);
      if (!links.length) pageLinks(page).then(l => !cancelled && setLinks(l));
    })();
    return () => { cancelled = true; task?.cancel(); textLayer?.cancel(); };
  }, [pdf, n, scale, near]);

  // Area selection for image explanation: explicit mode or ⌘/Ctrl + drag.
  const down = (e: MouseEvent) => {
    if (e.button !== 0 || !(areaMode || e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    const r = ref.current!.getBoundingClientRect();
    const start = { x: e.clientX - r.left, y: e.clientY - r.top };
    let cur: Rect | null = null;
    const move = (ev: globalThis.MouseEvent) => {
      const x = Math.min(Math.max(ev.clientX - r.left, 0), r.width), y = Math.min(Math.max(ev.clientY - r.top, 0), r.height);
      cur = { x: Math.min(x, start.x), y: Math.min(y, start.y), w: Math.abs(x - start.x), h: Math.abs(y - start.y) };
      setBox(cur);
    };
    const up = () => {
      removeEventListener('mousemove', move);
      removeEventListener('mouseup', up);
      setBox(null);
      const c = cur as Rect | null;
      if (!c || c.w < 12 || c.h < 12) return;
      const canvas = ref.current!.querySelector<HTMLCanvasElement>('canvas.render');
      if (!canvas) return;
      const k = canvas.width / r.width;
      const out = Object.assign(document.createElement('canvas'), { width: c.w * k, height: c.h * k });
      out.getContext('2d')!.drawImage(canvas, c.x * k, c.y * k, c.w * k, c.h * k, 0, 0, out.width, out.height);
      onArea(n, out.toDataURL('image/png'));
    };
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
  };

  const style = { width: W, height: H, '--scale-factor': scale, '--total-scale-factor': scale, '--user-unit': 1 } as CSSProperties;
  return (
    <div ref={ref} className={`page ${areaMode ? 'area' : ''}`} data-page={n} style={style} onMouseDown={down}>
      <div className="overlay">
        {marks.map(m => m.rects.map((r, i) => (
          <div key={`${m.id}-${i}`} className={`hl ${m.note && i === 0 ? 'note' : ''}`} style={{ ...pct(r), background: COLORS[m.color] }} title={m.note || undefined} />
        )))}
        {flash?.map((r, i) => <div key={`f${i}-${flash.key}`} className="hl flash" style={pct(r)} />)}
      </div>
      <div className="links">
        {links.map((l, i) => (
          <a key={i} style={pct(l)} href={l.url || '#'} target={l.url ? '_blank' : undefined} rel="noreferrer"
            onMouseEnter={e => l.dest && onLinkEnter(l, n, e)} onMouseLeave={onLinkLeave}
            onClick={e => { if (!l.url) { e.preventDefault(); onLinkClick(l, n, e); } }} />
        ))}
      </div>
      {layout && (
        <div className="layout-tr">
          {layout.map((b, i) => <div key={i} style={{ ...pct(b), fontSize: fitFont(b, H, W) }} title={b.text}>{b.tr}</div>)}
        </div>
      )}
      {box && <div className="area-box" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />}
      <div className="page-num">{n}</div>
    </div>
  );
});
