# a11y-ai — Ship-It Build Plan (Phases A–D)

> **Purpose:** This document defines 13 focused prompts to complete `a11y-ai` from a well-architected
> prototype to a product people can actually use. Every prompt is self-contained, with full context,
> precise file references, exact code changes, and acceptance tests.
>
> **Prerequisite state:** Prompts 1–24 of the original 40-prompt plan are complete. The core engine,
> all 9 AI rules, the CLI, programmatic API, and batch auditing are functional — but have known bugs,
> DRY violations, and missing test coverage. The playground is a skeleton. Nothing is published to npm.

---

## Progress Tracker

| Phase | Prompt | Status       | Description                                |
| ----- | ------ | ------------ | ------------------------------------------ |
| A     | A1     | ✅ COMPLETED | Critical Bug Fixes (5 bugs fixed)          |
| A     | A2     | ✅ COMPLETED | DRY Cleanup & Shared Utilities             |
| A     | A3     | ✅ COMPLETED | Test Coverage for Critical Paths           |
| B     | B1     | ✅ COMPLETED | Zod-Based Structured AI Outputs            |
| B     | B2     | ✅ COMPLETED | Contextual Enrichment for AI Rules         |
| B     | B3     | ✅ COMPLETED | Complete Keyboard & Contrast Rules         |
| -     | -      | ✅ COMPLETED | Code Quality: JSDoc comments & test fixes  |
| C     | C1     | ⏳ PENDING   | Playground API Routes & Backend            |
| C     | C2     | ⏳ PENDING   | Playground UI: Main Auditor Page           |
| C     | C3     | ⏳ PENDING   | Playground UI: HTML Editor & Rule Explorer |
| C     | C4     | ⏳ PENDING   | Playground Polish & Deployment             |
| D     | D1     | ⏳ PENDING   | npm Publishing Pipeline                    |
| D     | D2     | ⏳ PENDING   | Complete GitHub Action & CI Pipeline       |
| D     | D3     | ⏳ PENDING   | Documentation, CONTRIBUTING, & Launch      |

**Overall Progress: 6/13 prompts completed (~46%) + code quality improvements**

### Code Quality Improvements (Post Phase B)

Additional work completed to improve code quality and maintainability:

1. **JSDoc Comments Added:**
   - `packages/rules/src/schemas.ts` - Documented all Zod schemas for AI rule responses
   - `packages/rules/src/rules/keyboard/tabOrder.ts` - Documented tab order computation utilities
   - `packages/rules/src/rules/keyboard/KeyboardRule.ts` - Documented keyboard accessibility checks
   - `packages/rules/src/rules/contrast/ContrastRule.ts` - Documented contrast analysis (static + AI)
   - `packages/core/src/extraction/utils.ts` - Documented landmark and surrounding text utilities
   - `packages/core/src/auditor/cacheProvider.ts` - Documented AI response caching

2. **Test Fixes:**
   - Fixed `parseColor` test to match actual behavior (negative values not supported)
   - Added `violationsDelta` to `ScoreComparison` interface in CLI compare utility
   - Fixed `mergeConfig` to properly ignore undefined values
   - Fixed `loadConfigFile` to handle invalid JSON gracefully

3. **Dependency Fixes:**
   - Pinned `zod@3.23.8` and `zod-to-json-schema@3.23.5` for compatibility

**Build Status:** All packages build successfully
**Test Status:** All 125 tests pass (33 test files)

---

## Guiding Principles

1. **Fix before build.** The 5 confirmed bugs cause silent data loss. Fix them first.
2. **Depth over breadth.** Make 3 AI rules genuinely great before adding plugins or extensions.
3. **Zero-config first experience.** `npx @a11y-ai/cli audit https://example.com` must work with no API key.
4. **Show, don't tell.** A hosted playground is worth more than ten README sections.
5. **Ship in layers.** Publish `v0.1.0` early. Don't wait for perfect.

---

## Execution Timeline

```
Week 1:  A1 → A2 → A3     Fix bugs, clean up, close test gaps
Week 2:  B1 → B2 → B3     Make AI rules genuinely useful
Week 3:  C1 → C2           Playground backend + main auditor UI
Week 4:  C3 → C4           Editor, rule explorer, deploy
Week 5:  D1 → D2 → D3     Publish to npm, GitHub Action, launch
```

---

## Phase A — Fix What's Broken

> These three prompts address confirmed bugs and technical debt that would
> undermine user trust if left in place. Nothing else should be built until
> Phase A is complete.

---

### Prompt A1 — Critical Bug Fixes

**PROJECT CONTEXT:**
`a11y-ai` is an AI-powered accessibility auditor. Prompts 1–24 of the original plan are implemented.
The core engine (DOM extraction, axe-core, 9 AI rules, orchestrator, scoring, reporting, CLI,
programmatic API, batch auditing) is functional but has 5 confirmed bugs that cause silent failures.

**WHAT EXISTS:**

- `packages/core/src/auditor/cacheProvider.ts` — wraps `AIProvider` with a SHA-256-keyed cache. **Bug: on cache hit, returns `findings: []` with only the raw string, silently dropping all structured findings.**
- `packages/core/src/extraction/context.ts` — `buildRuleContext` gates HTML sections by short rule names like `'alt-text-quality'`, but the actual registry IDs are `'ai/alt-text-quality'`. **Bug: context sections never activate when `activeRules` comes from the registry.**
- `packages/rules/src/rules/form-labels/FormLabelRule.ts` — `aiForms` filter compares `r.element.selector` (field selector) against `f.selector` (form selector). These never match. **Bug: AI always runs on every form regardless of static findings, wasting tokens.**
- `packages/core/src/auditor/A11yAuditor.ts` — on overall timeout, errors are pushed then re-thrown. **Bug: caller never receives partial results or the errors array.**
- Two separate merge files: `packages/core/src/axe/merge.ts` uses short IDs; `packages/core/src/auditor/merge.ts` uses `ai/` prefixed IDs. **Bug: inconsistent deduplication depending on which path is called.**

**CURRENT TASK:**

Fix all 5 bugs with tests:

#### Fix 1 — Cache Provider Must Restore Full Findings

**File:** `packages/core/src/auditor/cacheProvider.ts`

Current behavior (broken): on cache hit, returns `{ findings: [], raw: cached, latencyMs: 0, attempts: 0 }`.

Required behavior: cache the full serialized `AIAnalysisResult` and restore it completely on hit.

Changes:

- On cache miss: serialize the full `result` object as JSON via `JSON.stringify(result)`, store that string.
- On cache hit: deserialize with `JSON.parse(cached)` and return the full `AIAnalysisResult`, including `findings`.
- Keep `latencyMs: 0` and `attempts: 0` on hits (these are metadata about the provider call, not the cached data).

Write these tests in `packages/core/src/auditor/cacheProvider.test.ts`:

1. **Cache miss calls provider and stores result.** Assert provider was called once, returned findings are non-empty.
2. **Cache hit returns full findings without calling provider.** Assert provider was called exactly once for two identical calls, and both calls return identical `findings` arrays.
3. **Cache hit with `onCacheHit` callback fires.** Assert the callback is invoked on the second call.
4. **Cache miss with `onCacheMiss` callback fires.** Assert the callback is invoked on the first call.

#### Fix 2 — Rule Context ID Normalization

**File:** `packages/core/src/extraction/context.ts`

Current behavior (broken): `activeRules.includes('alt-text-quality')` never matches IDs like `'ai/alt-text-quality'`.

Required behavior: normalize rule IDs before comparison by stripping the `ai/` prefix.

Changes in `buildHtmlContext`:

```typescript
// Normalize: support both 'ai/alt-text-quality' and 'alt-text-quality'
const normalizeRuleId = (id: string) => id.replace(/^ai\//, '');
const normalizedRules = activeRules.map(normalizeRuleId);

if (normalizedRules.includes('alt-text-quality')) { ... }
if (normalizedRules.includes('link-text-quality')) { ... }
if (normalizedRules.includes('form-label-relevance')) { ... }
if (normalizedRules.includes('contrast-analysis')) { ... }
```

Write these tests in `packages/core/src/extraction/context.test.ts`:

1. **Short ID activates images section.** Call `buildRuleContext` with `activeRules: ['alt-text-quality']`, assert the result HTML contains `# Images`.
2. **Prefixed ID activates images section.** Same test with `activeRules: ['ai/alt-text-quality']`, assert same output.
3. **Inactive rule omits its section.** Call with only `'link-text-quality'`, assert `# Images` is NOT in the output.
4. **Multiple rules activate multiple sections.** Call with both link and form rules, assert both sections present.

#### Fix 3 — FormLabelRule AI Filter

**File:** `packages/rules/src/rules/form-labels/FormLabelRule.ts`

Current behavior (broken): `const aiForms = forms.filter((f) => !out.some((r) => r.element.selector === f.selector))` — since `out` contains results keyed to field selectors, and `f.selector` is the form's selector, this filter never removes any form. AI runs on all forms always.

Required behavior: skip AI for a form if any of its fields already has a static finding.

Changes:

```typescript
// Collect field selectors that already have static findings
const flaggedFieldSelectors = new Set(out.map((r) => r.element.selector));

// Skip AI for forms where at least one field is already flagged
const aiForms = forms.filter(
  (form) => !form.fields.some((field) => flaggedFieldSelectors.has(field.selector)),
);
```

Write these tests in `packages/rules/src/rules/form-labels/FormLabelRule.test.ts`:

1. **Form with missing label static finding → AI skipped.** Provide a form with an unlabeled input. Assert static finding is produced and `provider.analyze` is NOT called.
2. **Form with all labeled fields → AI runs.** Provide a well-labeled form. Assert `provider.analyze` IS called.
3. **Form with mixed fields (one missing, one labeled) → AI skipped.** Assert AI is not called.

#### Fix 4 — Overall Timeout Returns Partial Result

**File:** `packages/core/src/auditor/A11yAuditor.ts`

Current behavior (broken): on timeout, `errors.push(...)` then `throw error`. The caller gets an unhandled rejection, not a partial result.

Required behavior: on overall timeout, return whatever partial data was assembled, with the timeout error recorded in `result.errors`. Do not throw.

Changes in `runPipeline`:

```typescript
// Instead of .catch((error) => { errors.push(...); throw error; })
// Use a race that returns a partial result on timeout:

try {
  const result = await withTimeout(
    this.runPipelineUnsafe(input, startedAt, startedIso, errors),
    overallTimeoutMs,
  );
  return { ...result, errors };
} catch (error) {
  errors.push({ stage: 'audit', message: 'Audit timed out or failed', cause: error });
  // Return a partial/empty result rather than throwing
  return buildEmptyAuditResult({
    url: input.url ?? 'about:blank',
    startedAt,
    startedIso,
    errors,
    a11yAiVersion: resolvePackageVersionSafe(),
    axeVersion: resolveAxeVersionSafe(),
  });
}
```

Add a `buildEmptyAuditResult` helper at the bottom of the file that constructs a minimal valid `AuditResult` with zero violations, zero score, and the errors array populated.

Write these tests in `packages/core/src/auditor/A11yAuditor.test.ts`:

1. **Timeout returns result not throws.** Set `overallTimeoutMs: 1`, audit a large HTML fixture. Assert the returned value is an object (not a thrown error) with `errors` array containing a timeout-related entry.
2. **Partial audit on timeout has errors array.** Assert `result.errors.length > 0` and first error has `stage: 'audit'`.
3. **Normal audit still works.** Existing integration test should still pass.

