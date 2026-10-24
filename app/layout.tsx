import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import AppShell from '@/components/app/AppShell';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Lunaread — AI paper reader on your own subscription',
  description: 'Read research papers with an AI colleague: explanations, translation, auto highlights, smart citations and chat, powered by your Claude or ChatGPT subscription.',
};
export const viewport: Viewport = { themeColor: '#FAFAFA' };

// Sets the saved light/dark mode before paint; the palette itself is applied by AppShell.
const themeScript = `try{var s=JSON.parse(localStorage.getItem('settings')||'{}');if(s.theme)document.documentElement.dataset.theme=s.theme}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${geist.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <AppShell />
      </body>
    </html>
  );
}
