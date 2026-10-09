'use strict';
/* Siłka – osobisty tracker (siła + bieg + praca zmianowa). Dane trzymane lokalnie w localStorage. */

const KEY = 'silka_v2', OLD_KEY = 'silka_v1';
const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
const DS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const dayDiff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const wd = s => (parse(s).getDay() + 6) % 7; // 0 = poniedziałek
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const kg = n => String(Math.round(n * 100) / 100).replace('.', ',');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = s => cap(parse(s).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }));
const shortDate = s => parse(s).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
const mmss = t => { t = Math.max(0, Math.round(t)); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
const hms = t => { t = Math.round(t); const h = Math.floor(t / 3600); return h ? `${h}:${pad(Math.floor(t % 3600 / 60))}:${pad(t % 60)}` : mmss(t); };
const parseTime = s => { // "25:30", "1:05:00" lub samo "25" (minuty) -> sekundy
  s = String(s).trim().replace(',', '.');
  if (!s) return 0;
  const p = s.split(':').map(Number);
  if (p.some(x => !isFinite(x))) return 0;
  if (p.length === 1) return Math.round(p[0] * 60);
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] * 3600 + p[1] * 60 + p[2];
};

/* ---------- plan "operator build" (wg raportu badawczego) ---------- */
// [klucz, nazwa, wzorzec, ciężar startowy, krok progresji, opcje]
const PLAN_EX = [
  ['zer', 'Zercher squat', 'legs', 50, 2.5],
  ['bench', 'Wyciskanie sztangi leżąc (chwyt ≤1,5× szer. barków)', 'push', 72.5, 2.5],
  ['pu', 'Podciąganie nachwytem', 'pull', 0, 2.5, { bw: 1 }],
  ['split', 'Split squat / wykroki chodzone (hantle, na nogę)', 'legs', 12, 2],
  ['row', 'Wiosłowanie hantlem jednorącz', 'pull', 22.5, 2.5],
  ['fp', 'Face pull + rotacja zewnętrzna na wyciągu', 'pull', 0, 2.5],
  ['carry', 'Suitcase carry (metry)', 'carry', 24, 2, { unit: 'm' }],
  ['trap', 'Martwy ciąg trap bar', 'legs', 0, 5],
  ['rdl', 'RDL (gdy brak trap bara)', 'legs', 55, 2.5],
  ['ohp', 'Wyciskanie hantli nad głowę siedząc (kg na hantlę)', 'push', 20, 2],
  ['pun', 'Podciąganie chwytem neutralnym', 'pull', 0, 2.5, { bw: 1 }],
  ['inc', 'Wyciskanie hantli na skosie dodatnim 30° (chwyt neutralny)', 'push', 16, 2],
  ['curl', 'Uginanie nóg leżąc', 'legs', 50, 2.5],
  ['abs', 'Allahy / wznosy nóg w zwisie', 'core', 0, 2.5],
  ['tri', 'Triceps na wyciągu', 'arm', 40, 2.5],
  ['bic', 'Uginanie hantli (biceps)', 'arm', 12.5, 2],
];
// pozycje: [klucz, serie, od, do, RIR, przerwa (s)]
const PLAN_W = [
  { name: 'Trening A', rot: 'A', note: 'Przysiad · wyciskanie · podciąganie. 5 min lekkiego ruchu + 2–3 serie dochodzące do ciężaru roboczego. Ok. 75–85 min.',
    items: [['zer', 4, 5, 8, '2–3', 150], ['bench', 3, 5, 8, '2–3', 150], ['pu', 4, 5, 8, '2–3', 150], ['split', 3, 8, 10, '1–2', 90], ['row', 3, 8, 12, '1–2', 75], ['fp', 2, 15, 20, '0–1', 60], ['carry', 3, 30, 40, '', 60]] },
  { name: 'Trening B', rot: 'B', note: 'Zawias · wyciskanie nad głowę · plecy. Triceps i biceps na koniec, jeśli starczy czasu. Bez trap bara zrób RDL 3×6–8.',
    items: [['trap', 3, 5, 5, '2–3', 150], ['ohp', 3, 6, 10, '2–3', 120], ['pun', 3, 6, 10, '1–2', 90], ['inc', 3, 8, 12, '1–2', 90], ['curl', 3, 10, 15, '0–1', 60], ['abs', 2, 10, 15, '0–1', 60], ['tri', 2, 10, 15, '0–1', 60], ['bic', 2, 10, 15, '0–1', 60]] },
  { name: 'Wersja łączona (tydzień z 1 oknem)', note: '1 bój nóg, 1 pchanie, 1 ciągnięcie, RIR 1–2, plus dodatki. Nie przesuwa kolejki A/B.',
    items: [['zer', 3, 5, 8, '1–2', 150], ['bench', 3, 5, 8, '1–2', 150], ['pu', 3, 5, 8, '1–2', 150], ['carry', 2, 30, 40, '', 60], ['fp', 2, 15, 20, '0–1', 60]] },
  { name: 'Minimum (30–40 min)', note: 'Tydzień kryzysowy: 2 serie robocze każdego boju głównego + noszenie. Nie przesuwa kolejki A/B.',
    items: [['zer', 2, 5, 8, '1–2', 120], ['bench', 2, 5, 8, '1–2', 120], ['pu', 2, 5, 8, '1–2', 120], ['carry', 2, 30, 40, '', 60]] },
  { name: 'Bieg spokojny', type: 'run', note: '30 min, w 6–8 tyg. dojdź do 40. Tętno ok. 130–145, tempo rozmowne (pełne zdania). Liczy się tętno, nie tempo.' },
  { name: 'Interwały', type: 'run', note: '4 × 3 min w tempie ok. 4:05–4:15/km, przerwy 2–3 min truchtu. Po 3–4 tyg. 4 × 4 min.', warn: 'Interwały tylko po śnie ≥7 h i nie w dzień przed treningiem A.', needSleep: 7 },
  { name: 'Test 3 km', type: 'run', test: true, note: 'Co 4–6 tyg., po dobrej nocy. Cel: ≤3:54/km (≈11:42).' },
];
function applyPlan(s) {
  const ids = {};
  for (const [k, name, pat, start, inc, o = {}] of PLAN_EX) {
    let ex = s.exercises.find(e => e.name === name);
    if (!ex) { ex = { id: uid(), name }; s.exercises.push(ex); }
    Object.assign(ex, { pat, start, inc, ...o });
    ids[k] = ex.id;
  }
  for (const p of PLAN_W) {
    if (s.workouts.some(w => w.name === p.name)) continue;
    s.workouts.push({
      id: uid(), name: p.name, type: p.type || 'strength', rot: p.rot, note: p.note, warn: p.warn, needSleep: p.needSleep, test: p.test,
      items: (p.items || []).map(([k, sets, repMin, repMax, rir, rest]) => ({ exId: ids[k], sets, repMin, repMax, rir, rest })),
    });
  }
  return s;
}
function seed() {
  return applyPlan({
    v: 2, exercises: [], workouts: [], schedule: [null, null, null, null, null, null, null], overrides: {}, logs: [],
    extras: [], shifts: {}, body: {}, protein: {}, deloadDate: null,
    settings: { inc: 2.5, rest: 120, height: 187, sleepAt: '' },
  });
}
function fill(s) {
  s.v = 2;
  s.extras ||= []; s.shifts ||= {}; s.body ||= {}; s.protein ||= {}; s.overrides ||= {};
  s.schedule ||= [null, null, null, null, null, null, null];
  s.settings = { inc: 2.5, rest: 120, height: 187, sleepAt: '', ...s.settings };
  return s;
}
let state = (() => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.workouts) return fill(s); } catch (e) { /* ignore */ }
  try { // migracja ze starej wersji: zachowaj tylko jeśli były już wpisy
    const o = JSON.parse(localStorage.getItem(OLD_KEY));
    if (o && o.workouts && o.logs && o.logs.length) return applyPlan(fill(o));
  } catch (e) { /* ignore */ }
  return seed();
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Nie można zapisać danych: ' + e.message); } };
try { navigator.storage?.persist?.(); } catch (e) { /* ignore */ }

