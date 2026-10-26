'use client';
// Native <dialog>: focus stays inside, Escape closes, the page behind is inert.
import { useEffect, useRef, type ReactNode } from 'react';

export default function Modal({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} aria-label={label} className="dialog" onCancel={e => { e.preventDefault(); onClose(); }} onMouseDown={e => e.target === ref.current && onClose()}>
      {children}
    </dialog>
  );
}
