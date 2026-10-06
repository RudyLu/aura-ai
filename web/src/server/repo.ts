// Storage for one session's State and photos. On Cloud Run: Firestore (one document
// per session, the State kept as a JSON string) and a Cloud Storage bucket. Locally,
// without a Google Cloud project: files under web/.data/.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { HealthImport, State } from '@/domain/state';
import type { HealthLink } from './healthLink';

const useCloud = () => process.env.STORAGE === 'cloud' || (!!process.env.K_SERVICE && process.env.STORAGE !== 'file');
const DATA = process.env.DATA_DIR || path.join(process.cwd(), '.data');

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
  await deleteHealthImport(sid);
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

// ---------- Apple Health linked from the iOS app ----------
// Kept apart from the client-owned State so a browser save can't overwrite it; the
// browser adopts it into its State when the link completes (or on its next load).
const readJson = async <T>(file: string): Promise<T | null> => {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
};
const writeJson = async (file: string, v: unknown) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(v));
};

export async function createLink(link: HealthLink) {
  if (useCloud()) { await (await firestore()).collection('healthLinks').doc(link.token).set(link); return; }
  await writeJson(path.join(DATA, 'links', `${link.token}.json`), link);
}

export async function getLink(token: string): Promise<HealthLink | null> {
  if (useCloud()) {
    const doc = await (await firestore()).collection('healthLinks').doc(token).get();
    return doc.exists ? (doc.data() as HealthLink) : null;
  }
  return readJson<HealthLink>(path.join(DATA, 'links', `${token}.json`));
}

// Uses the token once: saves the import and marks the link done, only if it is still
// pending and unexpired. Returns false otherwise.
export async function completeLink(token: string, h: HealthImport, now = Date.now()): Promise<boolean> {
  const done = { status: 'done' as const, completedAt: new Date(now).toISOString() };
  if (useCloud()) {
    const db = await firestore();
    const ref = db.collection('healthLinks').doc(token);
    return db.runTransaction(async tx => {
      const link = (await tx.get(ref)).data() as HealthLink | undefined;
      if (!link || link.status !== 'pending' || now > link.expiresAt) return false;
      tx.set(db.collection('healthImports').doc(link.sid), { json: JSON.stringify(h), updatedAt: new Date(now) });
      tx.update(ref, done);
      return true;
    });
  }
  const file = path.join(DATA, 'links', `${token}.json`);
  const link = await readJson<HealthLink>(file);
  if (!link || link.status !== 'pending' || now > link.expiresAt) return false;
  await writeJson(path.join(DATA, 'health', `${link.sid}.json`), h);
  await writeJson(file, { ...link, ...done });
  return true;
}

export async function loadHealthImport(sid: string): Promise<HealthImport | null> {
  if (useCloud()) {
    const doc = await (await firestore()).collection('healthImports').doc(sid).get();
    const json = doc.exists ? doc.get('json') : null;
    return json ? JSON.parse(json) : null;
  }
  return readJson<HealthImport>(path.join(DATA, 'health', `${sid}.json`));
}

// Removes the linked import and this session's link tokens.
export async function deleteHealthImport(sid: string) {
  if (useCloud()) {
    const db = await firestore();
    const links = await db.collection('healthLinks').where('sid', '==', sid).get();
    const batch = db.batch();
    links.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('healthImports').doc(sid));
    await batch.commit();
    return;
  }
  await fs.rm(path.join(DATA, 'health', `${sid}.json`), { force: true });
  const dir = path.join(DATA, 'links');
  for (const f of await fs.readdir(dir).catch(() => [] as string[])) {
    const link = await readJson<HealthLink>(path.join(dir, f));
    if (link?.sid === sid) await fs.rm(path.join(dir, f), { force: true });
  }
}
