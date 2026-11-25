const { standardDeck, fail, log, cardName, takeCards, shuffle } = require('./util');

function isSet(cards) {
  return cards.length >= 3 && cards.length <= 4 && cards.every((c) => c.r === cards[0].r);
}
function isRun(cards) {
  if (cards.length < 3 || !cards.every((c) => c.s === cards[0].s)) return false;
  const rs = cards.map((c) => c.r).sort((a, b) => a - b);
  return rs.every((r, i) => i === 0 || r === rs[i - 1] + 1);
}
function meldType(cards) {
  if (isSet(cards)) return 'set';
  if (isRun(cards)) return 'run';
  return null;
}
const value = (c) => (c.r > 10 ? 10 : c.r);

module.exports = {
  id: 'rummy',
  name: 'Rummy',
  icon: '🃏',
  min: 2,
  max: 6,
  blurb: 'Draw, build sets and runs, and be first to empty your hand.',
  rules: [
    'Deal: 10 cards each for 2 players, 7 each for 3-4 players, 6 each for 5-6 players.',
    'On your turn: draw one card, either from the face-down stock or the top of the discard pile.',
    'Then you may lay down melds: a set (3 or 4 cards of the same rank) or a run (3 or more cards in a row of the same suit). Aces are low (A-2-3 is a run, Q-K-A is not).',
    'You may also add cards to any meld already on the table ("lay off").',
    'End your turn by discarding one card. You cannot discard the card you just picked up from the discard pile.',
    'The first player to empty their hand wins the round and scores the value of every card left in the other hands (face cards 10, aces 1, others face value).',
  ],

  setup(names) {
    const deck = standardDeck();
    const n = names.length;
    const size = n === 2 ? 10 : n <= 4 ? 7 : 6;
    const hands = names.map(() => deck.splice(0, size));
    return {
      names,
      deck,
      discard: [deck.pop()],
      hands,
      melds: [],
      meldSeq: 0,
      turn: 0,
      phase: 'draw',
      takenId: null,
      over: false,
      winner: null,
      log: [`${names[0]} starts. Draw a card.`],
    };
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    if (p !== st.turn) fail('Not your turn');
    const hand = st.hands[p];
    switch (a.type) {
      case 'drawStock': {
        if (st.phase !== 'draw') fail('You already drew');
        if (!st.deck.length) {
          if (st.discard.length < 2) fail('No cards left to draw');
          const top = st.discard.pop();
          st.deck = shuffle(st.discard);
          st.discard = [top];
          log(st, 'Stock reshuffled from the discard pile.');
        }
        hand.push(st.deck.pop());
        st.phase = 'play';
        st.takenId = null;
        log(st, `${st.names[p]} drew from the stock.`);
        break;
      }
      case 'drawDiscard': {
        if (st.phase !== 'draw') fail('You already drew');
        if (!st.discard.length) fail('Discard pile is empty');
        const c = st.discard.pop();
        hand.push(c);
        st.phase = 'play';
        st.takenId = c.id;
        log(st, `${st.names[p]} took ${cardName(c)} from the discard pile.`);
        break;
      }
      case 'meld': {
        if (st.phase !== 'play') fail('Draw first');
        const ids = a.cardIds || [];
        const cards = ids.map((id) => hand.find((c) => c.id === id));
        if (cards.some((c) => !c)) fail('Card not in hand');
        const type = meldType(cards);
        if (!type) fail('That is not a valid set or run');
        takeCards(hand, ids);
        st.melds.push({ id: st.meldSeq++, type, owner: p, cards: sortMeld(cards, type) });
        log(st, `${st.names[p]} laid down ${cards.map(cardName).join(' ')}.`);
        if (!hand.length) finish(st, p);
        break;
      }
      case 'layoff': {
        if (st.phase !== 'play') fail('Draw first');
        const meld = st.melds.find((m) => m.id === a.meldId);
        if (!meld) fail('Pick a meld on the table');
        const ids = a.cardIds || [];
        const cards = ids.map((id) => hand.find((c) => c.id === id));
        if (!cards.length || cards.some((c) => !c)) fail('Select cards to add');
        const all = meld.cards.concat(cards);
        if (meldType(all) !== meld.type) fail('Those cards do not fit that meld');
        takeCards(hand, ids);
        meld.cards = sortMeld(all, meld.type);
        log(st, `${st.names[p]} added ${cards.map(cardName).join(' ')} to a meld.`);
        if (!hand.length) finish(st, p);
        break;
      }
      case 'discard': {
        if (st.phase !== 'play') fail('Draw first');
        const c = hand.find((x) => x.id === a.cardId);
        if (!c) fail('Card not in hand');
        if (c.id === st.takenId && hand.length > 1) fail('You cannot discard the card you just took');
        hand.splice(hand.indexOf(c), 1);
        st.discard.push(c);
        log(st, `${st.names[p]} discarded ${cardName(c)}.`);
        if (!hand.length) return finish(st, p);
        st.turn = (st.turn + 1) % st.names.length;
        st.phase = 'draw';
        st.takenId = null;
        break;
      }
      default:
        fail('Unknown action');
    }
  },

  boardView(st) {
    return {
      names: st.names,
      counts: st.hands.map((h) => h.length),
      melds: st.melds,
      top: st.discard[st.discard.length - 1] || null,
      deckCount: st.deck.length,
      turn: st.turn,
      phase: st.phase,
      over: st.over,
      winner: st.winner,
      points: st.points,
      leftovers: st.over ? st.hands : null,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.hand = st.hands[p];
    v.myTurn = st.turn === p && !st.over;
    v.takenId = st.takenId;
    return v;
  },
};

function sortMeld(cards, type) {
  return [...cards].sort((a, b) => (type === 'run' ? a.r - b.r : a.s.localeCompare(b.s)));
}

function finish(st, p) {
  st.over = true;
  st.winner = p;
  st.points = st.hands.reduce((s, h) => s + h.reduce((t, c) => t + value(c), 0), 0);
  log(st, `${st.names[p]} went out and scores ${st.points} points!`);
}

module.exports._test = { isSet, isRun };
