import { z } from 'zod';

const FindingBase = z.object({
  element: z.string(),
  confidence: z.number().min(0).max(1).default(0.7),
});

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

export const VisionResponseSchema = z.object({
  element: z.string(),
  imageDescription: z.string(),
  altTextAccuracy: z.enum(['accurate', 'partial', 'inaccurate', 'missing-context']),
  suggestedAlt: z.string(),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type VisionResponse = z.infer<typeof VisionResponseSchema>;

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

export const HeadingOutlineResponseSchema = z.object({
  issues: z.array(z.string()),
  overallQuality: z.enum(['good', 'needs-improvement', 'poor']),
  suggestedOutline: z.array(z.object({ level: z.number(), text: z.string() })).optional(),
});

export type HeadingOutlineResponse = z.infer<typeof HeadingOutlineResponseSchema>;

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

export const KeyboardResponseSchema = z.object({
  issues: z.array(z.string()),
  unreachable: z.array(z.string()).optional(),
  traps: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type KeyboardResponse = z.infer<typeof KeyboardResponseSchema>;

export const LanguageResponseSchema = z.object({
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type LanguageResponse = z.infer<typeof LanguageResponseSchema>;

export const MediaResponseSchema = z.object({
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type MediaResponse = z.infer<typeof MediaResponseSchema>;

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