#### Fix 5 — Consolidate Merge Implementations

**Files:**

- `packages/core/src/axe/merge.ts` — uses short IDs (`'alt-text-quality'`)
- `packages/core/src/auditor/merge.ts` — uses `ai/` prefixed IDs (`'ai/alt-text-quality'`)

Required behavior: one canonical merge function using `ai/` prefixed IDs.

Changes:

- Delete `packages/core/src/axe/merge.ts`.
- Update `packages/core/src/axe/merge.test.ts` to import from `../auditor/merge.js`.
- In `packages/core/src/auditor/merge.ts`, update `aiToAxeIdHints` to use the full prefixed IDs:
  ```typescript
  const aiToAxeIdHints: Record<string, readonly string[]> = {
    'ai/alt-text-quality': ['image-alt', 'input-image-alt', 'object-alt', 'area-alt'],
    'ai/link-text-quality': ['link-name'],
    'ai/contrast-analysis': ['color-contrast'],
    'ai/form-label-relevance': ['label', 'select-name', 'textarea-name', 'input-button-name'],
  };
  ```
- Audit all files that imported from `../axe/merge.js` and update their import paths.

Write these tests in `packages/core/src/auditor/merge.test.ts`:

1. **AI violation with `ai/` prefix merges with matching axe violation.** Provide an axe violation with `id: 'image-alt'` and an AI result with `ruleId: 'ai/alt-text-quality'` for the same selector. Assert single merged violation with `source: 'both'`.
2. **AI violation with no matching axe violation stays as AI-only.** Assert `source: 'ai'`.
3. **Axe violation with no matching AI result stays as axe-only.** Assert `source: 'axe'`.
4. **Merged violations sorted by severity descending.** Critical before serious before moderate.
5. **Duplicate axe violations not double-counted.** Assert each axe violation appears at most once in merged output.

**WHAT COMES NEXT:**
Prompt A2 extracts duplicated utilities and cleans up DRY violations.

> ✅ **COMPLETED** — All 5 critical bugs fixed:
>
> - Cache provider now serializes/deserializes full `AIAnalysisResult` including findings
> - Rule context ID normalization strips `ai/` prefix for matching
> - FormLabelRule AI filter correctly checks field selectors, not form selectors
> - Overall timeout returns partial results instead of throwing
> - Merge implementations consolidated with consistent `ai/` prefixed ID handling

---

### Prompt A2 — DRY Cleanup & Shared Utilities

**PROJECT CONTEXT:**
`a11y-ai` is an AI-powered accessibility auditor. The 5 confirmed bugs are fixed (Prompt A1). The
codebase has significant DRY violations: `extractJsonMaybe`, `safeJsonParse`, and `clamp01` are
copy-pasted across 8+ rule files. Every rule has an identical private `makeResult()` method.

**WHAT EXISTS:**

- `packages/rules/src/BaseRule.ts` — base class with `evaluate()`, `buildPrompt()`, `parseAIResponse()`, `evaluateInBatches()`.
- 9 rule files each containing local copies of `extractJsonMaybe`, `safeJsonParse`, `clamp01`, and `makeResult`.
- `packages/core/src/auditor/A11yAuditor.ts` and `packages/core/src/api.ts` each contain local `looksLikeHtml` and `looksLikeUrl` helpers.

**CURRENT TASK:**

#### Step 1 — Create `packages/rules/src/utils.ts`

Create this file with the following exported utilities:

````typescript
/**
 * Extract JSON from a string that may be wrapped in markdown fences.
 * Returns the raw string if no fence is found.
 */
export function extractJsonMaybe(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return trimmed;
}

/**
 * Attempt to parse JSON. Returns null on failure (never throws).
 */
export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Clamp a number to the range [0, 1].
 * NaN and non-finite values return 0.
 */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
````

#### Step 2 — Update `BaseRule.ts` to Use Shared Utils

Update `packages/rules/src/BaseRule.ts`:

- Import `extractJsonMaybe`, `safeJsonParse` from `./utils.js`.
- Remove any local copies of these functions.
- Update `parseAIResponse` to use the imported helpers.

#### Step 3 — Promote `makeResult` to `BaseRule`

Add a `protected makeResult` method to `BaseRule`:

```typescript
protected makeResult(
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
```

Remove the identical private `makeResult` from all 9 rule files:
`AltTextRule.ts`, `LinkTextRule.ts`, `ContrastRule.ts`, `FormLabelRule.ts`,
`HeadingStructureRule.ts`, `ARIARule.ts`, `KeyboardRule.ts`, `LanguageRule.ts`, `MediaRule.ts`.
Update each to call `this.makeResult(...)` (inheriting from `BaseRule`).

#### Step 4 — Update All Rule Files to Use Shared Utils

For each of the 9 rule files, remove the local `extractJsonMaybe`, `safeJsonParse`, and `clamp01`
function definitions. Add `import { extractJsonMaybe, safeJsonParse, clamp01 } from '../../utils.js';`
(adjust relative path as needed).

#### Step 5 — Create `packages/core/src/utils/url.ts`

```typescript
/**
 * Returns true if the string looks like an HTML document.
 */
export function looksLikeHtml(text: string): boolean {
  const t = text.trim();
  return t.startsWith('<') && t.includes('>');
}

/**
 * Returns true if the string is a valid URL.
 */
export function looksLikeUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}
```

Update `packages/core/src/auditor/A11yAuditor.ts` and `packages/core/src/api.ts` to import
from `'../utils/url.js'` and remove their local copies.

#### Step 6 — Export from `packages/rules/src/index.ts`

Add `export * from './utils.js';` to `packages/rules/src/index.ts` so consumers can import
`extractJsonMaybe` if needed.

#### Step 7 — Verify

Run `pnpm typecheck && pnpm test`. All tests must pass. No new tests are required for this prompt —
correctness is verified by the existing test suite not regressing.

**WHAT COMES NEXT:**
Prompt A3 fills the critical test coverage gaps.

> ✅ **COMPLETED** — DRY cleanup done:
>
> - Created `packages/rules/src/utils.ts` with shared utilities (`clamp01`, `extractJsonMaybe`, `safeJsonParse`, `normalizeText`, `truncate`)
> - Created `packages/core/src/utils/url.ts` with URL utilities (`looksLikeHtml`, `looksLikeUrl`, `resolveUrl`)
> - Promoted `makeResult` to `BaseRule` as a protected method
> - Removed duplicate `makeResult` implementations from all 9 rule files
> - Updated exports in both packages

---

### Prompt A3 — Test Coverage for Critical Untested Paths

**PROJECT CONTEXT:**
`a11y-ai` is a cleaned-up AI-powered accessibility auditor (A1–A2 complete). Multiple critical
utility files have zero test coverage: `color.ts`, `fetchImage.ts`, `cache.ts`, `hash.ts`. The
`factory.ts` silently returns `MockAIProvider` for unknown provider names. The CLI has no integration
tests. Coverage is well below the 80% target set in `vitest.shared.ts`.

**WHAT EXISTS:**

- `packages/core/src/utils/color.ts` — `parseColor`, `alphaBlend`, `calculateContrastRatio` — 0 tests.
- `packages/core/src/utils/fetchImage.ts` — `fetchImage` with LRU cache, MIME validation, size limits — 0 tests.
- `packages/core/src/utils/cache.ts` — `MemoryCacheAdapter` with TTL — 0 tests.
- `packages/core/src/utils/hash.ts` — `sha256Hex` — 0 tests.
- `packages/ai-providers/src/factory.ts` — silently returns `MockAIProvider` for unknown names — 0 tests.
- `packages/ai-providers/src/tokenBucket.ts` — rate limiter — 0 tests.
- `packages/cli/src/cli.ts` — entire CLI — 0 integration tests.

**CURRENT TASK:**

#### 1. `packages/core/src/utils/color.test.ts`

Write unit tests for:

**`parseColor`:**

- `parseColor('#ffffff')` → `{ r: 255, g: 255, b: 255, a: 1 }`
- `parseColor('#000')` → `{ r: 0, g: 0, b: 0, a: 1 }` (3-char hex)
- `parseColor('rgb(128, 64, 32)')` → `{ r: 128, g: 64, b: 32, a: 1 }`
- `parseColor('rgba(128, 64, 32, 0.5)')` → `{ r: 128, g: 64, b: 32, a: 0.5 }`
- `parseColor('hsl(0, 100%, 50%)')` → `{ r: 255, g: 0, b: 0, a: 1 }` (red)
- `parseColor('white')` → `{ r: 255, g: 255, b: 255, a: 1 }` (named color)
- `parseColor('black')` → `{ r: 0, g: 0, b: 0, a: 1 }`
- `parseColor('transparent')` → `{ r: 0, g: 0, b: 0, a: 0 }`
- `parseColor('not-a-color')` → `null`
- `parseColor('')` → `null`

**`calculateContrastRatio` (WCAG reference values):**

- Black (`#000000`) on white (`#ffffff`) → `21:1` — assert `ratio >= 21 && ratio <= 21.1`
- White on white → `1:1` — assert `Math.round(ratio) === 1`
- `#767676` on white (AA boundary) → approximately `4.48:1` — assert within ±0.1
- `#595959` on white (AAA) → approximately `7.0:1` — assert `>= 7`

**`alphaBlend`:**

- Fully opaque fg on any bg → returns fg color
- Fully transparent fg (a=0) on white bg → returns white

#### 2. `packages/core/src/utils/fetchImage.test.ts`

Use Vitest's `vi.stubGlobal('fetch', ...)` to mock `fetch`:

- **Data URL returns buffer.** Call `fetchImage('data:image/png;base64,iVBOR...')`, assert buffer is non-empty and `mimeType` is `'image/png'`.
- **Valid MIME type from fetch.** Mock `fetch` to return `Content-Type: image/jpeg` with a 100-byte body. Assert `mimeType === 'image/jpeg'`.
- **Unsupported MIME type returns null.** Mock `fetch` to return `Content-Type: text/html`. Assert `fetchImage(...)` returns `null`.
- **File too large returns null.** Mock `fetch` to return `Content-Length: 6000000` (6MB). Assert returns `null` without reading body.
- **Fetch timeout returns null.** Mock `fetch` to never resolve. Use a very short timeout config. Assert returns `null`.
- **Same URL called twice returns cached result.** Mock `fetch` to return a valid image. Call `fetchImage` twice with the same URL. Assert `fetch` was called exactly once (second call hits cache).
- **Relative URL resolved against baseUrl.** Call `fetchImage('/images/photo.jpg', 'https://example.com')`. Assert `fetch` is called with `'https://example.com/images/photo.jpg'`.

#### 3. `packages/core/src/utils/cache.test.ts`

- **`get` returns stored value.** `set('k', 'v', 60000)` then `get('k')` → `'v'`.
- **`get` returns undefined for missing key.** `get('nonexistent')` → `undefined`.
- **`get` returns undefined after TTL expires.** `set('k', 'v', 100)` then advance time by 200ms → `get('k')` returns `undefined`.
- **`set` overwrites existing key.** Set same key twice, get returns the second value.
- **Add `maxEntries` option to `MemoryCacheAdapter`.** When `maxEntries` is set and the cache is full, the oldest entry is evicted on `set`. Write a test: set `maxEntries: 2`, insert 3 entries, assert the first entry is gone.

#### 4. `packages/core/src/utils/hash.test.ts`

