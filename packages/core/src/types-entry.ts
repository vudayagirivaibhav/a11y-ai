/**
 * Types-only entrypoint.
 *
 * This avoids runtime circular dependencies between:
 * - `a11y-ai` (core orchestrator)
 * - `@a11y-ai/ai-providers` (provider adapters)
 * - `@a11y-ai/rules` (rules engine)
 *
 * Packages that only need shared types should import from `@a11y-ai/core/types`.
 */
export * from './types/index.js';
