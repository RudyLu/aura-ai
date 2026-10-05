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
  const sid = await sessionId();
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
  const state = (await loadState(sid)) || blank();
  if (!allowAiCall(sid)) {
    return NextResponse.json({ reply: { text: 'I need a short rest before the next message. Your records are saved; try again in a little while.', action: null, draft: null, logOffer: null, via: 'verified-summary' } });
  }
  // The latest user message is already in the saved history; pass the turns before it.
  const history = state.messages.at(-1)?.text === body.data.text ? state.messages.slice(0, -1) : state.messages;
  const reply = await respond(state, body.data.text, history, body.data.today);
  return NextResponse.json({ reply });
}
