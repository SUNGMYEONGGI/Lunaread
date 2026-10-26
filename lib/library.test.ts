import assert from 'node:assert';
import { bibLinks, toBibtex } from './library.ts';
import type { Doc } from './types.ts';

const doc = { id: 'x', title: 'Attention {Is} All You Need', url: 'https://arxiv.org/pdf/1706.03762', addedAt: 0, folder: 'NLP', marks: [{ id: 'm', page: 2, rects: [], text: 'scaled dot-product', color: 'yellow', note: 'key idea', at: 0 }], chat: [], cards: [], translations: {} } as Doc;
const bib = toBibtex([doc]);
assert.match(bib, /eprint = \{1706\.03762\}/);
assert.match(bib, /title = \{\{Attention Is All You Need\}\}/);
assert.match(bib, /note = \{p\.2: scaled dot-product \(key idea\)\}/);
assert.deepEqual(bibLinks(bib + '@article{b, title={No link}}\n@misc{c, url = {https://x.org/a.pdf}}'), { links: ['1706.03762', 'https://x.org/a.pdf'], skipped: 1 });
console.log('library ok');
