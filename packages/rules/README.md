# @a11y-ai/rules

AI-powered accessibility rules engine for a11y-ai.

## Install

```bash
npm install @a11y-ai/rules
# or
pnpm add @a11y-ai/rules
```

## Built-in Rules

| Rule ID                  | Category  | Description                                                 | AI Required |
| ------------------------ | --------- | ----------------------------------------------------------- | ----------- |
| `ai/alt-text-quality`    | images    | Validates image alt text quality and context                | Yes         |
| `ai/link-text-quality`   | links     | Checks link text is descriptive and unique                  | Yes         |
| `ai/form-label-quality`  | forms     | Validates form labels are clear and associated              | Yes         |
| `ai/heading-structure`   | structure | Checks heading hierarchy and content                        | Yes         |
| `ai/aria-usage`          | aria      | Validates ARIA attributes and roles                         | Yes         |
| `ai/color-contrast`      | contrast  | Checks color contrast (static + AI for complex backgrounds) | Hybrid      |
| `ai/keyboard-navigation` | keyboard  | Validates keyboard accessibility                            | Hybrid      |
| `ai/language-quality`    | language  | Checks reading level and lang attributes                    | Yes         |
| `ai/media-accessibility` | media     | Validates video/audio have captions/transcripts             | Yes         |

## Usage with Registry

```typescript
import { RuleRegistry, registerBuiltinRules } from '@a11y-ai/rules';

// Create registry and register built-in rules
const registry = RuleRegistry.create();
registerBuiltinRules(registry);

// List all rules
for (const rule of registry.getAll()) {
  console.log(`${rule.id}: ${rule.description}`);
}

// Get a specific rule
const altTextRule = registry.get('ai/alt-text-quality');

// Get rules enabled for a config
const enabledRules = registry.enabledRules(auditConfig);
```

## Creating Custom Rules

```typescript
import { createRule } from '@a11y-ai/rules';
import type { RuleContext, RuleResult } from '@a11y-ai/rules/types';

const myCustomRule = createRule({
  id: 'custom/my-rule',
  category: 'custom',
  description: 'My custom accessibility rule',
  severity: 'serious',
  requiresAI: true,
  supportsVision: false,

  async run(context: RuleContext, aiProvider): Promise<RuleResult[]> {
    const { elements, html, url } = context;

    // Filter elements to analyze
    const targets = elements.filter((el) => el.tagName === 'button');

    if (targets.length === 0) {
      return [];
    }

    // Build prompt for AI
    const prompt = `Analyze these buttons for accessibility issues:
${targets.map((t) => `- ${t.selector}: "${t.textContent}"`).join('\n')}`;

    // Call AI provider
    const response = await aiProvider.analyze(prompt, context);

    // Parse response and return results
    const findings = JSON.parse(response.raw);

    return findings.map((f) => ({
      ruleId: 'custom/my-rule',
      selector: f.element,
      message: f.issue,
      severity: f.severity || 'moderate',
      suggestion: f.suggestion,
      confidence: f.confidence || 0.8,
    }));
  },
});

// Register custom rule
registry.register(myCustomRule);
```

## Rule Result Format

```typescript
interface RuleResult {
  ruleId: string;
  selector: string; // CSS selector for the element
  message: string; // Human-readable issue description
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  suggestion?: string; // How to fix the issue
  confidence?: number; // 0-1, AI confidence score
  wcagCriteria?: string[]; // e.g., ['1.1.1', '1.4.3']
}
```

## Rule Context

Rules receive a `RuleContext` with:

```typescript
interface RuleContext {
  url: string; // Page URL
  html: string; // Full HTML
  elements: ElementSnapshot[]; // Extracted DOM elements
  metadata: {
    pageTitle: string;
    counts: { images; links; forms; headings; ariaElements };
  };
}

interface ElementSnapshot {
  tagName: string;
  selector: string;
  textContent: string;
  attributes: Record<string, string>;
  computedStyles: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontWeight: string;
  };
  boundingBox?: { x; y; width; height };
  surroundingText?: string; // Context from parent
  landmark?: string; // ARIA landmark
}
```

## Zod Schemas for AI Responses

Rules use Zod schemas for type-safe AI response parsing:

```typescript
import { z } from 'zod';
import { BaseRule } from '@a11y-ai/rules';

class MyRule extends BaseRule {
  private static schema = z.object({
    findings: z.array(
      z.object({
        element: z.string(),
        issue: z.string(),
        severity: z.enum(['critical', 'serious', 'moderate', 'minor']),
        confidence: z.number().min(0).max(1),
      }),
    ),
  });

  async run(context, aiProvider) {
    const response = await aiProvider.analyze(prompt, context);
    const parsed = this.parseAIResponseWithSchema(response.raw, MyRule.schema);

    if (!parsed) {
      return []; // Graceful degradation on parse failure
    }

    return parsed.findings.map((f) => this.makeResult(f));
  }
}
```

## License

MIT