const exById = id => state.exercises.find(e => e.id === id);
const wById = id => state.workouts.find(w => w.id === id);
const exInc = id => num(exById(id)?.inc) || state.settings.inc;
const unitOf = id => (exById(id)?.unit === 'm' ? 'm' : 'powt.');

function dayWorkout(date) {
  const o = state.overrides[date];
  if (o === 'rest') return null;
  return wById(o || state.schedule[wd(date)]) || null;
}
function logDone(l) {
  if (!l) return false;
  return l.type === 'run' ? num(l.run?.dist) > 0 : (l.entries || []).some(e => e.sets.some(s => s.d));
}
const doneLog = date => state.logs.find(l => l.date === date && logDone(l));

/* ---------- grafik pracy ---------- */
const afterNight = date => state.shifts[addDays(date, -1)] === 'N';
function near48(date) { // inny trening siłowy (zrobiony lub zaplanowany) bliżej niż 48 h
  const cand = [];
  for (const l of state.logs) if (l.type === 'strength' && logDone(l) && l.date !== date) cand.push(l.date);
  for (const [d, id] of Object.entries(state.overrides)) if (d !== date && wById(id)?.type === 'strength') cand.push(d);
  return cand.find(d => Math.abs(dayDiff(d, date)) < 2) || null;
}
function goodWindow(date) {
  if (!Object.keys(state.shifts).length || date < today()) return false;
  return !state.shifts[date] && !afterNight(date) && !near48(date);
}

/* ---------- logi i progresja ---------- */
const drafts = {}; // szkice logów (zapisują się dopiero po pierwszej zmianie)

