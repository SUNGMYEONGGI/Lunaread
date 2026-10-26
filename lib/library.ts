// Library-level operations: importing papers, retrieval across papers, BibTeX export/import.
import { addPdf, listDocs, putDoc } from './db.ts';
import { docText, fetchPdf, normalizePaperUrl } from './api.ts';
import { loadPdf, pdfTitle } from './pdf.ts';
import { chunkPaper, topChunks } from './text.ts';
import type { Doc } from './types.ts';

// Adds a PDF to the library: reads the title and renders a first-page thumbnail.
export async function importPdf(bytes: Uint8Array, { url, name }: { url?: string; name?: string } = {}) {
  const pdf = await loadPdf(bytes);
  const title = await pdfTitle(pdf, name?.replace(/\.pdf$/i, '') || url || 'Untitled');
  const page = await pdf.getPage(1);
  const vp = page.getViewport({ scale: 0.5 });
  const canvas = Object.assign(document.createElement('canvas'), { width: vp.width, height: vp.height });
  await page.render({ canvas, viewport: vp } as never).promise;
  const doc = await addPdf(bytes, { title, url });
  doc.thumb = canvas.toDataURL('image/jpeg', 0.7);
  doc.pages = pdf.numPages;
  await putDoc(doc);
  pdf.loadingTask.destroy();
  return doc;
}

export const importUrl = async (input: string) => { const url = normalizePaperUrl(input); return importPdf(await fetchPdf(url), { url }); };

// "paper" | "library" | "folder:<name>"
export type Scope = string;
export async function libraryExcerpts(question: string, scope: Scope, currentId: string) {
  const docs = (await listDocs()).filter(d => d.id !== currentId && (scope === 'library' || d.folder === scope.slice(7)));
  const chunks = (await Promise.all(docs.map(async d => chunkPaper(d.title, await docText(d))))).flat();
  return topChunks(question, chunks);
}

const arxivId = (url = '') => url.match(/arxiv\.org\/(?:abs|pdf)\/([^\s?#]+?)(?:v\d+)?(?:\.pdf)?$/i)?.[1];
const bibEsc = (s: string) => s.replace(/[{}\\]/g, '').replace(/\s+/g, ' ').trim();

// BibTeX with highlights and notes in the note field; Zotero imports it as-is.
export function toBibtex(docs: Doc[]) {
  return docs.map((d, i) => {
    const id = arxivId(d.url);
    const notes = [...(d.marks || [])].sort((a, b) => a.page - b.page).map(m => `p.${m.page}: ${m.text}${m.note ? ` (${m.note})` : ''}`).join(' | ');
    const fields: [string, string | undefined][] = [
      ['title', `{${bibEsc(d.title)}}`], ['url', d.url], ...(id ? [['eprint', id], ['archivePrefix', 'arXiv']] as [string, string][] : []),
      ['note', notes ? bibEsc(notes) : undefined], ['keywords', d.folder ? bibEsc(d.folder) : undefined],
    ];
    return `@misc{lunaread${i + 1}${id ? `_${id.replace(/\W/g, '')}` : ''},\n${fields.filter(f => f[1]).map(([k, v]) => `  ${k} = {${v}}`).join(',\n')}\n}`;
  }).join('\n\n') + '\n';
}

// Paper links found in a .bib file: arXiv eprints, arXiv/PDF urls. Other entries are reported as skipped.
export function bibLinks(bib: string) {
  const entries = bib.split(/(?=@\w+\s*\{)/).filter(e => e.trim().startsWith('@'));
  const field = (e: string, k: string) => e.match(new RegExp(`\\b${k}\\s*=\\s*[{"]([^}"]+)[}"]`, 'i'))?.[1].trim();
  const links: string[] = [];
  let skipped = 0;
  for (const e of entries) {
    const eprint = field(e, 'eprint'), url = field(e, 'url');
    const link = eprint && /^\d{4}\.\d{4,5}/.test(eprint) ? eprint : url && (arxivId(url) || /\.pdf($|\?)/i.test(url)) ? url : null;
    if (link) links.push(link); else skipped++;
  }
  return { links, skipped };
}
