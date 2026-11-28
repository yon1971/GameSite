const socket = io();
const $ = (id) => document.getElementById(id);
let room = null;
let joinInfo = null;
let last = null;

function emit(ev, data) {
  return new Promise((res) => socket.emit(ev, data, (r) => { if (r && !r.ok) U.err(r); res(r); }));
}

async function connect() {
  await loadGames();
  let saved = null;
  try { saved = sessionStorage.getItem('boardRoom'); } catch (e) {}
  if (saved) {
    const r = await new Promise((res) => socket.emit('host:watch', { code: saved }, res));
    if (r && r.ok) { joinInfo = r; socket.emit('room:lang', { lang: T.lang() }); return; }
  }
  const r = await new Promise((res) => socket.emit('host:create', { origin: location.origin, lang: T.lang() }, res));
  joinInfo = r;
  try { sessionStorage.setItem('boardRoom', r.code); } catch (e) {}
}

socket.on('connect', connect);
socket.on('board:state', (s) => { last = s; render(s); });
// The big screen's language is the room's language.
document.addEventListener('langchange', () => {
  socket.emit('room:lang', { lang: T.lang() });
  if (last) render(last);
});

function render({ room: rm, view }) {
  room = rm;
  const game = GAME_BY_ID[rm.gameId];
  const inGame = !!view;

  $('boardWrap').classList.toggle('in-game', inGame);

  // join box
  const jb = $('joinbox');
  jb.className = 'panel joinbox' + (inGame ? ' compact' : '');
  if (joinInfo) {
    const host = location.host;
    jb.innerHTML = `<div class="muted">${T('Join at {host} with code', { host: `<b dir="ltr">${U.esc(host)}</b>` })}</div><div class="code" dir="ltr">${rm.code}</div><img src="${joinInfo.qr}" alt="${T('QR code to join')}"/><div class="muted" style="font-size:.85em;margin-top:4px">${T('Scan with your phone camera')}</div>`;
  }

  // players
  $('players').innerHTML = rm.players.length
    ? `<ul class="plist">${rm.players
        .map((p, i) => `<li class="pc${i} ${p.connected ? '' : 'off'} ${view && view.turn === i && !view.over ? 'turn' : ''}"><span class="dot"></span><span class="grow">${U.bdi(p.name)}${i === 0 ? ' 👑' : ''}</span>${p.connected ? '' : `<span class="muted">${T('offline')}</span>`}${!inGame ? `<button class="ghost small" data-kick="${i}" title="${T('Remove')}">✕</button>` : ''}</li>`)
        .join('')}</ul>`
    : `<p class="muted">${T('Waiting for players to join…')}</p>`;
  U.on($('players'), '[data-kick]', (b) => emit('room:kick', { seat: Number(b.dataset.kick) }));

  // controls
  const c = $('controls');
  if (!inGame) {
    c.innerHTML = game
      ? `<h3>${game.icon} ${U.esc(T(game.name))}</h3><p class="muted">${U.range(game)} · ${T('{n} joined', { n: rm.players.length })}</p><div class="col"><button id="startBtn" ${rm.players.length < game.min || rm.players.length > game.max ? 'disabled' : ''}>${T('Start game')}</button><button class="secondary" id="rulesBtn">${T('Rules')}</button></div>`
      : `<p class="muted">${T('Pick a game to play. The first player to join (👑) can also choose from their phone.')}</p>`;
  } else {
    c.innerHTML = `<h3>${game.icon} ${U.esc(T(game.name))}</h3><div class="col">${view.over ? `<button id="startBtn">${T('Play again')}</button><button class="secondary" id="lobbyBtn">${T('Choose another game')}</button>` : `<button class="secondary" id="rulesBtn">${T('Rules')}</button><button class="ghost" id="lobbyBtn">${T('End game')}</button>`}</div>`;
  }
  c.insertAdjacentHTML('beforeend', `<div class="lang-row"><span class="muted">${T('Language')}</span>${U.langBtn()}</div>`);
  const sb = $('startBtn'); if (sb) sb.onclick = () => emit('room:start');
  const rb = $('rulesBtn'); if (rb) rb.onclick = () => U.rules(game);
  const lb = $('lobbyBtn'); if (lb) lb.onclick = () => { if (view.over || confirmEnd()) emit('room:lobby'); };

  $('logbox').classList.toggle('hidden', !inGame);
  if (inGame) $('log').innerHTML = U.log(view);

  // stage
  const stage = $('stage');
  if (!inGame) {
    stage.innerHTML = `<div><h1 class="logo">${T('Game <span>Night</span>')}</h1><p class="muted">${T('Room {code}. Choose a game:', { code: `<b dir="ltr">${rm.code}</b>` })}</p></div><div class="game-grid" id="picker">${GAME_LIST.map((g) => `<div class="game-tile ${g.id === rm.gameId ? 'selected' : ''}" data-id="${g.id}"><div class="ic">${g.icon}</div><h3>${U.esc(T(g.name))}</h3><p>${U.range(g)}</p><p style="margin-top:6px">${U.esc(T(g.blurb))}</p></div>`).join('')}</div>${game && game.options.length ? `<div class="panel"><h2>${T('Settings')}</h2><div style="max-width:420px">${U.optionsHTML(game, rm.options)}</div></div>` : ''}${game ? `<div class="panel"><h2>${T('How to play {game}', { game: U.esc(T(game.name)) })}</h2><ol>${game.rules.map((r) => `<li>${U.esc(T(r))}</li>`).join('')}</ol></div>` : ''}`;
    U.on(stage, '.game-tile', (t) => emit('room:select', { gameId: t.dataset.id }));
    U.bindOptions(stage, emit);
  } else {
    const ui = GameUI[rm.gameId];
    ui.board(stage, view);
  }
}

let endArmed = 0;
function confirmEnd() {
  // two taps within 3 seconds ends the game (avoids browser confirm dialogs on TVs)
  if (Date.now() - endArmed < 3000) return true;
  endArmed = Date.now();
  U.toast(T('Tap "End game" again to stop this game'), true);
  return false;
}
