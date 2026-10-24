// AI providers besides the Anthropic API (which lives in server.mjs because it uses the Files API).
// `claude-sub` and `codex-sub` drive the locally logged-in Claude Code / Codex CLIs, so they use the
// user's own subscription. They are meant for a personal local install (desktop app or localhost).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { Codex } from '@openai/codex-sdk';
import OpenAI from 'openai';

const TMP = os.tmpdir();

export type RunArgs = {
  key?: string;
  model?: string;
  system: string;
  prompt: string;
  image?: string;
  schema?: object;
  onText?: (t: string) => void;
  signal?: AbortSignal;
};
export type ModelInfo = { id: string; label: string };

// Models are only parseable JSON when asked for; fall back to the first {...} in the text.
export const parseJson = (text: string) => JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);

// ---- Claude subscription (Claude Agent SDK) ----
function claudeOptions(extra: Record<string, unknown> = {}): any {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // force the CLI login (subscription) instead of API billing
  return { tools: [], maxTurns: 1, settingSources: [], persistSession: false, cwd: TMP, env, ...extra };
}

let claudeModels: Promise<ModelInfo[]> | undefined;
export function claudeSubModels(): Promise<ModelInfo[]> {
  claudeModels ??= (async () => {
    const q = query({ prompt: (async function* (): AsyncGenerator<any> { await new Promise(() => {}); })(), options: claudeOptions() });
    try {
      const list = await Promise.race([q.supportedModels(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000))]);
      return list.map(m => ({ id: m.value, label: m.displayName || m.value }));
    } finally { q.interrupt().catch(() => {}); q.return?.(undefined); }
  })().catch(e => { claudeModels = undefined; throw e; });
  return claudeModels;
}

async function claudeSub({ model, system, prompt, image, schema, onText, signal }: RunArgs) {
  const abort = new AbortController();
  signal?.addEventListener('abort', () => abort.abort());
  const content = [...(image ? [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } }] : []), { type: 'text', text: prompt }];
  const q = query({
    prompt: (async function* (): AsyncGenerator<any> { yield { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null }; })(),
    options: claudeOptions({
      ...(model && model !== 'default' && { model }), systemPrompt: system, includePartialMessages: !!onText, abortController: abort,
      ...(schema && { outputFormat: { type: 'json_schema', schema } }),
    }),
  });
  let text = '';
  for await (const m of q) {
    if (m.type === 'stream_event' && m.event.type === 'content_block_delta' && m.event.delta.type === 'text_delta') { text += m.event.delta.text; onText?.(m.event.delta.text); }
    if (m.type === 'result') {
      if (m.subtype !== 'success' || m.is_error) throw new Error(('result' in m && m.result) || ('errors' in m && m.errors?.join(', ')) || `Claude: ${m.subtype}`);
      if (schema) return m.structured_output ?? parseJson(m.result);
      return m.result ?? text;
    }
  }
  return schema ? parseJson(text) : text;
}

// ---- ChatGPT subscription (Codex SDK) ----
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
export function codexSubModels(): ModelInfo[] {
  if (!fs.existsSync(path.join(CODEX_HOME, 'auth.json'))) throw new Error('Codex CLI is not logged in (run `codex login`).');
  try {
    const { models } = JSON.parse(fs.readFileSync(path.join(CODEX_HOME, 'models_cache.json'), 'utf8'));
    return models.filter((m: any) => m.visibility !== 'hide').map((m: any) => ({ id: m.slug, label: m.display_name || m.slug }));
  } catch { return [{ id: 'default', label: 'Codex default' }]; }
}

let codex: Codex | undefined;
async function codexSub({ model, system, prompt, image, schema, onText, signal }: RunArgs) {
  codex ??= new Codex();
  const thread = codex.startThread({
    ...(model && model !== 'default' && { model }), sandboxMode: 'read-only', skipGitRepoCheck: true,
    workingDirectory: TMP, modelReasoningEffort: 'low', approvalPolicy: 'never',
  });
  let img: string | undefined;
  if (image) { img = path.join(TMP, `lunaread-${Date.now()}-${Math.random().toString(36).slice(2)}.png`); fs.writeFileSync(img, Buffer.from(image, 'base64')); }
  const text = `${system}\n\nDo not run commands or edit files; answer directly.\n\n${prompt}`;
  try {
    const { events } = await thread.runStreamed(img ? [{ type: 'text', text }, { type: 'local_image', path: img }] : text, { ...(schema && { outputSchema: schema }), signal });
    let out = '';
    for await (const ev of events) {
      if (ev.type === 'item.completed' && ev.item.type === 'agent_message') { out += ev.item.text; onText?.(ev.item.text); }
      if (ev.type === 'turn.failed') throw new Error(ev.error.message);
      if (ev.type === 'error') throw new Error(ev.message);
    }
    return schema ? parseJson(out) : out;
  } finally { if (img) fs.rm(img, () => {}); }
}

// ---- OpenAI API key ----
const openaiClients = new Map<string, OpenAI>();
function openai(key?: string): OpenAI {
  if (!key) throw Object.assign(new Error('OpenAI API key missing. Add it in Settings.'), { status: 401 });
  if (!openaiClients.has(key)) openaiClients.set(key, new OpenAI({ apiKey: key }));
  return openaiClients.get(key)!;
}
export async function openaiModels(key?: string): Promise<ModelInfo[]> {
  const list = await openai(key).models.list();
  return list.data.map(m => m.id).filter(id => /^(gpt|o\d|chatgpt)/.test(id) && !/audio|realtime|tts|transcribe|image|search/.test(id)).sort().reverse().map(id => ({ id, label: id }));
}

async function openaiApi({ key, model, system, prompt, image, schema, onText, signal }: RunArgs) {
  const user: any = image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:image/png;base64,${image}` } }] : prompt;
  const stream = await openai(key).chat.completions.create({
    model: model!, stream: true,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    ...(schema && { response_format: { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: schema as Record<string, unknown> } } }),
  }, { signal });
  let text = '';
  for await (const c of stream) {
    const t = c.choices[0]?.delta?.content;
    if (t) { text += t; onText?.(t); }
  }
  return schema ? parseJson(text) : text;
}

export const RUNNERS: Record<string, (args: RunArgs) => Promise<any>> = { 'claude-sub': claudeSub, 'codex-sub': codexSub, 'openai-api': openaiApi };
