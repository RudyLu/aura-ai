// Storage for one session's State and photos. On Cloud Run: Firestore (one document
// per session, the State kept as a JSON string) and a Cloud Storage bucket. Locally,
// without a Google Cloud project: files under web/.data/.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { State } from '@/domain/state';

const useCloud = () => process.env.STORAGE === 'cloud' || (!!process.env.K_SERVICE && process.env.STORAGE !== 'file');
const DATA = path.join(process.cwd(), '.data');

// ---------- Firestore / Cloud Storage (lazy, server only) ----------
let fsClient: import('@google-cloud/firestore').Firestore | null = null;
async function firestore() {
  if (!fsClient) {
    const { Firestore } = await import('@google-cloud/firestore');
    fsClient = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT, databaseId: process.env.FIRESTORE_DATABASE || '(default)' });
  }
  return fsClient;
}
let bucketRef: import('@google-cloud/storage').Bucket | null = null;
async function bucket() {
  if (!bucketRef) {
    const name = process.env.PHOTO_BUCKET;
    if (!name) throw new Error('PHOTO_BUCKET is not set');
    const { Storage } = await import('@google-cloud/storage');
    bucketRef = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT }).bucket(name);
  }
  return bucketRef;
}

export async function loadState(sid: string): Promise<State | null> {
  if (useCloud()) {
    const doc = await (await firestore()).collection('sessions').doc(sid).get();
    const json = doc.exists ? doc.get('json') : null;
    return json ? JSON.parse(json) : null;
  }
  try { return JSON.parse(await fs.readFile(path.join(DATA, 'sessions', `${sid}.json`), 'utf8')); }
  catch { return null; }
}

export async function saveState(sid: string, state: State) {
  const json = JSON.stringify(state);
  if (useCloud()) {
    await (await firestore()).collection('sessions').doc(sid).set({ json, updatedAt: new Date() });
    return;
  }
  await fs.mkdir(path.join(DATA, 'sessions'), { recursive: true });
  await fs.writeFile(path.join(DATA, 'sessions', `${sid}.json`), json);
}

export async function deleteSession(sid: string) {
  if (useCloud()) {
    await (await firestore()).collection('sessions').doc(sid).delete();
    try { await (await bucket()).deleteFiles({ prefix: `photos/${sid}/` }); }
    catch (e) { console.error('[repo] photo cleanup failed', e); }
    return;
  }
  await fs.rm(path.join(DATA, 'sessions', `${sid}.json`), { force: true });
  await fs.rm(path.join(DATA, 'photos', sid), { recursive: true, force: true });
}

// Photos are stored under the session, so one visitor's photo URL is useless to another.
export async function savePhoto(sid: string, id: string, data: Buffer, contentType: string) {
  if (useCloud()) {
    await (await bucket()).file(`photos/${sid}/${id}`).save(data, { contentType, resumable: false });
    return;
  }
  const dir = path.join(DATA, 'photos', sid);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, id), data);
  await fs.writeFile(path.join(dir, `${id}.type`), contentType);
}

export async function loadPhoto(sid: string, id: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    if (useCloud()) {
      const f = (await bucket()).file(`photos/${sid}/${id}`);
      const [[data], [meta]] = await Promise.all([f.download(), f.getMetadata()]);
      return { data, contentType: meta.contentType || 'image/jpeg' };
    }
    const dir = path.join(DATA, 'photos', sid);
    return { data: await fs.readFile(path.join(dir, id)), contentType: await fs.readFile(path.join(dir, `${id}.type`), 'utf8') };
  } catch { return null; }
}
