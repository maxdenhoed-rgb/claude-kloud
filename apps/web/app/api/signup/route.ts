import { NextResponse } from 'next/server';
import { z } from 'zod';

import { addSignup } from '@/lib/signups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SignupBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_json', message: 'Request body was not valid JSON.' } },
      { status: 400 },
    );
  }

  const parsed = SignupBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'invalid_email',
          message: 'Provide a valid email address.',
        },
      },
      { status: 400 },
    );
  }

  const { email } = parsed.data;
  addSignup(email);

  return NextResponse.json({ ok: true, data: { email } }, { status: 200 });
}
