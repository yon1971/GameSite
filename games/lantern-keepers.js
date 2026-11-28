const { fail, log, tr, shuffle } = require('./util');

const COLORS = ['amber', 'jade', 'azure', 'rose'];
const COPIES = { 1: 3, 10: 1 }; // others 2
const MAX_SPARKS = 8;
const MAX_GUSTS = 3;

module.exports = {
  id: 'lantern-keepers',
  name: 'Lantern Keepers',
  icon: '🏮',
  min: 2,
  max: 5,
  blurb: 'Cooperative: light four lantern rows 1 to 10 without seeing your own cards.',
  rules: [
    'Everyone plays together. The deck has lantern cards in four colours (amber, jade, azure, rose) numbered 1 to 10: three 1s, two each of 2 to 9, and one 10 per colour.',
    'You hold your cards facing away from you: your phone shows everyone else\'s cards, but not your own. Never say your cards out loud!',
    'Hands: 5 cards with 2-3 players, 4 cards with 4-5 players.',
    'On your turn do one thing: give a hint, light a card, or discard a card.',
    `Hint (costs 1 spark, ${MAX_SPARKS} sparks to start): tell another player all of their cards of one colour, or all of their cards of one number.`,
    'Light: play one of your cards. If it is the next number for its colour, it joins that lantern row. If not, a gust blows and it is discarded.',
    `Discard: throw away one card and get 1 spark back. Lighting a 10 also gives a spark back.`,
    `You lose if ${MAX_GUSTS} gusts blow. When the deck runs out, everyone gets one last turn. Your score is the total of the four lantern rows (40 is perfect).`,
  ],

  setup(names) {
    const deck = [];
    let id = 0;
    for (const color of COLORS)
      for (let v = 1; v <= 10; v++)
        for (let k = 0; k < (COPIES[v] || 2); k++) deck.push({ id: id++, color, v, hint: { color: null, v: null, notColors: [], notValues: [] } });
    shuffle(deck);
    const size = names.length <= 3 ? 5 : 4;
    return {
      names,
      deck,
      hands: names.map(() => deck.splice(0, size)),
      lit: Object.fromEntries(COLORS.map((c) => [c, 0])),
      discards: [],
      sparks: MAX_SPARKS,
      gusts: 0,
      turn: 0,
      finalTurns: null,
      over: false,
      lastEvent: null,
      log: [{ t: '{name} goes first. Good luck, keepers!', p: { name: names[0] } }],
    };
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    if (p !== st.turn) fail('Not your turn');
    const hand = st.hands[p];
    let justEmptied = false;
    if (a.type === 'hint') {
      if (st.sparks <= 0) fail('No sparks left. Discard to earn one.');
      const t = a.target;
      if (t === p || !st.hands[t]) fail('Pick another player');
      const th = st.hands[t];
      let match;
      if (a.color) {
        if (!COLORS.includes(a.color)) fail('Bad colour');
        match = th.filter((c) => c.color === a.color);
        if (!match.length) fail('They have no cards of that colour');
        th.forEach((c) => {
          if (c.color === a.color) c.hint.color = a.color;
          else if (!c.hint.notColors.includes(a.color)) c.hint.notColors.push(a.color);
        });
        log(st, match.length > 1 ? '{a} told {b}: {n} {color} cards.' : '{a} told {b}: 1 {color} card.', { a: st.names[p], b: st.names[t], n: match.length, color: tr(a.color) });
      } else {
        const v = Number(a.value);
        match = th.filter((c) => c.v === v);
        if (!match.length) fail('They have no cards of that number');
        th.forEach((c) => {
          if (c.v === v) c.hint.v = v;
          else if (!c.hint.notValues.includes(v)) c.hint.notValues.push(v);
        });
        log(st, match.length > 1 ? '{a} told {b}: {n} cards numbered {v}.' : '{a} told {b}: 1 card numbered {v}.', { a: st.names[p], b: st.names[t], n: match.length, v });
      }
      st.sparks--;
      st.lastEvent = { type: 'hint', target: t, ids: match.map((c) => c.id) };
    } else if (a.type === 'light' || a.type === 'discard') {
      const i = hand.findIndex((c) => c.id === a.cardId);
      if (i < 0) fail('Card not in hand');
      if (a.type === 'discard' && st.sparks >= MAX_SPARKS) fail('Sparks are full, so you cannot discard. Hint or light instead.');
      const [card] = hand.splice(i, 1);
      if (a.type === 'light') {
        if (st.lit[card.color] === card.v - 1) {
          st.lit[card.color] = card.v;
          log(st, '{name} lit {color} {v}!', { name: st.names[p], color: tr(card.color), v: card.v });
          if (card.v === 10 && st.sparks < MAX_SPARKS) st.sparks++;
          st.lastEvent = { type: 'lit', card };
        } else {
          st.gusts++;
          st.discards.push(card);
          log(st, "A gust! {name}'s {color} {v} did not fit.", { name: st.names[p], color: tr(card.color), v: card.v });
          st.lastEvent = { type: 'gust', card };
          if (st.gusts >= MAX_GUSTS) {
            st.over = true;
            st.score = 0;
            log(st, 'Three gusts blew out the lanterns. The night is lost.');
            return;
          }
        }
      } else {
        st.discards.push(card);
        st.sparks++;
        log(st, '{name} discarded {color} {v}.', { name: st.names[p], color: tr(card.color), v: card.v });
        st.lastEvent = { type: 'discard', card };
      }
      if (st.deck.length) hand.push(st.deck.pop());
      if (!st.deck.length && st.finalTurns === null) {
        st.finalTurns = st.names.length;
        justEmptied = true;
        log(st, 'The deck is empty. Everyone gets one last turn.');
      }
    } else fail('Unknown action');

    const total = Object.values(st.lit).reduce((s, v) => s + v, 0);
    if (total === 40) return end(st, 'All lanterns are lit! A perfect night!');
    if (st.finalTurns !== null && !justEmptied) {
      st.finalTurns--;
      if (st.finalTurns <= 0) return end(st, 'The night is over.');
    }
    st.turn = (p + 1) % st.names.length;
  },

  boardView(st) {
    return {
      names: st.names,
      colors: COLORS,
      lit: st.lit,
      discards: st.discards,
      sparks: st.sparks,
      maxSparks: MAX_SPARKS,
      gusts: st.gusts,
      maxGusts: MAX_GUSTS,
      deckCount: st.deck.length,
      counts: st.hands.map((h) => h.length),
      turn: st.turn,
      finalTurns: st.finalTurns,
      lastEvent: st.lastEvent,
      over: st.over,
      score: st.over ? (st.gusts >= MAX_GUSTS ? 0 : Object.values(st.lit).reduce((s, v) => s + v, 0)) : null,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.me = p;
    v.myTurn = st.turn === p && !st.over;
    v.myHand = st.hands[p].map((c) => ({ id: c.id, hint: c.hint }));
    v.others = st.hands.map((h, i) => (i === p ? null : h));
    return v;
  },
};

function end(st, msg) {
  st.over = true;
  log(st, '{msg} Score: {n}.', { msg: tr(msg), n: Object.values(st.lit).reduce((s, v) => s + v, 0) });
}
