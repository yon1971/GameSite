const { fail, log } = require('./util');

const COLS = 7;
const ROWS = 6;
const MAX_MOVES = 80;

// grid[c] is a column, index 0 = bottom
function fourIn(grid, who) {
  const at = (c, r) => (c >= 0 && c < COLS && r >= 0 && r < ROWS ? grid[c][r] : null);
  const cells = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      if (at(c, r) !== who) continue;
      for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        const line = [0, 1, 2, 3].map((k) => [c + dc * k, r + dr * k]);
        if (line.every(([x, y]) => at(x, y) === who)) cells.push(...line);
      }
    }
  return cells.length ? cells : null;
}

module.exports = {
  id: 'shifting-tower',
  name: 'Shifting Tower',
  icon: '🗼',
  min: 2,
  max: 2,
  blurb: 'Four in a row, but after every move one column sinks a slot.',
  rules: [
    'Players take turns dropping a disc into one of 7 columns. Discs fall to the lowest free slot.',
    'After every move, the column under the shifting arrow sinks: its bottom disc drops out of the tower and everything above slides down one slot.',
    'The arrow then moves one column to the right (wrapping around), so you always know which column sinks next.',
    'Make four in a row (across, up, or diagonal) to win. Your own move is checked first, so a move that makes four wins before the column sinks.',
    'If the sink creates four in a row for one player only, that player wins. If it creates rows for both, the player who just moved wins.',
    `After ${MAX_MOVES} moves with no winner the game is a draw.`,
  ],

  setup(names) {
    return {
      names,
      grid: Array.from({ length: COLS }, () => []),
      turn: 0,
      shiftCol: 0,
      moves: 0,
      lastDrop: null,
      lastSink: null,
      over: false,
      winner: null,
      winCells: null,
      log: [`${names[0]} (red) goes first.`],
    };
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    if (p !== st.turn) fail('Not your turn');
    if (a.type !== 'drop') fail('Unknown action');
    const c = a.col;
    if (!(c >= 0 && c < COLS)) fail('Bad column');
    if (st.grid[c].length >= ROWS) fail('That column is full');
    st.grid[c].push(p);
    st.moves++;
    st.lastDrop = [c, st.grid[c].length - 1];
    log(st, `${st.names[p]} dropped in column ${c + 1}.`);
    let w = fourIn(st.grid, p);
    if (w) return win(st, p, w);
    const sc = st.shiftCol;
    const fell = st.grid[sc].shift();
    st.lastSink = sc;
    if (fell !== undefined) log(st, `Column ${sc + 1} sank; a ${fell === 0 ? 'red' : 'yellow'} disc fell out.`);
    st.shiftCol = (sc + 1) % COLS;
    st.lastDrop = c === sc ? [c, st.grid[c].length - 1] : st.lastDrop;
    const mine = fourIn(st.grid, p);
    const theirs = fourIn(st.grid, 1 - p);
    if (mine) return win(st, p, mine);
    if (theirs) return win(st, 1 - p, theirs);
    if (st.moves >= MAX_MOVES || st.grid.every((col) => col.length >= ROWS)) {
      st.over = true;
      log(st, 'Draw!');
      return;
    }
    st.turn = 1 - p;
  },

  boardView(st) {
    return {
      names: st.names,
      grid: st.grid,
      cols: COLS,
      rows: ROWS,
      turn: st.turn,
      shiftCol: st.shiftCol,
      lastDrop: st.lastDrop,
      lastSink: st.lastSink,
      moves: st.moves,
      maxMoves: MAX_MOVES,
      over: st.over,
      winner: st.winner,
      winCells: st.winCells,
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

function win(st, p, cells) {
  st.over = true;
  st.winner = p;
  st.winCells = cells;
  log(st, `${st.names[p]} wins with four in a row!`);
}
