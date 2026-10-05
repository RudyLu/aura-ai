import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sessionId } from '@/server/session';
import { savePhoto } from '@/server/repo';
import { geminiConfigured } from '@/server/gemini';
import { extractFood } from '@/server/vision';
import { allowAiCall } from '@/server/limits';
import { uid } from '@/domain/dates';

export const dynamic = 'force-dynamic';

const SAMPLES: Record<string, string> = { mocha: 'iced-mocha.jpg', salad: 'salad.jpg', lasagna: 'lasagna.jpg' };
const MAX = 8 * 1024 * 1024;

// Upload a photo (or pick a bundled sample) and get Gemini's suggested fields.
// Returns a draft only; the entry is saved by the client after the user confirms.
export async function POST(req: Request) {
  const sid = await sessionId();
  const form = await req.formData();
  const sample = form.get('sample');
  let data: Buffer, type: string, photoUrl: string;
  if (typeof sample === 'string') {
    const file = SAMPLES[sample];
    if (!file) return NextResponse.json({ error: 'Unknown sample photo.' }, { status: 400 });
    data = await fs.readFile(path.join(process.cwd(), 'public', 'assets', 'food', file));
    type = 'image/jpeg';
    photoUrl = `/assets/food/${file}`;
  } else {
    const file = form.get('photo');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a photo.' }, { status: 400 });
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) return NextResponse.json({ error: 'Choose a JPEG, PNG, WebP or HEIC image.' }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: 'Choose an image smaller than 8 MB.' }, { status: 400 });
    data = Buffer.from(await file.arrayBuffer());
    type = file.type;
    const id = uid('ph');
    await savePhoto(sid, id, data, type);
    photoUrl = `/api/photo/${id}`;
  }

  if (!geminiConfigured()) return NextResponse.json({ photoUrl, extraction: null, error: 'Photo recognition is off in this environment. Fill in the details yourself.' });
  if (!allowAiCall(sid)) return NextResponse.json({ photoUrl, extraction: null, error: 'Photo recognition is resting for this session. Fill in the details yourself.' });
  try {
    const r = await extractFood(data, type);
    if ('notFood' in r) return NextResponse.json({ photoUrl, extraction: null, error: 'This doesn’t look like food or a drink. You can still describe it yourself.' });
    return NextResponse.json({ photoUrl, extraction: r });
  } catch (e) {
    console.error('[photo] extraction failed', e);
    return NextResponse.json({ photoUrl, extraction: null, error: 'Couldn’t read the photo just now. Fill in the details yourself, or try again.' });
  }
}
