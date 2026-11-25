const crypto = require('crypto');

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function standardDeck() {
  const deck = [];
  let id = 0;
  for (const s of ['S', 'H', 'D', 'C']) for (let r = 1; r <= 13; r++) deck.push({ id: id++, r, s });
  return shuffle(deck);
}

function fail(msg) {
  throw new Error(msg);
}

function log(state, msg) {
  state.log.unshift(msg);
  if (state.log.length > 8) state.log.length = 8;
}

function takeCards(hand, ids) {
  const out = [];
  for (const id of ids) {
    const i = hand.findIndex((c) => c.id === id);
    if (i < 0) fail('You do not have that card');
    out.push(hand[i]);
  }
  if (new Set(ids).size !== ids.length) fail('Duplicate card');
  for (const c of out) hand.splice(hand.indexOf(c), 1);
  return out;
}

const RANK = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
const cardName = (c) => RANK(c.r) + SUIT[c.s];

module.exports = { shuffle, standardDeck, fail, log, takeCards, cardName, RANK, SUIT };
