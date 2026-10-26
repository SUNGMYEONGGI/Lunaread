// Paragraph translation shared by the page/paper translator, Alt+hover and exports.
// Each paragraph is masked (citations, references), glossary-guided and cached in IndexedDB.
import { aiJSON, getSettings } from './api.ts';
import { getCached, putCached } from './db.ts';
import { glossaryRules, mask, unmask } from './text.ts';
import type { Doc } from './types.ts';

async function hash(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// The model translations run on: the translation model from Settings, else the default model.
export const trModel = () => { const s = getSettings(); return s.trModel || { provider: s.provider, model: s.model }; };

// Translates paragraphs in order. `force` skips the cache (retranslate).
export async function translateParas(doc: Doc | null, srcs: string[], { force = false } = {}): Promise<string[]> {
  const { lang, glossary } = getSettings();
  const rules = glossaryRules(glossary, doc?.glossary);
  const model = trModel();
  const keys = await Promise.all(srcs.map(s => hash(JSON.stringify([lang, model, rules, s]))));
  const out = await Promise.all(keys.map(k => force ? undefined : getCached(k)));
  const todo = out.flatMap((t, i) => t === undefined ? [i] : []);
  // ponytail: one request per call; callers pass one page at a time, so prompts stay small.
  if (todo.length) {
    const masked = todo.map(i => mask(srcs[i]));
    const { translations } = await aiJSON<{ translations: string[] }>(null, { task: 'translateParas', ...model, extra: { paras: masked.map(m => m.text), glossary: rules } });
    await Promise.all(todo.map(async (i, j) => {
      const t = translations[j];
      out[i] = t ? unmask(t, masked[j].tokens) : srcs[i];
      if (t) await putCached(keys[i], out[i]!);
    }));
  }
  return out as string[];
}
