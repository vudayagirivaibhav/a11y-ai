import { auditHTML } from '@a11y-ai/core';

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>a11y-ai playground</title>
  </head>
  <body>
    <h1>a11y-ai playground</h1>
    <p>
      This page exists to manually exercise the audit engine during development.
      It intentionally includes a couple of issues.
    </p>

    <img src="/logo.png" />
    <a href="https://example.com">click here</a>
  </body>
</html>`;

export default async function Page() {
  const result = await auditHTML(SAMPLE_HTML, {
    provider: { name: 'custom', handler: async () => ({ content: '{"results":[]}' }) },
    preset: 'quick',
  });

  return (
    <main>
      <h2>Audit Result</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result.summary, null, 2)}</pre>
    </main>
  );
}
