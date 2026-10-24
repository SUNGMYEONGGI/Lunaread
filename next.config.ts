import type { NextConfig } from 'next';

// Static export: the same `out/` folder is served by the local server, the desktop app and GitHub Pages.
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: { unoptimized: true },
};
export default config;
