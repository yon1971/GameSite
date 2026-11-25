const { fail, log, shuffle } = require('./util');
const crypto = require('crypto');

const R = 4; // hex radius -> 61 cells
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; // E, NE, NW, W, SW, SE (counter-clockwise)
const TILE_NAMES = { 0: 'Straight', 1: 'Gentle left', '-1': 'Gentle right', 2: 'Sharp left', '-2': 'Sharp right' };
const key = (q, r) => `${q},${r}`;
const onBoard = (q, r) => Math.abs(q) <= R && Math.abs(r) <= R && Math.abs(q + r) <= R;
const dist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;

function makeBag() {
  const bag = [];
  let id = 0;
  const add = (turn, n) => { for (let i = 0; i < n; i++) bag.push({ id: id++, turn }); };
  add(0, 10); add(1, 8); add(-1, 8); add(2, 4); add(-2, 4);
  return shuffle(bag);
}

module.exports = {
  id: 'rivers',
  name: 'Rivers',
  icon: '🏞️',
  min: 2,
  max: 2,
  blurb: 'Lay bending river tiles on a hex map and race them to the sea.',
  rules: [
    'Each player has a river that starts at a spring near the middle of a hex map, and a hand of 3 river tiles.',
    'Tiles are Straight, Gentle bend (left or right) or Sharp bend (left or right). There are 34 tiles in the bag.',
    'On your turn play one tile: it goes in the hex your river is flowing into, and sets which way the river flows next. Then draw a new tile.',
    'If your river flows off the edge of the map it reaches the sea: you score 1 point per tile in that river. A longer, winding river scores more but is easier to block.',
    'If your river flows into an occupied hex (either river or a spring) it dries up and scores nothing.',
    'After reaching the sea or drying up, you start a new spring in a free hex as close to the middle as possible.',
    'When all tiles are played, the highest score wins. Unfinished rivers score nothing.',
  ],

  setup(names) {
    const bag = makeBag();
    const st = {
      names,
      cells: {},
      bag,
      hands: names.map(() => bag.splice(0, 3)),
      heads: [],
      lengths: [0, 0],
      scores: [0, 0],
      rivers: [0, 0],
      turn: 0,
      over: false,
      winner: null,
      log: [`${names[0]} goes first.`],
    };
    st.cells[key(0, 1)] = { owner: 0, spring: true, out: 0 };
    st.heads[0] = { q: 0, r: 1, dir: 0 };
    st.cells[key(0, -1)] = { owner: 1, spring: true, out: 3 };
    st.heads[1] = { q: 0, r: -1, dir: 3 };
    return st;
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    if (p !== st.turn) fail('Not your turn');
    if (a.type !== 'tile') fail('Unknown action');
    const hand = st.hands[p];
    const tile = hand.find((t) => t.id === a.tileId);
    if (!tile) fail('Tile not in hand');
    const h = st.heads[p];
    const [dq, dr] = DIRS[h.dir];
    const q = h.q + dq, r = h.r + dr;
    if (!onBoard(q, r) || st.cells[key(q, r)]) fail('River is blocked');
    hand.splice(hand.indexOf(tile), 1);
    const out = (h.dir + tile.turn + 6) % 6;
    st.cells[key(q, r)] = { owner: p, in: h.dir, out };
    st.heads[p] = { q, r, dir: out };
    st.lengths[p]++;
    if (st.bag.length) hand.push(st.bag.pop());
    log(st, `${st.names[p]} played ${TILE_NAMES[tile.turn].toLowerCase()}.`);
    resolveFront(st, p);
    if (st.over) return;
    if (st.hands.every((hh) => hh.length === 0)) return finish(st);
    // next player (skip one with no tiles)
    let nxt = 1 - p;
    if (!st.hands[nxt].length) nxt = p;
    st.turn = nxt;
    resolveFront(st, nxt);
  },

  boardView(st) {
    return {
      names: st.names,
      radius: R,
      cells: st.cells,
      heads: st.heads,
      lengths: st.lengths,
      scores: st.scores,
      bagCount: st.bag.length,
      handCounts: st.hands.map((h) => h.length),
      turn: st.turn,
      over: st.over,
      winner: st.winner,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.me = p;
    v.hand = st.hands[p].map((t) => ({ ...t, name: TILE_NAMES[t.turn] }));
    v.myTurn = st.turn === p && !st.over;
    return v;
  },
};

function resolveFront(st, p) {
  const h = st.heads[p];
  const [dq, dr] = DIRS[h.dir];
  const q = h.q + dq, r = h.r + dr;
  if (!onBoard(q, r)) {
    const pts = st.lengths[p];
    st.scores[p] += pts;
    log(st, `${st.names[p]}'s river reached the sea for ${pts} point${pts === 1 ? '' : 's'}!`);
    respawn(st, p);
  } else if (st.cells[key(q, r)]) {
    log(st, `${st.names[p]}'s river ran into land and dried up.`);
    respawn(st, p);
  }
}

function respawn(st, p) {
  st.lengths[p] = 0;
  const options = [];
  for (let q = -R; q <= R; q++)
    for (let r = -R; r <= R; r++) {
      if (!onBoard(q, r) || st.cells[key(q, r)]) continue;
      const dirs = DIRS.map((d, i) => i).filter((i) => {
        const nq = q + DIRS[i][0], nr = r + DIRS[i][1];
        return onBoard(nq, nr) && !st.cells[key(nq, nr)];
      });
      if (dirs.length) options.push({ q, r, dirs, d: dist(q, r) });
    }
  if (!options.length) return finish(st);
  const best = Math.min(...options.map((o) => o.d));
  const pool = options.filter((o) => o.d === best);
  const pick = pool[crypto.randomInt(pool.length)];
  // prefer flowing away from centre-ish: random among valid
  const dir = pick.dirs[crypto.randomInt(pick.dirs.length)];
  st.cells[key(pick.q, pick.r)] = { owner: p, spring: true, out: dir };
  st.heads[p] = { q: pick.q, r: pick.r, dir };
  st.rivers[p]++;
}

function finish(st) {
  st.over = true;
  const [a, b] = st.scores;
  st.winner = a === b ? null : a > b ? 0 : 1;
  log(st, st.winner === null ? `Tie game at ${a}!` : `${st.names[st.winner]} wins ${Math.max(a, b)} to ${Math.min(a, b)}!`);
}
