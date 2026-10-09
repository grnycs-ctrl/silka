'use strict';
/* Siłka – osobisty tracker treningów (siłownia + bieganie). Dane trzymane lokalnie w localStorage. */

const KEY = 'silka_v1';
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
const wd = s => (parse(s).getDay() + 6) % 7; // 0 = poniedziałek
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const kg = n => String(Math.round(n * 100) / 100).replace('.', ',');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const longDate = s => cap(parse(s).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }));
const shortDate = s => parse(s).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
const mmss = t => { t = Math.max(0, Math.round(t)); return `${Math.floor(t / 60)}:${pad(t % 60)}`; };
const hms = t => { t = Math.round(t); const h = Math.floor(t / 3600); return h ? `${h}:${pad(Math.floor(t % 3600 / 60))}:${pad(t % 60)}` : mmss(t); };
// "25:30", "1:05:00" lub samo "25" (minuty) -> sekundy
const parseTime = s => {
  s = String(s).trim().replace(',', '.');
  if (!s) return 0;
  const p = s.split(':').map(Number);
  if (p.some(x => !isFinite(x))) return 0;
  if (p.length === 1) return Math.round(p[0] * 60);
  if (p.length === 2) return p[0] * 60 + p[1];
  return p[0] * 3600 + p[1] * 60 + p[2];
};

/* ---------- stan ---------- */
function seed() {
  const names = ['Wyciskanie sztangi leżąc', 'Wyciskanie hantli skos', 'Wyciskanie nad głowę', 'Triceps linka',
    'Podciąganie', 'Wiosłowanie sztangą', 'Ściąganie drążka', 'Biceps hantle',
    'Przysiad', 'Martwy ciąg rumuński', 'Wypychanie nóg', 'Uginanie nóg'];
  const exercises = names.map(name => ({ id: uid(), name }));
  const id = n => exercises.find(e => e.name === n).id;
  const it = (n, sets, repMin, repMax) => ({ exId: id(n), sets, repMin, repMax });
  const w = (name, type, items, note = '') => ({ id: uid(), name, type, items, note });
  const workouts = [
    w('Push', 'strength', [it('Wyciskanie sztangi leżąc', 4, 6, 8), it('Wyciskanie hantli skos', 3, 8, 12), it('Wyciskanie nad głowę', 3, 8, 10), it('Triceps linka', 3, 10, 15)]),
    w('Pull', 'strength', [it('Podciąganie', 4, 6, 10), it('Wiosłowanie sztangą', 4, 6, 10), it('Ściąganie drążka', 3, 8, 12), it('Biceps hantle', 3, 10, 12)]),
    w('Nogi', 'strength', [it('Przysiad', 4, 5, 8), it('Martwy ciąg rumuński', 3, 8, 10), it('Wypychanie nóg', 3, 10, 15), it('Uginanie nóg', 3, 10, 15)]),
    w('Bieg', 'run', [], 'Spokojny bieg w tempie rozmownym'),
  ];
  const [push, pull, legs, run] = workouts.map(x => x.id);
  return {
    exercises, workouts,
    schedule: [push, run, pull, null, legs, run, null], // Pn..Nd
    overrides: {}, // data -> id treningu | 'rest'
    logs: [],
    settings: { inc: 2.5, rest: 90 },
  };
}
let state = (() => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.workouts) return s; } catch (e) { /* ignore */ }
  return seed();
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Nie można zapisać danych: ' + e.message); } };
try { navigator.storage?.persist?.(); } catch (e) { /* ignore */ }

const exById = id => state.exercises.find(e => e.id === id);
const wById = id => state.workouts.find(w => w.id === id);
const exInc = id => num(exById(id)?.inc) || state.settings.inc;

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

/* ---------- logi i progresja ---------- */
const drafts = {}; // szkice logów (jeszcze nie zapisane, dopóki nic nie wpiszesz)

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

