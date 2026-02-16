export * from './types/index.js';
export * from './axe/normalize.js';
export * from './axe/merge.js';
export { AxeRunner } from './axe/AxeRunner.js';
export { DOMExtractor } from './extraction/DOMExtractor.js';
export { buildRuleContext } from './extraction/context.js';
export { A11yAuditor } from './auditor/A11yAuditor.js';
export type { AuditConfig, AuditorEvents } from './auditor/types.js';
export { AccessibilityScorer } from './scoring/AccessibilityScorer.js';
export { ReportGenerator } from './reporting/ReportGenerator.js';
export type {
  Reporter,
  JsonReportOptions,
  MarkdownReportOptions,
  HtmlReportOptions,
  ConsoleReportOptions,
} from './reporting/ReportGenerator.js';