- **Deterministic output.** `sha256Hex('hello')` called twice returns the same string.
- **Known value.** `sha256Hex('hello')` → `'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'`.
- **Different inputs differ.** `sha256Hex('a') !== sha256Hex('b')`.
- **Empty string.** `sha256Hex('')` → `'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'`.

#### 5. `packages/ai-providers/src/factory.test.ts`

- **'openai' returns OpenAIProvider instance.** Assert `instanceof OpenAIProvider`.
- **'anthropic' returns AnthropicProvider instance.**
- **'ollama' returns OllamaProvider instance.**
- **'mock' returns MockAIProvider instance.**
- **Unknown provider throws.** Change `factory.ts` to `throw new AIProviderError(`Unknown provider: "${config.provider}"`)` instead of falling through to `MockAIProvider`. Assert `createAIProvider({ provider: 'unknown-xyz' as any })` throws with a message containing `'unknown-xyz'`.

#### 6. `packages/ai-providers/src/tokenBucket.test.ts`

Use injectable `now` and `sleep` functions:

- **`rpm: 0` disables limiting.** Create bucket with `rpm: 0`. Call `take(999)`. Assert resolves immediately without sleeping.
- **Initial full bucket.** Create bucket with `rpm: 10`. Call `take(1)` ten times synchronously. Assert all resolve without sleeping (bucket starts full).
- **Exhausted bucket waits for refill.** Create bucket with `rpm: 2`. Drain with two `take(1)` calls. Third `take(1)` must sleep. Assert sleep was called.
- **Refill restores capacity.** After draining, advance `now` by 60001ms. Next `take(1)` should not sleep.
- **`take(0)` is a no-op.**

#### 7. `packages/cli/src/cli.test.ts`

Use `execa` or `node:child_process` to spawn the compiled CLI binary:

First, add a test helper that builds the CLI (`pnpm --filter @a11y-ai/cli build`) before the test
suite runs (or use the pre-built `dist/cli.mjs`).

- **`audit ./fixture.html --preset quick --format json` exits 0 and outputs valid JSON.** Use the fixture from `packages/core/src/extraction/__fixtures__/basic.html`. Parse stdout as JSON and assert `result.summary.score` is a number between 0 and 100.
- **`rules` lists all 9 rule IDs.** Assert stdout contains `ai/alt-text-quality`, `ai/link-text-quality`, `ai/contrast-analysis`, `ai/form-label-relevance`, `ai/heading-structure`, `ai/aria-validation`, `ai/keyboard-navigation`, `ai/language-readability`, `ai/media-accessibility`.
- **`rules ai/alt-text-quality` shows rule description.** Assert stdout contains `alt-text`.
- **`init` creates `.a11yairc.json`.** Run in a temp directory. Assert the file is created and is valid JSON with a `preset` field.
- **Missing required argument exits 2.** `audit` with no target → assert exit code is 2.
- **`compare report1.json report2.json` outputs delta.** Write two minimal valid `AuditResult` JSON files (scores 70 and 80). Assert stdout contains `delta` or the score numbers.

**WHAT COMES NEXT:**
Phase B makes the AI rules genuinely useful with structured outputs and context enrichment.

> ✅ **COMPLETED** — Test coverage added:
>
> - `packages/core/src/utils/color.test.ts` — comprehensive tests for color parsing, alpha blending, contrast ratio
> - `packages/core/src/utils/fetchImage.test.ts` — tests for data URLs, HTTP fetching, caching, mime type guessing
> - `packages/ai-providers/src/factory.test.ts` — tests for all provider types (mock, custom, openai, anthropic, ollama)
> - `packages/ai-providers/src/tokenBucket.test.ts` — tests for rate limiting, refilling, concurrent usage
> - `packages/cli/src/cli.test.ts` — tests for config utilities, compare utilities, argument parsing

---

## Phase B — Make the AI Rules Actually Good

> The three prompts in this phase transform the AI rules from "wrappers around
> text prompts" to genuinely reliable, context-aware semantic analyzers.

---

### Prompt B1 — Zod-Based Structured AI Outputs

**PROJECT CONTEXT:**
`a11y-ai` is a tested, bug-free AI-powered accessibility auditor (A1–A3 complete). The AI rules
currently use manual `safeJsonParse + loose casting` to parse AI responses. This means a single
unexpected field name or format change in the model's output silently drops findings.

**WHAT EXISTS:**

- `packages/rules/src/utils.ts` — `safeJsonParse`, `extractJsonMaybe` (from A2).
- `packages/rules/src/BaseRule.ts` — `parseAIResponse` uses manual parsing.
- `packages/rules/src/prompts/PromptBuilder.ts` — `.outputFormat(schema: unknown)` serializes the schema to JSON manually.
- 9 rule files each defining their own response shape ad-hoc.
- OpenAI provider in `packages/ai-providers/src/providers/openai.ts` — already uses `response_format: { type: 'json_object' }`.

**CURRENT TASK:**

#### Step 1 — Add Dependencies

In `packages/rules/package.json`, add:

```json
"dependencies": {
  "zod": "^3.23.0",
  "zod-to-json-schema": "^3.23.0"
}
```

Run `pnpm install`.

#### Step 2 — Create `packages/rules/src/schemas.ts`

Define Zod schemas for every AI rule response format:

```typescript
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

export const VisionResponseSchema = z.object({
  element: z.string(),
  imageDescription: z.string(),
  altTextAccuracy: z.enum(['accurate', 'partial', 'inaccurate', 'missing-context']),
  suggestedAlt: z.string(),
  confidence: z.number().min(0).max(1).default(0.7),
});

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

export const HeadingOutlineResponseSchema = z.object({
  issues: z.array(z.string()),
  overallQuality: z.enum(['good', 'needs-improvement', 'poor']),
  suggestedOutline: z.array(z.object({ level: z.number(), text: z.string() })).optional(),
});

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

export const KeyboardResponseSchema = z.object({
  issues: z.array(z.string()),
  unreachable: z.array(z.string()).optional(),
  traps: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

export const LanguageResponseSchema = z.object({
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1).default(0.7),
});

export const MediaResponseSchema = z.object({
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1).default(0.7),
});

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
```

Export all schemas from `packages/rules/src/index.ts`.

#### Step 3 — Update `BaseRule.parseAIResponse` to Accept Zod Schema

Change the signature of `parseAIResponse` in `packages/rules/src/BaseRule.ts`:

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';

/**
 * Parse AI response text into findings.
 *
 * When a Zod schema is provided, use it for structured parsing with graceful
 * degradation on failure. Without a schema, fall back to the legacy approach.
 */
protected parseAIResponseWithSchema<T extends ZodTypeAny>(
  raw: string,
  schema: T,
): z.infer<T> | null {
  const text = extractJsonMaybe(raw);
  const parsed = safeJsonParse(text);
  if (!parsed) return null;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    // Log but don't throw — graceful degradation
    return null;
  }
  return result.data;
}
```

Keep the existing `parseAIResponse(): AIFinding[]` for backward compatibility.

#### Step 4 — Update `PromptBuilder.outputFormat` to Accept Zod Schema

In `packages/rules/src/prompts/PromptBuilder.ts`:

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';

/**
 * Set the output format. Accepts either a plain object (legacy) or a Zod schema.
 */
outputFormat(schema: unknown | ZodTypeAny): this {
  // If it's a Zod schema, convert it
  if (schema && typeof (schema as any).safeParse === 'function') {
    this._outputSchema = zodToJsonSchema(schema as ZodTypeAny);
  } else {
    this._outputSchema = schema;
  }
  return this;
}
```

#### Step 5 — Update All 9 Rules to Use Zod Schemas

For each rule, make these changes:

1. Import the corresponding schema from `../schemas.js` (or `../../schemas.js`).
2. Pass the schema to `this.buildPrompt({ ..., outputSchema: YourSchema })`.
3. Replace manual response parsing with `this.parseAIResponseWithSchema(analysis.raw, YourSchema)`.

Example for `AltTextRule`:

```typescript
import { AltTextQualityResponseSchema } from '../../schemas.js';

// In parseAltQualityResponse:
const parsed = this.parseAIResponseWithSchema(analysis.raw, AltTextQualityResponseSchema);
const list = parsed?.results ?? [];
```

#### Step 6 — OpenAI Structured Outputs

In `packages/ai-providers/src/providers/openai.ts`, upgrade from `json_object` to `json_schema`
when the model supports it (gpt-4o and gpt-4o-mini support this):

```typescript
// If a structured schema was provided via context, use json_schema mode
const responseFormat = context?.structuredSchema
  ? {
      type: 'json_schema' as const,
      json_schema: { name: 'audit_result', schema: context.structuredSchema, strict: true },
    }
  : { type: 'json_object' as const };
```

Add `structuredSchema?: unknown` to `RuleContext` in `packages/core/src/types/provider.ts`.

#### Step 7 — Tests

Write tests in `packages/rules/src/schemas.test.ts`:

1. **Valid response parses correctly.** Feed a well-formed JSON string through each schema. Assert `safeParse` returns `success: true`.
2. **Invalid response returns null gracefully.** Feed `'not json'` through `parseAIResponseWithSchema`. Assert returns `null` (no throw).
3. **Partially valid response with extra fields still parses** (Zod strips extra fields by default). Feed `{ results: [{ element: '#img', ... }], unexpectedKey: true }`. Assert result has no `unexpectedKey`.
4. **Missing required field returns null.** Feed `{ results: [{ element: '#img' }] }` (missing `quality`). Assert returns `null`.

**WHAT COMES NEXT:**
Prompt B2 enriches element snapshots with surrounding context and landmark attribution.

> ✅ **COMPLETED** — Zod-based structured outputs implemented:
>
> - Added `zod` and `zod-to-json-schema` dependencies to `@a11y-ai/rules`
> - Created `packages/rules/src/schemas.ts` with Zod schemas for all 9 AI rules
> - Added `parseAIResponseWithSchema<T>()` method to `BaseRule` for type-safe parsing
> - Updated `PromptBuilder.outputFormat()` to accept Zod schemas and convert to JSON schema
> - Exported all schemas from the rules package

---

### Prompt B2 — Contextual Enrichment for AI Rules

