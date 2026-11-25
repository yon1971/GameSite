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
