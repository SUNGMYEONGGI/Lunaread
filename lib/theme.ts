// Turn a 4-color Color Hunt palette into the app's CSS tokens, nudging colors until text stays readable.
type RGB = number[];
const hex = (h: string): RGB => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: RGB) => `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => v + (b[i] - v) * t); // t=0 → a, t=1 → b
const lum = (c: RGB) => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: RGB, b: RGB) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const sat = (c: RGB) => { const mx = Math.max(...c), mn = Math.min(...c); return mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255)); };
const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0];
// Move `c` toward `to` in small steps until it contrasts `against` by `min`.
const push = (c: RGB, to: RGB, against: RGB, min: number) => { let t = 0, out = c; while (contrast(out, against) < min && t < 1) out = mix(c, to, (t += 0.05)); return out; };

export const splitCode = (code: string) => [0, 6, 12, 18].map(i => `#${code.slice(i, i + 6)}`);

export function paletteTokens(code: string, dark: boolean): Record<string, string> {
  const cs = splitCode(code).map(c => hex(c.slice(1))).sort((a, b) => lum(b) - lum(a));
  const [light, , , deep] = cs;
  const bg = dark ? push(deep, BLACK, WHITE, 14) : push(light, WHITE, BLACK, 15);
  const text = dark ? push(light, WHITE, bg, 11) : push(deep, BLACK, bg, 10);
  const accentBase = [...cs].sort((a, b) => sat(b) - sat(a))[0];
  // Buttons put white text on the accent, so light mode also needs contrast against white.
  const accent = dark ? push(accentBase, WHITE, bg, 4.5) : push(push(accentBase, BLACK, bg, 4.5), BLACK, WHITE, 4.5);
  const surface = dark ? mix(bg, WHITE, 0.05) : mix(bg, WHITE, 0.7);
  const ai = mix(dark ? cs[2] : cs[1], bg, dark ? 0.8 : 0.55);
  return {
    '--bg': toHex(bg), '--text': toHex(text), '--accent': toHex(accent), '--ai': toHex(contrast(ai, text) < 7 ? mix(ai, bg, 0.6) : ai),
    '--surface': toHex(surface), '--surface-2': toHex(mix(bg, text, 0.06)), '--border': toHex(mix(bg, text, 0.13)),
    '--muted': toHex(push(mix(text, bg, 0.45), text, bg, 4.5)), '--accent-soft': `${toHex(accent)}1f`,
  };
}

export function applyTheme({ theme, palette }: { theme: string; palette: string | null }) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  const tokens: Record<string, string> = palette ? paletteTokens(palette, theme === 'dark') : {};
  for (const k of ['--bg', '--text', '--accent', '--ai', '--surface', '--surface-2', '--border', '--muted', '--accent-soft']) {
    if (tokens[k]) root.style.setProperty(k, tokens[k]); else root.style.removeProperty(k);
  }
}
