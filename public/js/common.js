window.GameUI = window.GameUI || {};

// ----- language -----
// The choice is remembered per device. Without a saved choice we follow the browser
// (Hebrew browsers get Hebrew); phones without a saved choice follow the room's language.
const I18N = {
  key: 'lang',
  saved() { try { return localStorage.getItem(this.key); } catch (e) { return null; } },
  save(l) { try { localStorage.setItem(this.key, l); } catch (e) {} },
  browser() {
    const ls = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
    return ls.some((l) => /^(he|iw)\b/i.test(l)) ? 'he' : 'en';
  },
  // Apply a language without saving it (e.g. following the room).
  apply(l) {
    if (l === T.lang()) return false;
    T.setLang(l);
    translateStatic();
    document.dispatchEvent(new CustomEvent('langchange', { detail: l }));
    return true;
  },
  choose(l) { this.save(l); this.apply(l); },
  follow(roomLang) { if (!this.saved() && roomLang) this.apply(roomLang); },
};
window.I18N = I18N;
T.setLang(I18N.saved() || I18N.browser());

// Static page text: <el data-t="English">, data-t-ph for placeholders.
function translateStatic(root = document) {
  root.querySelectorAll('[data-t]').forEach((el) => { el.innerHTML = T(el.dataset.t); });
  root.querySelectorAll('[data-t-ph]').forEach((el) => { el.placeholder = T(el.dataset.tPh); });
  root.querySelectorAll('[data-t-title]').forEach((el) => { el.title = T(el.dataset.tTitle); });
  const tt = document.querySelector('title[data-t-doc]');
  if (tt) document.title = T(tt.dataset.tDoc);
}
window.translateStatic = translateStatic;
document.addEventListener('DOMContentLoaded', () => translateStatic());
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-lang-toggle]');
  if (!b) return;
  e.preventDefault();
  I18N.choose(T.lang() === 'he' ? 'en' : 'he');
});

const U = {
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  // "A, B and C" with each name in bold (Hebrew: "A, B ו־C")
  nameList(v, arr, bold = true) {
    return T.list(arr.map((i) => ({ raw: bold ? `<b>${U.bdi(v.names[i])}</b>` : U.bdi(v.names[i]), text: v.names[i] })));
  },
  bdi(s) {
    return `<bdi>${U.esc(s)}</bdi>`;
  },
  // Button that switches between English and Hebrew. Shows the other language's name.
  langBtn(cls = 'ghost small') {
    const he = T.lang() === 'he';
    return `<button class="${cls} lang-btn" data-lang-toggle lang="${he ? 'en' : 'he'}" title="${he ? 'Switch to English' : 'החלפה לעברית'}">🌐 ${he ? 'English' : 'עברית'}</button>`;
  },
  // Toast a server error ({ error, err }) in the current language.
  err(r) {
    if (r && (r.err || r.error)) U.toast(T.text(r.err || r.error));
  },
  nplayers(n) {
    return T.n(n, '1 player', '{n} players');
  },
  range(g) {
    return g.min === g.max ? U.nplayers(g.min) : T('{min}-{max} players', { min: g.min, max: g.max });
  },
  toast(msg, info) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'show' + (info ? ' info' : '');
    clearTimeout(U._tt);
    U._tt = setTimeout(() => (t.className = info ? 'info' : ''), 2600);
  },
  RANK: (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r)),
  SUIT: { S: '♠', H: '♥', D: '♦', C: '♣' },
  SUITNAME: { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' },
  // Text that comes in both languages ({ en, he }), e.g. Point Party questions.
  loc(x) {
    return x && typeof x === 'object' ? x[T.lang()] ?? x.en : x;
  },
  card(c, cls = '', attrs = '') {
    if (!c) return `<div class="card empty ${cls}"></div>`;
    const red = c.s === 'H' || c.s === 'D';
    return `<div class="card ${red ? 'red' : ''} ${cls}" dir="ltr" data-id="${c.id}" ${attrs}><span class="corner">${U.RANK(c.r)}${U.SUIT[c.s]}</span><span class="r">${U.RANK(c.r)}</span><span class="s">${U.SUIT[c.s]}</span></div>`;
  },
  back(cls = '') {
    return `<div class="card back ${cls}"></div>`;
  },
  name(v, i) {
    return `<span class="pc${i}"><span class="dot"></span>${U.bdi(v.names[i])}</span>`;
  },
  players(v, extra = () => '') {
    return `<ul class="plist">${v.names
      .map((n, i) => `<li class="pc${i} ${v.turn === i && !v.over ? 'turn' : ''}"><span class="dot"></span><span class="grow">${U.bdi(n)}</span>${extra(i)}</li>`)
      .join('')}</ul>`;
  },
  log(v) {
    return `<div class="log">${(v.log || []).map((l) => `<div>${T.html(l)}</div>`).join('')}</div>`;
  },
  // Attach click handlers: root.querySelectorAll(sel) -> fn(el)
  on(root, sel, fn) {
    root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); fn(el, e); }));
  },
  modal(html) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal">${html}<div class="center" style="margin-top:12px"><button class="secondary" data-close>${T('Close')}</button></div></div>`;
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.hasAttribute('data-close')) bg.remove(); });
    document.body.appendChild(bg);
    return bg;
  },
  rules(game) {
    U.modal(`<h2>${game.icon} ${U.esc(T(game.name))}</h2><p class="muted">${U.range(game)}</p><ol>${game.rules.map((r) => `<li>${U.esc(T(r))}</li>`).join('')}</ol>`);
  },
};
window.U = U;

