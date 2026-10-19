// Health program engine (no browser):  node tools/health.cjs
global.window = global;
['figure', 'exercises', 'program', 'products', 'health'].forEach(f => require('../js/' + f + '.js'));
const H = global.Health;
const errs = [];
const ok = (c, m) => { if (!c) errs.push(m); };
const D = (s) => new Date(s + 'T09:00:00');
const day = (start, n) => { const d = D(start); d.setDate(d.getDate() + n); return d; };

const S0 = '2026-11-02';   // a Monday
const s = { name: 'Maja', settings: { days: 3, prefDays: [], goal: 'general', intake: {},
  routine: [
    { id: 'c', pid: 'creatine', name: 'Creatine', slot: 'morning', days: 'daily', pack: { start: S0, servings: 85 }, perDay: 1 },
    { id: 'r', pid: 'recovery', name: 'Recovery Shake', slot: 'post', days: 'training', pack: { start: S0, servings: 20 }, perDay: 1 }
  ] }, log: [] };

// week 1: seven check-ins → first reward, reminders relax to 3×/week
let got = null;
for (let i = 0; i < 7; i++) got = H.checkin(s, 'done', day(S0, i)) || got;
ok(H.count(s) === 7, 'count 7: ' + H.count(s));
ok(got && got.n === 7, 'reward unlocked at 7');
ok(H.prog(s).rewards[7] && H.prog(s).rewards[7].code === 'FINESTME-SHIP', 'reward code stored');
ok(H.prog(s).reminders === '3x', 'reminders relax after the first reward');
ok(s.settings.intake['2026-11-04'].c && s.settings.intake['2026-11-04'].r, 'done marks every due item taken (Wed = training day of the 3×/week plan)');
ok(!s.settings.intake['2026-11-03'].r, 'training-only item not due on a rest day (Tue)');
ok(H.next(s).step.n === 30 && H.next(s).left === 23, 'next reward 30, 23 to go');
ok(H.streak(s, day(S0, 6)) === 7, 'streak 7');

// "not today" keeps everything; one gap is bridged by a streak freeze
H.checkin(s, 'skip', day(S0, 7));
ok(H.count(s) === 7, 'skip loses nothing');
H.checkin(s, 'done', day(S0, 8));
ok(H.freezes(s) === 1 && H.streak(s, day(S0, 8)) === 8, 'freeze bridges the skipped day: ' + H.streak(s, day(S0, 8)));

// three silent days → missed run 3 (skip counts as an answer, not a miss)
ok(H.missedRun(s, day(S0, 12)) === 3, 'missed run 3: ' + H.missedRun(s, day(S0, 12)));
ok(H.missedRun(s, day(S0, 8)) === 0, 'no misses after a check-in');

// supply: creatine 85, used on done days + silent due days (assumed taken), not on the skip day
const sup = H.supply(s, s.settings.routine[0], day(S0, 12));
ok(sup.used === 11 && sup.left === 74, 'creatine used 11 left 74: ' + JSON.stringify(sup));
ok(sup.daysLeft === 73, 'days left 73: ' + sup.daysLeft);
const rec = H.supply(s, s.settings.routine[1], day(S0, 12));
ok(rec.left < 20 && rec.daysLeft > rec.left, 'training-only item lasts longer than its servings in days: ' + JSON.stringify(rec));
ok(H.lowSupply(s, day(S0, 12)).length === 0, 'nothing low yet');
s.settings.routine[1].pack.servings = 7;   // 5 used → 2 left → runs out on the 2nd training day ahead
const low = H.lowSupply(s, day(S0, 12));
ok(low.length === 1 && low[0].it.id === 'r', 'recovery runs low');
H.prog(s).supplySnooze.r = '2026-11-17';
ok(H.lowSupply(s, day(S0, 12)).length === 0, 'snoozed for 3 days');
const url = H.reorderUrl(s.settings.routine[0], 'FINESTME-SHIP', 'supply_low');
ok(/add-to-cart=786110/.test(url) && /coupon=FINESTME-SHIP/.test(url) && /utm_campaign=supply_low/.test(url), 'reorder url: ' + url);
ok(H.bestCode(s) === 'FINESTME-SHIP', 'best code available');

// pause freezes: no misses, streak skips paused days
H.prog(s).pause = { from: '2026-11-11', to: '2026-11-17' };
ok(H.paused(s, '2026-11-12') && H.missedRun(s, day(S0, 16)) === 0, 'paused days are not misses');
H.prog(s).pause = null;

// weekly check-in: due on Sunday after ≥5 days, once per week
ok(H.weeklyDue(s, D('2026-11-08')), 'weekly due on the first Sunday');
H.prog(s).weekly[H.weekKey(D('2026-11-08'))] = { energy: 3, sleep: 3, goal: 3 };
ok(!H.weeklyDue(s, D('2026-11-08')), 'not twice the same week');
H.prog(s).weekly[H.weekKey(D('2026-11-15'))] = { energy: 4, sleep: 3, goal: 4 };
const rv = H.review(s, D('2026-11-15'));
ok(rv && rv.cur.energy === 4 && rv.prev.energy === 3 && rv.adh.due > 0, 'review compares weeks: ' + JSON.stringify(rv && rv.adh));
ok(H.weekKey(D('2026-11-08')) === '2026-W45', 'ISO week ' + H.weekKey(D('2026-11-08')));

// complement: never before day 21, max once a month, never already in the routine, respects "no thanks"
ok(H.crossPick(s, day(S0, 15)) === null, 'no suggestion before day 21');
const c1 = H.crossPick(s, day(S0, 22));
ok(c1 && ['creatine', 'recovery'].indexOf(c1.id) < 0, 'suggests a product not in the routine: ' + (c1 && c1.id));
H.prog(s).cross.last = day(S0, 22).toISOString(); H.prog(s).cross.dismissed.push(c1.id);
ok(H.crossPick(s, day(S0, 40)) === null, 'max once a month');
const c2 = H.crossPick(s, day(S0, 60));
ok(c2 && c2.id !== c1.id, 'a dismissed product is not suggested again');
global.HEALTH_COMPLEMENTS = { creatine: { complements: [{ id: 'magnesium' }] } };
ok(H.crossPick(s, day(S0, 60)).id === 'magnesium', 'data-driven complement first');

// per-item ticks complete the day
const t = { name: 'T', settings: { days: 3, routine: [{ id: 'a', name: 'A', days: 'daily' }, { id: 'b', name: 'B', days: 'daily' }], intake: {} }, log: [] };
const d0 = D('2026-11-02');
t.settings.intake['2026-11-02'] = { a: 1 };
ok(!H.syncDay(t, d0) && H.count(t) === 0, 'one of two ticked – not a check-in yet');
t.settings.intake['2026-11-02'].b = 1;
H.syncDay(t, d0);
ok(H.count(t) === 1, 'both ticked – day counts');
delete t.settings.intake['2026-11-02'].b; H.syncDay(t, d0);
ok(H.count(t) === 0, 'untick removes the auto check-in');
ok(/habit/.test(H.expectation(t, d0)) && !/burn|boost|cure|improve/i.test(H.expectation(s, day(S0, 30))), 'expectation copy is habit-only (no product claims)');

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no errors');
