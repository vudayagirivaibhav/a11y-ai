/**
 * Run async work items with a fixed concurrency limit.
 *
 * This is a tiny utility used by `BatchAuditor` so we don't need an external
 * dependency like `p-limit`.
 */
export async function runWithConcurrency<TItem, TResult>(options: {
  items: readonly TItem[];
  concurrency: number;
  worker: (item: TItem, index: number) => Promise<TResult>;
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<TResult[]> {
  const total = options.items.length;
  const concurrency = Math.max(1, Math.floor(options.concurrency || 1));

  const results: TResult[] = new Array(total);
  let nextIndex = 0;
  let completed = 0;

  const runOne = async (): Promise<void> => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= total) return;

      results[current] = await options.worker(options.items[current]!, current);

      completed += 1;
      options.onProgress?.({ completed, total });
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => runOne());
  await Promise.all(workers);
  return results;
}
