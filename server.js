const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const GAMES = require('./games');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (req, res) => res.send('ok'));
app.get('/api/games', (req, res) => res.json(Object.values(GAMES).map(gameInfo)));

function gameInfo(g) {
  return { id: g.id, name: g.name, min: g.min, max: g.max, blurb: g.blurb, rules: g.rules, icon: g.icon, options: g.options || [] };
}

const rooms = new Map();
const ROOM_TTL = 1000 * 60 * 60 * 6;

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => letters[crypto.randomInt(letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function roomInfo(room) {
  return {
    code: room.code,
    gameId: room.gameId,
    options: room.gameId ? currentOptions(room) : {},
    phase: room.phase,
    joinUrl: room.joinUrl,
    players: room.players.map((p, i) => ({ name: p.name, connected: p.connected, seat: i })),
  };
}

function currentOptions(room) {
  const g = GAMES[room.gameId];
  const saved = (room.options && room.options[room.gameId]) || {};
  const out = {};
  for (const o of (g && g.options) || []) out[o.key] = saved[o.key] !== undefined ? saved[o.key] : o.default;
  return out;
}

function broadcast(room) {
  room.touched = Date.now();
  const game = GAMES[room.gameId];
  const info = roomInfo(room);
  const playing = room.state && (room.phase === 'playing' || room.phase === 'over');
  for (const sid of room.boards) {
    io.to(sid).emit('board:state', { room: info, view: playing ? game.boardView(room.state) : null });
  }
  room.players.forEach((p, i) => {
    if (!p.socketId) return;
    io.to(p.socketId).emit('player:state', {
      room: info,
      seat: i,
      name: p.name,
      view: playing ? game.playerView(room.state, i) : null,
    });
  });
}

function canControl(room, socket) {
  if (room.boards.has(socket.id)) return true;
  const p = room.players.find((pl) => pl.socketId === socket.id);
  return p && room.players.indexOf(p) === 0; // first player is captain
}

io.on('connection', (socket) => {
  let joined = null; // { code, role }

  socket.on('host:create', async (data, cb) => {
    const code = newCode();
    const origin = (data && data.origin) || '';
    const joinUrl = `${origin}/play.html?room=${code}`;
    const qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 320 });
    const room = { code, joinUrl, qr, boards: new Set([socket.id]), players: [], gameId: null, phase: 'lobby', state: null, touched: Date.now() };
    rooms.set(code, room);
    socket.join(code);
    joined = { code, role: 'board' };
    cb && cb({ ok: true, code, qr, joinUrl });
    broadcast(room);
  });

  socket.on('host:watch', (data, cb) => {
    const room = rooms.get(String((data && data.code) || '').toUpperCase());
    if (!room) return cb && cb({ ok: false, error: 'Room not found' });
    room.boards.add(socket.id);
    joined = { code: room.code, role: 'board' };
    cb && cb({ ok: true, code: room.code, qr: room.qr, joinUrl: room.joinUrl });
    broadcast(room);
  });

  socket.on('player:join', (data, cb) => {
    const code = String((data && data.code) || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb && cb({ ok: false, error: 'No room with that code' });
    const token = data.token;
    let p = token && room.players.find((pl) => pl.token === token);
    if (!p) {
      const name = String(data.name || '').trim().slice(0, 16);
      if (!name) return cb && cb({ ok: false, error: 'Enter a name' });
      if (room.phase !== 'lobby') return cb && cb({ ok: false, error: 'Game already started. Wait for the next one.' });
      if (room.players.length >= 16) return cb && cb({ ok: false, error: 'Room is full' });
      if (room.players.some((pl) => pl.name.toLowerCase() === name.toLowerCase())) return cb && cb({ ok: false, error: 'That name is taken' });
      p = { name, token: crypto.randomUUID(), socketId: null, connected: false };
      room.players.push(p);
    }
    p.socketId = socket.id;
    p.connected = true;
    joined = { code, role: 'player', token: p.token };
    cb && cb({ ok: true, token: p.token, code });
    broadcast(room);
  });

  socket.on('player:leave', () => {
    if (!joined || joined.role !== 'player') return;
    const room = rooms.get(joined.code);
    if (!room) return;
    if (room.phase === 'lobby') {
      room.players = room.players.filter((pl) => pl.token !== joined.token);
      broadcast(room);
    }
    joined = null;
  });

  socket.on('room:select', (data, cb) => {
    const room = joined && rooms.get(joined.code);
    if (!room || !canControl(room, socket)) return cb && cb({ ok: false, error: 'Not allowed' });
    if (!GAMES[data.gameId]) return cb && cb({ ok: false, error: 'Unknown game' });
    room.gameId = data.gameId;
    room.phase = 'lobby';
    room.state = null;
    cb && cb({ ok: true });
    broadcast(room);
  });

  socket.on('room:start', (data, cb) => {
    const room = joined && rooms.get(joined.code);
    if (!room || !canControl(room, socket)) return cb && cb({ ok: false, error: 'Not allowed' });
    const game = GAMES[room.gameId];
    if (!game) return cb && cb({ ok: false, error: 'Pick a game first' });
    const n = room.players.length;
    if (n < game.min || n > game.max) return cb && cb({ ok: false, error: `${game.name} needs ${game.min}-${game.max} players (you have ${n})` });
    try {
      room.plays = room.plays || {};
      const round = room.plays[room.gameId] || 0;
      room.state = game.setup(room.players.map((p) => p.name), { round, options: currentOptions(room) });
      room.plays[room.gameId] = round + 1;
      room.phase = 'playing';
    } catch (e) {
      return cb && cb({ ok: false, error: e.message });
    }
    cb && cb({ ok: true });
    broadcast(room);
  });

  socket.on('room:options', (data, cb) => {
    const room = joined && rooms.get(joined.code);
    if (!room || !canControl(room, socket) || room.phase === 'playing') return cb && cb({ ok: false, error: 'Not allowed' });
    const g = GAMES[room.gameId];
    const o = g && (g.options || []).find((x) => x.key === data.key);
    if (!o) return cb && cb({ ok: false, error: 'Unknown setting' });
    let v = data.value;
    if (o.type === 'bool') v = !!v;
    else {
      v = Math.round(Number(v));
      if (!Number.isFinite(v)) return cb && cb({ ok: false, error: 'Bad value' });
      v = Math.max(o.min, Math.min(o.max, v));
    }
    room.options = room.options || {};
    room.options[room.gameId] = { ...(room.options[room.gameId] || {}), [o.key]: v };
    cb && cb({ ok: true });
    broadcast(room);
  });

  socket.on('room:lobby', (data, cb) => {
    const room = joined && rooms.get(joined.code);
    if (!room || !canControl(room, socket)) return cb && cb({ ok: false, error: 'Not allowed' });
    room.phase = 'lobby';
    room.state = null;
    cb && cb({ ok: true });
    broadcast(room);
  });

  socket.on('room:kick', (data, cb) => {
    const room = joined && rooms.get(joined.code);
    if (!room || !room.boards.has(socket.id) || room.phase !== 'lobby') return cb && cb({ ok: false });
    const p = room.players[data.seat];
    if (p) {
      room.players.splice(data.seat, 1);
      if (p.socketId) io.to(p.socketId).emit('kicked');
    }
    cb && cb({ ok: true });
    broadcast(room);
  });

  socket.on('game:action', (action, cb) => {
    if (!joined || joined.role !== 'player') return cb && cb({ ok: false, error: 'Not in a room' });
    const room = rooms.get(joined.code);
    if (!room || room.phase !== 'playing') return cb && cb({ ok: false, error: 'No game running' });
    const seat = room.players.findIndex((pl) => pl.token === joined.token);
    const game = GAMES[room.gameId];
    try {
      game.act(room.state, seat, action || {});
    } catch (e) {
      return cb && cb({ ok: false, error: e.message });
    }
    if (room.state.over) room.phase = 'over';
    cb && cb({ ok: true });
    broadcast(room);
  });

  socket.on('disconnect', () => {
    if (!joined) return;
    const room = rooms.get(joined.code);
    if (!room) return;
    if (joined.role === 'board') room.boards.delete(socket.id);
    else {
      const p = room.players.find((pl) => pl.token === joined.token);
      if (p && p.socketId === socket.id) {
        p.connected = false;
        p.socketId = null;
      }
    }
    broadcast(room);
  });
});

// Timed games: let them advance on their own clock.
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== 'playing' || !room.state) continue;
    const g = GAMES[room.gameId];
    if (!g.tick) continue;
    try {
      if (g.tick(room.state, Date.now())) {
        if (room.state.over) room.phase = 'over';
        broadcast(room);
      }
    } catch (e) {
      console.error('tick failed', room.code, e);
    }
  }
}, 1000);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.touched > ROOM_TTL) rooms.delete(code);
  }
}, 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Games site listening on ${PORT}`));
