/**
 * Zod schemas for AI rule response validation.
 *
 * These schemas define the expected structure of AI model responses for each rule.
 * Using Zod provides:
 * - Runtime type validation with graceful degradation
 * - Automatic TypeScript type inference
 * - JSON Schema generation for AI prompt instructions
 *
 * @module schemas
 */
import { z } from 'zod';

/**
 * Base schema for all AI findings.
 * Every finding must identify the element and provide a confidence score.
 */
const FindingBase = z.object({
  /** CSS selector identifying the element */
  element: z.string(),
  /** Confidence score from 0 (uncertain) to 1 (certain) */
  confidence: z.number().min(0).max(1).default(0.7),
});

/**
 * Schema for AltTextRule AI response.
 * Evaluates the quality of image alt text.
 */
export const AltTextQualityResponseSchema = z.object({
  results: z.array(
    FindingBase.extend({
      currentAlt: z.string(),
      quality: z.enum(['good', 'needs-improvement', 'poor']),
      issues: z.array(z.string()),
      suggestedAlt: z.string(),
    }),
  ),
});

export type AltTextQualityResponse = z.infer<typeof AltTextQualityResponseSchema>;

/**
 * Schema for vision-based image analysis.
 * Used when AI has access to the actual image content.
 */
export const VisionResponseSchema = z.object({
  element: z.string(),
  imageDescription: z.string(),
  altTextAccuracy: z.enum(['accurate', 'partial', 'inaccurate', 'missing-context']),
  suggestedAlt: z.string(),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type VisionResponse = z.infer<typeof VisionResponseSchema>;

/**
 * Schema for LinkTextRule AI response.
 * Evaluates whether link text is descriptive and meaningful.
 */
export const LinkTextResponseSchema = z.object({
  results: z.array(
    FindingBase.extend({
      currentText: z.string(),
      quality: z.enum(['good', 'vague', 'misleading']),
      issues: z.array(z.string()),
      suggestedText: z.string(),
    }),
  ),
});

export type LinkTextResponse = z.infer<typeof LinkTextResponseSchema>;

/**
 * Schema for FormLabelRule AI response.
 * Evaluates form field labels for clarity and relevance.
 */
export const FormLabelResponseSchema = z.object({
  results: z.array(
    FindingBase.extend({
      label: z.string(),
      quality: z.enum(['good', 'vague', 'misleading', 'missing']),
      issues: z.array(z.string()),
      suggestedLabel: z.string(),
    }),
  ),
});

export type FormLabelResponse = z.infer<typeof FormLabelResponseSchema>;

/**
 * Schema for HeadingStructureRule AI response.
 * Evaluates document heading hierarchy and structure.
 */
export const HeadingOutlineResponseSchema = z.object({
  issues: z.array(z.string()),
  overallQuality: z.enum(['good', 'needs-improvement', 'poor']),
  suggestedOutline: z.array(z.object({ level: z.number(), text: z.string() })).optional(),
});

export type HeadingOutlineResponse = z.infer<typeof HeadingOutlineResponseSchema>;

/**
 * Schema for ARIARule AI response.
 * Evaluates ARIA attribute usage and suggests improvements.
 */
export const ARIAResponseSchema = z.object({
  results: z.array(
    FindingBase.extend({
      ariaAttributes: z.record(z.string()),
      issues: z.array(z.string()),
      recommendation: z.enum(['keep', 'simplify', 'fix']),
      suggestedMarkup: z.string().optional(),
    }),
  ),
});

export type ARIAResponse = z.infer<typeof ARIAResponseSchema>;

/**
 * Schema for KeyboardRule AI response.
 * Evaluates keyboard navigation and identifies potential issues.
 */
export const KeyboardResponseSchema = z.object({
  /** List of keyboard navigation issues found */
  issues: z.array(z.string()),
  /** Elements that may be unreachable via keyboard */
  unreachable: z.array(z.string()).optional(),
  /** Potential focus trap locations */
  traps: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type KeyboardResponse = z.infer<typeof KeyboardResponseSchema>;

/**
 * Schema for LanguageRule AI response.
 * Evaluates language clarity and readability.
 */
export const LanguageResponseSchema = z.object({
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type LanguageResponse = z.infer<typeof LanguageResponseSchema>;

/**
 * Schema for MediaRule AI response.
 * Evaluates media accessibility (captions, transcripts, etc.).
 */
export const MediaResponseSchema = z.object({
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type MediaResponse = z.infer<typeof MediaResponseSchema>;

/**
 * Schema for ContrastRule AI response.
 * Used for complex backgrounds that can't be computed statically.
 */
export const ContrastAIResponseSchema = z.object({
  results: z.array(
    FindingBase.extend({
      foreground: z.string(),
      background: z.string(),
      estimatedRatio: z.number().optional(),
      wcagLevel: z.enum(['pass-AAA', 'pass-AA', 'fail-AA']),
      suggestion: z.string(),
    }),
  ),
});

export type ContrastAIResponse = z.infer<typeof ContrastAIResponseSchema>;