// Podwójna progresja: gdy wszystkie serie na górnym zakresie powtórzeń -> +krok i powrót do dolnego zakresu.
function progression(it, last) {
  if (!last) return null;
  return { up: last.sets.length >= it.sets && last.sets.every(s => s.r >= it.repMax) };
}
function suggestSet(it, i, date) {
  const last = lastSession(it.exId, date);
  if (!last) return { w: 0, r: it.repMin, d: false };
  const b = last.sets[Math.min(i, last.sets.length - 1)];
  if (progression(it, last).up) return { w: b.w + exInc(it.exId), r: it.repMin, d: false };
  return { w: b.w, r: Math.min(b.r + 1, it.repMax), d: false };
}
function buildLog(date, w) {
  if (!w) return null;
  if (w.type === 'run') return { id: uid(), date, wid: w.id, type: 'run', run: { dist: 0, time: 0, note: '' } };
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

/* ---------- nawigacja ---------- */
let ui = { tab: 'cal', date: today(), cal: { y: new Date().getFullYear(), m: new Date().getMonth() }, exId: null, wid: null, metric: 'top' };
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

function viewCal() {
  const { y, m } = ui.cal;
  const first = new Date(y, m, 1), off = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
  const t = today();
  let cells = DS.map(d => `<div class="dn">${d}</div>`).join('') + '<div class="d o"></div>'.repeat(off);
  let doneS = 0, doneR = 0, km = 0;
  for (let d = 1; d <= n; d++) {
    const date = iso(new Date(y, m, d));
    const dl = doneLog(date), w = dayWorkout(date);
    const type = dl ? dl.type : w?.type;
    let cls = 'none';
    if (type) cls = (type === 'run' ? 'run' : '') + (dl ? ' done' : date < t ? ' miss' : '');
    if (dl) { dl.type === 'run' ? (doneR++, km += num(dl.run.dist)) : doneS++; }
    cells += `<button class="d ${date === t ? 'today' : ''}" data-act="day" data-date="${date}">${d}<span class="dot ${cls}"></span></button>`;
  }
  const title = cap(first.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }));
  const tw = dayWorkout(t);
  return `${hdr('Kalendarz')}
  <div class="cal-h"><button data-act="calPrev">‹</button><b>${title}</b><button data-act="calNext">›</button></div>
  <div class="cal">${cells}</div>
  <div class="legend"><span><i class="dot done"></i>siła zrobiona</span><span><i class="dot run done"></i>bieg zrobiony</span><span><i class="dot"></i>zaplanowany</span><span><i class="dot miss"></i>ominięty</span></div>
  <div class="stats"><div><b>${doneS}</b><small>treningi siłowe</small></div><div><b>${doneR}</b><small>biegi</small></div><div><b>${kg(km)}</b><small>km w miesiącu</small></div></div>
  <div class="card row sp"><div><small>Dziś, ${longDate(t)}</small><h3>${tw ? esc(tw.name) : 'Odpoczynek'}</h3></div>${tw ? '<button class="pri" data-act="tab" data-tab="today">Start</button>' : ''}</div>`;
}

