declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: unknown);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window: any;
  }
}
declare module 'playwright';
declare module 'puppeteer';