function lastSession(exId, before) {
  let best = null;
  for (const l of state.logs) {
    if (l.type !== 'strength' || l.date >= before) continue;
    const e = (l.entries || []).find(x => x.exId === exId);
    const sets = e ? e.sets.filter(s => s.d && s.r > 0) : [];
    if (sets.length && (!best || l.date > best.date)) best = { date: l.date, sets };
  }
  return best;
}
function sessionsFor(exId) {
  const out = [];
  for (const l of state.logs) {
    if (l.type !== 'strength') continue;
    const e = (l.entries || []).find(x => x.exId === exId);
    const sets = e ? e.sets.filter(s => s.d && s.r > 0) : [];
    if (sets.length) out.push({ date: l.date, sets });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
const topW = sets => Math.max(...sets.map(s => s.w));
const e1rm = sets => Math.max(...sets.map(s => s.w * (1 + s.r / 30)));
const volume = sets => sets.reduce((a, s) => a + s.w * s.r, 0);
const reps = sets => sets.reduce((a, s) => a + s.r, 0);
const score = sets => (topW(sets) > 0 ? e1rm(sets) : reps(sets)); // przy masie ciała liczą się powtórzenia
function stagnant(exId, before) { // 3 sesje z rzędu bez poprawy względem sesji sprzed nich
  const s = sessionsFor(exId).filter(x => x.date < before);
  if (s.length < 4) return false;
  const base = score(s[s.length - 4].sets);
  return s.slice(-3).every(x => score(x.sets) <= base + 0.01);
}

// Podwójna progresja: wszystkie serie na górnym zakresie przy RIR ≥2 -> +krok i powrót do dolnego zakresu.
function progression(it, last) {
  if (!last) return null;
  const top = last.sets.length >= it.sets && last.sets.every(s => s.r >= it.repMax);
  const hard = last.sets.some(s => s.x != null && s.x < 2);
  return { up: top && !hard, blocked: top && hard };
}
function suggestSet(it, i, date) {
  const ex = exById(it.exId), last = lastSession(it.exId, date);
  if (!last) return { w: ex?.start || 0, r: it.repMin, x: null, d: false };
  const b = last.sets[Math.min(i, last.sets.length - 1)], step = ex?.unit === 'm' ? 5 : 1;
  if (progression(it, last).up) return { w: b.w + exInc(it.exId), r: it.repMin, x: null, d: false };
  return { w: b.w, r: Math.min(b.r + step, it.repMax), x: null, d: false };
}
function buildLog(date, w) {
  if (!w) return null;
  if (w.type === 'run') return { id: uid(), date, wid: w.id, type: 'run', run: { dist: 0, time: 0, note: '', hr: 0 } };
  return {
    id: uid(), date, wid: w.id, type: 'strength',
    entries: w.items.map(it => ({ exId: it.exId, sets: Array.from({ length: it.sets }, (_, i) => suggestSet(it, i, date)) })),
  };
}
function getLog(date) {
  const saved = state.logs.find(l => l.date === date);
  if (saved) return saved;
  if (!drafts[date]) drafts[date] = buildLog(date, dayWorkout(date));
  return drafts[date];
}
function commit(l) {
  if (!state.logs.includes(l)) state.logs.push(l);
  delete drafts[l.date];
  save();
}
function nextRot() { // kolejka A -> B -> A -> B, niezależnie od dat
  const rots = state.workouts.filter(w => w.rot).sort((a, b) => a.rot.localeCompare(b.rot));
  if (!rots.length) return null;
  const last = state.logs.filter(l => l.type === 'strength' && logDone(l) && wById(l.wid)?.rot).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return rots[0];
  const i = rots.findIndex(w => w.id === last.wid);
  return rots[(i + 1) % rots.length];
}

/* ---------- nawigacja ---------- */
let ui = { tab: 'cal', date: today(), cal: { y: new Date().getFullYear(), m: new Date().getMonth() }, exId: null, wid: null, metric: 'top', bm: 'weight', bdate: today(), shiftMode: false };
function go(p, push = true) {
  ui = { ...ui, ...p };
  if (push) history.pushState(JSON.parse(JSON.stringify(ui)), '');
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', e => { if (e.state) { ui = e.state; render(); } });
history.replaceState(JSON.parse(JSON.stringify(ui)), '');

/* ---------- widoki ---------- */
const hdr = (title, back) => `<div class="hdr">${back ? '<button class="ghost" data-act="back">←</button>' : ''}<h1>${esc(title)}</h1></div>`;
const banner = (cls, txt) => `<div class="bn ${cls}">${txt}</div>`;

function weekPushPull() {
  const from = addDays(today(), -6), c = { push: 0, pull: 0 };
  for (const l of state.logs) {
    if (l.type !== 'strength' || l.date < from) continue;
    for (const e of l.entries) { const p = exById(e.exId)?.pat; if (c[p] !== undefined) c[p] += e.sets.filter(s => s.d).length; }
  }
  return c;
}

function viewCal() {
  const { y, m } = ui.cal;
  const first = new Date(y, m, 1), off = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
  const t = today();
  let cells = DS.map(d => `<div class="dn">${d}</div>`).join('') + '<div class="d o"></div>'.repeat(off);
  let doneS = 0, doneR = 0, km = 0;
  for (let d = 1; d <= n; d++) {
    const date = iso(new Date(y, m, d));
    const dl = doneLog(date), w = dayWorkout(date), sh = state.shifts[date], an = afterNight(date);
    const type = dl ? dl.type : w?.type;
    let cls = 'none';
    if (type) cls = (type === 'run' ? 'run' : '') + (dl ? ' done' : date < t ? ' miss' : '');
    if (dl) { dl.type === 'run' ? (doneR++, km += num(dl.run.dist)) : doneS++; }
    const ex = state.extras.some(x => x.date === date);
    const tag = sh ? `<em class="sh">${sh}</em>` : an ? '<em class="sh">zZ</em>' : '';
    cells += `<button class="d ${date === t ? 'today' : ''} ${an ? 'an' : ''} ${sh ? 'shift' : ''} ${goodWindow(date) ? 'win' : ''}" data-act="day" data-date="${date}">${tag}${d}<span class="dots"><i class="dot ${cls}"></i>${ex ? '<i class="dot x done"></i>' : ''}</span></button>`;
  }
  const title = cap(first.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }));
  const nx = nextRot(), tw = dayWorkout(t), pp = weekPushPull();
  const firstLog = state.logs.filter(l => l.type === 'strength' && logDone(l)).map(l => l.date).sort()[0];
  const since = state.deloadDate || firstLog;
  const wk = since ? Math.floor(dayDiff(t, since) / 7) : 0;
  return `${hdr('Kalendarz')}
  <div class="cal-h"><button data-act="calPrev">‹</button><b>${title}</b><button data-act="calNext">›</button></div>
  <div class="seg"><button class="${ui.shiftMode ? 'on' : ''}" data-act="shiftMode">${ui.shiftMode ? '✔ Gotowe – wróć do kalendarza' : '✏️ Wpisz grafik pracy (dotknij dni: D → N → wolne)'}</button></div>
  <div class="cal">${cells}</div>
  <div class="legend"><span><i class="dot done"></i>siła</span><span><i class="dot run done"></i>bieg</span><span><i class="dot x done"></i>inne (BJJ)</span><span><i class="dot"></i>plan</span><span><i class="dot miss"></i>ominięty</span><span><b>D</b> służba dzienna</span><span><b>N</b> nocka</span><span><b>zZ</b> po nocce (bez siłowni)</span><span class="winl">zielone tło = dobre okno na siłownię</span></div>
  <div class="stats"><div><b>${doneS}</b><small>treningi siłowe</small></div><div><b>${doneR}</b><small>biegi</small></div><div><b>${kg(km)}</b><small>km w miesiącu</small></div></div>
  <div class="card row sp"><div><small>Dziś, ${longDate(t)}</small><h3>${tw ? esc(tw.name) : 'Nic nie zaplanowane'}</h3><small>Następny w kolejce: <b>${nx ? esc(nx.name) : '–'}</b></small></div><button class="pri" data-act="tab" data-tab="today">Otwórz</button></div>
  ${pp.push + pp.pull ? `<div class="card"><small>Ostatnie 7 dni – serie ciągnięcia : pchania</small><h3>${pp.pull} : ${pp.push} ${pp.pull >= pp.push ? '✅' : '⚠️ dołóż ciągnięcie (cel ≥1:1)'}</h3></div>` : ''}
  ${wk >= 6 ? `<div class="card"><small>Deload</small><p style="margin:4px 0">Minęło ${wk} tyg. od ${state.deloadDate ? 'ostatniego deloadu' : 'startu'}. Zrób deload (1 tydzień, objętość −40–50%, ten sam ciężar), jeśli widzisz 2 sygnały naraz: wyniki spadają przez 2 sesje, RIR rośnie przy tym samym ciężarze, rośnie tętno spoczynkowe albo bolą stawy.</p><div class="btns"><button data-act="deload">Zaczynam deload / zeruj licznik</button></div></div>` : ''}`;
}

function viewDay() {
  const date = ui.date;
  const l = getLog(date);
  const w = l ? wById(l.wid) : dayWorkout(date);
  const sh = state.shifts[date] || '';
  const shiftSel = `<div class="seg" style="margin:0">${[['', 'Wolne'], ['D', 'Służba dzienna'], ['N', 'Nocka']].map(([k, t]) => `<button class="${sh === k ? 'on' : ''}" data-act="setShift" data-k="${k}">${t}</button>`).join('')}</div>`;
  const opts = `<option value="">Brak / domyślny</option><option value="rest" ${state.overrides[date] === 'rest' ? 'selected' : ''}>Odpoczynek</option>` +
    state.workouts.map(x => `<option value="${x.id}" ${state.overrides[date] === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const strength = w && w.type === 'strength';
  let bn = '';
  if (afterNight(date)) bn += banner('bad', strength ? '⚠️ Dzień po nocce – wg raportu bez siłowni (niższa synteza białek, gorsza technika, większe ryzyko kontuzji). Spacer 20–40 min i drzemka.' : '😴 Dzień po nocce – siłownia odpada. Spacer 20–40 min, najlepiej bez energetyków do 13–14.');
  if (sh === 'N') bn += banner('', '🌙 Nocka od wieczora: trening tylko rano, potem drzemka 60–90 min (np. 15:30–17:00).');
  if (sh === 'D') bn += banner('', '🕖 Służba dzienna – ten dzień raczej bez treningu.');
  if (strength) {
    const n = near48(date);
    if (n) bn += banner('warn', `Mniej niż 48 h od innego treningu siłowego (${shortDate(n)}). Przesuń albo zmniejsz objętość.`);
    const y = state.extras.find(x => x.date === addDays(date, -1) && (x.rpe >= 6 || /bjj/i.test(x.name)));
    if (y) bn += banner('warn', `Wczoraj: ${esc(y.name)}. Przy tym treningu obniż objętość nóg o ok. 30% albo przesuń trening.`);
  }
  if (w?.warn) bn += banner('warn', esc(w.warn));
  if (l && w && (strength || w.needSleep)) {
    const s = l.sleep;
    if (s != null && s !== '') {
      if (w.needSleep && s < w.needSleep) bn += banner('bad', `Sen ${kg(s)} h – interwały tylko po ≥7 h. Zrób bieg spokojny albo odpocznij.`);
      else if (strength && s < 5) bn += banner('bad', `Sen ${kg(s)} h (<5 h): zamiast siłowni spacer albo lekki bieg 20–30 min. Bez ciężkich bojów.`);
      else if (strength && s < 7) bn += banner('warn', `Sen ${kg(s)} h (5–7 h): bez prób rekordowych, RIR ≥3, objętość −20–30%. ${l.cut ? '(objętość już zmniejszona)' : '<button class="inl" data-act="cutVol">Zmniejsz objętość</button>'}`);
      else if (strength) bn += banner('ok', `Sen ${kg(s)} h – plan bez zmian.`);
    }
    const pain = num(l.pain), recent = state.logs.find(x => x.type === 'strength' && x.date < date && dayDiff(date, x.date) <= 3 && num(x.pain) > 3);
    if (pain > 3) bn += banner(recent ? 'bad' : 'warn', recent ? `Ból barku ${pain}/10, a był >3 też ${shortDate(recent.date)} – utrzymuje się >48 h: zmodyfikuj trening i skonsultuj fizjoterapeutę.` : `Ból barku ${pain}/10 (>3): węższy chwyt / hantle neutralne, krótszy zakres. Narastający, nocny lub >48 h → fizjoterapeuta.`);
  }

  let body = '';
  if (!l) {
    const nx = nextRot(), an = afterNight(date);
    const btn = (x, pri) => `<button class="${pri ? 'pri' : ''}" data-act="plan" data-wid="${x.id}">${esc(x.name)}</button>`;
    const others = state.workouts.filter(x => x !== nx);
    body = `<div class="card"><h3>${an ? 'Dzień po nocce 😴' : 'Co dziś?'}</h3>
      <p class="muted">${an ? 'Wg raportu bez siłowni – odpoczynek, spacer albo najwyżej lekki bieg.' : 'Wybierz trening. Kolejka A→B→A→B przesuwa się tylko po zrobionych A/B.'}</p>
      ${!an && nx ? `<div class="btns">${btn(nx, true)}</div><p class="muted" style="margin:4px 0 8px">↑ następny w kolejce</p>` : ''}
      <div class="chips">${others.map(x => btn(x, false)).join('')}<button data-act="plan" data-wid="rest">Odpoczynek</button></div></div>`;
  } else if (l.type === 'run') {
    body = viewRun(l, w);
  } else {
    body = l.entries.map((e, ei) => {
      const ex = exById(e.exId);
      const it = w?.items.find(i => i.exId === e.exId) || { exId: e.exId, sets: e.sets.length, repMin: 5, repMax: 10 };
      const last = lastSession(e.exId, date), pr = progression(it, last), u = unitOf(e.exId);
      let hint, hc = '';
      if (!last) hint = ex?.start ? `Pierwszy raz – punkt startowy z planu: ${kg(ex.start)} kg. Dopasuj do siebie (RIR 2–3).` : 'Pierwszy raz – dobierz ciężar tak, by zostało RIR 2–3.';
      else if (pr.up) { hint = `↑ Wszystkie serie na górze zakresu przy RIR ≥2 – dziś +${kg(exInc(e.exId))} kg`; hc = 'up'; }
      else if (pr.blocked) hint = 'Górny zakres był, ale RIR <2 – zostań przy tym ciężarze, wróć do RIR 2–3.';
      else hint = `Cel: ${it.repMax} ${u} we wszystkich seriach przy RIR ≥2, potem podnieś ciężar`;
      if (stagnant(e.exId, date)) hint += ' · ⚠️ 3 sesje bez progresu: zmień zakres/wariant albo zrób deload (jeśli sen był dobry).';
      const prev = last ? `Ostatnio (${shortDate(last.date)}): ${last.sets.map(s => `${kg(s.w)}×${s.r}${s.x != null ? ` @${s.x}` : ''}`).join(', ')}` : '';
      const rows = e.sets.map((s, si) => `<div class="set ${s.d ? 'done' : ''}"><span>${si + 1}</span>
        <input inputmode="decimal" data-f="w" data-e="${ei}" data-s="${si}" value="${s.w ? kg(s.w) : ''}" placeholder="${ex?.bw ? 'MC' : 'kg'}">
        <input inputmode="numeric" data-f="r" data-e="${ei}" data-s="${si}" value="${s.r || ''}" placeholder="${u === 'm' ? 'm' : 'powt.'}">
        <input inputmode="numeric" data-f="x" data-e="${ei}" data-s="${si}" value="${s.x ?? ''}" placeholder="RIR">
        <button data-act="tog" data-e="${ei}" data-s="${si}">✓</button></div>`).join('');
      return `<section class="card"><div class="row sp"><h3 data-act="openEx" data-id="${e.exId}">${esc(ex?.name || '?')}</h3><small>${it.sets}×${it.repMin}${it.repMax !== it.repMin ? '–' + it.repMax : ''}${it.rir ? ` · RIR ${it.rir}` : ''}</small></div>
        <div class="hint ${hc}">${hint}</div><div class="hint">${prev}</div>
        <div class="sets"><div class="set hd"><span>#</span><span>${ex?.bw ? 'kg (0 = masa ciała)' : 'kg'}</span><span>${u}</span><span>RIR</span><span></span></div>${rows}</div>
        <div class="btns"><button data-act="addSet" data-e="${ei}">+ seria</button><button data-act="delSet" data-e="${ei}">− seria</button></div></section>`;
    }).join('');
    const used = new Set(l.entries.map(e => e.exId));
    const extra = state.exercises.filter(e => !used.has(e.id));
    const vol = l.entries.reduce((a, e) => a + volume(e.sets.filter(s => s.d)), 0);
    body += `<div class="card"><div class="f" style="margin:0"><label>Dodaj ćwiczenie do tego treningu</label>
      <select data-act="addEx"><option value="">wybierz…</option>${extra.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div></div>
      <p class="muted" style="text-align:center">Objętość: <b>${Math.round(vol)}</b> kg</p>`;
  }
  const top = l && w ? `<div class="card"><div class="row"><div class="grow"><label class="muted">Sen przed treningiem (h)</label><input inputmode="decimal" data-f="sleep" value="${l.sleep ?? ''}" placeholder="np. 7,5"></div>
    ${strength ? `<div class="grow"><label class="muted">Ból barku (0–10)</label><select data-act="pain">${Array.from({ length: 11 }, (_, i) => `<option value="${i}" ${num(l.pain) === i ? 'selected' : ''}>${i}</option>`).join('')}</select></div>` : ''}</div></div>` : '';
  const done = logDone(l);
  const prot = state.protein[date] || 0;
  const extras = state.extras.filter(x => x.date === date);
  const ex = `<h2>Białko</h2><div class="card row sp"><div><b>${prot} / 4 porcji</b><br><small>1 porcja = 35–45 g białka</small></div><div class="btns" style="margin:0"><button data-act="prot" data-d="-1">−</button><button class="pri" data-act="prot" data-d="1">+</button></div></div>
    <h2>Dodatkowa aktywność</h2><div class="card">${extras.map(x => `<div class="li"><div class="grow"><b>${esc(x.name)}</b><small>${x.min} min · RPE ${x.rpe}</small></div><button class="ghost dng" data-act="delExtra" data-id="${x.id}">✕</button></div>`).join('')}
    <div class="ed3"><input id="xname" value="BJJ" aria-label="nazwa"><input id="xmin" inputmode="numeric" placeholder="min"><input id="xrpe" inputmode="numeric" placeholder="RPE 1–10"></div>
    <div class="btns"><button data-act="addExtra">+ Dodaj aktywność</button></div></div>`;
  const cafe = date === today() ? viewCaf() : '';
  return `${hdr(longDate(date), ui.tab !== 'today')}${w ? `<p class="muted" style="margin:0 0 10px">${esc(w.name)}${done ? ' · ✅ zrobiony' : ''}</p>` : ''}
  <div class="card" style="padding:10px"><small class="muted">Zmiana w pracy</small>${shiftSel}</div>${bn}${top}${body}
  <div class="card"><div class="f" style="margin:0"><label>Trening na ten dzień</label><select data-act="override">${opts}</select></div></div>${ex}${cafe}`;
}

function viewCaf() {
  const t = state.settings.sleepAt;
  let out = '';
  if (t) {
    const [h, m] = t.split(':').map(Number);
    const f = min => { let x = h * 60 + m - min; const prev = x < 0; x = ((x % 1440) + 1440) % 1440; return `<b>${pad(Math.floor(x / 60))}:${pad(x % 60)}</b>${prev ? ' (dzień wcześniej)' : ''}`; };
    out = `<p style="margin:8px 0 0">☕ Ostatnia kawa (~100 mg): ${f(528)}<br>⚡ Ostatnia przedtreningówka / energetyk (~200 mg): ${f(792)}</p><p class="muted" style="margin:6px 0 0">Wg raportu: kawa ≥8,8 h, dawka ~200 mg ≥13 h przed snem. Na nocce małe dawki (~100 mg) na początku i w środku zmiany.</p>`;
  }
  return `<h2>Kofeina i sen</h2><div class="card"><div class="f" style="margin:0"><label>O której planujesz zasnąć?</label><input type="time" data-f="sleepAt" value="${esc(t)}"></div>${out}</div>`;
}

function viewRun(l, w) {
  const runs = state.logs.filter(x => x.type === 'run' && logDone(x) && x.date < l.date).sort((a, b) => b.date.localeCompare(a.date));
  const prev = runs[0];
  const d = num(l.run.dist), t = l.run.time;
  return `<section class="card">
    ${w?.note ? `<p class="muted" style="margin-top:0">${esc(w.note)}</p>` : ''}
    <div class="f"><label>Dystans (km)</label><input inputmode="decimal" data-f="dist" value="${d ? kg(d) : ''}" placeholder="np. 5,2"></div>
    <div class="f"><label>Czas (mm:ss lub g:mm:ss)</label><input inputmode="text" data-f="time" value="${t ? hms(t) : ''}" placeholder="np. 28:30"></div>
    <div class="f"><label>Średnie tętno (opcjonalnie)</label><input inputmode="numeric" data-f="hr" value="${l.run.hr || ''}" placeholder="np. 138"></div>
    <div class="f"><label>Notatka</label><input data-f="note" value="${esc(l.run.note)}" placeholder="samopoczucie, trasa, interwały…"></div>
    <div class="stats" style="margin:0"><div><b id="pace">${d && t ? mmss(t / d) : '–'}</b><small>min/km</small></div>
    <div><b>${prev ? kg(num(prev.run.dist)) : '–'}</b><small>poprzednio km</small></div>
    <div><b>${prev && prev.run.time ? mmss(prev.run.time / num(prev.run.dist)) : '–'}</b><small>poprz. tempo</small></div></div></section>`;
}

function viewExList() {
  const runs = state.logs.filter(l => l.type === 'run' && logDone(l));
  const km = runs.reduce((a, l) => a + num(l.run.dist), 0);
  const q = (ui.q || '').toLowerCase();
  const list = state.exercises.filter(e => e.name.toLowerCase().includes(q)).map(e => {
    const s = sessionsFor(e.id), last = s[s.length - 1];
    return `<div class="li" data-act="openEx" data-id="${e.id}"><div class="grow"><b>${esc(e.name)}</b><small>${last ? `ostatnio ${shortDate(last.date)}: ${last.sets.map(x => `${kg(x.w)}×${x.r}`).join(' ')}` : 'brak wpisów'}</small></div><span class="chip">${s.length}×</span></div>`;
  }).join('');
  return `${hdr('Ćwiczenia')}
  <div class="card li" data-act="openEx" data-id="run" style="margin-bottom:12px"><div class="grow"><b>🏃 Bieganie</b><small>${runs.length} biegów · ${kg(km)} km łącznie</small></div><span class="chip">›</span></div>
  <input data-f="q" placeholder="Szukaj ćwiczenia…" value="${esc(ui.q || '')}" style="margin-bottom:10px">
  <div class="card" style="padding:4px 14px">${list || '<p class="muted">Brak wyników.</p>'}</div>`;
}

function chart(pts, fmt) {
  if (pts.length < 2) return '<p class="muted">Wykres pojawi się po co najmniej 2 pomiarach.</p>';
  const W = 320, H = 150, L = 34, R = 8, T = 10, B = 22;
  let lo = Math.min(...pts.map(p => p.y)), hi = Math.max(...pts.map(p => p.y));
  if (hi === lo) { hi += 1; lo -= 1; }
  const X = i => L + (W - L - R) * i / (pts.length - 1), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" fill="var(--acc)"/>`).join('');
  return `<svg class="ch" viewBox="0 0 ${W} ${H}">
    <line x1="${L}" x2="${W - R}" y1="${Y(hi)}" y2="${Y(hi)}" stroke="var(--line)"/><line x1="${L}" x2="${W - R}" y1="${Y(lo)}" y2="${Y(lo)}" stroke="var(--line)"/>
    <text x="${L - 4}" y="${Y(hi) + 3}" text-anchor="end">${fmt(hi)}</text><text x="${L - 4}" y="${Y(lo) + 3}" text-anchor="end">${fmt(lo)}</text>
    <path d="${path}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round"/>${dots}
    <text x="${L}" y="${H - 6}">${shortDate(pts[0].l)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${shortDate(pts[pts.length - 1].l)}</text></svg>`;
}
const seg = (opts, cur, act = 'metric') => `<div class="seg">${opts.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-k="${k}">${t}</button>`).join('')}</div>`;
const delta = (a, b, u = '') => {
  const d = Math.round((a - b) * 100) / 100;
  return d === 0 ? '' : `<span class="chip ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${kg(d)}${u}</span>`;
};

