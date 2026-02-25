import { NextResponse } from 'next/server';

import { auditHTML } from '@a11y-ai/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuditRequestBody = {
  html?: string;
  preset?: 'quick' | 'standard' | 'thorough' | 'custom';
};

/**
 * Tiny demo-only AI handler used by the playground so users can try the app
 * without configuring a real provider key.
 */
async function demoAiHandler(): Promise<{ content: string }> {
  return {
    content: JSON.stringify({ findings: [] }),
  };
}

function makeSerializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (current instanceof Error) {
        return {
          name: current.name,
          message: current.message,
        };
      }
      return current;
    }),
  ) as T;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as AuditRequestBody;
    const html = typeof body.html === 'string' ? body.html.trim() : '';
    const preset = body.preset ?? 'quick';

    if (!html) {
      return NextResponse.json({ error: 'HTML input is required.' }, { status: 400 });
    }

    if (html.length > 250_000) {
      return NextResponse.json(
        { error: 'HTML input is too large for the playground (max 250,000 characters).' },
        { status: 400 },
      );
    }

    const result = await auditHTML(html, {
      preset,
      provider: { name: 'custom', handler: demoAiHandler },
    });

    return NextResponse.json({ result: makeSerializable(result) });
  } catch (error) {
    // Keep server logs useful while returning a concise client-safe error payload.
    console.error('[playground/api/audit] audit failed', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Playground audit failed.',
      },
      { status: 500 },
    );
  }
}
