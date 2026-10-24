'use client';
// Small CSS-driven takes on Magic UI effects (blur fade, border beam, marquee, shiny text).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

export function BlurFade({ children, delay = 0, className = '', as: Tag = 'div' }: { children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'h1' | 'p' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } }, { rootMargin: '-40px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} className={`blur-fade ${className}`} style={{ '--delay': `${delay}s` } as CSSProperties}>{children}</Tag>;
}

export const BorderBeam = ({ duration = 9 }: { duration?: number }) => <div className="border-beam" style={{ '--beam-duration': `${duration}s` } as CSSProperties} />;

export function Marquee({ children, duration = 40, gap = '1rem', className = '' }: { children: ReactNode; duration?: number; gap?: string; className?: string }) {
  const style = { '--duration': `${duration}s`, '--gap': gap } as CSSProperties;
  return (
    <div className={`marquee ${className}`} style={style}>
      <div>{children}</div>
      <div aria-hidden>{children}</div>
    </div>
  );
}

export const ShinyText = ({ children, className = '' }: { children: ReactNode; className?: string }) => <span className={`shiny ${className}`}>{children}</span>;
