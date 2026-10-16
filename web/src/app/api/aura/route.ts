import { modeSid } from '@/server/statePolicy';
import { geminiConfigured } from '@/server/gemini';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionId } from '@/server/session';
import { loadState } from '@/server/repo';
import { respond } from '@/server/agent';
import { allowAiCall } from '@/server/limits';
import { blank } from '@/domain/state';

export const dynamic = 'force-dynamic';

const Body = z.object({ text: z.string().trim().min(1).max(2000), today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// Aura reads this session's saved records (never another visitor's) and replies.
export async function POST(req: Request) {
  const sid = modeSid(await sessionId(), req);
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  const state = (await loadState(sid)) || blank();
  // The original Agent remains unchanged. Its canned offline replies are not shown as live AI.
  if (new URL(req.url).searchParams.get('mode') === 'demo' && !state.profile.includeDemoInAI) return NextResponse.json({ code: 'DEMO_CONSENT_REQUIRED', error: 'Allow demo records to be sent to Gemini in Settings first.' }, { status: 403 });
  if (!geminiConfigured()) return NextResponse.json({ status: 'not-integrated', error: 'Gemini is not connected. Your message is saved; no Agent response was generated.' }, { status: 503 });
  if (!allowAiCall(sid)) {
    return NextResponse.json({ reply: { text: 'I need a short rest before the next message. Your records are saved; try again in a little while.', action: null, draft: null, logOffer: null, via: 'verified-summary' } });
  }
  // The latest user message is already in the saved history; pass the turns before it.
  const history = state.messages.at(-1)?.text === body.data.text ? state.messages.slice(0, -1) : state.messages;
  const reply = await respond(state, body.data.text, history, body.data.today);
  return NextResponse.json({ reply });
}
