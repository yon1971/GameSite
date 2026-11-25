const socket = io();
const $ = (id) => document.getElementById(id);
let room = null;
let joinInfo = null;
let last = null;

function emit(ev, data) {
  return new Promise((res) => socket.emit(ev, data, (r) => { if (r && !r.ok && r.error) U.toast(r.error); res(r); }));
}

async function connect() {
  await loadGames();
  let saved = null;
  try { saved = sessionStorage.getItem('boardRoom'); } catch (e) {}
  if (saved) {
    const r = await new Promise((res) => socket.emit('host:watch', { code: saved }, res));
    if (r && r.ok) { joinInfo = r; return; }
  }
  const r = await new Promise((res) => socket.emit('host:create', { origin: location.origin }, res));
  joinInfo = r;
  try { sessionStorage.setItem('boardRoom', r.code); } catch (e) {}
}

socket.on('connect', connect);
socket.on('board:state', (s) => { last = s; render(s); });

function render({ room: rm, view }) {
  room = rm;
  const game = GAME_BY_ID[rm.gameId];
  const inGame = !!view;

  // join box
  const jb = $('joinbox');
  jb.className = 'panel joinbox' + (inGame ? ' compact' : '');
  if (joinInfo) {
    const host = location.host;
    jb.innerHTML = `<div class="muted">Join at <b>${U.esc(host)}</b> with code</div><div class="code">${rm.code}</div><img src="${joinInfo.qr}" alt="QR code to join"/><div class="muted" style="font-size:.85em;margin-top:4px">Scan with your phone camera</div>`;
  }

  // players
  $('players').innerHTML = rm.players.length
    ? `<ul class="plist">${rm.players
        .map((p, i) => `<li class="pc${i} ${p.connected ? '' : 'off'} ${view && view.turn === i && !view.over ? 'turn' : ''}"><span class="dot"></span><span class="grow">${U.esc(p.name)}${i === 0 ? ' 👑' : ''}</span>${p.connected ? '' : '<span class="muted">offline</span>'}${!inGame ? `<button class="ghost small" data-kick="${i}" title="Remove">✕</button>` : ''}</li>`)
        .join('')}</ul>`
    : '<p class="muted">Waiting for players to join…</p>';
  U.on($('players'), '[data-kick]', (b) => emit('room:kick', { seat: Number(b.dataset.kick) }));

  // controls
  const c = $('controls');
  if (!inGame) {
    c.innerHTML = game
      ? `<h3>${game.icon} ${U.esc(game.name)}</h3><p class="muted">${game.min === game.max ? game.min : game.min + '-' + game.max} players · ${rm.players.length} joined</p><div class="col"><button id="startBtn" ${rm.players.length < game.min || rm.players.length > game.max ? 'disabled' : ''}>Start game</button><button class="secondary" id="rulesBtn">Rules</button></div>`
      : `<p class="muted">Pick a game to play. The first player to join (👑) can also choose from their phone.</p>`;
  } else {
    c.innerHTML = `<h3>${game.icon} ${U.esc(game.name)}</h3><div class="col">${view.over ? '<button id="startBtn">Play again</button><button class="secondary" id="lobbyBtn">Choose another game</button>' : '<button class="secondary" id="rulesBtn">Rules</button><button class="ghost" id="lobbyBtn">End game</button>'}</div>`;
  }
  const sb = $('startBtn'); if (sb) sb.onclick = () => emit('room:start');
  const rb = $('rulesBtn'); if (rb) rb.onclick = () => U.rules(game);
  const lb = $('lobbyBtn'); if (lb) lb.onclick = () => { if (view.over || confirmEnd()) emit('room:lobby'); };

  $('logbox').classList.toggle('hidden', !inGame);
  if (inGame) $('log').innerHTML = U.log(view);

  // stage
  const stage = $('stage');
  if (!inGame) {
    stage.innerHTML = `<div><h1 class="logo">Game <span>Night</span></h1><p class="muted">Room <b>${rm.code}</b>. Choose a game:</p></div><div class="game-grid" id="picker">${GAME_LIST.map((g) => `<div class="game-tile ${g.id === rm.gameId ? 'selected' : ''}" data-id="${g.id}"><div class="ic">${g.icon}</div><h3>${U.esc(g.name)}</h3><p>${g.min === g.max ? g.min : g.min + '-' + g.max} players</p><p style="margin-top:6px">${U.esc(g.blurb)}</p></div>`).join('')}</div>${game ? `<div class="panel"><h2>How to play ${U.esc(game.name)}</h2><ol>${game.rules.map((r) => `<li>${U.esc(r)}</li>`).join('')}</ol></div>` : ''}`;
    U.on(stage, '.game-tile', (t) => emit('room:select', { gameId: t.dataset.id }));
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
  U.toast('Tap "End game" again to stop this game', true);
  return false;
}
