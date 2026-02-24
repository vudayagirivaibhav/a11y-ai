export type Inputs = {
  url?: string;
  htmlPath?: string;
  preset: string;
  threshold: number;
  provider: string;
  apiKey: string;
  format: string;
  failOnViolations: boolean;
};

/**
 * Read action inputs from the environment.
 *
 * GitHub Actions maps inputs to env vars like `INPUT_URL`, `INPUT_API_KEY`, etc.
 */
export function readInputsFromEnv(env: NodeJS.ProcessEnv): Inputs {
  const url = readInput(env, 'url');
  const htmlPath = readInput(env, 'html_path') || readInput(env, 'html-path');

  return {
    url: url || undefined,
    htmlPath: htmlPath || undefined,
    preset: readInput(env, 'preset') || 'standard',
    threshold: Number(readInput(env, 'threshold') || '70'),
    provider: readInput(env, 'provider') || 'openai',
    apiKey: readInput(env, 'api_key') || readInput(env, 'api-key') || '',
    format: readInput(env, 'format') || 'markdown',
    failOnViolations:
      (readInput(env, 'fail_on_violations') || readInput(env, 'fail-on-violations') || 'true') ===
      'true',
  };
}

function readInput(env: NodeJS.ProcessEnv, name: string): string {
  const envName = `INPUT_${name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
  return (env[envName] ?? '').trim();
}
