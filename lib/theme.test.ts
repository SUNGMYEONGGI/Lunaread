import assert from 'node:assert/strict';
import { paletteTokens, contrast } from './theme.ts';

const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// Popular Color Hunt palettes, including all-pastel and all-dark ones.
for (const code of ['e3fdfdcbf1f5a6e3e971c9ce', 'fff5e4ffe3e1ffd1d1ff9494', '222831393e4600adb5eeeeee', 'f9f5f6f8e8eefdcedff2bed1', '0000001a1a1d4e4e5056565b']) {
  for (const dark of [false, true]) {
    const t = paletteTokens(code, dark);
    assert.ok(contrast(rgb(t['--text']), rgb(t['--bg'])) >= 7, `${code} ${dark} text`);
    assert.ok(contrast(rgb(t['--accent']), rgb(t['--bg'])) >= 4.4, `${code} ${dark} accent`);
    assert.ok(contrast(rgb(t['--text']), rgb(t['--ai'])) >= 4.5, `${code} ${dark} ai`);
  }
}
console.log('theme ok');
