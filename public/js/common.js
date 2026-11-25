window.GameUI = window.GameUI || {};

const U = {
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
  card(c, cls = '', attrs = '') {
    if (!c) return `<div class="card empty ${cls}"></div>`;
    const red = c.s === 'H' || c.s === 'D';
    return `<div class="card ${red ? 'red' : ''} ${cls}" data-id="${c.id}" ${attrs}><span class="corner">${U.RANK(c.r)}${U.SUIT[c.s]}</span><span class="r">${U.RANK(c.r)}</span><span class="s">${U.SUIT[c.s]}</span></div>`;
  },
  back(cls = '') {
    return `<div class="card back ${cls}"></div>`;
  },
  name(v, i) {
    return `<span class="pc${i}"><span class="dot"></span>${U.esc(v.names[i])}</span>`;
  },
  players(v, extra = () => '') {
    return `<ul class="plist">${v.names
      .map((n, i) => `<li class="pc${i} ${v.turn === i && !v.over ? 'turn' : ''}"><span class="dot"></span><span class="grow">${U.esc(n)}</span>${extra(i)}</li>`)
      .join('')}</ul>`;
  },
  log(v) {
    return `<div class="log">${(v.log || []).map((l) => `<div>${U.esc(l)}</div>`).join('')}</div>`;
  },
  // Attach click handlers: root.querySelectorAll(sel) -> fn(el)
  on(root, sel, fn) {
    root.querySelectorAll(sel).forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); fn(el, e); }));
  },
  modal(html) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal">${html}<div class="center" style="margin-top:12px"><button class="secondary" data-close>Close</button></div></div>`;
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.hasAttribute('data-close')) bg.remove(); });
    document.body.appendChild(bg);
    return bg;
  },
  rules(game) {
    U.modal(`<h2>${game.icon} ${U.esc(game.name)}</h2><p class="muted">${game.min === game.max ? game.min : game.min + '-' + game.max} players</p><ol>${game.rules.map((r) => `<li>${U.esc(r)}</li>`).join('')}</ol>`);
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
    if (o.type === 'bool') return `<label class="row" style="justify-content:space-between"><span>${U.esc(o.label)}</span><button class="small ${v ? '' : 'secondary'}" data-opt="${o.key}" data-val="${v ? 0 : 1}">${v ? 'Yes' : 'No'}</button></label>`;
    return `<div class="row" style="justify-content:space-between"><span>${U.esc(o.label)}</span><span class="row" style="gap:6px"><button class="secondary small" data-opt="${o.key}" data-val="${v - 1}" ${v <= o.min ? 'disabled' : ''}>−</button><b style="min-width:1.6em;text-align:center">${v}</b><button class="secondary small" data-opt="${o.key}" data-val="${v + 1}" ${v >= o.max ? 'disabled' : ''}>+</button></span></div>`;
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
