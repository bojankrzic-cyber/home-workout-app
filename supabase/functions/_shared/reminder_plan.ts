// Which reminders are due for one routine right now – pure, no I/O (unit-tested in tools/functions.mjs).
//
// The rules (docs/reminders.md):
//   - quiet hours 21:30–07:00 local: nothing; paused: nothing; freq 'off': nothing
//   - at most ONE push and ONE e-mail per local day; every reminder kind at most once per occasion
//   - daily nudge (push) at the customer's own moment – their learned check-in time minus 15 min, else the
//     time they set / their anchor (coffee 07:30, breakfast 08:00, lunch 12:30, evening 20:00) – only
//     while today is not ticked. '3x' (after the first reward) = Mon, Wed, Fri
//   - streak at risk (push, 19:30): streak ≥ 3, today still open, no nudge sent today
//   - 3 quiet days (push + e-mail, once per silence): no guilt – a different time, fewer reminders or a pause
//   - 14 quiet days (e-mail + push, Monday morning, once): fresh start
//   - supply: 5 days before the pack runs out (push + e-mail) and on the last day (e-mail)
//   - weekly check-in (push, Sunday 18:00) when this week's is not done and the routine is ≥ 5 days old
// A reminder is sent in the window [due, due + 2 h) – the scheduler runs every 15 min; a late one is skipped.

export type State = {
  user_id: string; member_id: string; tz: string; lang: string; anchor: string; remind_min: number | null; learned_min: number | null;
  freq: string; paused_until: string | null; start_date: string | null; last_checkin: string | null; checkins: number; streak: number;
  product: string | null; runout: string | null; runout_product: string | null; weekly_last: string | null; push: boolean; email: boolean;
};
export type Sent = { dedupe_key: string; channel: string; local_date: string };
export type Msg = { kind: string; key: string; channel: 'push' | 'email'; title: string; body: string; url: string; done?: string; tag: string };
export type Dict = Record<string, string>;

const ANCHOR: Record<string, number> = { coffee: 450, breakfast: 480, lunch: 750, evening: 1200 };
export const TEXT: Record<string, [string, string]> = {
  checkin_coffee: ['☕ Coffee time', 'Your {product} goes with it – one tap and today is ticked.'],
  checkin_breakfast: ['🍳 Breakfast time', 'Your {product} goes with it – one tap and today is ticked.'],
  checkin_lunch: ['🥗 Lunch time', 'Your {product} goes with it – one tap and today is ticked.'],
  checkin_evening: ['🌙 Evening routine', 'Your {product} goes with it – one tap and today is ticked.'],
  streak: ['🔥 {n} days in a row', 'Today is still open – one tap keeps it going.'],
  missed: ['Life gets busy 💚', 'Pick up where you left off – your {n} check-ins are safe. A different time or fewer reminders?'],
  winback: ['A fresh week, a fresh start 🌱', 'Your routine is waiting. Start again today – your rewards are still yours.'],
  supply: ['📦 {product}: 5 days left', 'Reorder now so your routine doesn’t break – your reward is applied.'],
  runout: ['Last serving today?', '{product} runs out today. Reorder in one tap and keep going.'],
  weekly: ['📊 Your week in 20 seconds', '3 quick taps – see how this week compares.'],
  done: ['✅ Done', ''],
};

// same key scheme as js/i18n.js: whitespace collapsed, numbers → {0}, {1} …
export function tr(text: string, dict: Dict | undefined, vars: Record<string, string | number> = {}): string {
  const nums: string[] = [];
  const key = text.replace(/\s+/g, ' ').trim().replace(/\d+(?:[.,:]\d+)*/g, (m) => { nums.push(m); return '{' + (nums.length - 1) + '}'; });
  let out = dict && dict[key] ? dict[key].replace(/\{(\d+)\}/g, (m, i) => nums[+i] ?? m) : text;
  for (const k of Object.keys(vars)) out = out.split('{' + k + '}').join(String(vars[k]));
  return out;
}

