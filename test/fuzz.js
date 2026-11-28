// Plays random moves in every game to catch crashes. Run: node test/fuzz.js
const GAMES = require('../games');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sub = (a) => a.filter(() => Math.random() < 0.4);

const gen = {
  'crazy-eights': (v, p) => v.myTurn ? [{ type: 'play', cardId: pick(v.hand).id, suit: pick(['S','H','D','C']) }, { type: 'draw' }, { type: 'pass' }] : [],
  rummy: (v) => v.myTurn ? [{ type: 'drawStock' }, { type: 'drawDiscard' }, { type: 'meld', cardIds: sub(v.hand).map(c=>c.id) },
    ...(v.melds.length ? [{ type: 'layoff', meldId: pick(v.melds).id, cardIds: sub(v.hand).slice(0,1).map(c=>c.id) }] : []),
    { type: 'discard', cardId: pick(v.hand).id }] : [],
  'tide-pool': (v) => v.myTurn ? [{ type: 'set', cardIds: sub(v.hand).map(c=>c.id) }, { type: 'end' }] : [],
  'lantern-keepers': (v, p) => v.myTurn ? [{ type: 'light', cardId: pick(v.myHand).id }, { type: 'discard', cardId: pick(v.myHand).id },
    { type: 'hint', target: pick(v.names.map((_, i) => i)), color: pick(v.colors) }, { type: 'hint', target: pick(v.names.map((_, i) => i)), value: 1 + Math.floor(Math.random()*10) }] : [],
  'bluff-market': (v, p) => [ ...(v.hand.length ? [{ type: 'offer', cardId: pick(v.hand).id, claim: pick(Object.keys(v.goods)), price: 1 + Math.floor(Math.random()*9) }] : []),
    { type: 'respond', choice: pick(['buy','call','pass']) }, { type: 'next' }],
  rivers: (v) => v.myTurn ? v.hand.map((t) => ({ type: 'tile', tileId: t.id })) : [],
  'shifting-tower': (v) => v.myTurn ? [{ type: 'drop', col: Math.floor(Math.random() * 7) }] : [],
  'moth-flame': (v) => v.myTurn ? [{ type: 'cell', r: Math.floor(Math.random()*9), c: Math.floor(Math.random()*9) }, ...v.frontier.map(([r,c]) => ({ type:'cell', r, c }))] : [],
  'the-killer': (v, p) => { const t = v.names.map((_, i) => i).filter((i) => v.alive[i]); return [{ type: 'vote', target: pick(t) }, { type: 'kill', target: pick(t) }, { type: 'spy', target: pick(t) }]; },
};

let bad = 0;
for (const g of Object.values(GAMES)) {
  const results = {};
  for (let n = g.min; n <= Math.min(g.max, g.id === 'the-killer' ? 10 : 6); n++) {
    for (let trial = 0; trial < 60; trial++) {
      const names = Array.from({ length: n }, (_, i) => 'P' + i);
      const st = g.setup(names, { round: trial, options: { killers: 1 + (trial % 3), spy: trial % 2 === 0 } });
      let steps = 0, ok = 0;
      while (!st.over && steps < 20000) {
        steps++;
        const p = Math.floor(Math.random() * n);
        const v = g.playerView(st, p);
        g.boardView(st);
        const acts = gen[g.id](v, p);
        if (!acts.length) continue;
        try { g.act(st, p, pick(acts)); ok++; } catch (e) { if (!/^[A-Z]/.test(e.message) || e instanceof TypeError || e instanceof ReferenceError) { console.error(g.id, e); bad++; break; } }
      }
      const k = st.over ? 'over' : 'stuck';
      results[k] = (results[k] || 0) + 1;
    }
  }
  console.log(g.id.padEnd(16), JSON.stringify(results));
}
process.exit(bad ? 1 : 0);
