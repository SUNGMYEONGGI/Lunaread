import { marked } from 'marked';
import { getDoc, getFile, putDoc } from './db.ts';
import { applyTheme } from './theme.ts';
import { loadPdf, pageItems, pageText } from './pdf.ts';
import type { Doc, ProviderInfo, Settings } from './types.ts';

export const LANGS = ['Korean', 'English', 'Japanese', 'Chinese (Simplified)', 'Spanish', 'French', 'German', 'Vietnamese'];
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const REPO_URL = 'https://github.com/SUNGMYEONGGI/Lunaread';
export const DOWNLOADS = {
  mac: `${REPO_URL}/releases/latest/download/Lunaread-arm64.dmg`,
  win: `${REPO_URL}/releases/latest/download/Lunaread-Setup-x64.exe`,
  all: `${REPO_URL}/releases/latest`,
};

// provider: claude-sub | codex-sub (local CLI logins = the user's subscriptions) | anthropic-api | openai-api
const DEFAULTS: Settings = { apiKey: '', openaiKey: '', provider: 'claude-sub', model: 'default', lang: 'Korean', theme: 'light', palette: null, server: '' };
export function getSettings(): Settings {
  let saved: Partial<Settings> = {};
  try { saved = JSON.parse(localStorage.getItem('settings') || '{}') || {}; } catch { /* private mode */ }
  return { ...DEFAULTS, ...saved };
}
export function saveSettings(s: Settings) {
  try { localStorage.setItem('settings', JSON.stringify(s)); } catch { /* private mode */ }
  applyTheme(s);
}

// Where the Lunaread server lives: same origin for `npm start` and the desktop app; the static GitHub Pages
// build points at the server on this computer (NEXT_PUBLIC_API_BASE). Settings can override either.
export const apiBase = () => (getSettings().server || process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
const api = (path: string, init?: RequestInit) => fetch(apiBase() + path, init).catch(() => {
  throw new Error(`Cannot reach the Lunaread server at ${apiBase() || location.origin}. Start it with \`npm start\` (or open the desktop app).`);
});

const headers = (): Record<string, string> => {
  const { apiKey, openaiKey } = getSettings();
  return { 'content-type': 'application/json', ...(apiKey && { 'x-api-key': apiKey }), ...(openaiKey && { 'x-openai-key': openaiKey }) };
};

async function failed(r: Response) {
  const { error } = await r.json().catch(() => ({ error: r.statusText }));
  return new Error(error);
}

export async function serverOnline() {
  try { return (await fetch(`${apiBase()}/api/health`)).ok; } catch { return false; }
}

export async function fetchModels(): Promise<ProviderInfo[]> {
  const r = await api('/api/models', { headers: headers() });
  if (!r.ok) throw await failed(r);
  return r.json();
}

export async function fetchPalettes(step: number, sort: string, tags: string): Promise<{ code: string; likes: string }[]> {
  const r = await api(`/api/palettes?step=${step}&sort=${sort}&tags=${encodeURIComponent(tags)}`);
  if (!r.ok) throw await failed(r);
  return r.json();
}

// Providers other than the Anthropic API get the paper as plain text (cached on the doc).
async function docText(doc: Doc) {
  if (doc.fullText) return doc.fullText;
  const pdf = await loadPdf(await getFile(doc.id));
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) pages.push(`[Page ${n}]\n${pageText(await pageItems(pdf, n))}`);
  pdf.loadingTask.destroy();
  doc.fullText = pages.join('\n\n');
  await putDoc(doc);
  return doc.fullText;
}

// Upload the paper to the Files API once; the file id is kept on the doc.
export async function ensureFileId(doc: Doc, force?: boolean) {
  if (doc.fileId && !force) return doc.fileId;
  const bytes = await getFile(doc.id);
  const r = await api('/api/upload', { method: 'POST', body: bytes as BodyInit, headers: { ...headers(), 'content-type': 'application/pdf', 'x-filename': encodeURIComponent(`${doc.title}.pdf`) } });
  if (!r.ok) throw await failed(r);
  doc.fileId = (await r.json()).fileId as string;
  await putDoc(doc);
  return doc.fileId;
}

