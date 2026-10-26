import assert from 'node:assert';
import { findInItems, blocks, pageText } from './text.ts';

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
console.log('text ok');