async function loadGames() {
  const res = await fetch('/api/games');
  const list = await res.json();
  window.GAME_LIST = list;
  window.GAME_BY_ID = Object.fromEntries(list.map((g) => [g.id, g]));
  return list;
}
window.loadGames = loadGames;

// Settings controls for games that have options (e.g. The Killer)
U.optionsHTML = function (game, values) {
  if (!game || !game.options || !game.options.length) return '';
  return `<div class="col opts">${game.options.map((o) => {
    const v = values[o.key];
    if (o.type === 'bool') return `<label class="row" style="justify-content:space-between"><span>${U.esc(T(o.label))}</span><button class="small ${v ? '' : 'secondary'}" data-opt="${o.key}" data-val="${v ? 0 : 1}">${v ? T('Yes') : T('No')}</button></label>`;
    if (o.type === 'choice') return `<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span>${U.esc(T(o.label))}</span><span class="row" style="gap:6px;flex-wrap:nowrap"><button class="secondary small" data-opt="${o.key}" data-val="${v <= o.min ? o.max : v - 1}" aria-label="${T('Previous')}">${T.isRTL() ? '›' : '‹'}</button><b style="min-width:7em;text-align:center">${U.esc(T(o.choices[v]))}</b><button class="secondary small" data-opt="${o.key}" data-val="${v >= o.max ? o.min : v + 1}" aria-label="${T('Next')}">${T.isRTL() ? '‹' : '›'}</button></span></div>`;
    return `<div class="row" style="justify-content:space-between"><span>${U.esc(T(o.label))}</span><span class="row" style="gap:6px"><button class="secondary small" data-opt="${o.key}" data-val="${v - 1}" ${v <= o.min ? 'disabled' : ''}>−</button><b style="min-width:1.6em;text-align:center">${v}</b><button class="secondary small" data-opt="${o.key}" data-val="${v + 1}" ${v >= o.max ? 'disabled' : ''}>+</button></span></div>`;
  }).join('')}</div>`;
};
U.bindOptions = function (root, emit) {
  U.on(root, '[data-opt]', (b) => emit('room:options', { key: b.dataset.opt, value: Number(b.dataset.val) }));
};

// Live countdowns: any element with data-deadline (ms timestamp) shows m:ss
U.fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => { el.textContent = U.fmt(Number(el.dataset.deadline) - Date.now()); });
}, 250);

// Small version badge in the corner of every page, so you can tell which deploy is live.
fetch('/api/version')
  .then((r) => r.json())
  .then((v) => {
    const el = document.createElement('div');
    el.className = 'version-badge';
    el.textContent = 'v' + v.version + (v.commit ? ' · ' + v.commit : '');
    document.body.appendChild(el);
  })
  .catch(() => {});
