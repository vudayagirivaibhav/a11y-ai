import { describe, expect, it } from 'vitest';

import { type RGBA, alphaBlend, calculateContrastRatio, parseColor } from './color.js';

describe('parseColor', () => {
  describe('hex colors', () => {
    it('parses 3-digit hex', () => {
      expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('parses 4-digit hex with alpha', () => {
      const result = parseColor('#fff8');
      expect(result?.r).toBe(255);
      expect(result?.g).toBe(255);
      expect(result?.b).toBe(255);
      expect(result?.a).toBeCloseTo(0.533, 2);
    });

    it('parses 6-digit hex', () => {
      expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('#ff5733')).toEqual({ r: 255, g: 87, b: 51, a: 1 });
    });

    it('parses 8-digit hex with alpha', () => {
      const result = parseColor('#ffffff80');
      expect(result?.r).toBe(255);
      expect(result?.g).toBe(255);
      expect(result?.b).toBe(255);
      expect(result?.a).toBeCloseTo(0.502, 2);
    });

    it('is case insensitive', () => {
      expect(parseColor('#FFF')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });

    it('returns null for invalid hex', () => {
      expect(parseColor('#gg')).toBeNull();
      expect(parseColor('#12345')).toBeNull();
      expect(parseColor('fff')).toBeNull();
    });
  });

  describe('rgb/rgba colors', () => {
    it('parses rgb()', () => {
      expect(parseColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('rgb(0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('rgb(128, 64, 32)')).toEqual({ r: 128, g: 64, b: 32, a: 1 });
    });

    it('parses rgba()', () => {
      expect(parseColor('rgba(255, 255, 255, 1)')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    });

    it('clamps values', () => {
      const result = parseColor('rgb(300, -10, 128)');
      expect(result?.r).toBe(255);
      expect(result?.g).toBe(0);
      expect(result?.b).toBe(128);
    });

    it('returns null for invalid rgb', () => {
      expect(parseColor('rgb()')).toBeNull();
      expect(parseColor('rgb(255)')).toBeNull();
    });
  });

  describe('hsl/hsla colors', () => {
    it('parses hsl()', () => {
      const red = parseColor('hsl(0, 100%, 50%)');
      expect(red?.r).toBe(255);
      expect(red?.g).toBe(0);
      expect(red?.b).toBe(0);

      const green = parseColor('hsl(120, 100%, 25%)');
      expect(green?.r).toBe(0);
      expect(green?.g).toBe(128);
      expect(green?.b).toBe(0);
    });

    it('parses hsla()', () => {
      const result = parseColor('hsla(0, 100%, 50%, 0.5)');
      expect(result?.r).toBe(255);
      expect(result?.a).toBe(0.5);
    });

    it('returns null for invalid hsl', () => {
      expect(parseColor('hsl()')).toBeNull();
      expect(parseColor('hsl(0, 100%)')).toBeNull();
    });
  });

  describe('named colors', () => {
    it('parses named colors', () => {
      expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColor('red')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    });

    it('is case insensitive', () => {
      expect(parseColor('BLACK')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColor('White')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseColor('')).toBeNull();
      expect(parseColor('   ')).toBeNull();
    });

    it('returns null for unknown values', () => {
      expect(parseColor('unknown')).toBeNull();
      expect(parseColor('gradient()')).toBeNull();
    });

    it('trims whitespace', () => {
      expect(parseColor('  #fff  ')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    });
  });
});

describe('alphaBlend', () => {
  it('blends opaque colors (fg wins)', () => {
    const fg: RGBA = { r: 255, g: 0, b: 0, a: 1 };
    const bg: RGBA = { r: 0, g: 0, b: 255, a: 1 };
    const result = alphaBlend(fg, bg);
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('blends semi-transparent fg over opaque bg', () => {
    const fg: RGBA = { r: 255, g: 0, b: 0, a: 0.5 };
    const bg: RGBA = { r: 0, g: 0, b: 255, a: 1 };
    const result = alphaBlend(fg, bg);
    expect(result.r).toBeCloseTo(128, 0);
    expect(result.g).toBe(0);
    expect(result.b).toBeCloseTo(128, 0);
    expect(result.a).toBe(1);
  });

  it('returns transparent for two transparent colors', () => {
    const fg: RGBA = { r: 255, g: 0, b: 0, a: 0 };
    const bg: RGBA = { r: 0, g: 0, b: 255, a: 0 };
    const result = alphaBlend(fg, bg);
    expect(result.a).toBe(0);
  });
});

describe('calculateContrastRatio', () => {
  it('returns 21 for black on white', () => {
    const black: RGBA = { r: 0, g: 0, b: 0, a: 1 };
    const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
    const ratio = calculateContrastRatio(black, white);
    expect(ratio).toBeCloseTo(21, 1);
  });

  it('returns 21 for white on black', () => {
    const black: RGBA = { r: 0, g: 0, b: 0, a: 1 };
    const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
    const ratio = calculateContrastRatio(white, black);
    expect(ratio).toBeCloseTo(21, 1);
  });

  it('returns 1 for same colors', () => {
    const color: RGBA = { r: 128, g: 128, b: 128, a: 1 };
    const ratio = calculateContrastRatio(color, color);
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('handles semi-transparent colors', () => {
    const fg: RGBA = { r: 0, g: 0, b: 0, a: 0.5 };
    const bg: RGBA = { r: 255, g: 255, b: 255, a: 1 };
    const ratio = calculateContrastRatio(fg, bg);
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(21);
  });

  it('meets WCAG AA for normal text (4.5:1)', () => {
    const darkGray: RGBA = { r: 89, g: 89, b: 89, a: 1 };
    const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
    const ratio = calculateContrastRatio(darkGray, white);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('meets WCAG AAA for normal text (7:1)', () => {
    const veryDarkGray: RGBA = { r: 59, g: 59, b: 59, a: 1 };
    const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
    const ratio = calculateContrastRatio(veryDarkGray, white);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });
});
