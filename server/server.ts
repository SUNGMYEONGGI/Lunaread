// Single Node server shared by local web use and the desktop app: serves the static Next.js export (`out/`),
// proxies remote PDFs and Color Hunt palettes (CORS), and talks to the AI providers.
// GitHub Pages hosts the same pages without a server; there the browser calls this server on 127.0.0.1.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { PROMPTS, SCHEMAS } from './prompts.ts';
import { RUNNERS, claudeSubModels, codexSubModels, openaiModels, type ModelInfo } from './providers.ts';

type Req = http.IncomingMessage;
type Res = http.ServerResponse;
type HttpError = Error & { status?: number };
const fail = (message: string, status: number): HttpError => Object.assign(new Error(message), { status });

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain', '.wasm': 'application/wasm' };

// Pages served elsewhere that may use this server. Anything else is refused, because the server spends the
// user's own AI subscription. Same-origin requests (desktop app, `npm start`) are always allowed.
const ORIGINS = new Set(['https://sungmyeonggi.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000', ...(process.env.LUNAREAD_ORIGINS || '').split(',').filter(Boolean)]);

const clients = new Map<string, Anthropic>();
function claude(req: Req): Anthropic {
  const key = (req.headers['x-api-key'] as string) || process.env.ANTHROPIC_API_KEY;
  if (!key) throw fail('Anthropic API key missing. Add it in Settings.', 401);
  if (!clients.has(key)) clients.set(key, new Anthropic({ apiKey: key }));
  return clients.get(key)!;
}

const readBody = (req: Req, limit = 60e6) => new Promise<Buffer>((resolve, reject) => {
  const chunks: Buffer[] = []; let size = 0;
  req.on('data', (c: Buffer) => { size += c.length; if (size > limit) { reject(fail('Payload too large', 413)); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});
const json = (res: Res, status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };

// ponytail: literal-host SSRF guard only; DNS rebinding to private IPs is not blocked. Add a resolver check before exposing publicly.
function publicUrl(raw: string | null): URL {
  const u = new URL(raw || '');
  if (!/^https?:$/.test(u.protocol)) throw fail('Only http(s) URLs', 400);
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd])/i.test(u.hostname)) throw fail('Private host not allowed', 400);
  return u;
}

type Body = {
  task: string; provider?: string; model?: string; lang?: string; text?: string; image?: string;
  fileId?: string; paperText?: string; refs?: { title: string; fileId?: string; text?: string }[];
  history?: { role: 'user' | 'assistant'; content: string }[]; extra?: Record<string, unknown>;
};
const prompt = (task: string) => PROMPTS[task] ?? (() => { throw fail(`Unknown task ${task}`, 400); })();

// Anthropic API: the paper goes first with cache_control so every follow-up on the same paper reuses the cached prefix.
function buildRequest(body: Body): any {
  const { task, model, fileId, refs = [], lang = 'Korean', text = '', image, history = [], extra = {} } = body;
  const p = prompt(task);
  const content: any[] = [];
  if (fileId && p.paper !== false) content.push({ type: 'document', source: { type: 'file', file_id: fileId }, title: 'Current paper', cache_control: { type: 'ephemeral' } });
  for (const r of refs) content.push({ type: 'document', source: { type: 'file', file_id: r.fileId }, title: `Reference: ${r.title}` });
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } });
  content.push({ type: 'text', text: p.user({ text, lang, ...extra }) });

  const messages = task === 'chat'
    ? [{ role: 'user', content: content.slice(0, -1).concat({ type: 'text', text: 'This is the paper we are discussing.' }) },
       { role: 'assistant', content: 'Understood. Ask me anything about it.' },
       ...history]
    : [{ role: 'user', content }];

  const m = MODELS.includes(model!) ? model! : MODELS[0];
  const req: any = {
    model: m,
    max_tokens: p.maxTokens ?? 16000,
    system: p.system(lang),
    messages,
    output_config: { effort: p.effort ?? 'medium', ...(SCHEMAS[task] && { format: { type: 'json_schema', schema: SCHEMAS[task] } }) },
  };
  // Server-side refusal fallback is not offered for Haiku.
  if (m !== 'claude-haiku-5-5') Object.assign(req, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  return req;
}