function viewEx() {
  if (ui.exId === 'run') return viewRunStats();
  const ex = exById(ui.exId);
  if (!ex) return hdr('Brak ćwiczenia', true);
  const s = sessionsFor(ex.id);
  const metric = ['e1rm', 'vol', 'reps'].includes(ui.metric) ? ui.metric : 'top';
  const val = { top: topW, e1rm, vol: volume, reps }[metric];
  const pts = s.map(x => ({ l: x.date, y: val(x.sets) }));
  const prSet = s.length ? s.flatMap(x => x.sets).reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a)) : null;
  const hist = [...s].reverse().map((x, i, arr) => {
    const p = arr[i + 1];
    return `<div class="li"><div class="grow"><b>${longDate(x.date)}</b><small>${x.sets.map(t => `${kg(t.w)}×${t.r}`).join(' · ')}</small></div>${p ? (topW(x.sets) > 0 || topW(p.sets) > 0 ? delta(topW(x.sets), topW(p.sets), ' kg') : '') + delta(reps(x.sets), reps(p.sets), ' powt.') : ''}</div>`;
  }).join('');
  return `${hdr(ex.name, true)}
  <div class="stats"><div><b>${prSet ? kg(prSet.w) : '–'}</b><small>rekord kg${prSet ? ` ×${prSet.r}` : ''}</small></div><div><b>${s.length ? kg(Math.round(Math.max(...s.map(x => e1rm(x.sets))) * 10) / 10) : '–'}</b><small>szac. 1RM</small></div><div><b>${s.length}</b><small>treningi</small></div></div>
  ${stagnant(ex.id, '9999') ? banner('warn', '3 ostatnie sesje bez progresu. Zmień zakres powtórzeń lub wariant, a jeśli śpisz dobrze – zrób deload.') : ''}
  <div class="card">${seg([['top', 'Ciężar'], ['e1rm', '1RM'], ['vol', 'Objętość'], ['reps', 'Powt.']], metric)}${chart(pts, v => kg(Math.round(v)))}</div>
  <div class="card"><div class="f"><label>Krok progresji (kg)</label><input inputmode="decimal" data-f="exinc" value="${kg(exInc(ex.id))}"></div>
  <div class="f" style="margin:0"><label>Ciężar startowy przy pierwszym razie (kg)</label><input inputmode="decimal" data-f="exstart" value="${ex.start ? kg(ex.start) : ''}"></div></div>
  <h2>Historia</h2><div class="card" style="padding:4px 14px">${hist || '<p class="muted">Brak wpisów – zrób pierwszy trening.</p>'}</div>
  <div class="btns"><button data-act="renameEx">Zmień nazwę</button></div>`;
}

