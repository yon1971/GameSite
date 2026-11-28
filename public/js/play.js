const socket = io();
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const code = (params.get('room') || '').toUpperCase();
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const tokenKey = 'token:' + code;
let joined = false;
let last = null;

function emit(ev, data) {
  return new Promise((res) => socket.emit(ev, data, (r) => { if (r && !r.ok) U.err(r); res(r || {}); }));
}
const send = (action) => emit('game:action', action);
window.sendAction = send;

let formErr = null;
let showingForm = false;
function nameForm(err) {
  formErr = err;
  showingForm = true;
  const typed = document.getElementById('n');
  const nameVal = typed ? typed.value : store.get('name') || '';
  app.innerHTML = `<div class="phone-top" style="justify-content:flex-end">${U.langBtn()}</div><div class="col" style="margin-top:9vh">
    <h1 class="logo center">${T('Game <span>Night</span>')}</h1>
    <form class="panel col" id="f">
      <div class="muted">${T('Joining room {code}', { code: `<b dir="ltr">${U.esc(code || '?')}</b>` })}</div>
      ${code ? '' : `<input id="c" placeholder="${T('Room code')}" maxlength="4" autocapitalize="characters" dir="ltr"/>`}
      <input id="n" placeholder="${T('Your name')}" maxlength="16" autocomplete="nickname" value="${U.esc(nameVal)}"/>
      <button>${T('Join game')}</button>
      ${err ? `<div style="color:var(--danger)">${U.esc(T(err))}</div>` : ''}
    </form></div>`;
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const c = code || document.getElementById('c').value.trim().toUpperCase();
    if (!code) return (location.href = '/play.html?room=' + c);
    const name = document.getElementById('n').value.trim();
    store.set('name', name);
    const r = await emit('player:join', { code: c, name });
    if (r.ok) { store.set(tokenKey, r.token); joined = true; showingForm = false; }
  };
}

socket.on('connect', async () => {
  const token = store.get(tokenKey);
  if (token && code) {
    const r = await new Promise((res) => socket.emit('player:join', { code, token }, res));
    if (r && r.ok) { joined = true; showingForm = false; return; }
    store.del(tokenKey);
    if (r && r.error === 'No room with that code') return nameForm('That room has closed. Ask the host for the new code.');
  }
  if (!joined) nameForm();
});
socket.on('disconnect', () => U.toast(T('Reconnecting…'), true));
socket.on('kicked', () => { store.del(tokenKey); joined = false; nameForm('You were removed from the room.'); });
socket.on('player:state', (s) => {
  last = s;
  showingForm = false;
  I18N.follow(s.room.lang); // re-renders through 'langchange' if the language changes
  if (window.GAME_LIST) render(s);
});
document.addEventListener('langchange', () => {
  if (showingForm) nameForm(formErr);
  else if (last && window.GAME_LIST) render(last);
});

function render(s) {
  const { room, view, seat } = s;
  const game = GAME_BY_ID && GAME_BY_ID[room.gameId];
  const captain = seat === 0;
  const top = `<div class="phone-top"><span class="pill pc${seat}"><span class="dot"></span>${U.bdi(s.name)}</span><span class="pill"><span>${T('Room {code}', { code: `<bdi>${room.code}</bdi>` })}</span></span>${game ? `<button class="ghost small" id="rulesBtn">${T('Rules')}</button>` : ''}${U.langBtn()}</div>`;
  if (!view) {
    app.innerHTML = `${top}
      <div class="panel col center">
        <h2>${game ? `${game.icon} ${U.esc(T(game.name))}` : T('Waiting for a game')}</h2>
        <p class="muted" style="margin:0">${T.n(room.players.length, '1 player in the room. Look at the big screen!', '{n} players in the room. Look at the big screen!')}</p>
        ${U.players({ names: room.players.map((p) => p.name) })}
      </div>
      ${captain ? `<div class="panel col" style="margin-top:12px"><h3>${T("👑 You're the captain")}</h3><p class="muted" style="margin:0">${T("Pick a game and start when everyone's in.")}</p>
        <div class="game-grid" id="picker">${GAME_LIST.map((g) => `<div class="game-tile ${g.id === room.gameId ? 'selected' : ''}" data-id="${g.id}"><span class="ic" style="font-size:1.4rem">${g.icon}</span> <b>${U.esc(T(g.name))}</b><p>${U.range(g)}</p></div>`).join('')}</div>
        ${game ? U.optionsHTML(game, room.options) : ''}
        ${game ? `<button id="startBtn">${T('Start {game}', { game: U.esc(T(game.name)) })}</button>` : ''}</div>` : ''}`;
    U.bindOptions(app, emit);
    U.on(app, '#picker .game-tile', (t) => emit('room:select', { gameId: t.dataset.id }));
    const sb = document.getElementById('startBtn');
    if (sb) sb.onclick = () => emit('room:start');
  } else {
    app.innerHTML = `${top}<div id="gameRoot"></div>`;
    const root = document.getElementById('gameRoot');
    GameUI[room.gameId].player(root, view, { send, seat, names: view.names });
    if (view.over && captain) {
      const bar = document.createElement('div');
      bar.className = 'panel col';
      bar.style.marginTop = '12px';
      bar.innerHTML = `<button id="againBtn">${T('Play again')}</button><button class="secondary" id="lobbyBtn">${T('Choose another game')}</button>`;
      root.appendChild(bar);
      document.getElementById('againBtn').onclick = () => emit('room:start');
      document.getElementById('lobbyBtn').onclick = () => emit('room:lobby');
    }
  }
  const rb = document.getElementById('rulesBtn');
  if (rb) rb.onclick = () => U.rules(game);
}

loadGames().then(() => last && render(last));