// Providers without the Files API get the paper as extracted text instead.
function buildText(body: Body, req: Req) {
  const { task, model, lang = 'Korean', text = '', paperText, refs = [], history = [], extra = {}, image } = body;
  const p = prompt(task);
  let user = '';
  if (paperText && p.paper !== false) user += `<paper>\n${paperText}\n</paper>\n\n`;
  for (const r of refs) user += `<reference title="${r.title}">\n${r.text}\n</reference>\n\n`;
  user += task === 'chat'
    ? `${history.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')}\n\nReply to the last user message.`
    : p.user({ text, lang, ...extra });
  return { key: (req.headers['x-openai-key'] as string) || process.env.OPENAI_API_KEY, model, system: p.system(lang), prompt: user, image, schema: SCHEMAS[task] };
}

const sse = (res: Res) => res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
const send = (res: Res, d: unknown) => res.write(`data: ${JSON.stringify(d)}\n\n`);

async function aiStream(req: Req, res: Res) {
  const body: Body = JSON.parse(String(await readBody(req)));
  const run = RUNNERS[body.provider!];
  const ac = new AbortController();
  res.on('close', () => ac.abort());
  if (run) {
    const params = buildText(body, req);
    sse(res);
    try { await run({ ...params, schema: undefined, signal: ac.signal, onText: t => send(res, { t }) }); send(res, { done: true }); }
    catch (e) { if (!ac.signal.aborted) send(res, { error: (e as Error).message }); }
    return res.end();
  }
  const stream = claude(req).beta.messages.stream(buildRequest(body), { signal: ac.signal });
  sse(res);
  try {
    for await (const ev of stream as any) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') send(res, { t: ev.delta.text });
    }
    const final: any = await stream.finalMessage();
    if (final.stop_reason === 'refusal') send(res, { error: 'The model declined this request.' });
    send(res, { done: true, usage: final.usage });
  } catch (e) {
    if (!ac.signal.aborted) send(res, { error: (e as Error).message });
  }
  res.end();
}

async function aiJson(req: Req, res: Res) {
  const body: Body = JSON.parse(String(await readBody(req)));
  if (RUNNERS[body.provider!]) return json(res, 200, await RUNNERS[body.provider!](buildText(body, req)));
  const msg: any = await claude(req).beta.messages.stream(buildRequest(body)).finalMessage();
  if (msg.stop_reason === 'refusal') return json(res, 422, { error: 'The model declined this request.' });
  const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  json(res, 200, JSON.parse(text));
}

// Which providers are usable here and their models. Failures are reported, not thrown.
async function models(req: Req, res: Res) {
  const anthropicKey = (req.headers['x-api-key'] as string) || process.env.ANTHROPIC_API_KEY;
  const openaiKey = (req.headers['x-openai-key'] as string) || process.env.OPENAI_API_KEY;
  const entry = async (id: string, label: string, list: () => ModelInfo[] | Promise<ModelInfo[]>) => {
    try { return { id, label, models: await list() }; } catch (e) { return { id, label, models: [], error: (e as Error).message }; }
  };
  json(res, 200, await Promise.all([
    entry('claude-sub', 'Claude (my subscription)', claudeSubModels),
    entry('codex-sub', 'ChatGPT / Codex (my subscription)', codexSubModels),
    entry('anthropic-api', 'Anthropic API key', () => {
      if (!anthropicKey) throw new Error('No Anthropic API key');
      return MODELS.map(id => ({ id, label: id }));
    }),
    entry('openai-api', 'OpenAI API key', () => openaiModels(openaiKey)),
  ]));
}

async function palettes(q: URLSearchParams, res: Res) {
  // colorhunt.co has no public API; this is the same feed its own grid loads.
  const sort = ['new', 'popular', 'random'].includes(q.get('sort')!) ? q.get('sort')! : 'popular';
  const form = new URLSearchParams({ step: String(Number(q.get('step')) || 0), sort, tags: (q.get('tags') || '').slice(0, 80), timeframe: '4000' });
  const r = await fetch('https://colorhunt.co/php/feed.php', { method: 'POST', body: form, headers: { 'x-requested-with': 'XMLHttpRequest' } });
  if (!r.ok) return json(res, 502, { error: `Color Hunt ${r.status}` });
  json(res, 200, (await r.json()).map((p: { code: string; likes: string }) => ({ code: p.code, likes: p.likes })));
}