function viewRunStats() {
  const runs = state.logs.filter(l => l.type === 'run' && logDone(l)).sort((a, b) => a.date.localeCompare(b.date));
  const metric = ['pace', 'hr'].includes(ui.metric) ? ui.metric : 'dist';
  const pts = runs.map(l => ({ l: l.date, y: metric === 'dist' ? num(l.run.dist) : metric === 'hr' ? num(l.run.hr) : (l.run.time ? l.run.time / num(l.run.dist) : 0) })).filter(p => p.y > 0);
  const km = runs.reduce((a, l) => a + num(l.run.dist), 0);
  const best = runs.filter(l => l.run.time).reduce((a, l) => (!a || l.run.time / num(l.run.dist) < a.run.time / num(a.run.dist) ? l : a), null);
  const longest = runs.reduce((a, l) => (!a || num(l.run.dist) > num(a.run.dist) ? l : a), null);
  const hist = [...runs].reverse().map((l, i, arr) => {
    const p = arr[i + 1], pace = l.run.time ? l.run.time / num(l.run.dist) : 0;
    return `<div class="li"><div class="grow"><b>${longDate(l.date)}</b><small>${esc(wById(l.wid)?.name || '')} · ${kg(num(l.run.dist))} km · ${l.run.time ? hms(l.run.time) : '–'}${pace ? ` · ${mmss(pace)}/km` : ''}${l.run.hr ? ` · ${l.run.hr} bpm` : ''}</small></div>${p ? delta(num(l.run.dist), num(p.run.dist), ' km') : ''}</div>`;
  }).join('');
  return `${hdr('Bieganie', true)}
  <div class="stats"><div><b>${kg(km)}</b><small>km razem</small></div><div><b>${longest ? kg(num(longest.run.dist)) : '–'}</b><small>najdłuższy km</small></div><div><b>${best ? mmss(best.run.time / num(best.run.dist)) : '–'}</b><small>najlepsze tempo</small></div></div>
  <div class="card">${seg([['dist', 'Dystans'], ['pace', 'Tempo'], ['hr', 'Tętno']], metric)}${chart(pts, v => metric === 'dist' ? kg(Math.round(v * 10) / 10) : metric === 'hr' ? Math.round(v) : mmss(v))}</div>
  <h2>Historia</h2><div class="card" style="padding:4px 14px">${hist || '<p class="muted">Brak biegów.</p>'}</div>`;
}

