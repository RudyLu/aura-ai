// A simple per-session budget for Gemini calls, so one visitor can't run up costs.
// In memory per instance: approximate on Cloud Run, which is enough for a demo.
const WINDOW_MS = 60 * 60 * 1000;
const MAX = Number(process.env.AI_CALLS_PER_HOUR || 60);
const calls = new Map<string, number[]>();

export function allowAiCall(sid: string): boolean {
  const now = Date.now();
  const recent = (calls.get(sid) || []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= MAX) { calls.set(sid, recent); return false; }
  recent.push(now);
  calls.set(sid, recent);
  return true;
}
