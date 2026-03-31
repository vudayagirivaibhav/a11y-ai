/**
 * Audit API endpoint for the playground.
 *
 * Supports both HTML string and URL auditing with rate limiting
 * and basic SSRF prevention.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { auditHTML, auditURL } from '@a11y-ai/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  url: z.string().url().optional(),
  html: z.string().max(500_000).optional(),
  preset: z.enum(['quick', 'standard', 'thorough']).default('quick'),
  apiKey: z.string().optional(),
});

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

function makeSerializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (current instanceof Error) {
        return { name: current.name, message: current.message };
      }
      return current;
    }),
  ) as T;
}

async function demoAiHandler(): Promise<{ content: string }> {
  return { content: JSON.stringify({ findings: [] }) };
}

export async function POST(request: NextRequest): Promise<Response> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 10 audits per minute.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const body = RequestSchema.safeParse(rawBody);

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

  if (url) {
    try {
      const parsed = new URL(url);

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json(
          { error: 'Only http/https URLs are supported', code: 'INVALID_URL' },
          { status: 400 },
        );
      }

      if (isPrivateIP(parsed.hostname)) {
        return NextResponse.json(
          { error: 'Private/internal URLs are not allowed', code: 'SSRF_BLOCKED' },
          { status: 400 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format', code: 'INVALID_URL' },
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
      : { name: 'custom' as const, handler: demoAiHandler };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const result = url
      ? await auditURL(url, { preset, provider: providerConfig })
      : await auditHTML(html!, { preset, provider: providerConfig });

    clearTimeout(timeout);

    return NextResponse.json({ result: makeSerializable(result) });
  } catch (error) {
    console.error('[playground/api/audit] audit failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audit failed', code: 'AUDIT_FAILED' },
      { status: 500 },
    );
  }
}