/* ---------- ciało: waga, talia, tętno, białko, test 3 km ---------- */
const bodyPts = k => Object.entries(state.body).filter(([, v]) => num(v[k]) > 0).map(([d, v]) => ({ d, y: num(v[k]) })).sort((a, b) => a.d.localeCompare(b.d));
const avgIn = (pts, from, to) => { const a = pts.filter(p => p.d >= from && p.d <= to); return a.length ? a.reduce((s, p) => s + p.y, 0) / a.length : null; };

function recommend() { // reguła praktyczna z raportu (nie wynik RCT)
  const t = today(), wp = bodyPts('w'), cp = bodyPts('waist');
  const w1 = avgIn(wp, addDays(t, -6), t), w0 = avgIn(wp, addDays(t, -20), addDays(t, -14));
  const cNow = cp.length ? cp[cp.length - 1] : null, cOld = [...cp].reverse().find(p => p.d <= addDays(t, -14));
  if (w1 == null || w0 == null || !cNow || !cOld) return { cls: '', txt: 'Za mało danych. Potrzebuję min. 2–3 tygodni pomiarów wagi (rano) i talii (raz w tygodniu).' };
  const rate = ((w1 - w0) / w0 * 100) / 2, dW = cNow.y - cOld.y;
  const base = `Waga: ${rate >= 0 ? '+' : ''}${kg(Math.round(rate * 100) / 100)}%/tydz., talia: ${dW >= 0 ? '+' : ''}${kg(Math.round(dW * 10) / 10)} cm w ~2 tyg. `;
  if (rate < -0.7) return { cls: 'warn', txt: base + 'Masa spada za szybko (>0,7%/tydz.). Dodaj ~1 porcję węglowodanów, sprawdź sen – a jeśli spada też siła, nie tnij dalej.' };
  if (dW <= -0.5 && rate >= -0.5 && rate <= 0.3) return { cls: 'ok', txt: base + 'Talia w dół przy stabilnej masie – idealna rekompozycja. Bez zmian.' };
  if (rate > 0.2 && dW >= 0.5) return { cls: 'warn', txt: base + 'Masa i talia rosną. Zabierz przekąski i kalorie płynne.' };
  if (Math.abs(dW) < 0.5 && Math.abs(rate) < 0.3) return { cls: 'warn', txt: base + 'Talia i masa stoją. Zabierz ~1 porcję węglowodanów/tłuszczu dziennie (np. pieczywo, przekąska).' };
  return { cls: '', txt: base + 'Obraz mieszany – obserwuj jeszcze tydzień, nie zmieniaj jedzenia po jednym pomiarze.' };
}

function viewBody() {
  const d = ui.bdate, b = state.body[d] || {};
  const wp = bodyPts('w'), cp = bodyPts('waist'), hp = bodyPts('hr');
  const m = ['waist', 'hr'].includes(ui.bm) ? ui.bm : 'weight';
  const src = { weight: wp, waist: cp, hr: hp }[m];
  const pts = src.map(p => ({ l: p.d, y: m === 'waist' ? p.y : avgIn(src, addDays(p.d, -6), p.d) }));
  const t = today(), wNow = avgIn(wp, addDays(t, -6), t), cNow = cp.length ? cp[cp.length - 1].y : 0;
  const whtr = cNow ? cNow / state.settings.height : 0;
  const rec = recommend();
  const tests = state.logs.filter(l => l.type === 'run' && logDone(l) && wById(l.wid)?.test).sort((a, b) => b.date.localeCompare(a.date));
  const tl = tests[0];
  const pr7 = Array.from({ length: 7 }, (_, i) => state.protein[addDays(t, -i)] || 0), pAvg = pr7.reduce((a, b) => a + b, 0) / 7;
  return `${hdr('Ciało')}
  <div class="card"><div class="f"><label>Data pomiaru</label><input type="date" data-f="bdate" value="${d}"></div>
    <div class="row"><div class="grow"><label class="muted">Waga rano (kg)</label><input inputmode="decimal" data-f="bw" value="${b.w ? kg(b.w) : ''}"></div>
    <div class="grow"><label class="muted">Talia (cm)</label><input inputmode="decimal" data-f="bwaist" value="${b.waist ? kg(b.waist) : ''}"></div>
    <div class="grow"><label class="muted">Tętno spocz.</label><input inputmode="numeric" data-f="bhr" value="${b.hr || ''}"></div></div>
    <p class="muted" style="margin:8px 0 0">Waga: rano po toalecie, 3–7× w tygodniu (liczy się średnia). Talia: 1× w tygodniu, na wysokości pępka, rano, na wydechu.</p></div>
  <div class="stats"><div><b>${wNow ? kg(Math.round(wNow * 10) / 10) : '–'}</b><small>waga, śr. 7 dni</small></div><div><b>${cNow ? kg(cNow) : '–'}</b><small>talia cm (cel 80–83)</small></div><div><b>${whtr ? whtr.toFixed(2).replace('.', ',') : '–'}</b><small>talia/wzrost</small></div></div>
  ${banner(rec.cls, `<b>Jedzenie bez liczenia kalorii:</b> ${rec.txt}<br><small>Reguła praktyczna z raportu – nie wynik badań. Ocena co 2–3 tygodnie, nie po jednym pomiarze.</small>`)}
  <div class="card">${seg([['weight', 'Waga'], ['waist', 'Talia'], ['hr', 'Tętno']], m, 'bm')}${chart(pts, v => kg(Math.round(v * 10) / 10))}${m !== 'waist' ? '<small class="muted">Wykres pokazuje średnią kroczącą z 7 dni.</small>' : ''}</div>
  <div class="card"><b>Białko:</b> średnio ${kg(Math.round(pAvg * 10) / 10)} / 4 porcje w ostatnich 7 dniach
    <p class="muted" style="margin:6px 0 0">Cel: 4 porcje po 35–45 g (140–180 g dziennie). Licznik porcji jest na ekranie dnia.</p></div>
  <div class="card"><b>Test 3 km</b> ${tl ? `<p style="margin:6px 0 0">Ostatni: ${longDate(tl.date)} – ${hms(tl.run.time)} (${mmss(tl.run.time / num(tl.run.dist))}/km). Następny: ok. ${shortDate(addDays(tl.date, 28))} – ${shortDate(addDays(tl.date, 42))}.</p>` : '<p class="muted" style="margin:6px 0 0">Brak. Zrób test po dobrej nocy (wybierz „Test 3 km” w planie dnia) i powtarzaj co 4–6 tyg.</p>'}
    <p class="muted" style="margin:6px 0 0">Gorszy wynik przy dobrym śnie → dodaj 1 bieg tygodniowo. Lepszy → bez zmian.</p></div>
  ${viewCaf()}`;
}

