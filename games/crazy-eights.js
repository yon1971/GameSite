const { standardDeck, fail, log, cardName, shuffle, SUIT } = require('./util');

module.exports = {
  id: 'crazy-eights',
  name: 'Crazy Eights',
  icon: '🎱',
  min: 2,
  max: 7,
  blurb: 'Match the suit or rank. Eights are wild. First to empty their hand wins.',
  rules: [
    'Each player gets 7 cards (5 cards with 5 or more players). One card starts the discard pile.',
    'On your turn play one card that matches the top card by suit or by rank.',
    'An 8 can always be played. When you play it, you choose the suit the next player must follow.',
    'If you cannot or do not want to play, draw one card. You may play that card if it fits, otherwise pass.',
    'If the deck runs out and nobody can play, the player with the lowest penalty total wins. The first player to get rid of all their cards wins. Everyone else scores penalty points for cards left: 8s are 50, face cards 10, aces 1, others face value.',
  ],

  setup(names) {
    const deck = standardDeck();
    const n = names.length;
    const handSize = n >= 5 ? 5 : 7;
    const hands = names.map(() => deck.splice(0, handSize));
    let start = deck.findIndex((c) => c.r !== 8);
    const discard = deck.splice(start, 1);
    return {
      names,
      deck,
      discard,
      hands,
      turn: 0,
      suit: discard[0].s,
      drewThisTurn: false,
      over: false,
      winner: null,
      log: [{ t: '{name} starts.', p: { name: names[0] } }],
    };
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    if (p !== st.turn) fail('Not your turn');
    const hand = st.hands[p];
    const top = st.discard[st.discard.length - 1];
    if (a.type === 'play') {
      const card = hand.find((c) => c.id === a.cardId);
      if (!card) fail('Card not in hand');
      if (st.drewThisTurn && card.id !== st.drawnId) fail('After drawing you may only play the drawn card');
      if (card.r !== 8 && card.s !== st.suit && card.r !== top.r) fail('That card does not match');
      if (card.r === 8 && !SUIT[a.suit]) fail('Pick a suit for your 8');
      hand.splice(hand.indexOf(card), 1);
      st.discard.push(card);
      st.blocked = 0;
      st.suit = card.r === 8 ? a.suit : card.s;
      if (card.r === 8) log(st, '{name} played {card} and called {suit}.', { name: st.names[p], card: cardName(card), suit: SUIT[a.suit] });
      else log(st, '{name} played {card}.', { name: st.names[p], card: cardName(card) });
      if (hand.length === 0) return finish(st, p);
      if (hand.length === 1) log(st, '{name} has one card left!', { name: st.names[p] });
      next(st);
    } else if (a.type === 'draw') {
      if (st.drewThisTurn) fail('You already drew');
      refill(st);
      if (!st.deck.length) {
        log(st, '{name} could not draw (no cards left) and passed.', { name: st.names[p] });
        st.blocked = (st.blocked || 0) + 1;
        if (st.blocked >= st.names.length) return blockedEnd(st);
        return next(st);
      }
      const c = st.deck.pop();
      hand.push(c);
      st.drewThisTurn = true;
      st.drawnId = c.id;
      log(st, '{name} drew a card.', { name: st.names[p] });
      const playable = c.r === 8 || c.s === st.suit || c.r === top.r;
      if (!playable) {
        log(st, '{name} passed.', { name: st.names[p] });
        next(st);
      }
    } else if (a.type === 'pass') {
      if (!st.drewThisTurn) fail('Draw first');
      log(st, '{name} passed.', { name: st.names[p] });
      next(st);
    } else fail('Unknown action');
  },

  boardView(st) {
    return {
      names: st.names,
      counts: st.hands.map((h) => h.length),
      top: st.discard[st.discard.length - 1],
      suit: st.suit,
      deckCount: st.deck.length,
      turn: st.turn,
      over: st.over,
      winner: st.winner,
      scores: st.scores,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.hand = [...st.hands[p]].sort((a, b) => (a.s === b.s ? a.r - b.r : a.s.localeCompare(b.s)));
    v.myTurn = st.turn === p && !st.over;
    v.drew = st.drewThisTurn && st.turn === p;
    v.drawnId = v.drew ? st.drawnId : null;
    return v;
  },
};

function refill(st) {
  if (st.deck.length) return;
  const top = st.discard.pop();
  st.deck = shuffle(st.discard);
  st.discard = [top];
}

function next(st) {
  st.turn = (st.turn + 1) % st.names.length;
  st.drewThisTurn = false;
  st.drawnId = null;
}

function penalty(h) {
  return h.reduce((s, c) => s + (c.r === 8 ? 50 : c.r > 10 ? 10 : c.r), 0);
}

function blockedEnd(st) {
  const pts = st.hands.map(penalty);
  const best = Math.min(...pts);
  st.over = true;
  st.winner = pts.indexOf(best);
  st.scores = pts;
  log(st, 'Nobody can play. {name} wins with the lowest hand!', { name: st.names[st.winner] });
}

function finish(st, p) {
  st.over = true;
  st.winner = p;
  st.scores = st.hands.map(penalty);
  log(st, '{name} wins!', { name: st.names[p] });
}