export function local(now: Date, tz: string) {
  let parts: Record<string, string> = {};
  try {
    for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(now)) parts[p.type] = p.value;
  } catch { return local(now, 'UTC'); }
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, min: +parts.hour * 60 + +parts.minute, dow };
}
export function daysBetween(a: string, b: string) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
export function isoWeek(date: string) {
  const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const w1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return d.getUTCFullYear() + '-W' + String(1 + Math.round(((+d - +w1) / 864e5 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0');
}

export function plan(s: State, now: Date, sent: Sent[], dict?: Dict): Msg[] {
  if (!s || s.freq === 'off' || (!s.push && !s.email) || !s.start_date) return [];
  const L = local(now, s.tz);
  if (L.min < 7 * 60 || L.min >= 21 * 60 + 30) return [];
  if (s.paused_until && L.date <= s.paused_until) return [];
  const keys = new Set(sent.map((x) => x.dedupe_key.replace(/:(push|email)$/, '')));   // logged as <occasion>:<channel>
  let pushToday = sent.some((x) => x.channel === 'push' && x.local_date === L.date);
  let mailToday = sent.some((x) => x.channel === 'email' && x.local_date === L.date);
  const open = s.last_checkin !== L.date;
  const quiet = s.last_checkin ? daysBetween(s.last_checkin, L.date) - 1 : daysBetween(s.start_date, L.date);
  const at = s.learned_min != null ? Math.max(7 * 60, s.learned_min - 15) : s.remind_min ?? ANCHOR[s.anchor] ?? ANCHOR.breakfast;
  const inWindow = (due: number) => L.min >= due && L.min < due + 120;
  const product = s.product || 'routine', V = { product, n: 0 };
  const out: Msg[] = [];
  function add(kind: string, key: string, channels: ('push' | 'email')[], vars: Record<string, string | number>, url: string, done = false) {
    if (keys.has(key)) return;
    const [t, b] = TEXT[kind] || TEXT.checkin_breakfast;
    for (const ch of channels) {
      if (ch === 'push' && (!s.push || pushToday)) continue;
      if (ch === 'email' && (!s.email || mailToday)) continue;
      out.push({ kind, key, channel: ch, title: tr(t, dict, vars), body: tr(b, dict, vars), url, tag: kind, ...(done && ch === 'push' ? { done: tr(TEXT.done[0], dict) } : {}) });
      if (ch === 'push') pushToday = true; else mailToday = true;
    }
  }
  // most important first – the caps then drop the rest
  if (s.runout) {
    const left = daysBetween(L.date, s.runout);
    if (left === 5 && inWindow(at)) add('supply', 'supply:' + s.runout, ['push', 'email'], { product: s.runout_product || product }, './?go=program');
    if (left === 0 && inWindow(at)) add('runout', 'runout:' + s.runout, ['email'], { product: s.runout_product || product }, './?go=program');
  }
  if (quiet >= 14 && L.dow === 1 && inWindow(8 * 60)) add('winback', 'winback:' + (s.last_checkin || s.start_date), ['email', 'push'], V, './');
  else if (quiet >= 3 && quiet < 14 && inWindow(at)) add('missed', 'missed:' + (s.last_checkin || s.start_date), ['push', 'email'], { ...V, n: s.checkins }, './?go=program', true);
  const nudgeDay = s.freq === 'daily' || [1, 3, 5].includes(L.dow);
  if (open && quiet < 3 && nudgeDay && inWindow(at)) add('checkin_' + (ANCHOR[s.anchor] ? s.anchor : 'breakfast'), 'checkin:' + L.date, ['push'], V, './', true);
  if (L.dow === 0 && inWindow(18 * 60) && s.weekly_last !== isoWeek(L.date) && daysBetween(s.start_date, L.date) >= 5) add('weekly', 'weekly:' + isoWeek(L.date), ['push'], V, './?go=program');
  if (open && s.streak >= 3 && !keys.has('checkin:' + L.date) && inWindow(19 * 60 + 30)) add('streak', 'streak:' + L.date, ['push'], { ...V, n: s.streak }, './', true);
  return out;
}
