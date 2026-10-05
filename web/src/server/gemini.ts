// Gemini on Vertex AI. Cloud Run's service account provides credentials (ADC); no API
// key is stored. Locally, `gcloud auth application-default login` does the same.
import { GoogleGenAI } from '@google/genai';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let client: GoogleGenAI | null = null;
export const geminiConfigured = () => !!process.env.GOOGLE_CLOUD_PROJECT && process.env.GEMINI_DISABLED !== '1';

function ai() {
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'global'
    });
  }
  return client;
}

// One structured call: the model must return JSON matching `schema`.
export async function generateJSON<T>(opts: {
  system: string; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[];
  schema: object; temperature?: number; timeoutMs?: number;
}): Promise<T> {
  if (!geminiConfigured()) throw new Error('Gemini is not configured (set GOOGLE_CLOUD_PROJECT).');
  const res = await ai().models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: opts.parts }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: 'application/json',
      responseJsonSchema: opts.schema,
      temperature: opts.temperature ?? 0.3,
      abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 20000)
    }
  });
  const text = res.text;
  if (!text) throw new Error('Empty response from Gemini');
  return JSON.parse(text) as T;
}
