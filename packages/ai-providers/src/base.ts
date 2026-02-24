import type {
  AIAnalysisResult,
  AIFinding,
  AIProvider,
  AiProviderConfig,
  RuleContext,
  Severity,
} from '@a11y-ai/core/types';

import { AIProviderParseError, AIProviderTimeoutError } from './errors.js';
import { VisionNotSupportedError } from './errors.js';
import { TokenBucket } from './tokenBucket.js';

type TokenUsage = AIAnalysisResult['usage'];

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function isSeverity(value: unknown): value is Severity {
  return value === 'critical' || value === 'serious' || value === 'moderate' || value === 'minor';
}

function extractJsonMaybe(text: string): string {
  const trimmed = text.trim();

  // Common pattern: ```json ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  return trimmed;
}

function safeJsonParse(text: string): unknown {
  const candidate = extractJsonMaybe(text);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    throw new AIProviderParseError('Failed to parse AI provider JSON response', { cause: error });
  }
}

function normalizeFindings(parsed: unknown, context: RuleContext): AIFinding[] {
  if (parsed === null || typeof parsed !== 'object') return [];

  const root = parsed as Record<string, unknown>;
  const list =
    (Array.isArray(root.findings) && root.findings) ||
    (Array.isArray(root.issues) && root.issues) ||
    [];

  const findings: AIFinding[] = [];

  for (const item of list) {
    if (item === null || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    const ruleIdRaw = (obj.ruleId ?? obj.rule ?? context.ruleId) as unknown;
    const ruleId =
      typeof ruleIdRaw === 'string' ? (ruleIdRaw as AIFinding['ruleId']) : context.ruleId;

    const severityRaw = obj.severity;
    const severity: Severity = isSeverity(severityRaw) ? severityRaw : 'moderate';

    const message = typeof obj.message === 'string' ? obj.message : 'Issue detected';
    const suggestion =
      typeof obj.suggestion === 'string' ? obj.suggestion : 'Review and fix the issue.';

    const confidence =
      typeof obj.confidence === 'number'
        ? clamp01(obj.confidence)
        : typeof obj.confidence === 'string'
          ? clamp01(Number(obj.confidence))
          : 0.5;

    const element =
      (obj.element as AIFinding['element'] | undefined) ??
      context.element ??
      ({
        selector: '',
        html: '',
        tagName: '',
        attributes: {},
      } satisfies AIFinding['element']);

    const finding: AIFinding = {
      ruleId,
      severity,
      element,
      message,
      suggestion,
      confidence,
    };

    if (obj.context && typeof obj.context === 'object') {
      finding.context = obj.context as Record<string, unknown>;
    }

    findings.push(finding);
  }

  return findings;
}

function backoffDelayMs(attempt: number): number {
  const base = 200;
  const factor = 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 50);
  return base * factor + jitter;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new AIProviderTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * Base implementation shared by all providers.
 *
 * - Retry: up to `maxRetries` attempts with exponential backoff
 * - Timeout: per request via `timeoutMs` (default 30s)
 * - Rate limiting: token bucket using `rpm` (requests-per-minute)
 * - Parsing: expects a structured JSON response and normalizes to `AIFinding[]`
 */
export abstract class BaseAIProvider implements AIProvider {
  protected readonly config: AiProviderConfig;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly limiter: TokenBucket | null;
  private lastUsage: TokenUsage | undefined;

  constructor(config: AiProviderConfig) {
    this.config = config;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

    const rpm = config.rpm;
    this.limiter =
      typeof rpm === 'number' && Number.isFinite(rpm) && rpm > 0 ? new TokenBucket({ rpm }) : null;
  }

  /**
   * Implemented by concrete providers to perform a single raw completion request.
   *
   * The return value MUST be the model's content string (expected to be JSON).
   * Providers can optionally call `this.setLastUsage(...)` to expose token usage.
   */
  protected abstract rawComplete(prompt: string, systemPrompt?: string): Promise<string>;

  /**
   * Shared retry/timeout/rate-limit wrapper.
   *
   * Concrete providers can reuse this for both text and vision calls.
   */
  protected async runWithRetries(
    request: () => Promise<string>,
    context: RuleContext,
  ): Promise<AIAnalysisResult> {
    const startedAt = Date.now();

    let attempts = 0;
    let lastRaw = '';
    let lastError: unknown;

    for (; attempts < this.maxRetries; attempts++) {
      try {
        this.lastUsage = undefined;

        if (this.limiter) {
          await this.limiter.take(1);
        }

        const raw = await withTimeout(request(), this.timeoutMs);
        lastRaw = raw;

        const parsed = safeJsonParse(raw);
        const findings = normalizeFindings(parsed, context);

        return {
          findings,
          raw,
          latencyMs: Date.now() - startedAt,
          attempts: attempts + 1,
          usage: this.lastUsage,
        };
      } catch (error) {
        lastError = error;
        if (attempts + 1 >= this.maxRetries) break;
        await sleep(backoffDelayMs(attempts + 1));
      }
    }

    // If parsing failed, keeping the raw response is often the most useful debugging artifact.
    if (lastError instanceof AIProviderParseError) {
      throw new AIProviderParseError(`${lastError.message}. Raw output: ${lastRaw.slice(0, 500)}`, {
        cause: (lastError as unknown as { cause?: unknown }).cause,
      });
    }

    throw lastError instanceof Error ? lastError : new Error('AI provider request failed');
  }

  async analyze(prompt: string, context: RuleContext): Promise<AIAnalysisResult> {
    return await this.runWithRetries(
      () => this.rawComplete(prompt, this.config.systemPrompt),
      context,
    );
  }

  /**
   * Optional vision API.
   *
   * Concrete providers can override this if they support multimodal inputs.
   */

  async analyzeImage(
    _imageData: Buffer | string,
    _prompt: string,
    _context: RuleContext,
  ): Promise<AIAnalysisResult> {
    throw new VisionNotSupportedError(this.config.provider);
  }

  /**
   * Allows concrete adapters to attach token usage after an SDK/HTTP call.
   */
  protected setLastUsage(usage: TokenUsage | undefined): void {
    this.lastUsage = usage;
  }
}
