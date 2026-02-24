import { EventEmitter } from 'node:events';

import type { AuditResult } from './types/audit.js';
import type { AuditOptions, ProviderInput, ProviderName } from './api.js';

import { toAuditConfig } from './api.js';
import { A11yAuditor } from './auditor/A11yAuditor.js';
import { registerRule as registerRuleInternal } from './rulesRegistry.js';
import type { Rule } from '@a11y-ai/rules';

/**
 * Callable factory function returned by `a11yAI`.
 *
 * We use an interface (instead of `namespace` merging) to keep eslint happy and to
 * avoid relying on TypeScript-only declaration merging patterns in runtime code.
 */
export interface A11yAIFactory {
  (): A11yAiBuilder;
  /** Register a custom rule globally so it is available to subsequent audits. */
  registerRule(rule: Rule): void;
}

/**
 * Builder-style API for configuring and running an audit.
 *
 * Example:
 *   const result = await a11yAI()
 *     .url('https://example.com')
 *     .provider('openai', { apiKey: '...' })
 *     .preset('standard')
 *     .on('rule:complete', console.log)
 *     .run();
 */
const a11yAIImpl = (() => new A11yAiBuilder()) as A11yAIFactory;
a11yAIImpl.registerRule = (rule: Rule): void => registerRuleInternal(rule);

export const a11yAI = a11yAIImpl;

type BuilderTarget =
  | { kind: 'url'; url: string }
  | { kind: 'html'; html: string }
  | { kind: 'none' };

export class A11yAiBuilder extends EventEmitter {
  private target: BuilderTarget = { kind: 'none' };
  private options: AuditOptions = { provider: { name: 'custom' } };

  url(url: string): this {
    this.target = { kind: 'url', url };
    return this;
  }

  html(html: string): this {
    this.target = { kind: 'html', html };
    return this;
  }

  preset(preset: string): this {
    this.options.preset = preset;
    return this;
  }

  provider(provider: ProviderInput): this;
  provider(
    name: ProviderName,
    config?: Omit<Extract<ProviderInput, { name: ProviderName }>, 'name'>,
  ): this;
  provider(
    nameOrProvider: ProviderName | ProviderInput,
    config?: Omit<Extract<ProviderInput, { name: ProviderName }>, 'name'>,
  ): this {
    this.options.provider =
      typeof nameOrProvider === 'string'
        ? { name: nameOrProvider, ...(config ?? {}) }
        : nameOrProvider;
    return this;
  }

  enableVision(): this {
    this.options.preset = this.options.preset ?? 'thorough';
    this.options.vision = true;
    this.options.rules = {
      ...(this.options.rules ?? {}),
      'ai/alt-text-quality': {
        ...(this.options.rules?.['ai/alt-text-quality'] ?? {}),
        vision: true,
      },
    };
    return this;
  }

  async run(): Promise<AuditResult> {
    if (this.target.kind === 'none') {
      throw new Error('No target configured. Call .url(...) or .html(...) before .run().');
    }

    const auditor = new A11yAuditor(toAuditConfig(this.options));
    forwardListeners(this, auditor);

    if (this.target.kind === 'url') {
      return await auditor.auditURL(this.target.url);
    }
    return await auditor.auditHTML(this.target.html);
  }
}

function forwardListeners(from: EventEmitter, to: EventEmitter): void {
  for (const name of from.eventNames()) {
    for (const listener of from.listeners(name)) {
      to.on(name, listener as (...args: unknown[]) => void);
    }
  }
}
