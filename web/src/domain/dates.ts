// Local-time dates as strings: YYYY-MM-DD and YYYY-MM-DDTHH:MM (ported from store.js).
const pad = (n: number) => String(n).padStart(2, '0');

export const localDateTime = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const todayISO = (now = new Date()) => localDateTime(now).slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() + n);
  return localDateTime(d).slice(0, 10);
};
export const daysBetween = (a: string, b: string) => Math.round((+new Date(b + 'T12:00') - +new Date(a + 'T12:00')) / 86400000);
export const dateRange = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
export const fmtDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
export const fmtDay = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

let counter = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