function viewDay() {
  const date = ui.date;
  const l = getLog(date);
  const w = l ? wById(l.wid) : dayWorkout(date);
  const opts = `<option value="">Domyślny dla dnia (${DAYS[wd(date)].toLowerCase()})</option><option value="rest" ${state.overrides[date] === 'rest' ? 'selected' : ''}>Odpoczynek</option>` +
    state.workouts.map(x => `<option value="${x.id}" ${state.overrides[date] === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const sel = `<div class="card"><div class="f" style="margin:0"><label>Trening na ten dzień</label><select data-act="override">${opts}</select></div></div>`;
  let body = '';
  if (!l) {
    body = `<div class="card"><h3>Odpoczynek 😴</h3><p class="muted">Brak zaplanowanego treningu. Wybierz inny powyżej, jeśli chcesz.</p></div>`;
  } else if (l.type === 'run') {
    body = viewRun(l, w);
  } else {
    body = l.entries.map((e, ei) => {
      const ex = exById(e.exId);
      const it = w?.items.find(i => i.exId === e.exId) || { exId: e.exId, sets: e.sets.length, repMin: 5, repMax: 10 };
      const last = lastSession(e.exId, date), pr = progression(it, last);
      const hint = !last ? 'Pierwszy raz – dobierz ciężar. Od kolejnego treningu podpowiem progresję.'
        : pr.up ? `↑ Poprzednio wszystkie serie na górnym zakresie – dziś +${kg(exInc(e.exId))} kg`
          : `Cel: dobić do ${it.repMax} powt. we wszystkich seriach, potem podnieś ciężar`;
      const prev = last ? `Ostatnio (${shortDate(last.date)}): ${last.sets.map(s => `${kg(s.w)}×${s.r}`).join(', ')}` : '';
      const rows = e.sets.map((s, si) => `<div class="set ${s.d ? 'done' : ''}"><span>${si + 1}</span>
        <input inputmode="decimal" data-f="w" data-e="${ei}" data-s="${si}" value="${s.w ? kg(s.w) : ''}" placeholder="kg">
        <input inputmode="numeric" data-f="r" data-e="${ei}" data-s="${si}" value="${s.r || ''}" placeholder="powt.">
        <button data-act="tog" data-e="${ei}" data-s="${si}">✓</button></div>`).join('');
      return `<section class="card"><div class="row sp"><h3 data-act="openEx" data-id="${e.exId}">${esc(ex?.name || '?')}</h3><small>${it.sets}×${it.repMin}–${it.repMax}</small></div>
        <div class="hint ${pr?.up ? 'up' : ''}">${hint}</div><div class="hint">${prev}</div>
        <div class="sets"><div class="set hd"><span>#</span><span>kg</span><span>powt.</span><span></span></div>${rows}</div>
        <div class="btns"><button data-act="addSet" data-e="${ei}">+ seria</button><button data-act="delSet" data-e="${ei}">− seria</button></div></section>`;
    }).join('');
    const used = new Set(l.entries.map(e => e.exId));
    const extra = state.exercises.filter(e => !used.has(e.id));
    const vol = l.entries.reduce((a, e) => a + volume(e.sets.filter(s => s.d)), 0);
    body += `<div class="card"><div class="f" style="margin:0"><label>Dodaj ćwiczenie do tego treningu</label>
      <select data-act="addEx"><option value="">wybierz…</option>${extra.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></div></div>
      <p class="muted" style="text-align:center">Objętość: <b>${Math.round(vol)}</b> kg</p>`;
  }
  const done = logDone(l);
  return `${hdr(longDate(date), ui.tab !== 'today')}${w ? `<p class="muted" style="margin:0 0 10px">${esc(w.name)}${done ? ' · ✅ zrobiony' : ''}</p>` : ''}${body}${sel}`;
}

function viewRun(l, w) {
  const runs = state.logs.filter(x => x.type === 'run' && logDone(x) && x.date < l.date).sort((a, b) => b.date.localeCompare(a.date));
  const prev = runs[0];
  const d = num(l.run.dist), t = l.run.time;
  return `<section class="card">
    ${w?.note ? `<p class="muted" style="margin-top:0">${esc(w.note)}</p>` : ''}
    <div class="f"><label>Dystans (km)</label><input inputmode="decimal" data-f="dist" value="${d ? kg(d) : ''}" placeholder="np. 5,2"></div>
    <div class="f"><label>Czas (mm:ss lub g:mm:ss)</label><input inputmode="text" data-f="time" value="${t ? hms(t) : ''}" placeholder="np. 28:30"></div>
    <div class="f"><label>Notatka</label><input data-f="note" value="${esc(l.run.note)}" placeholder="samopoczucie, trasa…"></div>
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
  if (pts.length < 2) return '<p class="muted">Wykres pojawi się po co najmniej 2 treningach.</p>';
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
const seg = (opts, cur) => `<div class="seg">${opts.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" data-act="metric" data-k="${k}">${t}</button>`).join('')}</div>`;
const delta = (a, b, u = '') => {
  const d = Math.round((a - b) * 100) / 100;
  return d === 0 ? '' : `<span class="chip ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : ''}${kg(d)}${u}</span>`;
};

function viewEx() {
  if (ui.exId === 'run') return viewRunStats();
  const ex = exById(ui.exId);
  if (!ex) return hdr('Brak ćwiczenia', true);
  const s = sessionsFor(ex.id);
  const metric = ui.metric === 'e1rm' || ui.metric === 'vol' ? ui.metric : 'top';
  const val = { top: topW, e1rm, vol: volume }[metric];
  const pts = s.map(x => ({ l: x.date, y: val(x.sets) }));
  const prSet = s.length ? s.flatMap(x => x.sets).reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a)) : null;
  const hist = [...s].reverse().map((x, i, arr) => {
    const p = arr[i + 1];
    return `<div class="li"><div class="grow"><b>${longDate(x.date)}</b><small>${x.sets.map(t => `${kg(t.w)}×${t.r}`).join(' · ')}</small></div>${p ? delta(topW(x.sets), topW(p.sets), ' kg') + delta(volume(x.sets), volume(p.sets), '') : ''}</div>`;
  }).join('');
  return `${hdr(ex.name, true)}
  <div class="stats"><div><b>${prSet ? kg(prSet.w) : '–'}</b><small>rekord kg${prSet ? ` ×${prSet.r}` : ''}</small></div><div><b>${s.length ? kg(Math.round(Math.max(...s.map(x => e1rm(x.sets))) * 10) / 10) : '–'}</b><small>szac. 1RM</small></div><div><b>${s.length}</b><small>treningi</small></div></div>
  <div class="card">${seg([['top', 'Maks. ciężar'], ['e1rm', 'Szac. 1RM'], ['vol', 'Objętość']], metric)}${chart(pts, v => kg(Math.round(v)))}</div>
  <div class="card"><div class="f" style="margin:0"><label>Krok progresji dla tego ćwiczenia (kg)</label><input inputmode="decimal" data-f="exinc" value="${kg(exInc(ex.id))}"></div></div>
  <h2>Historia</h2><div class="card" style="padding:4px 14px">${hist || '<p class="muted">Brak wpisów – zrób pierwszy trening.</p>'}</div>
  <div class="btns"><button data-act="renameEx">Zmień nazwę</button></div>`;
}

