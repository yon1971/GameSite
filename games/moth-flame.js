const { fail, log } = require('./util');

const N = 9;
const MOTHS_PER_TURN = 2;

module.exports = {
  id: 'moth-flame',
  name: 'Moth & Flame',
  icon: '🔥',
  min: 2,
  max: 2,
  blurb: 'One player is a spreading flame, the other places moths to smother it.',
  rules: [
    `The board is a ${N}×${N} grid. The flame starts in the centre square.`,
    'In the first game the first player to join is the Flame and the second is the Moths. Roles swap every time you play again.',
    `The Moths player goes first and places ${MOTHS_PER_TURN} moths on any empty squares each turn.`,
    'The Flame player then spreads: pick one empty square that touches any burning square (up, down, left or right) and set it alight.',
    'The Flame wins as soon as it reaches any edge square of the board.',
    'The Moths win when the flame has no empty square left to spread into.',
  ],

  setup(names, opts = {}) {
    const flame = (opts.round || 0) % 2;
    const moth = 1 - flame;
    const grid = Array.from({ length: N }, () => Array(N).fill(null));
    const m = Math.floor(N / 2);
    grid[m][m] = 'F';
    return {
      names,
      roles: { flame, moth },
      grid,
      turn: moth,
      placed: 0,
      over: false,
      winner: null,
      last: [],
      log: [{ t: '{flame} is the Flame. {moth} (Moths) places first.', p: { flame: names[flame], moth: names[moth] } }],
    };
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    if (p !== st.turn) fail('Not your turn');
    if (a.type !== 'cell') fail('Unknown action');
    const { r, c } = a;
    if (!(r >= 0 && r < N && c >= 0 && c < N)) fail('Off the board');
    if (st.grid[r][c]) fail('That square is taken');
    if (p === st.roles.moth) {
      st.grid[r][c] = 'M';
      if (st.placed === 0) st.last = [];
      st.last.push([r, c]);
      st.placed++;
      if (frontier(st).length === 0) return end(st, st.roles.moth, 'The flame is trapped! Moths win.');
      if (st.placed >= MOTHS_PER_TURN) {
        st.placed = 0;
        st.turn = st.roles.flame;
        log(st, '{name} placed moths.', { name: st.names[p] });
      }
    } else {
      if (!frontier(st).some(([x, y]) => x === r && y === c)) fail('The flame can only spread next to a burning square');
      st.grid[r][c] = 'F';
      st.last = [[r, c]];
      log(st, '{name} spread the flame.', { name: st.names[p] });
      if (r === 0 || c === 0 || r === N - 1 || c === N - 1) return end(st, st.roles.flame, 'The flame reached the edge! Flame wins.');
      st.turn = st.roles.moth;
    }
  },

  boardView(st) {
    return {
      names: st.names,
      roles: st.roles,
      grid: st.grid,
      n: N,
      turn: st.turn,
      placed: st.placed,
      perTurn: MOTHS_PER_TURN,
      frontier: st.turn === st.roles.flame && !st.over ? frontier(st) : [],
      last: st.last,
      over: st.over,
      winner: st.winner,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.me = p;
    v.myTurn = st.turn === p && !st.over;
    return v;
  },
};

function frontier(st) {
  const out = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      if (st.grid[r][c]) continue;
      const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(
        ([x, y]) => x >= 0 && y >= 0 && x < N && y < N && st.grid[x][y] === 'F'
      );
      if (near) out.push([r, c]);
    }
  return out;
}

function end(st, winner, msg) {
  st.over = true;
  st.winner = winner;
  log(st, msg);
}