export type AiBody = { task: string; text?: string; image?: string; extra?: Record<string, unknown>; history?: { role: string; content: string }[]; refs?: { id: string }[]; provider?: string; model?: string };

async function withPaper<T>(doc: Doc | null, body: AiBody, call: (full: Record<string, unknown>) => Promise<T>): Promise<T> {
  const { lang, model, provider } = getSettings();
  const full: Record<string, unknown> = { lang, model, provider, ...body };
  const refs = (await Promise.all((body.refs || []).map(r => getDoc(r.id)))).filter(Boolean) as Doc[];
  if (full.provider !== 'anthropic-api') {
    if (doc) full.paperText = await docText(doc);
    full.refs = await Promise.all(refs.map(async r => ({ title: r.title, text: await docText(r) })));
    return call(full);
  }
  if (doc) full.fileId = await ensureFileId(doc);
  full.refs = await Promise.all(refs.map(async r => ({ title: r.title, fileId: await ensureFileId(r) })));
  try {
    return await call(full);
  } catch (e) {
    // A file uploaded under a different key (or deleted) is not found: upload again once.
    const msg = (e as Error).message;
    if (!doc || !/file/i.test(msg) || !/not.?found|invalid/i.test(msg)) throw e;
    full.fileId = await ensureFileId(doc, true);
    return call(full);
  }
}

// Streams text to onText (the whole text so far); resolves with the full text.
export function streamAI(doc: Doc | null, body: AiBody, onText?: (text: string) => void, signal?: AbortSignal) {
  return withPaper(doc, body, async full => {
    const r = await api('/api/ai', { method: 'POST', headers: headers(), body: JSON.stringify(full), signal });
    if (!r.ok) throw await failed(r);
    const reader = r.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '', text = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const events = buf.split('\n\n');
      buf = events.pop()!;
      for (const ev of events) {
        const d = JSON.parse(ev.replace(/^data: /, ''));
        if (d.error) throw new Error(d.error);
        if (d.t) { text += d.t; onText?.(text); }
      }
    }
    return text;
  });
}

export function aiJSON<T = any>(doc: Doc | null, body: AiBody): Promise<T> {
  return withPaper(doc, body, async full => {
    const r = await api('/api/ai-json', { method: 'POST', headers: headers(), body: JSON.stringify(full) });
    if (!r.ok) throw await failed(r);
    return r.json();
  });
}

export async function fetchPdf(url: string) {
  const r = await api(`/api/pdf?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw await failed(r);
  return new Uint8Array(await r.arrayBuffer());
}

// "2610.30877", "arxiv.org/abs/2610.30877" → PDF URL
export function normalizePaperUrl(input: string) {
  const s = input.trim();
  const id = s.match(/^(?:arxiv:)?(\d{4}\.\d{4,5}(v\d+)?)$/i)?.[1] || s.match(/arxiv\.org\/(?:abs|pdf)\/([^\s?#]+?)(?:\.pdf)?$/i)?.[1];
  if (id) return `https://arxiv.org/pdf/${id}`;
  return /^https?:\/\//.test(s) ? s : `https://${s}`;
}

export type ScholarPaper = { paperId: string; title: string; authors?: { name: string }[]; year?: number; abstract?: string; url: string; openAccessPdf?: { url: string }; externalIds?: { ArXiv?: string }; citationCount?: number; venue?: string };
export async function scholarSearch(q: string): Promise<ScholarPaper[]> {
  const r = await api(`/api/scholar?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw await failed(r);
  return (await r.json()).data || [];
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// AI text can echo paper content, so raw HTML is escaped rather than rendered.
marked.use({
  renderer: { html: ({ text }) => esc(text) },
  hooks: { postprocess: html => html.replace(/(href|src)="(?!https?:|#)[^"]*"/gi, '$1="#"') },
});
export const md = (text: string) => marked.parse(text || '') as string;
