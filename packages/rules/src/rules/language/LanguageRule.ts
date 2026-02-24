import type { AIAnalysisResult, AIProvider, ElementSnapshot } from '@a11y-ai/core/types';

import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';

function bcp47LooksValid(lang: string): boolean {
  // Best-effort BCP 47 validator: language[-script][-region][-variant...]
  return /^[a-zA-Z]{2,3}(-[a-zA-Z]{4})?(-[a-zA-Z]{2}|\d{3})?(-[a-zA-Z0-9]{5,8})*$/.test(lang);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;

  const vowels = 'aeiouy';
  let count = 0;
  let prevWasVowel = false;
  for (const ch of w) {
    const isVowel = vowels.includes(ch);
    if (isVowel && !prevWasVowel) count++;
    prevWasVowel = isVowel;
  }

  // Silent 'e'
  if (w.endsWith('e')) count = Math.max(1, count - 1);
  return Math.max(1, count);
}

function fleschKincaidGrade(text: string): number {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  if (sentences.length === 0 || words.length === 0) return 0;

  let syllables = 0;
  for (const w of words) syllables += countSyllables(w);

  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = syllables / words.length;
  return 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
}

function smogIndex(text: string): number {
  const sentences = splitSentences(text);
  const words = splitWords(text);
  if (sentences.length < 3 || words.length === 0) return 0;

  const polysyllables = words.filter((w) => countSyllables(w) >= 3).length;
  return 1.043 * Math.sqrt(polysyllables * (30 / sentences.length)) + 3.1291;
}

/**
 * Language + readability rule.
 */
export class LanguageRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/language-readability',
      category: 'structure',
      description: 'Checks language declarations and estimates readability.',
      severity: 'minor',
      defaultBatchSize: 1,
      requiresAI: true,
      estimatedCost: '1 request per page (optional) + static readability',
    });
  }

  async evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    const out: RuleResult[] = [];
    const anchor: ElementSnapshot =
      context.extraction.headings[0] ??
      ({
        selector: 'html',
        html: '<html>',
        tagName: 'html',
        attributes: {},
        textContent: '',
      } satisfies ElementSnapshot);

    const lang = context.extraction.pageLanguage;
    if (!lang) {
      out.push(
        this.makeResult(anchor, {
          severity: 'moderate',
          source: 'static',
          message: 'Missing lang attribute on <html>.',
          suggestion: 'Set <html lang="en"> (or the appropriate language tag).',
          confidence: 0.85,
          context: { reason: 'missing-lang' },
        }),
      );
    } else if (!bcp47LooksValid(lang)) {
      out.push(
        this.makeResult(anchor, {
          severity: 'moderate',
          source: 'static',
          message: 'Invalid lang attribute value.',
          suggestion: 'Use a valid BCP 47 language tag (e.g., "en", "en-US").',
          confidence: 0.8,
          context: { reason: 'invalid-lang', lang },
        }),
      );
    }

    const rtlLangs = new Set(['ar', 'he', 'fa', 'ur']);
    const baseLang = (lang ?? '').split('-')[0]?.toLowerCase();
    if (baseLang && rtlLangs.has(baseLang)) {
      const hasDir = /<html[^>]*\bdir=["'](rtl|ltr)["']/i.test(context.extraction.rawHTML);
      if (!hasDir) {
        out.push(
          this.makeResult(anchor, {
            severity: 'minor',
            source: 'static',
            message: 'RTL language detected but dir attribute is missing on <html>.',
            suggestion: 'Add dir="rtl" to <html> for right-to-left languages.',
            confidence: 0.6,
            context: { reason: 'missing-dir', lang },
          }),
        );
      }
    }

    // Readability scoring (best-effort on extracted HTML).
    const text = stripHtml(context.extraction.rawHTML);
    const fk = fleschKincaidGrade(text);
    const smog = smogIndex(text);

    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const target = Number(settings?.targetGradeLevel ?? 8);
    const grade = Math.max(fk, smog);
    if (Number.isFinite(target) && grade > target + 1) {
      out.push(
        this.makeResult(anchor, {
          severity: 'minor',
          source: 'static',
          message: `Reading level may be high (estimated grade ${grade.toFixed(1)}).`,
          suggestion:
            'Consider simplifying sentences, defining jargon, and using clearer headings.',
          confidence: 0.55,
          context: { fleschKincaid: fk, smog, targetGradeLevel: target },
        }),
      );
    }

    const aiEnabled = settings?.aiEnabled !== false;
    if (!aiEnabled) return out;

    const prompt = this.buildAiPrompt(text, lang ?? null, target);
    const analysis = await provider.analyze(prompt, context);
    out.push(...this.parseAiResponse(analysis, anchor));

    return out;
  }

  private buildAiPrompt(text: string, lang: string | null, targetGradeLevel: number): string {
    const outputSchema = {
      type: 'object',
      properties: {
        issues: { type: 'array', items: { type: 'string' } },
        suggestions: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number' },
      },
      required: ['issues', 'suggestions', 'confidence'],
    };

    const instruction = [
      'Analyze language and readability.',
      'Look for mixed languages, jargon without definitions, unexpanded abbreviations, and sensory-only instructions.',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');

    const sample = text.slice(0, 2000);

    return [
      'You are an accessibility auditor.',
      '',
      '# instruction',
      instruction,
      '',
      '# context',
      JSON.stringify({ declaredLanguage: lang, targetGradeLevel, textSample: sample }),
      '',
      '# outputSchema',
      JSON.stringify(outputSchema),
    ].join('\n');
  }

  private parseAiResponse(analysis: AIAnalysisResult, anchor: ElementSnapshot): RuleResult[] {
    const parsed = safeJsonParse(extractJsonMaybe(analysis.raw));
    if (!parsed || typeof parsed !== 'object') return [];
    const obj = parsed as Record<string, unknown>;
    const issues = Array.isArray(obj.issues) ? obj.issues.filter((x) => typeof x === 'string') : [];
    if (issues.length === 0) return [];
    const suggestions = Array.isArray(obj.suggestions)
      ? obj.suggestions.filter((x) => typeof x === 'string')
      : [];
    const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0.5;

    return [
      this.makeResult(anchor, {
        severity: 'minor',
        source: 'ai',
        message: 'Language/readability issues detected.',
        suggestion: suggestions.join(' ') || issues.join(' '),
        confidence,
        context: {
          issues,
          suggestions,
          latencyMs: analysis.latencyMs,
          attempts: analysis.attempts,
        },
      }),
    ];
  }

  private makeResult(
    element: ElementSnapshot,
    options: Omit<RuleResult, 'ruleId' | 'category' | 'element'> & {
      context?: Record<string, unknown>;
    },
  ): RuleResult {
    return {
      ruleId: this.id,
      category: this.category,
      element,
      severity: options.severity,
      message: options.message,
      suggestion: options.suggestion,
      confidence: options.confidence,
      source: options.source,
      context: options.context,
    };
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function extractJsonMaybe(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