/* ---------- plan ---------- */
function viewPlan() {
  if (ui.wid) return viewEditWorkout();
  const wopts = sel => `<option value="">–</option>` + state.workouts.map(w => `<option value="${w.id}" ${sel === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
  const sched = DAYS.map((d, i) => `<div class="li"><div class="grow">${d}</div><select data-act="sched" data-i="${i}" style="width:60%">${wopts(state.schedule[i])}</select></div>`).join('');
  const ws = state.workouts.map(w => `<div class="li" data-act="editW" data-id="${w.id}"><div class="grow"><b>${esc(w.name)}</b><small>${w.type === 'run' ? '🏃 bieg' : `${w.items.length} ćwiczeń`}${w.rot ? ` · kolejka ${w.rot}` : ''}</small></div><span class="chip">edytuj ›</span></div>`).join('');
  return `${hdr('Plan')}
  <div class="card"><p style="margin:0">Treningi A i B idą w <b>kolejce</b> (A→B→A→B), niezależnie od dat – bo grafik zmianowy nie trzyma stałych dni. Daty ustawiasz w kalendarzu (dotknij dnia → „Co dziś?”).</p></div>
  <h2>Treningi</h2><div class="card" style="padding:4px 14px">${ws}</div>
  <div class="btns"><button class="pri" data-act="newW">+ Nowy trening</button><button data-act="applyPlan">Dołóż brakujące treningi planu</button></div>
  <h2>Stałe dni tygodnia (opcjonalnie)</h2><div class="card" style="padding:4px 14px">${sched}</div>
  <h2>Ustawienia</h2><div class="card">
    <div class="f"><label>Domyślny krok progresji (kg)</label><input inputmode="decimal" data-f="inc" value="${kg(state.settings.inc)}"></div>
    <div class="f"><label>Domyślna przerwa między seriami (s)</label><input inputmode="numeric" data-f="rest" value="${state.settings.rest}"></div>
    <div class="f" style="margin:0"><label>Wzrost (cm)</label><input inputmode="numeric" data-f="height" value="${state.settings.height}"></div></div>
  <h2>Dane</h2><div class="card"><p class="muted" style="margin-top:0">Dane są tylko w tej przeglądarce. Rób kopię od czasu do czasu.</p>
    <div class="btns"><button data-act="export">Eksport (kopia)</button><button data-act="import">Import</button></div>
    <input type="file" id="file" accept="application/json" hidden>
    <div class="btns"><button class="dng" data-act="reset">Usuń wszystkie dane</button></div></div>`;
}

function viewEditWorkout() {
  const w = wById(ui.wid);
  if (!w) return hdr('Brak treningu', true);
  const items = w.items.map((it, i) => `<div class="ed"><div class="grow"><b>${esc(exById(it.exId)?.name || '?')}</b></div>
    <input inputmode="numeric" data-f="wi" data-k="sets" data-i="${i}" value="${it.sets}">
    <input inputmode="numeric" data-f="wi" data-k="repMin" data-i="${i}" value="${it.repMin}">
    <input inputmode="numeric" data-f="wi" data-k="repMax" data-i="${i}" value="${it.repMax}"></div>
    <div class="btns" style="margin:-2px 0 10px"><button data-act="wUp" data-i="${i}">↑</button><button data-act="wDown" data-i="${i}">↓</button><button class="dng" data-act="wDel" data-i="${i}">Usuń</button></div>`).join('');
  return `${hdr('Edycja treningu', true)}
  <div class="card"><div class="f"><label>Nazwa</label><input data-f="wname" value="${esc(w.name)}"></div>
  <div class="f"><label>Rodzaj</label><select data-act="wtype"><option value="strength" ${w.type === 'strength' ? 'selected' : ''}>Siłowy</option><option value="run" ${w.type === 'run' ? 'selected' : ''}>Bieganie</option></select></div>
  <div class="f" style="margin:0"><label>Opis / notatka planu</label><input data-f="wnote" value="${esc(w.note || '')}"></div></div>
  ${w.type === 'strength' ? `<h2>Ćwiczenia</h2><div class="card"><div class="ed hd"><span style="text-align:left">ćwiczenie</span><span>serie</span><span>od</span><span>do</span></div>${items || '<p class="muted">Brak ćwiczeń.</p>'}
  <div class="f" style="margin-top:12px"><label>Dodaj ćwiczenie (wybierz lub wpisz nowe)</label><input id="newEx" list="exlist" placeholder="nazwa ćwiczenia"><datalist id="exlist">${state.exercises.map(e => `<option value="${esc(e.name)}">`).join('')}</datalist></div>
  <div class="btns"><button class="pri" data-act="wAdd">+ Dodaj</button></div></div>` : ''}
  <div class="btns"><button class="dng" data-act="delW">Usuń trening</button></div>`;
}

const views = { cal: viewCal, today: viewDay, day: viewDay, ex: () => (ui.exId ? viewEx() : viewExList()), body: viewBody, plan: viewPlan };
function render() {
  const tab = ui.tab === 'day' ? 'cal' : ui.tab;
  $('#app').innerHTML = views[ui.tab]();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  wake();
}

/* ---------- timer przerwy ---------- */
const tm = { end: 0, iv: null };
function startTimer(sec) {
  tm.end = Date.now() + sec * 1000;
  clearInterval(tm.iv);
  tm.iv = setInterval(tick, 250);
  tick();
}
function tick() {
  const left = Math.ceil((tm.end - Date.now()) / 1000), el = $('#timer');
  if (left <= 0) { clearInterval(tm.iv); el.hidden = true; try { navigator.vibrate?.([250, 100, 250]); } catch (e) { /* ignore */ } return; }
  el.hidden = false;
  $('#tleft').textContent = mmss(left);
}

/* ekran nie gaśnie podczas treningu */
let lock = null;
async function wake() {
  try {
    if (ui.tab === 'today' || ui.tab === 'day') { if (!lock && navigator.wakeLock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } }
    else if (lock) { lock.release(); lock = null; }
  } catch (e) { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });

/* ---------- akcje ---------- */
const A = {
  tab: t => {
    if (t === 'today') go({ tab: 'today', date: today() });
    else go({ tab: t, exId: null, wid: null });
  },
  back: () => history.back(),
  day: el => {
    const date = el.dataset.date;
    if (ui.shiftMode) { // tryb grafiku: wolne -> D -> N -> wolne
      const cur = state.shifts[date], nx = !cur ? 'D' : cur === 'D' ? 'N' : '';
      if (nx) state.shifts[date] = nx; else delete state.shifts[date];
      save(); render();
    } else go({ tab: 'day', date });
  },
  shiftMode: () => { ui.shiftMode = !ui.shiftMode; render(); },
  setShift: el => { if (el.dataset.k) state.shifts[ui.date] = el.dataset.k; else delete state.shifts[ui.date]; save(); render(); },
  calPrev: () => { const { y, m } = ui.cal; go({ cal: m ? { y, m: m - 1 } : { y: y - 1, m: 11 } }, false); },
  calNext: () => { const { y, m } = ui.cal; go({ cal: m < 11 ? { y, m: m + 1 } : { y: y + 1, m: 0 } }, false); },
  deload: () => { state.deloadDate = today(); save(); render(); },
  openEx: el => go({ tab: 'ex', exId: el.dataset.id }),
  metric: el => go({ metric: el.dataset.k }, false),
  bm: el => go({ bm: el.dataset.k }, false),
  tog: el => {
    const l = getLog(ui.date), e = l.entries[+el.dataset.e], s = e.sets[+el.dataset.s];
    s.d = !s.d;
    commit(l);
    render();
    if (s.d) startTimer(wById(l.wid)?.items.find(i => i.exId === e.exId)?.rest || state.settings.rest);
  },
  addSet: el => {
    const l = getLog(ui.date), e = l.entries[+el.dataset.e], p = e.sets[e.sets.length - 1];
    e.sets.push({ w: p ? p.w : 0, r: p ? p.r : 8, x: null, d: false });
    commit(l); render();
  },
  delSet: el => {
    const l = getLog(ui.date), e = l.entries[+el.dataset.e];
    if (e.sets.length > 1) { e.sets.pop(); commit(l); render(); }
  },
  cutVol: () => { // sen 5–7 h: usuń ostatnią niezrobioną serię z ćwiczeń mających ≥3 serie (~−25%)
    const l = getLog(ui.date);
    if (l.cut) return;
    for (const e of l.entries) {
      if (e.sets.length < 3) continue;
      const i = e.sets.map(s => s.d).lastIndexOf(false);
      if (i >= 0) e.sets.splice(i, 1);
    }
    l.cut = true; commit(l); render();
  },
  pain: el => { const l = getLog(ui.date); l.pain = +el.value; commit(l); render(); },
  addEx: el => {
    if (!el.value) return;
    const l = getLog(ui.date), it = { exId: el.value, sets: 3, repMin: 8, repMax: 12 };
    l.entries.push({ exId: el.value, sets: [0, 1, 2].map(i => suggestSet(it, i, ui.date)) });
    commit(l); render();
  },
  plan: el => {
    const id = el.dataset.wid, w = wById(id);
    if (w?.type === 'strength' && afterNight(ui.date) && !confirm('Dzień po nocce – raport odradza siłownię (niższa synteza białek, gorsza technika). Na pewno?')) return;
    delete drafts[ui.date];
    state.overrides[ui.date] = id;
    save(); render();
  },
  override: el => {
    const date = ui.date, old = state.logs.find(l => l.date === date);
    if (old && logDone(old)) {
      if (!confirm('Ten dzień ma już zapisany trening. Zmiana planu nie usunie wpisów – kontynuować?')) return render();
    } else if (old) state.logs = state.logs.filter(l => l !== old);
    delete drafts[date];
    if (el.value) state.overrides[date] = el.value; else delete state.overrides[date];
    save(); render();
  },
  prot: el => { const d = ui.date; state.protein[d] = Math.max(0, Math.min(8, (state.protein[d] || 0) + +el.dataset.d)); save(); render(); },
  addExtra: () => {
    const name = $('#xname').value.trim() || 'Aktywność', min = Math.round(num($('#xmin').value)), rpe = Math.round(num($('#xrpe').value));
    state.extras.push({ id: uid(), date: ui.date, name, min, rpe });
    save(); render();
  },
  delExtra: el => { state.extras = state.extras.filter(x => x.id !== el.dataset.id); save(); render(); },
  timerAdd: () => { tm.end += 15000; tick(); },
  timerStop: () => { tm.end = 0; tick(); },
  renameEx: () => {
    const ex = exById(ui.exId), n = prompt('Nowa nazwa ćwiczenia:', ex.name);
    if (n && n.trim()) { ex.name = n.trim(); save(); render(); }
  },
  sched: el => { state.schedule[+el.dataset.i] = el.value || null; save(); },
  editW: el => go({ wid: el.dataset.id }),
  newW: () => {
    const w = { id: uid(), name: 'Nowy trening', type: 'strength', items: [], note: '' };
    state.workouts.push(w); save(); go({ wid: w.id });
  },
  applyPlan: () => { applyPlan(state); save(); render(); alert('Gotowe – brakujące treningi planu zostały dołożone.'); },
  delW: () => {
    if (!confirm('Usunąć ten trening z planu? Zapisane wyniki zostają.')) return;
    const id = ui.wid;
    state.workouts = state.workouts.filter(w => w.id !== id);
    state.schedule = state.schedule.map(x => (x === id ? null : x));
    for (const k of Object.keys(state.overrides)) if (state.overrides[k] === id) delete state.overrides[k];
    save(); history.back();
  },
  wtype: el => { wById(ui.wid).type = el.value; save(); render(); },
  wAdd: () => {
    const inp = $('#newEx'), name = inp.value.trim();
    if (!name) return;
    let ex = state.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!ex) { ex = { id: uid(), name }; state.exercises.push(ex); }
    wById(ui.wid).items.push({ exId: ex.id, sets: 3, repMin: 8, repMax: 12 });
    save(); render();
  },
  wUp: el => { const a = wById(ui.wid).items, i = +el.dataset.i; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; save(); render(); } },
  wDown: el => { const a = wById(ui.wid).items, i = +el.dataset.i; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; save(); render(); } },
  wDel: el => { wById(ui.wid).items.splice(+el.dataset.i, 1); save(); render(); },
  export: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }));
    a.download = `silka-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  import: () => $('#file').click(),
  reset: () => {
    if (confirm('Na pewno usunąć WSZYSTKIE dane? Tego nie da się cofnąć.') && confirm('Ostatnie pytanie – usunąć wszystko?')) {
      state = seed(); save(); for (const k in drafts) delete drafts[k]; go({ tab: 'cal', exId: null, wid: null });
    }
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT') return;
  A[el.dataset.act]?.(el);
});

// zmiany pól (bez przerysowywania, żeby nie gubić fokusu)
document.addEventListener('input', e => {
  const el = e.target, f = el.dataset.f;
  if (!f) return;
  if (f === 'q') { ui.q = el.value; const pos = el.selectionStart; render(); const n = $('[data-f=q]'); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (f === 'w' || f === 'r' || f === 'x') {
    const l = getLog(ui.date), s = l.entries[+el.dataset.e].sets[+el.dataset.s];
    s[f] = f === 'w' ? num(el.value) : f === 'x' ? (el.value.trim() === '' ? null : Math.round(num(el.value))) : Math.round(num(el.value));
    commit(l);
  } else if (f === 'dist' || f === 'time' || f === 'note' || f === 'hr') {
    const l = getLog(ui.date);
    if (f === 'dist') l.run.dist = num(el.value);
    else if (f === 'time') l.run.time = parseTime(el.value);
    else if (f === 'hr') l.run.hr = Math.round(num(el.value));
    else l.run.note = el.value;
    commit(l);
    const p = $('#pace');
    if (p) p.textContent = l.run.dist && l.run.time ? mmss(l.run.time / l.run.dist) : '–';
  } else if (f === 'inc') { state.settings.inc = num(el.value) || 2.5; save(); }
  else if (f === 'rest') { state.settings.rest = Math.max(10, Math.round(num(el.value)) || 120); save(); }
  else if (f === 'height') { state.settings.height = num(el.value) || 187; save(); }
  else if (f === 'exinc') { exById(ui.exId).inc = num(el.value) || undefined; save(); }
  else if (f === 'exstart') { exById(ui.exId).start = num(el.value) || 0; save(); }
  else if (f === 'wname') { wById(ui.wid).name = el.value; save(); }
  else if (f === 'wnote') { wById(ui.wid).note = el.value; save(); }
  else if (f === 'wi') { wById(ui.wid).items[+el.dataset.i][el.dataset.k] = Math.max(1, Math.round(num(el.value)) || 1); save(); }
  else if (f === 'bw' || f === 'bwaist' || f === 'bhr') {
    const k = { bw: 'w', bwaist: 'waist', bhr: 'hr' }[f], b = state.body[ui.bdate] ||= {};
    if (num(el.value) > 0) b[k] = num(el.value); else delete b[k];
    if (!Object.keys(b).length) delete state.body[ui.bdate];
    save();
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.tagName === 'SELECT' && el.dataset.act) A[el.dataset.act](el);
  else if (el.dataset.f === 'sleep') { const l = getLog(ui.date); l.sleep = el.value.trim() === '' ? null : num(el.value); commit(l); render(); }
  else if (el.dataset.f === 'sleepAt') { state.settings.sleepAt = el.value; save(); render(); }
  else if (el.dataset.f === 'bdate') { ui.bdate = el.value || today(); render(); }
  else if (['bw', 'bwaist', 'bhr'].includes(el.dataset.f)) render();
  if (el.id === 'file' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!s.workouts || !s.logs || !s.exercises) throw new Error('to nie jest plik z kopią Siłki');
        if (!confirm('Zastąpić obecne dane danymi z pliku?')) return;
        state = fill(s); save(); go({ tab: 'cal', exId: null, wid: null });
      } catch (err) { alert('Błąd importu: ' + err.message); }
    };
    r.readAsText(el.files[0]);
  }
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
