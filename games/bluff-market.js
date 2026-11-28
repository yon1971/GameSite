const { fail, log, tr, shuffle } = require('./util');

const GOODS = {
  gem: { name: 'Gem', value: 7, count: 4, icon: '💎' },
  silk: { name: 'Silk', value: 5, count: 6, icon: '🧣' },
  spice: { name: 'Spice', value: 4, count: 8, icon: '🌶️' },
  tea: { name: 'Tea', value: 3, count: 8, icon: '🍵' },
  clay: { name: 'Clay pot', value: 2, count: 8, icon: '🏺' },
  junk: { name: 'Junk', value: 0, count: 10, icon: '🥫' },
};
const ROUNDS = 5;
const HAND = 4;
const START_COINS = 10;

module.exports = {
  id: 'bluff-market',
  name: 'Bluff Market',
  icon: '🏪',
  min: 3,
  max: 6,
  blurb: 'Sell face-down goods at your price. Buy, call the bluff, or walk away.',
  rules: [
    `Everyone starts with ${START_COINS} coins and ${HAND} goods cards. Goods are worth: Gem 7, Silk 5, Spice 4, Tea 3, Clay pot 2, Junk 0.`,
    `The game lasts ${ROUNDS} rounds. Each round every player gets one turn as the seller.`,
    'Seller: pick one of your cards face down, say what it is (you may lie!) and set a price from 1 to 9 coins.',
    'Everyone else secretly chooses on their phone: Buy, Call bluff, or Pass.',
    'If anyone calls bluff, the card is revealed. If the seller lied, the seller pays each caller the asking price and the sale is cancelled. If the seller told the truth, each caller pays the seller half the price (rounded up), and the sale goes ahead.',
    'Sale: the first buyer clockwise from the seller pays the asking price and takes the card into their stash without showing it.',
    'At the end, everyone reveals their stash. Score = coins + the true value of your goods. Most wins.',
  ],

  setup(names) {
    const deck = [];
    let id = 0;
    for (const [k, g] of Object.entries(GOODS)) for (let i = 0; i < g.count; i++) deck.push({ id: id++, k });
    shuffle(deck);
    return {
      names,
      deck,
      hands: names.map(() => deck.splice(0, HAND)),
      coins: names.map(() => START_COINS),
      stash: names.map(() => []),
      round: 1,
      seller: 0,
      phase: 'offer',
      offer: null,
      responses: {},
      result: null,
      over: false,
      winner: null,
      log: [{ t: 'Round 1. {name} is selling first.', p: { name: names[0] } }],
    };
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    const n = st.names.length;
    if (a.type === 'offer') {
      if (st.phase !== 'offer' || p !== st.seller) fail('Not your turn to sell');
      const card = st.hands[p].find((c) => c.id === a.cardId);
      if (!card) fail('Pick a card from your hand');
      if (!GOODS[a.claim]) fail('Say what the card is');
      const price = Math.floor(Number(a.price));
      if (!(price >= 1 && price <= 9)) fail('Price must be 1 to 9');
      st.offer = { cardId: card.id, claim: a.claim, price };
      st.responses = {};
      st.phase = 'respond';
      log(st, '{name} offers {good} for {n} coins.', { name: st.names[p], good: tr(GOODS[a.claim].name), n: price });
    } else if (a.type === 'respond') {
      if (st.phase !== 'respond' || p === st.seller) fail('You cannot respond now');
      if (!['buy', 'call', 'pass'].includes(a.choice)) fail('Choose buy, call or pass');
      if (a.choice === 'buy' && st.coins[p] < st.offer.price) fail('Not enough coins to buy');
      st.responses[p] = a.choice;
      if (Object.keys(st.responses).length === n - 1) resolve(st);
    } else if (a.type === 'next') {
      if (st.phase !== 'result') fail('Nothing to continue');
      st.phase = 'offer';
      st.offer = null;
      st.result = null;
      st.responses = {};
      st.seller = (st.seller + 1) % n;
      if (st.seller === 0) {
        st.round++;
        if (st.round > ROUNDS) return finish(st);
        log(st, 'Round {n} begins.', { n: st.round });
      }
      if (!st.hands[st.seller].length) {
        log(st, '{name} has nothing to sell.', { name: st.names[st.seller] });
        st.phase = 'result';
        st.result = { skipped: true };
      }
    } else fail('Unknown action');
  },

  boardView(st) {
    const offer = st.offer && { claim: st.offer.claim, claimName: GOODS[st.offer.claim].name, icon: GOODS[st.offer.claim].icon, price: st.offer.price };
    return {
      names: st.names,
      goods: GOODS,
      coins: st.coins,
      stashCounts: st.stash.map((s) => s.length),
      round: st.round,
      rounds: ROUNDS,
      seller: st.seller,
      phase: st.phase,
      offer,
      responded: st.names.map((_, i) => (st.responses[i] ? true : false)),
      result: st.result,
      deckCount: st.deck.length,
      over: st.over,
      winner: st.winner,
      final: st.final,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.me = p;
    v.hand = st.hands[p];
    v.stash = st.stash[p];
    v.myResponse = st.responses[p] || null;
    v.mySellingCard = st.seller === p && st.offer ? st.offer.cardId : null;
    return v;
  },
};

function resolve(st) {
  const n = st.names.length;
  const s = st.seller;
  const hand = st.hands[s];
  const card = hand.find((c) => c.id === st.offer.cardId);
  hand.splice(hand.indexOf(card), 1);
  const price = st.offer.price;
  const order = Array.from({ length: n - 1 }, (_, i) => (s + 1 + i) % n);
  const callers = order.filter((i) => st.responses[i] === 'call');
  const buyers = order.filter((i) => st.responses[i] === 'buy');
  const res = { choices: { ...st.responses }, revealed: null, lied: null, buyer: null, transfers: [] };
  const pay = (from, to, amt) => {
    const x = Math.min(amt, st.coins[from]);
    st.coins[from] -= x;
    st.coins[to] += x;
    if (x) res.transfers.push({ from, to, amt: x });
  };
  let sale = true;
  if (callers.length) {
    res.revealed = card.k;
    res.lied = card.k !== st.offer.claim;
    if (res.lied) {
      callers.forEach((c) => pay(s, c, price));
      sale = false;
      log(st, 'Bluff called! It was {good}. {name} pays the callers.', { good: tr(GOODS[card.k].name), name: st.names[s] });
    } else {
      callers.forEach((c) => pay(c, s, Math.ceil(price / 2)));
      log(st, 'Bluff called, but it really was {good}! Callers pay {name}.', { good: tr(GOODS[card.k].name), name: st.names[s] });
    }
  }
  if (sale && buyers.length) {
    const b = buyers.find((i) => st.coins[i] >= price);
    if (b !== undefined) {
      pay(b, s, price);
      st.stash[b].push(card);
      res.buyer = b;
      log(st, '{name} bought it for {n}.', { name: st.names[b], n: price });
    } else sale = false;
  }
  if (res.buyer === null && sale && !buyers.length) log(st, 'Nobody bought it.');
  while (hand.length < HAND && st.deck.length) hand.push(st.deck.pop());
  st.result = res;
  st.phase = 'result';
}

function finish(st) {
  st.over = true;
  st.phase = 'over';
  st.final = st.names.map((_, i) => {
    const goods = st.stash[i].reduce((s, c) => s + GOODS[c.k].value, 0);
    return { coins: st.coins[i], goods, total: st.coins[i] + goods, stash: st.stash[i].map((c) => c.k) };
  });
  const best = Math.max(...st.final.map((f) => f.total));
  const w = st.final.map((f, i) => (f.total === best ? i : -1)).filter((i) => i >= 0);
  st.winner = w.length === 1 ? w[0] : null;
  if (w.length === 1) log(st, '{name} wins with {n}!', { name: st.names[w[0]], n: best });
  else log(st, 'Tie at {n}!', { n: best });
}