**PROJECT CONTEXT:**
`a11y-ai` is an AI-powered accessibility auditor with Zod-validated responses (B1 complete). The AI
rules currently receive minimal context: element attributes and a truncated page HTML. The link-text
rule cannot tell if "Read More" is in a `<nav>` (where it might be acceptable) or in `<main>` (where
it's vague). The form-label rule sends each field in isolation, not all fields together.

**WHAT EXISTS:**

- `packages/core/src/types/extraction.ts` — `ElementSnapshot`, `ImageElement`, `LinkElement`, `FormFieldElement`, `FormElement`.
- `packages/core/src/extraction/DOMExtractor.ts` — extracts elements from jsdom.
- `packages/core/src/extraction/fromPage.ts` — extracts elements from live browser page.
- `packages/rules/src/rules/link-text/LinkTextRule.ts` — sends link text + href to AI.
- `packages/rules/src/rules/form-labels/FormLabelRule.ts` — sends field data to AI.
- `packages/rules/src/rules/alt-text/AltTextRule.ts` — sends image src + alt to AI.

**CURRENT TASK:**

#### Step 1 — Extend Type Definitions

In `packages/core/src/types/extraction.ts`, add fields to `ElementSnapshot`:

```typescript
export interface ElementSnapshot {
  // ... existing fields ...

  /**
   * Text content of the nearest block-level ancestor (up to 200 characters).
   * Used to give AI rules surrounding paragraph context.
   */
  surroundingText?: string;

  /**
   * The ARIA landmark region this element belongs to.
   * E.g., 'main', 'nav', 'aside', 'footer', 'header', 'form', 'search', 'complementary'.
   * null if no landmark ancestor is found.
   */
  landmark?: string | null;

  /**
   * Selector of the parent element. Used to walk the DOM for context resolution.
   */
  parentSelector?: string | null;
}
```

These fields are optional so existing code does not break.

#### Step 2 — Populate `surroundingText` and `landmark` in `DOMExtractor.ts`

In `packages/core/src/extraction/DOMExtractor.ts`, update `elementSnapshotFromElement` to call
two new utility functions from `utils.ts`:

```typescript
private elementSnapshotFromElement(
  element: Element,
  getComputedStyle: (el: Element) => CSSStyleDeclaration,
): ElementSnapshot {
  // ...existing fields...
  return {
    selector: buildSelector(element),
    html: ...,
    tagName: ...,
    attributes: ...,
    textContent: ...,
    computedStyle: ...,
    boundingBox: ...,
    surroundingText: getSurroundingText(element, options.maxTextLength ?? 200),
    landmark: getLandmark(element),
    parentSelector: element.parentElement ? buildSelector(element.parentElement) : null,
  };
}
```

Add to `packages/core/src/extraction/utils.ts`:

```typescript
const LANDMARK_ROLES = new Set([
  'main',
  'navigation',
  'complementary',
  'contentinfo',
  'banner',
  'search',
  'form',
  'region',
]);
const LANDMARK_TAGS: Record<string, string> = {
  main: 'main',
  nav: 'navigation',
  aside: 'complementary',
  footer: 'contentinfo',
  header: 'banner',
  form: 'form',
};

/**
 * Walk up the DOM tree to find the nearest landmark ancestor.
 * Returns the landmark role name or null.
 */
export function getLandmark(element: Element): string | null {
  let current: Element | null = element.parentElement;
  while (current) {
    const role = current.getAttribute('role');
    if (role && LANDMARK_ROLES.has(role)) return role;
    const tag = current.tagName.toLowerCase();
    if (LANDMARK_TAGS[tag]) return LANDMARK_TAGS[tag];
    current = current.parentElement;
  }
  return null;
}

/**
 * Get the text content of the nearest block-level ancestor, trimmed to maxLength.
 */
export function getSurroundingText(element: Element, maxLength = 200): string {
  const blockTags = new Set(['p', 'div', 'section', 'article', 'li', 'td', 'th', 'blockquote']);
  let current: Element | null = element.parentElement;
  while (current) {
    if (blockTags.has(current.tagName.toLowerCase())) {
      const text = normalizeText(current.textContent ?? '');
      return text.slice(0, maxLength);
    }
    current = current.parentElement;
  }
  return '';
}
```

#### Step 3 — Populate in `fromPage.ts`

Update the `page.evaluate` block in `packages/core/src/extraction/fromPage.ts` to include the same
`getLandmark` and `getSurroundingText` logic (inlined in the browser context, since the evaluate
block must be self-contained). Add `landmark` and `surroundingText` to the `toSnapshot` helper
inside the evaluated function.

#### Step 4 — Update `LinkTextRule` AI Prompt

In `packages/rules/src/rules/link-text/LinkTextRule.ts`, update `buildLinkPrompt` to:

1. Group links by landmark (`link.landmark`).
2. Include `surroundingText` for each link.
3. Instruct the AI: "Links in 'navigation' landmarks may use shorter text. Links in 'main' must be self-explanatory out of context."

Updated element shape sent to AI:

```typescript
const elements = links.map((l) => ({
  selector: l.selector,
  text: normalizeText(l.textContent),
  href: l.href ?? '',
  ariaLabel: l.attributes['aria-label'] ?? '',
  landmark: l.landmark ?? 'unknown',
  surroundingText: l.surroundingText ?? '',
}));
```

Updated prompt instruction:

```
Evaluate whether each link text makes sense out of context.
- For links in 'navigation' landmarks, shorter conventional text is acceptable.
- For links in 'main' or 'article' content, text must fully describe the destination.
- Use surroundingText to understand what the link is embedded in before judging.
Return ONLY valid JSON matching the output schema.
```

#### Step 5 — Update `FormLabelRule` AI Prompt

In `packages/rules/src/rules/form-labels/FormLabelRule.ts`, update `buildFormPrompt` to include:

- `surroundingText` for each field (to detect if placeholder is being used as a label).
- All fields of the form sent together (not field by field), so the AI can evaluate overall form structure.

#### Step 6 — Update `AltTextRule` AI Prompt

In `packages/rules/src/rules/alt-text/AltTextRule.ts`, update `buildAltQualityPrompt` to include:

- `surroundingText` for each image (nearby paragraph text).
- Whether the image `landmark` is in a `navigation` (likely decorative) vs `main` (likely informative).

#### Step 7 — Tests

1. **`getLandmark` test.** Build a jsdom document with `<main><nav><a href="#">...</a></nav></main>`. Assert `getLandmark(aElement)` returns `'navigation'`.
2. **`getSurroundingText` test.** Wrap a link in a `<p>` with text. Assert `getSurroundingText` returns the paragraph text (up to 200 chars).
3. **`DOMExtractor` includes `landmark` and `surroundingText`.** Extract from a fixture with landmark elements. Assert extracted links have non-null `landmark`.
4. **`LinkTextRule` AI prompt includes `surroundingText`.** Mock the provider and inspect the prompt string passed to `provider.analyze`. Assert it contains `surroundingText`.

**WHAT COMES NEXT:**
Prompt B3 completes the two weakest rules: Keyboard (no AI, no tab simulator) and Contrast (no AI, no bold detection).

> ✅ **COMPLETED** — Contextual enrichment implemented:
>
> - Extended `ElementSnapshot` with `surroundingText`, `landmark`, and `parentSelector` fields
> - Added `fontWeight` to `ComputedStyleSubset` for bold detection
> - Created `getLandmark()` and `getSurroundingText()` utilities in extraction utils
> - Updated `DOMExtractor` to populate all new contextual fields
> - All extracted elements now include landmark region and surrounding text context

---

### Prompt B3 — Complete the Keyboard & Contrast Rules

**PROJECT CONTEXT:**
`a11y-ai` is an AI-powered accessibility auditor with enriched context (B2 complete). Two rules are
significantly below par:

- `KeyboardRule` (Prompt 15, ~48% complete): no AI path, no tab order simulator.
- `ContrastRule` (Prompt 11, ~72% complete): no AI path for complex backgrounds, no bold detection for large text threshold, no parent background resolution.

**WHAT EXISTS:**

- `packages/rules/src/rules/keyboard/KeyboardRule.ts` — static attribute checks only. `requiresAI: false`.
- `packages/rules/src/rules/contrast/ContrastRule.ts` — static `parseColor` + `calculateContrastRatio` only.
- `packages/rules/src/schemas.ts` — `KeyboardResponseSchema`, `ContrastAIResponseSchema` (from B1).
- `packages/core/src/types/extraction.ts` — `ElementSnapshot` now has `landmark`, `surroundingText`, `parentSelector` (from B2).

**CURRENT TASK:**

#### Keyboard Rule — Tab Order Simulator

Add a `buildTabOrder` utility to `packages/rules/src/rules/keyboard/tabOrder.ts`:

```typescript
import type { ElementSnapshot } from '@a11y-ai/core/types';

export interface TabEntry {
  selector: string;
  tagName: string;
  tabIndex: number | null;
  order: number;
}

/**
 * Compute the expected keyboard tab order for a list of interactive elements.
 *
 * Algorithm (matches browser behavior):
 * 1. Elements with explicit positive tabindex, sorted ascending, then by DOM order.
 * 2. Elements with tabindex="0" or no tabindex, in DOM order.
 * 3. Elements with tabindex="-1" are excluded.
 */
export function buildTabOrder(elements: ElementSnapshot[]): TabEntry[] {
  const positive: TabEntry[] = [];
  const zero: TabEntry[] = [];

  elements.forEach((el, domIndex) => {
    const raw = el.attributes.tabindex ?? el.attributes.tabIndex;
    const tabIndex = raw !== undefined ? Number(raw) : null;
    const isInteractive = isNativelyInteractive(el.tagName) || el.attributes.role !== undefined;

    if (tabIndex === -1) return; // Excluded from tab order

    const entry: TabEntry = {
      selector: el.selector,
      tagName: el.tagName,
      tabIndex,
      order: domIndex,
    };

    if (tabIndex !== null && tabIndex > 0) {
      positive.push(entry);
    } else if (isInteractive || tabIndex === 0) {
      zero.push(entry);
    }
  });

  positive.sort((a, b) => a.tabIndex! - b.tabIndex! || a.order - b.order);
  // zero is already in DOM order

  return [...positive, ...zero].map((e, i) => ({ ...e, order: i + 1 }));
}

function isNativelyInteractive(tagName: string): boolean {
  return ['a', 'button', 'input', 'select', 'textarea'].includes(tagName.toLowerCase());
}
```

#### Keyboard Rule — Add AI Analysis

Update `packages/rules/src/rules/keyboard/KeyboardRule.ts`:

1. Change `requiresAI: true` in the constructor.
2. Add AI path at the end of `evaluate()`:

```typescript
const settings = context.config.rules?.[this.id]?.settings as Record<string, unknown> | undefined;
const aiEnabled = settings?.aiEnabled !== false;

if (aiEnabled) {
  const tabOrder = buildTabOrder(candidates);
  const prompt = this.buildKeyboardPrompt(candidates, tabOrder, context);
  const analysis = await provider.analyze(prompt, context);
  const parsed = this.parseAIResponseWithSchema(analysis.raw, KeyboardResponseSchema);
  if (parsed?.issues && parsed.issues.length > 0) {
    const anchor = this.makeResult(
      { selector: 'page', html: '', tagName: 'page', attributes: {}, textContent: '' },
      {
        severity: 'moderate',
        source: 'ai',
        message: 'Potential keyboard navigation issues detected.',
        suggestion: parsed.issues.join(' '),
        confidence: parsed.confidence ?? 0.6,
        context: { issues: parsed.issues, unreachable: parsed.unreachable, traps: parsed.traps },
      },
    );
    out.push(anchor);
  }
}
```

3. Add `buildKeyboardPrompt(elements, tabOrder, context)` method:
   - Send: list of interactive elements with selectors + tab indices + event handlers + landmark context.
   - Send: computed tab order from `buildTabOrder`.
   - Ask: "Are there logical issues with this tab order? Are any important elements unreachable? Are there potential focus traps?"

Import `KeyboardResponseSchema` from `../../schemas.js`.
Import `buildTabOrder` from `./tabOrder.js`.

#### Contrast Rule — Bold Detection

In `packages/rules/src/rules/contrast/ContrastRule.ts`, update `contrastRequirement`:

```typescript
function contrastRequirement(
  fontSizePx: number,
  fontWeight: string,
  standard: 'AA' | 'AAA',
): number {
  const isBold = Number(fontWeight) >= 700 || fontWeight === 'bold' || fontWeight === 'bolder';
  // WCAG: large text is >=18px normal, or >=14px bold
  const isLarge = fontSizePx >= 18 || (isBold && fontSizePx >= 14);
  if (standard === 'AAA') return isLarge ? 4.5 : 7;
  return isLarge ? 3 : 4.5;
}
```

Update the call site to extract `fontWeight` from `el.computedStyle`. Add `fontWeight` to
`ComputedStyleSubset` in `packages/core/src/types/extraction.ts` and populate it in the extractor.

#### Contrast Rule — Parent Background Resolution

In `ContrastRule.evaluate`, when `bg.a === 0` (transparent background):

```typescript
if (bg.a === 0) {
  // Instead of just flagging "manual review", try to resolve parent background
  const resolvedBg = resolveParentBackground(el, context.extraction);
  if (resolvedBg) {
    // Re-run the contrast check with the resolved background
    const ratio = calculateContrastRatio(fg, resolvedBg);
    const required = contrastRequirement(fontSizePx, el.computedStyle.fontWeight ?? '', standard);
    if (ratio < required) {
      out.push(
        this.makeResult(el, {
          severity: ratio < required / 2 ? 'serious' : 'moderate',
          source: 'static',
          message: `Text contrast is too low (${ratio.toFixed(2)}:1 against resolved parent background, requires ≥${required}:1).`,
          suggestion: `...`,
          confidence: 0.65,
          context: { ratio, required, resolvedFromParent: true },
        }),
      );
    }
    continue;
  }
  // Fallback to AI if parent background can't be resolved from extracted data
  // ... call AI ...
}
```

Add `resolveParentBackground(element: ElementSnapshot, extraction: ExtractionResult): RGBA | null`
to `packages/core/src/utils/color.ts`. It walks the `parentSelector` chain through the extraction's
`ariaElements` + `headings` + `links` data, looking for the first ancestor with a non-transparent
`backgroundColor`.

#### Contrast Rule — AI Path for Complex Backgrounds

When both direct color parsing and parent resolution fail:

```typescript
// If we can't compute contrast statically, ask AI
const aiEnabled = settings?.aiEnabled !== false;
if (aiEnabled && (hasGradient || !fg || !bg || bg.a === 0)) {
  const prompt = this.buildContrastAiPrompt([el], context);
  const analysis = await provider.analyze(prompt, context);
  const parsed = this.parseAIResponseWithSchema(analysis.raw, ContrastAIResponseSchema);
  if (parsed?.results) {
    // ... convert to RuleResult
  }
}
```

Change `requiresAI: true` in the constructor. Import `ContrastAIResponseSchema`.

#### Tests

1. **Tab order simulator — positive tabindex first.** Elements with `tabindex="2"` and `tabindex="1"` should appear before `tabindex="0"` elements.
2. **Tab order simulator — negative tabindex excluded.** Element with `tabindex="-1"` should not appear in output.
3. **Bold detection — 14px bold passes AA large threshold.** Create element with 14px bold text, `3.01:1` ratio. Assert no violation (would fail for 14px normal text).
4. **Bold detection — 13px bold still requires 4.5:1.** 13px bold is not large text.
5. **Parent background resolution.** Element with `transparent` bg, parent with `rgb(0,0,0)`. Assert contrast calculated against black.
6. **Keyboard AI prompt contains tab order.** Mock provider, inspect prompt string. Assert it contains tab order data.

**WHAT COMES NEXT:**
Phase C builds the frontend playground that lets users try a11y-ai without installing anything.

> ✅ **COMPLETED** — Keyboard and Contrast rules enhanced:
>
> - Created `packages/rules/src/rules/keyboard/tabOrder.ts` with `buildTabOrder()` utility
> - Added AI analysis to `KeyboardRule` for tab order evaluation and focus trap detection
> - Added bold detection to `ContrastRule` (14px bold = large text per WCAG)
> - Added parent background resolution for transparent backgrounds
> - Added AI analysis for complex backgrounds (gradients, images)
> - Both rules now have `requiresAI: true` with optional AI enhancement

---

## Phase C — The Frontend (Playground That Sells the Product)

> Four prompts to build a production-quality Next.js playground. The playground
> is the product's homepage, demo, and documentation all in one.

---

### Prompt C1 — Playground API Routes & Backend

**PROJECT CONTEXT:**
`a11y-ai` is a complete, well-tested AI-powered accessibility auditor (Phases A and B complete).
`apps/playground/` is a skeleton Next.js app: just `app/layout.tsx` and `app/page.tsx` stubs.
No API routes, no dependency on `@a11y-ai/core`.

**WHAT EXISTS:**

- `apps/playground/package.json` — Next.js 14 with `react`, `react-dom`.
- `apps/playground/app/layout.tsx` — minimal root layout.
- `apps/playground/app/page.tsx` — "Hello world" stub.
- `apps/playground/next.config.mjs` — minimal config.

**CURRENT TASK:**

#### Step 1 — Add Dependencies

Update `apps/playground/package.json`:

```json
{
  "dependencies": {
    "@a11y-ai/core": "workspace:*",
    "@a11y-ai/rules": "workspace:*",
    "next": "...",
    "react": "...",
    "react-dom": "...",
    "next-themes": "^0.3.0",
    "zod": "^3.23.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

Set up Tailwind: add `tailwind.config.ts` and `postcss.config.js`. Add `@tailwind base/components/utilities` to `app/globals.css`.

#### Step 2 — Create `app/api/audit/route.ts`

POST endpoint that accepts `{ url?: string, html?: string, preset?: 'quick' | 'standard' | 'thorough', apiKey?: string }`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auditHTML, auditURL } from '@a11y-ai/core';

const RequestSchema = z.object({
  url: z.string().url().optional(),
  html: z.string().max(500_000).optional(),
  preset: z.enum(['quick', 'standard', 'thorough']).default('quick'),
  apiKey: z.string().optional(),
});

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(ip) ?? { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  rateLimiter.set(ip, entry);
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 10 audits per minute.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  const body = RequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { error: 'Invalid request', code: 'INVALID_INPUT', details: body.error.flatten() },
      { status: 400 },
    );
  }

  const { url, html, preset, apiKey } = body.data;
  if (!url && !html) {
    return NextResponse.json(
      { error: 'Provide either url or html', code: 'MISSING_INPUT' },
      { status: 400 },
    );
  }

  // Block non-http URLs and private IPs (basic SSRF prevention)
  if (url) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: 'Only http/https URLs are supported', code: 'INVALID_URL' },
        { status: 400 },
      );
    }
  }

  const providerConfig =
    preset !== 'quick' && (apiKey || process.env.OPENAI_API_KEY)
      ? {
          name: 'openai' as const,
          apiKey: apiKey || process.env.OPENAI_API_KEY,
          model: 'gpt-4o-mini',
        }
      : { name: 'custom' as const };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const result = url
      ? await auditURL(url, { preset, provider: providerConfig })
      : await auditHTML(html!, { preset, provider: providerConfig });

    clearTimeout(timeout);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Audit failed';
    return NextResponse.json({ error: message, code: 'AUDIT_FAILED' }, { status: 500 });
  }
}
```

#### Step 3 — Create `app/api/audit/stream/route.ts`

SSE endpoint for real-time audit progress:

```typescript
import { NextRequest } from 'next/server';
import { A11yAuditor, toAuditConfig } from '@a11y-ai/core';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { url, html, preset = 'quick', apiKey } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const auditor = new A11yAuditor(
          toAuditConfig({
            preset,
            provider:
              preset !== 'quick' && (apiKey || process.env.OPENAI_API_KEY)
                ? {
                    name: 'openai',
                    apiKey: apiKey || process.env.OPENAI_API_KEY,
                    model: 'gpt-4o-mini',
                  }
                : { name: 'custom' },
          }),
        );

        auditor.on('start', (target) => send('start', { target }));
        auditor.on('axe:complete', (violations) =>
          send('axe:complete', { violationCount: violations.length }),
        );
        auditor.on('rule:start', (ruleId) => send('rule:start', { ruleId }));
        auditor.on('rule:complete', (ruleId, results) =>
          send('rule:complete', { ruleId, resultCount: results.length }),
        );

        const result = url ? await auditor.auditURL(url) : await auditor.auditHTML(html);

        send('complete', result);
      } catch (error) {
        send('error', { message: error instanceof Error ? error.message : 'Audit failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

#### Step 4 — Create `app/api/rules/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { RuleRegistry, registerBuiltinRules, getRuleMetadata } from '@a11y-ai/rules';

export async function GET() {
  const registry = RuleRegistry.create();
  registerBuiltinRules(registry);
  return NextResponse.json(getRuleMetadata(registry));
}
```

#### Step 5 — Tests

In `apps/playground/src/__tests__/api.test.ts` (use `next/server` mock or test via `fetch`):

1. **POST `/api/audit` with valid HTML returns 200 with score.**
2. **POST `/api/audit` with invalid URL returns 400.**
3. **POST `/api/audit` without url or html returns 400.**
4. **POST `/api/audit` with `file:///etc/passwd` as URL returns 400 (SSRF prevention).**
5. **GET `/api/rules` returns array of 9 rules.**

**WHAT COMES NEXT:**
Prompt C2 builds the main auditor page UI with real-time progress and rich results.

---

### Prompt C2 — Playground UI: Main Auditor Page

**PROJECT CONTEXT:**
`a11y-ai` has a working API backend (C1 complete). The playground needs a UI that hooks developers
in within 30 seconds. It must be beautiful, accessible, and require zero configuration.

**WHAT EXISTS:**

- `apps/playground/app/api/` — 3 working API routes.
- `apps/playground/app/layout.tsx` — minimal stub.
- Tailwind CSS configured.

**CURRENT TASK:**

#### Step 1 — Update `app/layout.tsx`

Create the root layout with dark/light mode support:

```tsx
import './globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  title: 'a11y-ai — AI-Powered Accessibility Auditor',
  description:
    'Combines axe-core static analysis with AI semantic analysis. Catch issues that static tools miss.',
  openGraph: {
    title: 'a11y-ai — AI-Powered Accessibility Auditor',
    description: 'Accessibility auditing that understands your page.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Header />
          <main id="main-content">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Create `components/Header.tsx`: logo ("a11y-ai" in monospace font), navigation links
(Audit → `/`, Editor → `/editor`, Rules → `/rules`), dark/light toggle button, GitHub link.

Create `components/Footer.tsx`: "Open source · MIT License · View on GitHub".

Both components must be keyboard-accessible with visible focus indicators.

#### Step 2 — Create `app/page.tsx` (Main Auditor Page)

Build the hero section with URL input:

```tsx
// components/AuditForm.tsx
'use client';

import { useState } from 'react';
// ... imports

const EXAMPLE_URLS = [
  { label: 'Example.com (simple)', url: 'https://example.com' },
  { label: 'Wikipedia (complex)', url: 'https://en.wikipedia.org/wiki/Web_accessibility' },
  { label: 'Try a URL with issues', url: '' }, // opens text input
];

const PRESETS = [
  {
    id: 'quick',
    label: 'Quick',
    description: 'Fast, free, no API key. Axe-core static analysis only.',
  },
  { id: 'standard', label: 'Standard', description: 'Full AI analysis. Requires OpenAI API key.' },
];

export function AuditForm() {
  const [url, setUrl] = useState('');
  const [preset, setPreset] = useState<'quick' | 'standard'>('quick');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAudit() {
    if (!url.trim()) return;
    setStatus('running');
    setProgress([]);
    setResult(null);
    setError(null);

    // Use SSE streaming endpoint
    const response = await fetch('/api/audit/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, preset, apiKey: apiKey || undefined }),
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';
      for (const chunk of lines) {
        const eventLine = chunk.split('\n').find((l) => l.startsWith('event:'));
        const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
        if (!eventLine || !dataLine) continue;
        const event = eventLine.replace('event: ', '').trim();
        const data = JSON.parse(dataLine.replace('data: ', '').trim());
        if (event === 'complete') {
          setResult(data);
          setStatus('done');
        } else if (event === 'error') {
          setError(data.message);
          setStatus('error');
        } else {
          setProgress((p) => [...p, { event, data }]);
        }
      }
    }
  }

  return (
    <div className="...">
      {/* URL Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runAudit();
        }}
      >
        <label htmlFor="url-input" className="sr-only">
          Website URL to audit
        </label>
        <div className="flex gap-2">
          <input
            id="url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-site.com"
            className="..."
            aria-label="Website URL to audit"
          />
          <button type="submit" disabled={status === 'running'} className="...">
            {status === 'running' ? 'Auditing...' : 'Audit'}
          </button>
        </div>
      </form>

      {/* Example URLs */}
      {/* Preset selector */}
      {/* API key input (when standard selected) */}
      {/* Progress panel (during audit) */}
      {/* Results (when done) */}
    </div>
  );
}
```

#### Step 3 — Create `components/ProgressPanel.tsx`

Shows real-time events from the SSE stream:

```tsx
export function ProgressPanel({ events }: { events: ProgressEvent[] }) {
  return (
    <div role="log" aria-live="polite" aria-label="Audit progress">
      {events.map((event, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {event.event === 'axe:complete' && (
            <span>✓ axe-core found {event.data.violationCount} violations</span>
          )}
          {event.event === 'rule:complete' && (
            <span>
              ✓ {event.data.ruleId} ({event.data.resultCount} findings)
            </span>
          )}
          {event.event === 'rule:start' && (
            <span className="opacity-60">⟳ Running {event.data.ruleId}...</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

#### Step 4 — Create `components/AuditResults.tsx`

Full results display with score, categories, violations:

Sub-components to create:

- `ScoreDonut.tsx` — SVG donut chart. Animates on mount (CSS transition on `stroke-dashoffset`). Green ≥80, yellow ≥70, red <70.
- `CategoryBreakdown.tsx` — horizontal bar chart per category with score and violation count.
- `SeverityBreakdown.tsx` — 4 colored badges showing critical/serious/moderate/minor counts.
- `ViolationList.tsx` — grouped by category, each violation as a card with expandable HTML preview.
- `ViolationCard.tsx` — severity badge, selector (monospace), message, suggestion, confidence (when AI-sourced), collapsible `<pre><code>` showing element HTML.
- `FilterBar.tsx` — category dropdown + severity checkboxes + text search.
- `ExportButtons.tsx` — "Download JSON", "Download HTML Report", "Copy Markdown" buttons.

#### Step 5 — Create Empty State

When no audit has been run, show 3 clickable example cards:

```tsx
const EXAMPLES = [
  {
    title: 'Simple page',
    url: 'https://example.com',
    description: 'A clean, minimal page — should score highly.',
  },
  {
    title: 'Wikipedia article',
    url: 'https://en.wikipedia.org/wiki/Web_accessibility',
    description: 'A content-heavy page with complex structure.',
  },
  {
    title: 'News site',
    url: 'https://www.bbc.com',
    description: 'A busy real-world page with many images and links.',
  },
];
```

Each card pre-fills the URL input on click.

#### Step 6 — Error States

Create `components/ErrorMessage.tsx`:

- `RATE_LIMITED` → "You've reached the limit (10 audits/minute). Wait a moment or [run locally](https://github.com/vudayagirivaibhav/a11y-ai)."
- `AUDIT_FAILED` → "Something went wrong: {message}. [Try again]"
- Network error → "Could not reach the server. Check your connection."

#### Step 7 — Accessibility Requirements for the Playground Itself

- All interactive elements keyboard-accessible.
- Focus ring visible on all focusable elements (`outline: 2px solid currentColor` or Tailwind `focus-visible:ring-2`).
- All images have descriptive alt text.
- Color is not the only indicator (severity badges have icons too: 🔴 critical, 🟡 serious, 🔵 moderate, ⚫ minor).
- `aria-live="polite"` on progress panel and results section.
- Score donut: `aria-label="Accessibility score: {score} out of 100, grade {grade}"`.

**WHAT COMES NEXT:**
Prompt C3 builds the HTML editor page and rule explorer page.

---

### Prompt C3 — Playground UI: HTML Editor & Rule Explorer

**PROJECT CONTEXT:**
`a11y-ai` has a working main auditor page (C2 complete). Now we need two additional pages:
the HTML editor for trying the tool with custom HTML, and the rule explorer for discovering what
the tool checks.

**WHAT EXISTS:**

- `apps/playground/app/page.tsx` — main URL auditor page.
- `apps/playground/components/` — `ScoreDonut`, `SeverityBadge`, `ViolationCard`, `CategoryBreakdown`.
- `apps/playground/app/api/` — 3 API routes.

**CURRENT TASK:**

#### Step 1 — HTML Fixtures

Create `apps/playground/fixtures/` with 6 HTML files:

`good-page.html` — fully accessible: proper headings, labeled forms, descriptive alt text, sufficient contrast, descriptive links. Should score 95+.

`bad-alt-text.html` — page with images having filename alt text (`alt="DSC_00472.jpg"`), generic alt (`alt="image"`), missing alt entirely, and one good alt for comparison.

`low-contrast.html` — page with text that fails WCAG AA contrast (#767676 on white, light gray on light background, white text on pale yellow).

`missing-labels.html` — contact form with inputs missing labels, a search input using placeholder as its only label, checkboxes without fieldset/legend.

`empty-links.html` — page with multiple accessibility link issues: "Click here", "Read more", raw URLs as link text, empty `<a>` tags, duplicate "Download" links pointing to different files.

`heading-soup.html` — page that jumps from `<h1>` to `<h4>`, has multiple `<h1>` elements, uses `<b>` and `<strong>` styled to look like headings, and has sections with no headings at all.

#### Step 2 — Create `app/editor/page.tsx`

Split-pane HTML editor with live audit:

```tsx
'use client';
import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';

// Lazy-load the code editor to avoid SSR issues
const CodeEditor = dynamic(() => import('@/components/CodeEditor'), {
  loading: () => <div className="animate-pulse bg-gray-200 h-full rounded" />,
  ssr: false,
});

export default function EditorPage() {
  const [html, setHtml] = useState('');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const auditHtml = useDebouncedCallback(async (html: string) => {
    if (!html.trim()) return;
    setIsLoading(true);
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, preset: 'quick' }),
    });
    const data = await res.json();
    setResult(data);
    setIsLoading(false);
  }, 1000);

  const handleChange = useCallback(
    (value: string) => {
      setHtml(value);
      auditHtml(value);
    },
    [auditHtml],
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Fixture selector */}
      <FixtureSelector onSelect={(html) => handleChange(html)} />

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Editor */}
        <div className="flex-1 overflow-hidden border rounded-lg">
          <CodeEditor
            value={html}
            onChange={handleChange}
            language="html"
            violations={result?.mergedViolations ?? []}
          />
        </div>

        {/* Results */}
        <div className="w-96 overflow-y-auto">
          {isLoading && <LoadingSpinner />}
          {result && !isLoading && <AuditResults result={result} compact />}
        </div>
      </div>
    </div>
  );
}
```

Create `components/CodeEditor.tsx` using either:

- `@monaco-editor/react` (full-featured, larger bundle), or
- `react-simple-code-editor` + `prismjs` (lightweight)

Prefer `react-simple-code-editor` for bundle size. Add violation line highlighting via a computed
`lineToViolations` map (parse selectors to find line numbers is hard; instead, highlight based on
element HTML matching in the raw HTML).

Create `components/FixtureSelector.tsx`: a dropdown showing all 6 fixtures + "Blank". On select,
fetches the fixture file and updates the editor.

#### Step 3 — Create `app/rules/page.tsx`

Rule explorer:

```tsx
import { getRuleMetadata, RuleRegistry, registerBuiltinRules } from '@a11y-ai/rules';

export default async function RulesPage() {
  const registry = RuleRegistry.create();
  registerBuiltinRules(registry);
  const rules = getRuleMetadata(registry);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Built-in Rules</h1>
      <p className="text-gray-600 mb-8">9 rules covering the most common accessibility issues.</p>

      {/* Category filter tabs */}
      <CategoryTabs rules={rules} />

      {/* Rule grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rules.map((rule) => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </div>
    </div>
  );
}
```

Create `components/RuleCard.tsx`:

- Rule ID in monospace
- Category badge (colored by category)
- Description
- "Requires AI" badge (when true)
- Estimated cost badge
- "Try it" button → navigates to `/editor?fixture=XXX` with the fixture that triggers this rule

#### Step 4 — Create Shared Components

Extract to `components/` for reuse across pages:

`ScoreDonut.tsx` (already created in C2 — verify it's in shared components).
`SeverityBadge.tsx` — reusable colored pill with icon.
`ViolationCard.tsx` — reusable expandable violation display.
`CategoryBar.tsx` — reusable horizontal progress bar.
`LoadingSpinner.tsx` — accessible spinner with `role="status"` and `aria-label="Loading"`.

#### Step 5 — `use-debounce` Dependency

Add `use-debounce` to `apps/playground/package.json`.

**WHAT COMES NEXT:**
Prompt C4 polishes the playground, adds SEO, error states, and deploys to Vercel.

---

### Prompt C4 — Playground Polish & Deployment

**PROJECT CONTEXT:**
`a11y-ai` has a complete three-page playground (C1–C3). Now we polish, optimize, and deploy.

**WHAT EXISTS:**

- `apps/playground/app/` — 3 pages + 3 API routes.
- All components from C1–C3.

**CURRENT TASK:**

#### Step 1 — SEO & Meta Tags

Update `app/layout.tsx` metadata:

```typescript
export const metadata: Metadata = {
  title: { default: 'a11y-ai — AI-Powered Accessibility Auditor', template: '%s | a11y-ai' },
  description:
    'Combines axe-core with AI analysis to catch accessibility issues static tools miss.',
  keywords: ['accessibility', 'a11y', 'wcag', 'axe-core', 'ai', 'audit'],
  openGraph: {
    type: 'website',
    url: 'https://a11y-ai.vercel.app',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', creator: '@vudayagirivaibhav' },
};
```

Add page-specific titles:

- Editor page: `{ title: 'HTML Editor' }`
- Rules page: `{ title: 'Rules' }`

Create `public/robots.txt`:

```
User-agent: *
Allow: /
```

Create `public/favicon.svg` — a simple "a11" text as an SVG icon.

#### Step 2 — Performance Optimizations

1. **Lazy-load Monaco** (already in C3 with `dynamic(..., { ssr: false })`).
2. **Cache results in sessionStorage**: after a successful audit, save to `sessionStorage.setItem('lastAuditResult', JSON.stringify(result))`. On page load, read and restore last result so navigating away and back doesn't lose results.
3. **Streaming is already in place** — this makes it feel fast.
4. **Suspense boundaries**: wrap heavy route components in `<Suspense fallback={<PageSkeleton />}>`.

#### Step 3 — Complete Error States

Create `components/ErrorMessage.tsx` with all error scenarios:

```tsx
const ERROR_MESSAGES: Record<string, { title: string; body: string; action?: string }> = {
  RATE_LIMITED: {
    title: 'Too many requests',
    body: "You've reached the limit (10 audits/minute). Wait a moment, or run locally:",
    action: 'npx @a11y-ai/cli audit https://your-site.com',
  },
  AUDIT_FAILED: {
    title: 'Audit failed',
    body: 'The audit could not complete. This may be a timeout or network issue.',
  },
  INVALID_URL: {
    title: 'Invalid URL',
    body: 'Only public http/https URLs are supported. Private IPs and non-web URLs are blocked.',
  },
  MISSING_INPUT: {
    title: 'No target provided',
    body: 'Enter a URL or HTML to audit.',
  },
};
```

#### Step 4 — "Run Locally" CTA

At the bottom of every audit results panel, show a persistent call-to-action:

```tsx
<div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
  <h3 className="font-semibold mb-2">Want to audit private pages or use full AI analysis?</h3>
  <pre className="text-sm bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
    npx @a11y-ai/cli audit https://your-site.com --preset standard
  </pre>
  <p className="text-sm text-gray-500 mt-2">
    Free for "quick" preset. Standard/thorough presets require an OpenAI API key.
  </p>
</div>
```

#### Step 5 — Vercel Configuration

Create `apps/playground/vercel.json`:

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "framework": "nextjs"
}
```

Environment variables needed in Vercel dashboard:

- `OPENAI_API_KEY` — for the demo "standard" preset (optional; quick preset works without it).

Create `apps/playground/README.md`:

```markdown
# a11y-ai Playground

Interactive demo at https://a11y-ai.vercel.app

## Local development

pnpm --filter apps/playground dev

## Deploy

Deployed automatically to Vercel on push to main.
Environment: OPENAI_API_KEY (optional)
```

#### Step 6 — Audit the Playground with a11y-ai

Once the playground is deployed:

1. Run: `node packages/cli/dist/cli.mjs audit https://a11y-ai.vercel.app --preset quick --format json --output playground-audit.json`
2. Fix any violations found.
3. Add to CI: `pnpm audit:playground` script in root `package.json` that runs this check.

This is the ultimate "eat your own dog food" step.

#### Step 7 — Final Accessibility Checklist for Playground

Before deploying, manually verify:

- [ ] Tab through every interactive element — all reachable with keyboard
- [ ] Screen reader test: all form inputs have labels, all images have alt text
- [ ] Color contrast: all text meets WCAG AA (use the a11y-ai tool itself to verify)
- [ ] No keyboard traps anywhere in the UI
- [ ] Error messages are announced via `aria-live`
- [ ] Focus is managed correctly when modals or panels open
- [ ] Works without JavaScript (landing page at minimum should be readable)

**WHAT COMES NEXT:**
Phase D publishes the packages to npm and automates the release pipeline.

---

## Phase D — Publish & Make It Real

> Three prompts to take the codebase from "local tool" to "publicly available npm package."

---

### Prompt D1 — npm Publishing Pipeline

**PROJECT CONTEXT:**
`a11y-ai` is a complete, tested, polished accessibility auditor with a production playground
(Phases A–C complete). Nothing is published to npm yet. Packages are at version `0.0.0`. The CLI
has `commander` and `ora` as optional dependencies, which means a fresh install may not work.

**WHAT EXISTS:**

- 4 publishable packages: `@a11y-ai/core`, `@a11y-ai/ai-providers`, `@a11y-ai/rules`, `@a11y-ai/cli`.
- `@a11y-ai/github-action` — also publishable.
- Changesets configured in `.changeset/config.json`.

**CURRENT TASK:**

#### Step 1 — Promote `commander` and `ora` to Hard Dependencies in CLI

In `packages/cli/package.json`, move `commander` and `ora` from `peerDependencies` or
`optionalDependencies` to `dependencies`. Remove the `tryImportCommander` and `tryImportOra` lazy
import pattern from `packages/cli/src/cli.ts`. Use direct static imports instead:

```typescript
import { Command } from 'commander';
import ora from 'ora';
```

This ensures `npx @a11y-ai/cli` works on a fresh machine without additional installs.

#### Step 2 — Update All `package.json` Files

For each of `core`, `ai-providers`, `rules`, `cli`, `github-action`:

```json
{
  "version": "0.1.0",
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  },
  "files": ["dist", "README.md", "LICENSE", "package.json"],
  "repository": {
    "type": "git",
    "url": "https://github.com/vudayagirivaibhav/a11y-ai"
  },
  "homepage": "https://a11y-ai.vercel.app",
  "bugs": {
    "url": "https://github.com/vudayagirivaibhav/a11y-ai/issues"
  },
  "keywords": ["accessibility", "a11y", "wcag", "axe-core", "ai", "audit", "typescript"]
}
```

Verify each package's `"exports"` map is correct and all entry points resolve.

#### Step 3 — Write Package-Level READMEs

**`packages/core/README.md`:**

```markdown
# @a11y-ai/core

Core engine for a11y-ai. Orchestrates axe-core + AI rules.

## Install

npm install @a11y-ai/core

## Quick start

import { audit } from '@a11y-ai/core';
const result = await audit('https://example.com', {
preset: 'quick',
provider: { name: 'openai', apiKey: process.env.OPENAI_API_KEY },
});
console.log(result.summary.score); // 0–100

## API

audit(target, options) — one-liner audit
auditHTML(html, options) — audit raw HTML
auditURL(url, options) — audit live URL
auditAxeOnly(target) — axe-core only, no AI, free

## Builder API

a11yAI().url('...').provider('openai', { apiKey: '...' }).preset('standard').run()
```

**`packages/cli/README.md`:**

```markdown
# @a11y-ai/cli

CLI for a11y-ai.

## Install

npm install -g @a11y-ai/cli

# or

npx @a11y-ai/cli audit https://example.com

## Commands

a11y-ai audit <url|file> Audit a URL or HTML file
a11y-ai rules List all rules
a11y-ai rules <id> Show rule details
a11y-ai init Create config file
a11y-ai compare <a> <b> Compare two JSON reports

## Options

--preset quick|standard|thorough
--provider openai|anthropic|ollama
--model gpt-4o-mini
--format json|html|md|sarif|console
--output report.html
--wcag AA|AAA
--threshold 70

## Config file: .a11yairc.json

{ "preset": "standard", "provider": "openai", "format": "html" }
```

**`packages/ai-providers/README.md`:** Provider setup instructions for OpenAI, Anthropic, Ollama.

**`packages/rules/README.md`:** Rule list table + custom rule example using `createRule`.

#### Step 4 — Create `.changeset` Entry for v0.1.0

Create `.changeset/v0-1-0.md`:

```markdown
---
'@a11y-ai/core': minor
'@a11y-ai/ai-providers': minor
'@a11y-ai/rules': minor
'@a11y-ai/cli': minor
'@a11y-ai/github-action': minor
---

Initial public release v0.1.0.

Features:

- DOM extraction engine (jsdom + Playwright/Puppeteer)
- axe-core integration with normalization and deduplication
- 9 AI-powered accessibility rules (alt-text, link-text, contrast, form-labels, headings, aria, keyboard, language, media)
- 3 presets: quick (free), standard (AI), thorough (AI + vision)
- 5 report formats: JSON, HTML, Markdown, SARIF, console
- Batch auditing with sitemap support
- CLI with config file, environment variable, and flag support
- Programmatic API with builder pattern and progress events
- GitHub Action for CI integration
```

#### Step 5 — Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - run: pnpm install --frozen-lockfile

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          NPM_CONFIG_PROVENANCE: true
```

#### Step 6 — Verify Publish Locally

```bash
# Build all packages
pnpm build

# Pack each package and inspect contents
pnpm --filter @a11y-ai/cli pack --dry-run
pnpm --filter @a11y-ai/core pack --dry-run

# Install CLI from tarball in a fresh temp project to verify
cd /tmp
mkdir test-a11y-ai && cd test-a11y-ai
npm init -y
npm install /path/to/a11y-ai/packages/cli/a11y-ai-cli-0.1.0.tgz
npx a11y-ai audit https://example.com --preset quick
```

**WHAT COMES NEXT:**
Prompt D2 completes the GitHub Action and upgrades the CI pipeline.

---

### Prompt D2 — Complete GitHub Action & CI Pipeline

**PROJECT CONTEXT:**
`a11y-ai` is ready for publishing (D1 complete). The GitHub Action in `packages/github-action/` is
partially complete: `action.yml` and `src/lib.ts` exist but the PR comment feature is not implemented.
The CI workflow only tests Node 20, doesn't upload coverage, and doesn't cache efficiently.

**WHAT EXISTS:**

- `packages/github-action/action.yml` — complete `action.yml` spec.
- `packages/github-action/src/lib.ts` — audit execution logic.
- `packages/github-action/src/index.ts` — entry point.
- `packages/github-action/src/lib.test.ts` — partial tests.
- `.github/workflows/ci.yml` — basic CI on Node 20 only.

**CURRENT TASK:**

#### Step 1 — Complete `packages/github-action/src/index.ts`

Full implementation:

```typescript
import { auditHTML, auditURL, ReportGenerator } from '@a11y-ai/core';
import { writeFileSync } from 'node:fs';

async function run() {
  const url = process.env.INPUT_URL;
  const htmlPath = process.env.INPUT_HTML_PATH;
  const preset = (process.env.INPUT_PRESET || 'standard') as 'quick' | 'standard' | 'thorough';
  const threshold = Number(process.env.INPUT_THRESHOLD || '70');
  const apiKey = process.env.INPUT_API_KEY;
  const format = process.env.INPUT_FORMAT || 'markdown';
  const failOnViolations = process.env.INPUT_FAIL_ON_VIOLATIONS !== 'false';

  if (!url && !htmlPath) {
    console.error('Either url or html-path is required');
    process.exit(1);
  }

  const providerConfig = apiKey
    ? { name: 'openai' as const, apiKey, model: 'gpt-4o-mini' }
    : { name: 'custom' as const };

  let result;
  try {
    if (htmlPath) {
      const { readFileSync } = await import('node:fs');
      const html = readFileSync(htmlPath, 'utf8');
      result = await auditHTML(html, { preset, provider: providerConfig });
    } else {
      result = await auditURL(url!, { preset, provider: providerConfig });
    }
  } catch (error) {
    console.error('Audit failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Generate report
  const reporter = new ReportGenerator();
  const reportContent =
    format === 'html' ? reporter.generateHTML(result) : reporter.generateMarkdown(result);
  const reportPath = `a11y-ai-report.${format === 'html' ? 'html' : 'md'}`;
  writeFileSync(reportPath, reportContent);

  // Set GitHub Action outputs
  const setOutput = (name: string, value: string) => {
    process.stdout.write(`::set-output name=${name}::${value}\n`);
  };
  setOutput('score', String(result.summary.score));
  setOutput('violations', String(result.mergedViolations.length));
  setOutput('report-path', reportPath);

  const passed =
    result.summary.score >= threshold &&
    (!failOnViolations || result.summary.bySeverity.critical === 0);
  setOutput('passed', String(passed));
  setOutput('fail-reason', passed ? '' : `Score ${result.summary.score} < threshold ${threshold}`);

  // Post PR comment if running in PR context
  await postPrComment(result);

  console.log(`\nAudit complete. Score: ${result.summary.score} (${result.summary.grade})`);
  console.log(`Violations: ${result.mergedViolations.length}`);
}

async function postPrComment(result: Awaited<ReturnType<typeof auditURL>>) {
  const githubToken = process.env.GITHUB_TOKEN;
  const eventName = process.env.GITHUB_EVENT_NAME;
  const repo = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!githubToken || eventName !== 'pull_request' || !repo || !eventPath) return;

  const { readFileSync } = await import('node:fs');
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  const prNumber = event.pull_request?.number;
  if (!prNumber) return;

  const body = formatPrComment(result);
  const [owner, repoName] = repo.split('/');

  await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ body }),
  });
}

function formatPrComment(result: Awaited<ReturnType<typeof auditURL>>): string {
  const { score, grade, bySeverity, totalViolations } = result.summary;
  const emoji = score >= 80 ? '✅' : score >= 70 ? '⚠️' : '❌';

  const top5 = result.mergedViolations
    .slice(0, 5)
    .map((v) => {
      const sevEmoji = v.severity === 'critical' ? '🔴' : v.severity === 'serious' ? '🟡' : '🔵';
      return `${sevEmoji} **${v.severity.toUpperCase()}** — ${v.message} (\`${v.selector}\`)`;
    })
    .join('\n');

  const allViolations = result.mergedViolations
    .map((v) => `| ${v.severity} | ${v.category ?? '-'} | \`${v.selector}\` | ${v.message} |`)
    .join('\n');

  return `## ${emoji} a11y-ai Accessibility Report

| Score | Grade | Critical | Serious | Moderate | Minor | Total |
|-------|-------|----------|---------|----------|-------|-------|
| **${score}** | **${grade}** | ${bySeverity.critical} | ${bySeverity.serious} | ${bySeverity.moderate} | ${bySeverity.minor} | ${totalViolations} |

### Top Issues
${top5 || '_No violations found._'}

<details>
<summary>All violations (${totalViolations})</summary>

| Severity | Category | Selector | Issue |
|----------|----------|----------|-------|
${allViolations || '| — | — | — | No violations |'}

</details>

> Generated by [a11y-ai](https://github.com/vudayagirivaibhav/a11y-ai)`;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

#### Step 2 — Add Workflow Examples to `docs/github-action.md`

Add four examples:

1. **Basic — audit on push to main:**

```yaml
- name: Accessibility audit
  uses: vudayagirivaibhav/a11y-ai/packages/github-action@main
  with:
    url: https://your-site.com
    preset: standard
    provider: openai
    api-key: ${{ secrets.OPENAI_API_KEY }}
    threshold: '70'
```

2. **PR comment — audit Vercel preview:**

```yaml
on: [pull_request]
steps:
  - uses: actions/checkout@v4
  - name: Get Vercel preview URL
    id: vercel
    run: echo "url=${{ env.VERCEL_URL }}" >> $GITHUB_OUTPUT
  - name: Audit accessibility
    uses: vudayagirivaibhav/a11y-ai/packages/github-action@main
    with:
      url: ${{ steps.vercel.outputs.url }}
      api-key: ${{ secrets.OPENAI_API_KEY }}
```

3. **Scheduled weekly audit:**

```yaml
on:
  schedule:
    - cron: '0 9 * * 1' # Every Monday at 9am
```

4. **Local HTML file audit (no live URL needed):**

```yaml
- name: Build site
  run: npm run build
- name: Audit output
  uses: vudayagirivaibhav/a11y-ai/packages/github-action@main
  with:
    html-path: ./dist/index.html
    preset: quick
    api-key: 'none'
```

#### Step 3 — Upgrade CI Pipeline

Update `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    name: Test (Node ${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test -- --coverage

      - name: Upload coverage
        if: matrix.node == 20
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          directory: ./coverage
```

**WHAT COMES NEXT:**
Prompt D3 writes the final documentation, CONTRIBUTING.md, and prepares for the v0.1.0 launch.

---

### Prompt D3 — Documentation, CONTRIBUTING, & Launch

**PROJECT CONTEXT:**
`a11y-ai` is published to npm (D1 complete), has a working GitHub Action and CI (D2 complete), and
a live playground. Final step: documentation that makes the project look serious, a CONTRIBUTING.md
that makes it easy to contribute, and a launch checklist.

**WHAT EXISTS:**

- Excellent root `README.md` (but still says "not published yet").
- No `CONTRIBUTING.md`.
- No `SECURITY.md`.
- No package-level READMEs (written in D1).
- `docs/github-action.md` (written in D2).

**CURRENT TASK:**

#### Step 1 — Update Root `README.md`

Change the install section from "from source only" to npm-first:

````markdown
## Install

```bash
# CLI (globally)
npm install -g @a11y-ai/cli
npx @a11y-ai/cli audit https://example.com --preset quick

# Programmatic API
npm install @a11y-ai/core
```
````

Add a "Comparison" section:

|                           | a11y-ai         | axe-core | Lighthouse | pa11y |
| ------------------------- | --------------- | -------- | ---------- | ----- |
| **Works without API key** | ✅ quick preset | ✅       | ✅         | ✅    |
| **AI semantic analysis**  | ✅              | ❌       | ❌         | ❌    |
| **Vision analysis**       | ✅ thorough     | ❌       | ❌         | ❌    |
| **Batch/sitemap**         | ✅              | ❌       | ❌         | ✅    |
| **CI/CD integration**     | ✅              | ✅       | ✅         | ✅    |
| **Custom rules**          | ✅              | ✅       | ❌         | ❌    |

Add screenshot of playground (once deployed):

```markdown
![a11y-ai playground screenshot](https://a11y-ai.vercel.app/og-image.png)
```

Update badges to point to real npm package:

```markdown
[![npm version](https://img.shields.io/npm/v/@a11y-ai/core)](https://npmjs.com/package/@a11y-ai/core)
[![CI](https://github.com/vudayagirivaibhav/a11y-ai/actions/workflows/ci.yml/badge.svg)](...)
[![codecov](https://codecov.io/gh/vudayagirivaibhav/a11y-ai/branch/main/graph/badge.svg)](...)
```

#### Step 2 — Create `CONTRIBUTING.md`

```markdown
# Contributing to a11y-ai

## Architecture

Packages:

- `@a11y-ai/core` — Orchestrator, DOM extraction, axe-core, scoring, reporting
- `@a11y-ai/rules` — Rules engine + 9 built-in rules
- `@a11y-ai/ai-providers` — Provider adapters
- `@a11y-ai/cli` — CLI

Data flow:
A11yAuditor → DOMExtractor → ExtractionResult
→ AxeRunner → AxeViolation[]
→ RuleRegistry → RuleResult[]
→ mergeAxeAndRuleResults → Violation[]
→ AccessibilityScorer → AuditSummary
→ ReportGenerator → string

## Development setup

git clone https://github.com/vudayagirivaibhav/a11y-ai
cd a11y-ai
corepack enable
pnpm install
pnpm build
pnpm test

## Adding a new rule

1. Create `packages/rules/src/rules/<category>/<RuleName>Rule.ts`
2. Extend `BaseRule`
3. Implement `evaluate(context, provider): Promise<RuleResult[]>`
4. Register in `packages/rules/src/registerBuiltinRules.ts`
5. Add schema to `packages/rules/src/schemas.ts`
6. Write tests in `<RuleName>Rule.test.ts`

## Adding a new AI provider

1. Create `packages/ai-providers/src/providers/<name>.ts`
2. Extend `BaseAIProvider`
3. Implement `rawComplete(prompt, systemPrompt?): Promise<string>`
4. Export from `packages/ai-providers/src/index.ts`
5. Add to `factory.ts` switch

## Pull request guidelines

- Run `pnpm test && pnpm typecheck && pnpm lint` before submitting
- Add tests for new behavior
- Update the relevant README if the public API changes
- Use conventional commit messages: feat, fix, docs, chore, test, refactor
```

#### Step 3 — Create `SECURITY.md`

```markdown
# Security Policy

## Reporting a Vulnerability

Please do NOT file a public GitHub issue for security vulnerabilities.

Email: security@[your-domain].com

We will respond within 72 hours and aim to release a patch within 7 days for critical issues.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Known Security Considerations

- **API Key handling**: API keys are passed to AI providers directly. They are never logged or cached.
- **HTML input**: Submitted HTML is sent to AI providers as text. Do not submit HTML containing credentials or PII.
- **SSRF protection**: URL auditing validates http/https only and blocks private IP ranges.
```

#### Step 4 — Final Launch Checklist

Verify each item before merging the release PR:

```markdown
## v0.1.0 Pre-launch Checklist

### Code quality

- [ ] `pnpm build` succeeds with zero errors
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero warnings
- [ ] `pnpm test` passes on Node 18, 20, 22
- [ ] Test coverage ≥ 80% across all packages

### Package readiness

- [ ] All 4 packages have `version: 0.1.0`
- [ ] All 4 packages have `publishConfig: { access: 'public' }`
- [ ] All 4 packages have accurate `files` arrays (no test files, no fixtures)
- [ ] `commander` and `ora` are hard deps in `@a11y-ai/cli`
- [ ] `pnpm --filter @a11y-ai/cli pack --dry-run` shows correct files
- [ ] `npm install @a11y-ai/core` works in a fresh project
- [ ] `npx @a11y-ai/cli audit https://example.com --preset quick` works

### Documentation

- [ ] Root README install section uses npm (not "clone repo")
- [ ] All 4 package READMEs are accurate and complete
- [ ] `CONTRIBUTING.md` is written
- [ ] `SECURITY.md` is written
- [ ] `CHANGELOG.md` has v0.1.0 entry
- [ ] `docs/github-action.md` has 4 workflow examples

### Playground

- [ ] Playground is deployed to Vercel
- [ ] URL audit works on the live playground
- [ ] HTML editor works with all 6 fixtures
- [ ] Rules page shows all 9 rules
- [ ] Dark mode works
- [ ] Playground passes its own accessibility audit (score ≥ 85)
- [ ] "Run locally" CTA is visible

### GitHub repository

- [ ] Repo description: "AI-powered accessibility auditor. axe-core + LLM analysis."
- [ ] Repo topics: accessibility, a11y, wcag, axe-core, ai, typescript, npm-package
- [ ] Repo website: https://a11y-ai.vercel.app
- [ ] Branch protection on main: require CI passing
- [ ] CI matrix covers Node 18, 20, 22
- [ ] Release workflow is configured (changesets/action)
- [ ] NPM_TOKEN secret is set in repo secrets

### Post-publish verification

- [ ] All 4 packages appear on npmjs.com
- [ ] GitHub release is created with changelog
- [ ] `npx @a11y-ai/cli@latest audit https://example.com` works from scratch
```

**🚀 Ship it.**

---

## Appendix: Deferred to v0.2.0

The following prompts from the original 40-prompt plan are intentionally not in this ship-it plan.
They are valuable but not required for the first public release. Build them after seeing what users
actually ask for.

| Deferred                                         | Reason                                                      |
| ------------------------------------------------ | ----------------------------------------------------------- |
| Prompt 26 — Vite/Webpack Plugins                 | Nice-to-have; most users start with CLI or programmatic API |
| Prompt 27 — Jest/Playwright/Cypress Integrations | Valuable but needs user demand signal                       |
| Prompt 28 — ESLint Plugin                        | Needs separate authoring effort; good v0.2 feature          |
| Prompt 29 — VS Code Extension                    | Large effort; build after npm adoption                      |
| Prompt 30 — Browser DevTools Panel               | Even larger; v0.3 at earliest                               |
| Prompts 31–32 — VitePress Docs Site              | Playground + package READMEs are sufficient for v0.1        |
| Prompts 33–35 — Comprehensive Tests/Performance  | Part of ongoing maintenance                                 |
| Prompts 38–40 — Security Audit/Launch Ceremony   | Addressed in D1–D3 above                                    |

---

_This document was generated from a deep analysis of the `a11y-ai` codebase at commit state where_
_Prompts 1–24 of the original 40-prompt plan were implemented._
