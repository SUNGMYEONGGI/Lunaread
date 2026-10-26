import assert from 'node:assert';
import { findInItems, blocks, pageText, mask, unmask, glossaryRules, chunkPaper, topChunks, fuzzy } from './text.ts';

const items: { str: string; x: number; y: number; w: number; h: number; eol?: boolean }[] = [
  { str: 'Deep learning has', x: 0.1, y: 0.1, w: 0.3, h: 0.01 },
  { str: 'transformed vision.', x: 0.1, y: 0.112, w: 0.3, h: 0.01, eol: true },
  { str: 'Table 1', x: 0.6, y: 0.5, w: 0.1, h: 0.01 },
];
assert.equal(findInItems(items, 'learning has transformed')[0].length, 2);
assert.equal(findInItems(items, 'nope here').length, 0);
const b = blocks(items);
assert.equal(b.length, 2);
assert.equal(b[0].text, 'Deep learning has transformed vision.');
assert.match(pageText(items), /vision\.\nTable 1/);
const m = mask('As shown in Fig. 3(a) and Eq. (2), attention [12, 14] beats RNNs (Smith et al., 2020; Lee, 2021). See https://x.org/a.');
assert.deepEqual(m.tokens, ['Fig. 3(a)', 'Eq. (2)', '[12, 14]', '(Smith et al., 2020; Lee, 2021)', 'https://x.org/a.']);
assert.equal(unmask(m.text.replace('⟦2⟧', '⟦ 2 ⟧'), m.tokens), 'As shown in Fig. 3(a) and Eq. (2), attention [12, 14] beats RNNs (Smith et al., 2020; Lee, 2021). See https://x.org/a.');
assert.equal(unmask('⟦9⟧', []), '⟦9⟧');
assert.equal(glossaryRules('Transformer\n# comment\nattention = 어텐션', undefined), '- "Transformer": keep untranslated\n- "attention" → "어텐션"');
const chunks = [...chunkPaper('A', '[Page 1]\nWe study dropout regularization.\n\n[Page 2]\nResults on ImageNet.'), ...chunkPaper('B', '[Page 1]\nAttention layers replace recurrence.')];
assert.deepEqual(chunks.map(c => [c.title, c.page]), [['A', 1], ['A', 2], ['B', 1]]);
assert.deepEqual(topChunks('How does attention replace recurrence?', chunks).map(c => c.title), ['B']);
assert.equal(topChunks('unrelated words', chunks).length, 0);
assert.equal(fuzzy('xyz', 'Settings'), -1);
assert.ok(fuzzy('set', 'Settings') < fuzzy('set', 'Scholar Deep Search tool'));
console.log('text ok');