async function upload(req: Req, res: Res) {
  const buf = await readBody(req);
  const name = decodeURIComponent((req.headers['x-filename'] as string) || 'paper.pdf');
  const file = await claude(req).files.upload({ file: await toFile(buf, name, { type: 'application/pdf' }) });
  json(res, 200, { fileId: file.id });
}

async function proxyPdf(url: string | null, res: Res) {
  const r = await fetch(publicUrl(url), { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 PaperReader' } });
  if (!r.ok) return json(res, 502, { error: `Fetch failed: ${r.status}` });
  res.writeHead(200, { 'content-type': 'application/pdf' });
  res.end(Buffer.from(await r.arrayBuffer()));
}

async function scholar(q: string, res: Res) {
  const fields = 'title,authors,year,abstract,url,openAccessPdf,externalIds,citationCount,venue';
  // Unauthenticated calls share a global rate limit; S2_API_KEY lifts it.
  const r = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?limit=12&fields=${fields}&query=${encodeURIComponent(q)}`,
    { headers: process.env.S2_API_KEY ? { 'x-api-key': process.env.S2_API_KEY } : {} });
  json(res, r.ok ? 200 : 502, r.ok ? await r.json() : { error: r.status === 429 ? 'Semantic Scholar rate limit — try again shortly or set S2_API_KEY.' : `Semantic Scholar ${r.status}` });
}

// Static export with trailingSlash: /library → out/library/index.html.
function serveStatic(pathname: string, res: Res) {
  const rel = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(OUT, rel);
  if (!file.startsWith(OUT)) return json(res, 403, { error: 'Forbidden' });
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  let status = 200;
  if (!fs.existsSync(file)) { file = path.join(OUT, '404.html'); status = 404; }
  if (!fs.existsSync(file)) return json(res, 404, { error: 'Run `npm run build` first' });
  res.writeHead(status, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url!, 'http://x');
    const origin = req.headers.origin;
    if (pathname.startsWith('/api/') && origin && !(origin === `http://${req.headers.host}` && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || ''))) {
      if (!ORIGINS.has(origin)) return json(res, 403, { error: `Origin ${origin} is not allowed (set LUNAREAD_ORIGINS)` });
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'origin');
      if (req.method === 'OPTIONS') {
        // Chrome's Private Network Access asks before a public page may call 127.0.0.1.
        res.writeHead(204, { 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type, x-api-key, x-openai-key, x-filename', 'access-control-allow-private-network': 'true', 'access-control-max-age': '600' });
        return res.end();
      }
    }
    try {
      if (pathname === '/api/health') return json(res, 200, { ok: true });
      if (pathname === '/api/ai' && req.method === 'POST') return await aiStream(req, res);
      if (pathname === '/api/ai-json' && req.method === 'POST') return await aiJson(req, res);
      if (pathname === '/api/upload' && req.method === 'POST') return await upload(req, res);
      if (pathname === '/api/models') return await models(req, res);
      if (pathname === '/api/palettes') return await palettes(searchParams, res);
      if (pathname === '/api/pdf') return await proxyPdf(searchParams.get('url'), res);
      if (pathname === '/api/scholar') return await scholar(searchParams.get('q') || '', res);
      if (pathname.startsWith('/api/')) return json(res, 404, { error: 'Not found' });
      serveStatic(pathname, res);
    } catch (e) {
      if (res.headersSent) return res.end();
      json(res, (e as HttpError).status || 500, { error: (e as Error).message });
    }
  });
}

export function start(port = Number(process.env.PORT) || 8787): Promise<number> {
  return new Promise(resolve => {
    const srv = createServer().listen(port, process.env.HOST || '127.0.0.1', () => resolve((srv.address() as { port: number }).port));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().then(p => console.log(`Lunaread server on http://127.0.0.1:${p}`));
}
