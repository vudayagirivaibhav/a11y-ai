import type { AIAnalysisResult, AIProvider, ElementSnapshot } from '@a11y-ai/core/types';

import { BaseRule } from '../../BaseRule.js';
import type { RuleContext, RuleResult } from '../../types.js';

function makeSyntheticElement(selector: string, html: string, tagName: string): ElementSnapshot {
  return {
    selector,
    html,
    tagName,
    attributes: {},
    textContent: '',
  };
}

function findTags(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi');
  const out: string[] = [];
  for (;;) {
    const m = re.exec(html);
    if (!m) break;
    out.push(m[0]!);
  }
  return out;
}

function findSelfClosingTags(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
  const out: string[] = [];
  for (;;) {
    const m = re.exec(html);
    if (!m) break;
    out.push(m[0]!);
  }
  return out;
}

function hasAttr(tagHtml: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`, 'i').test(tagHtml);
}

function getAttr(tagHtml: string, name: string): string | null {
  const m = tagHtml.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'));
  return m?.[1] ?? null;
}

function isKnownEmbed(src: string): boolean {
  const s = src.toLowerCase();
  return (
    s.includes('youtube.com') ||
    s.includes('youtu.be') ||
    s.includes('vimeo.com') ||
    s.includes('soundcloud.com') ||
    s.includes('spotify.com')
  );
}

/**
 * Media accessibility rule for video/audio/embed elements.
 */
export class MediaRule extends BaseRule {
  constructor() {
    super({
      id: 'ai/media-accessibility',
      category: 'structure',
      description: 'Checks common accessibility issues for video/audio/embed media.',
      severity: 'moderate',
      defaultBatchSize: 10,
      requiresAI: true,
      estimatedCost: '1 request per page (optional) + static',
    });
  }

  async evaluate(context: RuleContext, provider: AIProvider): Promise<RuleResult[]> {
    const html = context.extraction.rawHTML;
    const out: RuleResult[] = [];

    const videos = findTags(html, 'video');
    videos.forEach((v, i) => {
      const el = makeSyntheticElement(`video:nth-of-type(${i + 1})`, v, 'video');
      const hasCaptions = /<track\b[^>]*\bkind=["'](captions|subtitles)["']/i.test(v);
      const hasDescriptions = /<track\b[^>]*\bkind=["']descriptions["']/i.test(v);
      const autoplay = hasAttr(v, 'autoplay');
      const controls = hasAttr(v, 'controls');

      if (!hasCaptions) {
        out.push(
          this.makeResult(el, {
            severity: 'serious',
            source: 'static',
            message: '<video> is missing captions/subtitles track.',
            suggestion: 'Provide <track kind="captions"> (and/or subtitles) for video content.',
            confidence: 0.85,
            context: { hasCaptions },
          }),
        );
      }

      if (!hasDescriptions) {
        out.push(
          this.makeResult(el, {
            severity: 'minor',
            source: 'static',
            message: '<video> is missing audio descriptions track.',
            suggestion:
              'Consider providing <track kind="descriptions"> for key visual information.',
            confidence: 0.5,
            context: { hasDescriptions },
          }),
        );
      }

      if (autoplay && !controls) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: 'Video autoplay is enabled without user controls.',
            suggestion: 'Avoid autoplay or ensure controls are present so users can pause/stop.',
            confidence: 0.7,
            context: { autoplay, controls },
          }),
        );
      }

      if (!controls) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: '<video> element is missing controls.',
            suggestion:
              'Add the controls attribute, or ensure equivalent accessible controls are provided.',
            confidence: 0.7,
            context: { controls },
          }),
        );
      }
    });

    const audios = findTags(html, 'audio');
    audios.forEach((a, i) => {
      const el = makeSyntheticElement(`audio:nth-of-type(${i + 1})`, a, 'audio');
      const controls = hasAttr(a, 'controls');
      if (!controls) {
        out.push(
          this.makeResult(el, {
            severity: 'moderate',
            source: 'static',
            message: '<audio> element is missing controls.',
            suggestion:
              'Add the controls attribute, or ensure equivalent accessible controls are provided.',
            confidence: 0.7,
            context: { controls },
          }),
        );
      }

      const hasTranscriptHint = /\btranscript\b/i.test(html);
      if (!hasTranscriptHint) {
        out.push(
          this.makeResult(el, {
            severity: 'minor',
            source: 'static',
            message: 'Audio content may be missing a transcript link nearby.',
            suggestion: 'Provide a transcript link close to the audio player.',
            confidence: 0.45,
            context: { transcriptHeuristic: 'page-text-scan' },
          }),
        );
      }
    });

    const iframes = findSelfClosingTags(html, 'iframe');
    iframes.forEach((f, i) => {
      const src = getAttr(f, 'src') ?? '';
      if (!src) return;
      if (!isKnownEmbed(src)) return;
      const el = makeSyntheticElement(`iframe:nth-of-type(${i + 1})`, f, 'iframe');
      out.push(
        this.makeResult(el, {
          severity: 'minor',
          source: 'static',
          message: 'Embedded media detected; captions/transcripts may require manual verification.',
          suggestion:
            'Verify captions/transcripts and keyboard accessibility for the embedded player.',
          confidence: 0.5,
          context: { src },
        }),
      );
    });

    const settings = context.config.rules?.[this.id]?.settings as
      | Record<string, unknown>
      | undefined;
    const aiEnabled = settings?.aiEnabled !== false;
    if (!aiEnabled) return out;

    const prompt = this.buildAiPrompt(videos, audios, iframes, context);
    const analysis = await provider.analyze(prompt, context);
    out.push(...this.parseAiResponse(analysis));

    return out;
  }

  private buildAiPrompt(
    videos: string[],
    audios: string[],
    iframes: string[],
    context: RuleContext,
  ): string {
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
      'Review media elements for accessibility concerns (captions, transcripts, controls, keyboard access).',
      'Return ONLY valid JSON matching the output schema.',
    ].join('\n');

    return [
      'You are an accessibility auditor.',
      '',
      '# instruction',
      instruction,
      '',
      '# context',
      JSON.stringify({
        pageTitle: context.extraction.pageTitle,
        videoCount: videos.length,
        audioCount: audios.length,
        embedCount: iframes.length,
        samples: {
          videos: videos.slice(0, 3),
          audios: audios.slice(0, 3),
          iframes: iframes.slice(0, 3),
        },
      }),
      '',
      '# outputSchema',
      JSON.stringify(outputSchema),
    ].join('\n');
  }

  private parseAiResponse(analysis: AIAnalysisResult): RuleResult[] {
    const parsed = safeJsonParse(extractJsonMaybe(analysis.raw));
    if (!parsed || typeof parsed !== 'object') return [];
    const obj = parsed as Record<string, unknown>;
    const issues = Array.isArray(obj.issues) ? obj.issues.filter((x) => typeof x === 'string') : [];
    if (issues.length === 0) return [];
    const suggestions = Array.isArray(obj.suggestions)
      ? obj.suggestions.filter((x) => typeof x === 'string')
      : [];
    const confidence = typeof obj.confidence === 'number' ? clamp01(obj.confidence) : 0.5;

    const anchor = makeSyntheticElement('media', '<media>', 'media');
    return [
      this.makeResult(anchor, {
        severity: 'minor',
        source: 'ai',
        message: 'Media accessibility issues detected.',
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
