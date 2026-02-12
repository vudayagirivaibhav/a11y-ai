/**
 * Approximate token counting utility.
 *
 * Tokenization differs per provider/model. As a conservative approximation,
 * we assume ~4 characters per token for English-like text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Trim a string to an approximate token budget.
 */
export function trimToTokens(text: string, maxTokens: number): string {
  const budget = Math.max(0, Math.floor(maxTokens * 4));
  if (text.length <= budget) return text;
  return `${text.slice(0, Math.max(0, budget - 1))}…`;
}

