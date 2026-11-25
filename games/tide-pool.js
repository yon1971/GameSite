const { fail, log, shuffle, takeCards } = require('./util');

const CREATURES = ['crab', 'octopus', 'fish', 'shrimp'];
const MAX_TIDE = 10;

function isSet(cards) {
  if (cards.length >= 2 && cards.every((c) => c.v === cards[0].v)) return 'pair';
  if (cards.length >= 3 && cards.every((c) => c.k === cards[0].k)) {
    const vs = cards.map((c) => c.v).sort((a, b) => a - b);
    if (vs.every((v, i) => i === 0 || v === vs[i - 1] + 1)) return 'run';
  }
  return null;
}

module.exports = {
  id: 'tide-pool',
  name: 'Tide Pool',
  icon: '🦀',
  min: 2,
  max: 4,
  blurb: 'Score sea-creature sets before the rising tide washes your cards away.',
  rules: [
    'The deck has 40 cards: four sea creatures (crab, octopus, fish, shrimp), numbered 1 to 10.',
    'Everyone starts with 7 cards (6 with 3-4 players). The tide starts at 1.',
    'At the start of your turn you draw 2 cards.',
    'Then play as many sets as you like: 2 or more cards with the same number (a school), or 3 or more of the same creature in a row like 4-5-6 (a current). A set scores the sum of its numbers; a current scores +3 bonus.',
    'When you end your turn, every card in your hand numbered below the tide washes out and costs you 1 point each.',
    `After everyone has had a turn the tide rises by 1. After the round at tide ${MAX_TIDE}, the game ends and the highest score wins.`,
  ],

  setup(names) {
    const deck = [];
    let id = 0;
    for (const k of CREATURES) for (let v = 1; v <= 10; v++) deck.push({ id: id++, k, v });
    shuffle(deck);
    const size = names.length <= 2 ? 7 : 6;
    const st = {
      names,
      deck,
      hands: names.map(() => deck.splice(0, size)),
      scores: names.map(() => 0),
      sets: names.map(() => []),
      lastPlayed: [],
      washed: [],
      tide: 1,
      turn: 0,
      over: false,
      winner: null,
      log: [`The tide is at 1. ${names[0]} goes first.`],
    };
    draw(st, 0);
    return st;
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    if (p !== st.turn) fail('Not your turn');
    const hand = st.hands[p];
    if (a.type === 'set') {
      const ids = a.cardIds || [];
      const cards = ids.map((id) => hand.find((c) => c.id === id));
      if (cards.some((c) => !c)) fail('Card not in hand');
      const kind = isSet(cards);
      if (!kind) fail('Not a set: use 2+ of the same number, or 3+ of one creature in a row');
      takeCards(hand, ids);
      const pts = cards.reduce((s, c) => s + c.v, 0) + (kind === 'run' ? 3 : 0);
      st.scores[p] += pts;
      st.sets[p].push(cards);
      st.lastPlayed = cards;
      log(st, `${st.names[p]} played a ${kind === 'run' ? 'current' : 'school'} for ${pts} points.`);
    } else if (a.type === 'end') {
      const out = hand.filter((c) => c.v < st.tide);
      st.hands[p] = hand.filter((c) => c.v >= st.tide);
      st.scores[p] -= out.length;
      st.washed = out;
      if (out.length) log(st, `The tide washed ${out.length} card${out.length > 1 ? 's' : ''} from ${st.names[p]} (-${out.length}).`);
      st.turn = (p + 1) % st.names.length;
      if (st.turn === 0) {
        if (st.tide >= MAX_TIDE) return finish(st);
        st.tide++;
        log(st, `The tide rises to ${st.tide}!`);
      }
      st.lastPlayed = [];
      draw(st, st.turn);
    } else fail('Unknown action');
  },

  boardView(st) {
    return {
      names: st.names,
      tide: st.tide,
      maxTide: MAX_TIDE,
      scores: st.scores,
      counts: st.hands.map((h) => h.length),
      setCounts: st.sets.map((s) => s.length),
      lastPlayed: st.lastPlayed,
      washed: st.washed,
      deckCount: st.deck.length,
      turn: st.turn,
      over: st.over,
      winner: st.winner,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.hand = [...st.hands[p]].sort((a, b) => a.v - b.v || a.k.localeCompare(b.k));
    v.myTurn = st.turn === p && !st.over;
    return v;
  },
};

function draw(st, p) {
  for (let i = 0; i < 2 && st.deck.length; i++) st.hands[p].push(st.deck.pop());
}

function finish(st) {
  st.over = true;
  const best = Math.max(...st.scores);
  const winners = st.scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
  st.winner = winners.length === 1 ? winners[0] : null;
  log(st, winners.length === 1 ? `${st.names[winners[0]]} wins with ${best} points!` : `Tie at ${best} points!`);
}
