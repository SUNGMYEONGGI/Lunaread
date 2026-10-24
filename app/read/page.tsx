'use client';
// Client-only: uses IndexedDB, pdf.js and localStorage, so it is not prerendered.
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const Viewer = dynamic(() => import('@/components/viewer/Viewer'), { ssr: false });

export default function Page() {
  return <Suspense><Viewer /></Suspense>;
}