function viewRunStats() {
  const runs = state.logs.filter(l => l.type === 'run' && logDone(l)).sort((a, b) => a.date.localeCompare(b.date));
  const metric = ui.metric === 'pace' ? 'pace' : 'dist';
  const pts = runs.map(l => ({ l: l.date, y: metric === 'dist' ? num(l.run.dist) : (l.run.time ? l.run.time / num(l.run.dist) : 0) })).filter(p => p.y > 0);
  const km = runs.reduce((a, l) => a + num(l.run.dist), 0);
  const best = runs.filter(l => l.run.time).reduce((a, l) => (!a || l.run.time / num(l.run.dist) < a.run.time / num(a.run.dist) ? l : a), null);
  const longest = runs.reduce((a, l) => (!a || num(l.run.dist) > num(a.run.dist) ? l : a), null);
  const hist = [...runs].reverse().map((l, i, arr) => {
    const p = arr[i + 1], pace = l.run.time ? l.run.time / num(l.run.dist) : 0;
    return `<div class="li"><div class="grow"><b>${longDate(l.date)}</b><small>${kg(num(l.run.dist))} km · ${l.run.time ? hms(l.run.time) : '–'}${pace ? ` · ${mmss(pace)}/km` : ''}</small></div>${p ? delta(num(l.run.dist), num(p.run.dist), ' km') : ''}</div>`;
  }).join('');
  return `${hdr('Bieganie', true)}
  <div class="stats"><div><b>${kg(km)}</b><small>km razem</small></div><div><b>${longest ? kg(num(longest.run.dist)) : '–'}</b><small>najdłuższy km</small></div><div><b>${best ? mmss(best.run.time / num(best.run.dist)) : '–'}</b><small>najlepsze tempo</small></div></div>
  <div class="card">${seg([['dist', 'Dystans'], ['pace', 'Tempo']], metric)}${chart(pts, v => metric === 'dist' ? kg(Math.round(v * 10) / 10) : mmss(v))}</div>
  <h2>Historia</h2><div class="card" style="padding:4px 14px">${hist || '<p class="muted">Brak biegów.</p>'}</div>`;
}

