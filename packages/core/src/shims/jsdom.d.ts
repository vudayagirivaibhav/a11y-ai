declare module 'jsdom' {
  /**
   * Minimal `jsdom` typing shim used by local Next.js type-checks in the playground.
   *
   * The core package only relies on `new JSDOM(...)` and `dom.window`, so we keep
   * this intentionally small instead of forcing `@types/jsdom` in every environment.
   */
  export class JSDOM {
    constructor(html?: string, options?: unknown);
    window: Window &
      typeof globalThis & {
        eval(code: string): unknown;
      };
  }
}
