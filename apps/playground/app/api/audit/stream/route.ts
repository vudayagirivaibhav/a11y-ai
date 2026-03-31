/**
 * Server-Sent Events endpoint for real-time audit progress.
 *
 * Streams audit events as they happen, allowing the UI to show
 * progress indicators for each phase of the audit.
 */
import { NextRequest } from 'next/server';

import { A11yAuditor, toAuditConfig } from '@a11y-ai/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function demoAiHandler(): Promise<{ content: string }> {
  return { content: JSON.stringify({ findings: [] }) };
}

function isPrivateIP(hostname: string): boolean {
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];
  return privatePatterns.some((pattern) => pattern.test(hostname));
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.json().catch(() => ({}));
  const {
    url,
    html,
    preset = 'quick',
    apiKey,
  } = body as {
    url?: string;
    html?: string;
    preset?: 'quick' | 'standard' | 'thorough';
    apiKey?: string;
  };

  if (!url && !html) {
    return new Response(JSON.stringify({ error: 'Provide either url or html' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateIP(parsed.hostname)) {
        return new Response(JSON.stringify({ error: 'Invalid or blocked URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown): void => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const providerConfig =
          preset !== 'quick' && (apiKey || process.env.OPENAI_API_KEY)
            ? {
                name: 'openai' as const,
                apiKey: apiKey || process.env.OPENAI_API_KEY,
                model: 'gpt-4o-mini',
              }
            : { name: 'custom' as const, handler: demoAiHandler };

        const auditor = new A11yAuditor(toAuditConfig({ preset, provider: providerConfig }));

        auditor.on('start', (target) => send('start', { target }));
        auditor.on('axe:complete', (violations) =>
          send('axe:complete', { violationCount: violations.length }),
        );
        auditor.on('rule:start', (ruleId) => send('rule:start', { ruleId }));
        auditor.on('rule:complete', (ruleId, results) =>
          send('rule:complete', { ruleId, resultCount: results.length }),
        );

        const result = url ? await auditor.auditURL(url) : await auditor.auditHTML(html!);

        send('complete', {
          summary: result.summary,
          violationCount: result.mergedViolations.length,
        });
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
