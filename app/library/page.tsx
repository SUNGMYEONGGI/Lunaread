'use client';
// Client-only: uses IndexedDB, pdf.js and localStorage, so it is not prerendered.
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const Library = dynamic(() => import('@/components/app/Library'), { ssr: false });

export default function Page() {
  return <Suspense><Library /></Suspense>;
}