function viewPlan() {
  if (ui.wid) return viewEditWorkout();
  const wopts = sel => `<option value="">Odpoczynek</option>` + state.workouts.map(w => `<option value="${w.id}" ${sel === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
  const sched = DAYS.map((d, i) => `<div class="li"><div class="grow">${d}</div><select data-act="sched" data-i="${i}" style="width:60%">${wopts(state.schedule[i])}</select></div>`).join('');
  const ws = state.workouts.map(w => `<div class="li" data-act="editW" data-id="${w.id}"><div class="grow"><b>${esc(w.name)}</b><small>${w.type === 'run' ? '🏃 bieg' : `${w.items.length} ćwiczeń`}</small></div><span class="chip">edytuj ›</span></div>`).join('');
  return `${hdr('Plan')}
  <h2>Plan tygodnia</h2><div class="card" style="padding:4px 14px">${sched}</div>
  <h2>Treningi</h2><div class="card" style="padding:4px 14px">${ws}</div>
  <div class="btns"><button class="pri" data-act="newW">+ Nowy trening</button></div>
  <h2>Ustawienia</h2><div class="card">
    <div class="f"><label>Domyślny krok progresji (kg)</label><input inputmode="decimal" data-f="inc" value="${kg(state.settings.inc)}"></div>
    <div class="f"><label>Przerwa między seriami (s)</label><input inputmode="numeric" data-f="rest" value="${state.settings.rest}"></div></div>
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
  <div class="f" style="margin:0"><label>Opis / notatka planu</label><input data-f="wnote" value="${esc(w.note || '')}" placeholder="np. 5 km spokojnie"></div></div>
  ${w.type === 'strength' ? `<h2>Ćwiczenia</h2><div class="card"><div class="ed hd"><span style="text-align:left">ćwiczenie</span><span>serie</span><span>od</span><span>do</span></div>${items || '<p class="muted">Brak ćwiczeń.</p>'}
  <div class="f" style="margin-top:12px"><label>Dodaj ćwiczenie (wybierz lub wpisz nowe)</label><input id="newEx" list="exlist" placeholder="nazwa ćwiczenia"><datalist id="exlist">${state.exercises.map(e => `<option value="${esc(e.name)}">`).join('')}</datalist></div>
  <div class="btns"><button class="pri" data-act="wAdd">+ Dodaj</button></div></div>` : ''}
  <div class="btns"><button class="dng" data-act="delW">Usuń trening</button></div>`;
}

const views = { cal: viewCal, today: viewDay, day: viewDay, ex: () => ui.exId ? viewEx() : viewExList(), plan: viewPlan };
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
  day: el => go({ tab: 'day', date: el.dataset.date }),
  calPrev: () => { const { y, m } = ui.cal; go({ cal: m ? { y, m: m - 1 } : { y: y - 1, m: 11 } }, false); },
  calNext: () => { const { y, m } = ui.cal; go({ cal: m < 11 ? { y, m: m + 1 } : { y: y + 1, m: 0 } }, false); },
  openEx: el => go({ tab: 'ex', exId: el.dataset.id }),
  metric: el => go({ metric: el.dataset.k }, false),
  tog: el => {
    const l = getLog(ui.date), s = l.entries[+el.dataset.e].sets[+el.dataset.s];
    s.d = !s.d;
    commit(l);
    render();
    if (s.d) startTimer(state.settings.rest);
  },
  addSet: el => {
    const l = getLog(ui.date), e = l.entries[+el.dataset.e], p = e.sets[e.sets.length - 1];
    e.sets.push({ w: p ? p.w : 0, r: p ? p.r : 8, d: false });
    commit(l); render();
  },
  delSet: el => {
    const l = getLog(ui.date), e = l.entries[+el.dataset.e];
    if (e.sets.length > 1) { e.sets.pop(); commit(l); render(); }
  },
  addEx: el => {
    if (!el.value) return;
    const l = getLog(ui.date);
    l.entries.push({ exId: el.value, sets: [suggestSet({ exId: el.value, sets: 3, repMin: 8, repMax: 12 }, 0, ui.date), suggestSet({ exId: el.value, sets: 3, repMin: 8, repMax: 12 }, 1, ui.date), suggestSet({ exId: el.value, sets: 3, repMin: 8, repMax: 12 }, 2, ui.date)] });
    commit(l); render();
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
  if (f === 'w' || f === 'r') {
    const l = getLog(ui.date), s = l.entries[+el.dataset.e].sets[+el.dataset.s];
    s[f] = f === 'w' ? num(el.value) : Math.round(num(el.value));
    commit(l);
  } else if (f === 'dist' || f === 'time' || f === 'note') {
    const l = getLog(ui.date);
    if (f === 'dist') l.run.dist = num(el.value);
    else if (f === 'time') l.run.time = parseTime(el.value);
    else l.run.note = el.value;
    commit(l);
    const p = $('#pace');
    if (p) p.textContent = l.run.dist && l.run.time ? mmss(l.run.time / l.run.dist) : '–';
  } else if (f === 'inc') { state.settings.inc = num(el.value) || 2.5; save(); }
  else if (f === 'rest') { state.settings.rest = Math.max(10, Math.round(num(el.value)) || 90); save(); }
  else if (f === 'exinc') { exById(ui.exId).inc = num(el.value) || undefined; save(); }
  else if (f === 'wname') { wById(ui.wid).name = el.value; save(); }
  else if (f === 'wnote') { wById(ui.wid).note = el.value; save(); }
  else if (f === 'wi') { wById(ui.wid).items[+el.dataset.i][el.dataset.k] = Math.max(1, Math.round(num(el.value)) || 1); save(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.tagName === 'SELECT' && el.dataset.act) A[el.dataset.act](el);
  if (el.id === 'file' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!s.workouts || !s.logs || !s.exercises) throw new Error('to nie jest plik z kopią Siłki');
        if (!confirm('Zastąpić obecne dane danymi z pliku?')) return;
        state = s; save(); go({ tab: 'cal', exId: null, wid: null });
      } catch (err) { alert('Błąd importu: ' + err.message); }
    };
    r.readAsText(el.files[0]);
  }
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
