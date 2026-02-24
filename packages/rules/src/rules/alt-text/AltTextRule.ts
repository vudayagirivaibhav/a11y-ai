import type { AIAnalysisResult, AIProvider, ImageElement } from '@a11y-ai/core/types';
import { fetchImage } from '@a11y-ai/core/utils';

import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';

/**
 * AI-powered image alt-text rule.
 *
 * This rule does two passes:
 * 1) Static heuristics (no AI) for missing/empty/suspicious alt text
 * 2) Optional AI evaluation for images with alt text to judge quality in context
 */
export class AltTextRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/alt-text-quality',
      category: 'alt-text',
      description: 'Checks image alt text presence and quality.',
      severity: 'moderate',
      defaultBatchSize: 10,
      requiresAI: true,
      supportsVision: true,
      estimatedCost: '1 request per ~10 images (+ vision when enabled)',
    });
  }

  async evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    const images = context.extraction.images;
    const results: RuleResult[] = [];

    // 1) Static checks
    for (const img of images) {
      const staticResults = this.evaluateStatic(img);
      results.push(...staticResults);
    }

    // 2) AI checks for images that have non-empty alt text.
    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const aiEnabled = settings?.aiEnabled !== false;

    const aiCandidates = images.filter((img) => img.hasAlt && (img.alt ?? '').trim().length > 0);
    const batchSize = context.config.rules?.[this.id]?.batchSize ?? this.defaultBatchSize;

    if (aiEnabled && aiCandidates.length > 0) {
      const aiResults = await this.evaluateInBatches(aiCandidates, batchSize, async (batch) => {
        const prompt = this.buildAltQualityPrompt(batch, context);
        const analysis = await provider.analyze(prompt, context);
        return this.parseAltQualityResponse(analysis, batch, context);
      });

      results.push(...aiResults);
    }

    // 3) Optional vision checks (expensive, opt-in).
    await this.maybeRunVisionChecks(results, images, context, provider);

    return results;
  }

  private async maybeRunVisionChecks(
    existingResults: RuleResult[],
    images: ImageElement[],
    context: RuleContext,
    provider: AIProvider,
  ): Promise<void> {
    const ruleCfg = context.config.rules?.[this.id];
    const visionEnabled = ruleCfg?.vision ?? context.config.vision ?? false;
    if (!visionEnabled) return;

    if (typeof provider.analyzeImage !== 'function') return;

    const maxVisionImages = context.config.maxVisionImages ?? 20;

    // Prioritize images already flagged by static/text checks.
    const flaggedSelectors = new Set(
      existingResults.filter((r) => r.ruleId === this.id).map((r) => r.element.selector),
    );

    const candidates = images.filter((img) => flaggedSelectors.has(img.selector));
    const toAnalyze = candidates.slice(0, maxVisionImages);
    if (toAnalyze.length === 0) return;

    for (const img of toAnalyze) {
      const fetched = await fetchImage(img.src, context.url);
      if (!fetched) continue;

      const dataUrl = `data:${fetched.mimeType};base64,${fetched.buffer.toString('base64')}`;
      const prompt = this.buildVisionPrompt(img, context);

      try {
        const analysis = await provider.analyzeImage(dataUrl, prompt, context);
        const visionResults = this.parseVisionResponse(analysis, img);
        existingResults.push(...visionResults);
      } catch {
        // Graceful degradation: vision is optional and should not fail the audit.
        continue;
      }
    }
  }

  private buildVisionPrompt(image: ImageElement, context: RuleContext): string {
    const outputSchema = {
      type: 'object',
      properties: {
        element: { type: 'string' },
        imageDescription: { type: 'string' },
        altTextAccuracy: {
          type: 'string',
          enum: ['accurate', 'partial', 'inaccurate', 'missing-context'],
        },
        suggestedAlt: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['element', 'imageDescription', 'altTextAccuracy', 'suggestedAlt', 'confidence'],
    };

    const instruction = [
      'You will receive an image and its current alt text.',
      '1) Describe what the image shows.',
      '2) Evaluate whether the alt text accurately represents the image content and purpose in context.',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');

    const payload = {
      element: image.selector,
      currentAlt: image.alt ?? '',
      pageTitle: context.extraction.pageTitle,
      surrounding: {
        // In later prompts we’ll provide richer neighborhood context; for now we keep it light.
        metaDescription: context.extraction.metaDescription,
      },
    };

    return [
      'You are an accessibility auditor.',
      '',
      '# instruction',
      instruction,
      '',
      '# context',
      JSON.stringify(payload),
      '',
      '# outputSchema',
      JSON.stringify(outputSchema),
    ].join('\n');
  }

  private parseVisionResponse(analysis: AIAnalysisResult, image: ImageElement): RuleResult[] {
    const parsed = safeJsonParse(extractJsonMaybe(analysis.raw));
    if (!parsed || typeof parsed !== 'object') return [];

    const obj = parsed as Record<string, unknown>;
    const altTextAccuracy =
      typeof obj.altTextAccuracy === 'string' ? obj.altTextAccuracy : 'accurate';
    if (altTextAccuracy === 'accurate') return [];

    const suggestedAlt = typeof obj.suggestedAlt === 'string' ? obj.suggestedAlt : '';
    const imageDescription = typeof obj.imageDescription === 'string' ? obj.imageDescription : '';
    const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0.6;

    const severity =
      altTextAccuracy === 'inaccurate'
        ? 'serious'
        : altTextAccuracy === 'missing-context'
          ? 'moderate'
          : 'moderate';

    return [
      this.makeResult(image, {
        severity,
        source: 'ai',
        message:
          altTextAccuracy === 'inaccurate'
            ? 'Alt text does not match the image content.'
            : altTextAccuracy === 'partial'
              ? 'Alt text only partially describes the image.'
              : 'Alt text may be missing important context from the image.',
        suggestion:
          suggestedAlt || 'Revise the alt text to accurately describe the image and its purpose.',
        confidence,
        context: {
          vision: true,
          altTextAccuracy,
          imageDescription,
          latencyMs: analysis.latencyMs,
          attempts: analysis.attempts,
        },
      }),
    ];
  }

  private evaluateStatic(img: ImageElement): RuleResult[] {
    const out: RuleResult[] = [];

    if (!img.hasAlt) {
      out.push(
        this.makeResult(img, {
          severity: 'serious',
          source: 'static',
          message: 'Image is missing an alt attribute.',
          suggestion: 'Add an alt attribute that describes the image, or set alt="" if decorative.',
          confidence: 1,
          context: { reason: 'missing-alt-attribute' },
        }),
      );
      return out;
    }

    const alt = img.alt ?? '';
    const trimmedAlt = alt.trim();

    if (trimmedAlt.length === 0) {
      if (!isLikelyDecorative(img)) {
        out.push(
          this.makeResult(img, {
            severity: 'serious',
            source: 'static',
            message: 'Image has empty alt text but does not look decorative.',
            suggestion:
              'Provide meaningful alt text, or confirm the image is decorative and intentionally uses alt="".',
            confidence: 0.85,
            context: { reason: 'empty-alt-not-decorative' },
          }),
        );
      }
      return out;
    }

    const suspicious = findSuspiciousAltReasons(trimmedAlt);
    if (suspicious.length > 0) {
      out.push(
        this.makeResult(img, {
          severity: 'moderate',
          source: 'static',
          message: 'Alt text looks suspicious or unhelpful.',
          suggestion: 'Rewrite the alt text to describe the image purpose in context.',
          confidence: 0.8,
          context: { reasons: suspicious, currentAlt: trimmedAlt },
        }),
      );
    }

    return out;
  }

  private buildAltQualityPrompt(images: ImageElement[], context: RuleContext): string {
    const outputSchema = {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              element: { type: 'string' },
              currentAlt: { type: 'string' },
              quality: { type: 'string', enum: ['good', 'needs-improvement', 'poor'] },
              issues: { type: 'array', items: { type: 'string' } },
              suggestedAlt: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['element', 'currentAlt', 'quality', 'issues', 'suggestedAlt', 'confidence'],
          },
        },
      },
      required: ['results'],
    };

    const instruction = [
      'Evaluate the quality of the provided image alt text.',
      'Use page context and nearby text only if relevant (you will not see the image pixels).',
      'If the current alt is good, set quality="good" and keep suggestedAlt close to currentAlt.',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');

    return this.buildPrompt({
      system: 'You are an accessibility auditor. Be practical and concise.',
      instruction,
      elements: images,
      outputSchema,
      extraContext: {
        pageTitle: context.extraction.pageTitle,
        pageLanguage: context.extraction.pageLanguage,
        metaDescription: context.extraction.metaDescription,
      },
    });
  }

  private parseAltQualityResponse(
    analysis: AIAnalysisResult,
    batch: ImageElement[],
    context: RuleContext,
  ): RuleResult[] {
    const parsed = safeJsonParse(extractJsonMaybe(analysis.raw));

    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { results?: unknown }).results)
        ? ((parsed as { results: unknown[] }).results as unknown[])
        : [];

    const bySelector = new Map<string, ImageElement>();
    for (const img of batch) bySelector.set(img.selector, img);

    const out: RuleResult[] = [];

    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;

      const selector = typeof obj.element === 'string' ? obj.element : '';
      const img = bySelector.get(selector);
      if (!img) continue;

      const quality = typeof obj.quality === 'string' ? obj.quality : 'good';
      if (quality === 'good') continue;

      const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0.6;

      const issues = Array.isArray(obj.issues)
        ? obj.issues.filter((x) => typeof x === 'string')
        : [];
      const suggestedAlt = typeof obj.suggestedAlt === 'string' ? obj.suggestedAlt : '';
      const currentAlt = typeof obj.currentAlt === 'string' ? obj.currentAlt : (img.alt ?? '');

      out.push(
        this.makeResult(img, {
          severity: quality === 'poor' ? 'serious' : 'moderate',
          source: 'ai',
          message:
            quality === 'poor'
              ? 'Alt text is poor quality for this image.'
              : 'Alt text could be improved for this image.',
          suggestion: suggestedAlt || 'Revise the alt text to better describe the image purpose.',
          confidence,
          context: {
            issues,
            currentAlt,
            modelRaw: analysis.raw,
            latencyMs: analysis.latencyMs,
            attempts: analysis.attempts,
          },
        }),
      );
    }

    // If the provider returns nothing usable, we fail silently (other rules should keep running).
    // This avoids turning temporary model formatting issues into hard audit failures.
    if (out.length === 0 && list.length === 0) {
      void context;
    }

    return out;
  }

  private makeResult(
    element: ImageElement,
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

function isLikelyDecorative(img: ImageElement): boolean {
  const ariaHidden = (img.attributes['aria-hidden'] ?? '').toLowerCase();
  if (ariaHidden === 'true') return true;

  const role = (img.attributes['role'] ?? '').toLowerCase();
  if (role === 'presentation' || role === 'none') return true;

  const className = (img.attributes['class'] ?? '').toLowerCase();
  if (className.includes('decorative') || className.includes('sr-only')) return true;

  const src = (img.src ?? '').toLowerCase();
  if (src.includes('spacer') || src.includes('sprite') || src.includes('decor')) return true;

  // If it looks like a real content image (large-ish), treat it as non-decorative.
  const box = img.boundingBox;
  if (box && box.width > 50 && box.height > 50) return false;

  return false;
}

function findSuspiciousAltReasons(alt: string): string[] {
  const reasons: string[] = [];
  const lower = alt.trim().toLowerCase();

  if (alt.length > 150) reasons.push('alt-text-too-long');

  const generic = new Set(['image', 'photo', 'picture', 'icon', 'graphic']);
  if (generic.has(lower)) reasons.push('generic-single-word');

  if (looksLikeFilename(lower)) reasons.push('looks-like-filename');

  return reasons;
}

function looksLikeFilename(text: string): boolean {
  if (/\b(img|dsc)[-_]?\d{3,}\b/i.test(text)) return true;
  if (/\bimage\.(png|jpe?g|gif|webp|svg)\b/i.test(text)) return true;
  if (/\b[a-z0-9_-]+\.(png|jpe?g|gif|webp|svg)\b/i.test(text)) return true;
  return false;
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
