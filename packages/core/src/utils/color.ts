/**
 * RGBA color in the sRGB color space.
 *
 * This module uses this shape as the "normalized" representation when parsing
 * CSS color strings and when calculating WCAG contrast ratios.
 */
export interface RGBA {
  /** Red channel in the range 0..255. */
  r: number;

  /** Green channel in the range 0..255. */
  g: number;

  /** Blue channel in the range 0..255. */
  b: number;

  /**
   * Alpha channel in the range 0..1.
   *
   * `1` is fully opaque, `0` is fully transparent.
   */
  a: number;
}

const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  transparent: 'rgba(0,0,0,0)',
};

function clampByte(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function hexToByte(hex: string): number {
  return Number.parseInt(hex, 16);
}

function parseHex(input: string): RGBA | null {
  const value = input.trim().toLowerCase();
  if (!value.startsWith('#')) return null;
  const hex = value.slice(1);

  if (hex.length === 3) {
    const r = hexToByte(hex[0]! + hex[0]!);
    const g = hexToByte(hex[1]! + hex[1]!);
    const b = hexToByte(hex[2]! + hex[2]!);
    return { r, g, b, a: 1 };
  }

  if (hex.length === 4) {
    const r = hexToByte(hex[0]! + hex[0]!);
    const g = hexToByte(hex[1]! + hex[1]!);
    const b = hexToByte(hex[2]! + hex[2]!);
    const a = hexToByte(hex[3]! + hex[3]!) / 255;
    return { r, g, b, a: clamp01(a) };
  }

  if (hex.length === 6 || hex.length === 8) {
    const r = hexToByte(hex.slice(0, 2));
    const g = hexToByte(hex.slice(2, 4));
    const b = hexToByte(hex.slice(4, 6));
    const a = hex.length === 8 ? hexToByte(hex.slice(6, 8)) / 255 : 1;
    return { r, g, b, a: clamp01(a) };
  }

  return null;
}

function parseRgb(input: string): RGBA | null {
  const m = input
    .trim()
    .match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i);
  if (!m) return null;
  const r = clampByte(Number(m[1]));
  const g = clampByte(Number(m[2]));
  const b = clampByte(Number(m[3]));
  const a = m[4] !== undefined ? clamp01(Number(m[4])) : 1;
  return { r, g, b, a };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp01(s);
  const ll = clamp01(l);

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: clampByte((rp + m) * 255),
    g: clampByte((gp + m) * 255),
    b: clampByte((bp + m) * 255),
  };
}

function parseHsl(input: string): RGBA | null {
  const m = input
    .trim()
    .match(/^hsla?\(\s*([0-9.]+)\s*,\s*([0-9.]+)%\s*,\s*([0-9.]+)%\s*(?:,\s*([0-9.]+)\s*)?\)$/i);
  if (!m) return null;
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const a = m[4] !== undefined ? clamp01(Number(m[4])) : 1;
  const { r, g, b } = hslToRgb(h, s, l);
  return { r, g, b, a };
}

/**
 * Parse a CSS color value into RGBA.
 *
 * Supports:
 * - hex: #rgb, #rgba, #rrggbb, #rrggbbaa
 * - rgb()/rgba()
 * - hsl()/hsla()
 * - a small set of named colors (black/white/red/green/blue/transparent)
 */
export function parseColor(value: string): RGBA | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const named = NAMED_COLORS[trimmed.toLowerCase()];
  if (named) return parseColor(named);

  return parseHex(trimmed) ?? parseRgb(trimmed) ?? parseHsl(trimmed);
}

/**
 * Alpha blend `fg` on top of `bg`.
 */
export function alphaBlend(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };

  const r = (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a;
  const g = (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a;
  const b = (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a;

  return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: clamp01(a) };
}

function channelToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * Calculate contrast ratio between two opaque colors using WCAG relative luminance.
 */
export function calculateContrastRatio(fg: RGBA, bg: RGBA): number {
  // Composite semi-transparent colors over the background.
  const fgOpaque = fg.a < 1 ? alphaBlend(fg, bg) : fg;
  const bgOpaque = bg.a < 1 ? alphaBlend(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;

  const l1 =
    0.2126 * channelToLinear(fgOpaque.r) +
    0.7152 * channelToLinear(fgOpaque.g) +
    0.0722 * channelToLinear(fgOpaque.b);
  const l2 =
    0.2126 * channelToLinear(bgOpaque.r) +
    0.7152 * channelToLinear(bgOpaque.g) +
    0.0722 * channelToLinear(bgOpaque.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
