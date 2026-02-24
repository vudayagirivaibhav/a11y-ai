export * from './types/index.js';
export * from './axe/normalize.js';
export * from './axe/merge.js';
export { AxeRunner } from './axe/AxeRunner.js';
export { DOMExtractor } from './extraction/DOMExtractor.js';
export { buildRuleContext } from './extraction/context.js';
export { A11yAuditor } from './auditor/A11yAuditor.js';
export type { AuditConfig } from './auditor/types.js';
export { AccessibilityScorer } from './scoring/AccessibilityScorer.js';
export { ReportGenerator } from './reporting/ReportGenerator.js';
export { fetchImage } from './utils/fetchImage.js';
export { parseColor, calculateContrastRatio, alphaBlend } from './utils/color.js';
export type {
  Reporter,
  JsonReportOptions,
  MarkdownReportOptions,
  HtmlReportOptions,
  ConsoleReportOptions,
} from './reporting/ReportGenerator.js';

export { createAIProvider } from '@a11y-ai/ai-providers';
export type { AIProvider } from './types/provider.js';
export type { AiProviderConfig } from './types/config.js';
export type { Rule, RuleResult, RuleContext } from '@a11y-ai/rules';

export { a11yAI, A11yAiBuilder } from './builder.js';
export { getRuleMetadata, registerRule } from './rulesRegistry.js';
export { audit, auditAxeOnly, auditHTML, auditPage, auditURL, toAuditConfig } from './api.js';

export { BatchAuditor } from './batch/BatchAuditor.js';
export type { BatchTarget } from './batch/BatchAuditor.js';
