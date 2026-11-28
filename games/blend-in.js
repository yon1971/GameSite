const { fail, log, shuffle } = require('./util');
const WORDS = require('./word-lists');

const CATEGORIES = Object.keys(WORDS);
const CATEGORY_CHOICES = ['Mixed (random)', ...CATEGORIES];

// Lower-case, strip accents and anything that isn't a letter or digit, and a plural ending,
// so "Pizzas", "pizza!" and "PIZZA" all count as the same word.
function norm(s) {
  let w = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (w.length > 4 && /(ss|x|ch|sh|s)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

module.exports = {
  id: 'blend-in',
  name: 'Blend In',
  icon: '🎭',
  min: 3,
  max: 12,
  blurb: 'Everyone knows the secret word except the imposter. Give clues, vote, and don\'t get caught.',
  options: [
    { key: 'imposters', label: 'Number of imposters', type: 'number', min: 1, max: 3, default: 1 },
    { key: 'rounds', label: 'Words to play', type: 'number', min: 1, max: 10, default: 3 },
    { key: 'laps', label: 'Clues each per word', type: 'number', min: 1, max: 3, default: 1 },
    { key: 'category', label: 'Category', type: 'choice', choices: CATEGORY_CHOICES, min: 0, max: CATEGORY_CHOICES.length - 1, default: 0 },
    { key: 'hint', label: 'Imposters see the category', type: 'bool', default: true },
  ],
  rules: [
    'Each word, every phone shows the same secret word, except the imposter\'s. The imposter only sees "You\'re the imposter" (and the category, if that setting is on). Keep your phone to yourself!',
    'With more than one imposter, imposters don\'t know who the other imposters are.',
    'Take turns in the order shown on the big screen. On your turn, type one word on your phone as a clue. Show you know the word, but don\'t make it too easy for the imposter. You can\'t use the secret word itself.',
    'The imposter has to bluff a clue that fits in. The first clue is never given by an imposter.',
    'When all clues are in, everyone votes on their phone for who they think the imposter is. There is no timer: you can change your vote until the last person votes.',
    'The player with the most votes is accused. A tie means nobody is accused and the imposters get away.',
    'If the accused player is an imposter, they get one chance to type the secret word. Guess it right and the imposters still score.',
    'Scoring: imposters who get away score 2 each. If a caught imposter guesses the word, every imposter scores 1. Otherwise everyone else scores 1. Anyone who voted for an imposter scores 1 more.',
    'After each word the big screen reveals the word and the imposters. Press "Next word" on any phone to carry on. Most points after the last word wins.',
  ],

  setup(names, opts = {}) {
    const o = opts.options || {};
    const n = names.length;
    const maxImp = Math.max(1, Math.floor((n - 1) / 2));
    const k = Math.max(1, Math.min(o.imposters || 1, maxImp));
    const st = {
      names,
      impCount: k,
      rounds: Math.max(1, Math.min(10, o.rounds || 3)),
      laps: Math.max(1, Math.min(3, o.laps || 1)),
      catChoice: Math.max(0, Math.min(CATEGORIES.length, o.category || 0)),
      hint: o.hint !== false,
      scores: names.map(() => 0),
      used: [],
      round: 0,
      over: false,
      log: [],
    };
    if (k < (o.imposters || 1)) log(st, `Only ${k} imposter${k > 1 ? 's' : ''} for ${n} players.`);
    newRound(st);
    return st;
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    switch (a.type) {
      case 'clue': {
        if (st.phase !== 'clues') fail('It\'s not time for clues');
        if (st.order[st.turn % st.names.length] !== p) fail('It\'s not your turn');
        const word = String(a.word || '').trim();
        if (!word) fail('Type a clue first');
        if (/\s/.test(word)) fail('Just one word, please');
        if (word.length > 24) fail('That clue is too long');
        if (!norm(word)) fail('Use letters in your clue');
        // Only checked for players who know the word: blocking an imposter would tell them the word.
        const w = norm(st.word);
        const c = norm(word);
        if (!st.imposters.includes(p) && (c.includes(w) || (c.length >= 4 && w.includes(c)))) fail('Too close to the secret word. Try another clue');
        st.clues.push({ who: p, word });
        st.turn++;
        if (st.turn >= st.names.length * st.laps) {
          st.phase = 'vote';
          log(st, 'All clues are in. Time to vote!');
        }
        break;
      }
      case 'vote': {
        if (st.phase !== 'vote') fail('It\'s not time to vote');
        const t = a.target;
        if (!Number.isInteger(t) || t < 0 || t >= st.names.length || t === p) fail('Pick another player');
        st.votes[p] = t;
        if (Object.keys(st.votes).length === st.names.length) resolveVote(st);
        break;
      }
      case 'guess': {
        if (st.phase !== 'guess') fail('It\'s not time to guess');
        if (p !== st.accused) fail('Only the accused imposter can guess');
        const g = String(a.word || '').trim();
        if (!g) fail('Type your guess first');
        if (g.length > 40) fail('That guess is too long');
        st.guess = g;
        finishRound(st, norm(g) === norm(st.word));
        break;
      }
      case 'next':
        if (st.phase !== 'reveal') fail('Finish this word first');
        if (st.round >= st.rounds) fail('That was the last word');
        newRound(st);
        break;
      default:
        fail('Unknown action');
    }
  },

  boardView(st) {
    const reveal = st.phase === 'reveal' || st.over;
    const n = st.names.length;
    return {
      names: st.names,
      round: st.round,
      rounds: st.rounds,
      phase: st.phase,
      impCount: st.impCount,
      laps: st.laps,
      // With the hint off, the category is secret too (the imposter can see the big screen).
      category: st.hint || reveal ? st.category : null,
      order: st.order,
      turn: st.turn,
      current: st.phase === 'clues' ? st.order[st.turn % n] : null,
      clues: st.clues,
      voted: st.names.map((_, i) => st.votes[i] !== undefined),
      votes: reveal || st.phase === 'guess' ? st.votes : null,
      accused: st.accused,
      result: st.result,
      word: reveal ? st.word : null,
      imposters: reveal ? st.imposters : null,
      guess: reveal ? st.guess : null,
      scores: st.scores,
      gained: reveal ? st.gained : null,
      over: st.over,
      winners: st.over ? st.winners : null,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    const imp = st.imposters.includes(p);
    v.me = p;
    v.amImposter = imp;
    v.secret = imp ? null : st.word;
    v.myCategory = !imp || st.hint ? st.category : null;
    v.myVote = st.votes[p] ?? null;
    v.myTurn = st.phase === 'clues' && v.current === p;
    v.canGuess = st.phase === 'guess' && st.accused === p;
    return v;
  },
};

function newRound(st) {
  const cat = st.catChoice ? CATEGORIES[st.catChoice - 1] : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  let pool = WORDS[cat].filter((w) => !st.used.includes(w));
  if (!pool.length) pool = WORDS[cat];
  const word = shuffle(pool.slice())[0];
  st.used.push(word);
  const seats = shuffle(st.names.map((_, i) => i));
  st.imposters = seats.slice(0, st.impCount).sort((a, b) => a - b);
  // Clue order: shuffled, but an imposter never goes first.
  const order = shuffle(st.names.map((_, i) => i));
  const first = order.findIndex((i) => !st.imposters.includes(i));
  [order[0], order[first]] = [order[first], order[0]];
  st.round++;
  st.category = cat;
  st.word = word;
  st.order = order;
  st.turn = 0;
  st.clues = [];
  st.votes = {};
  st.accused = null;
  st.guess = null;
  st.result = null;
  st.gained = null;
  st.phase = 'clues';
  log(st, `Word ${st.round} of ${st.rounds}: the category is ${cat}. ${st.names[order[0]]} gives the first clue.`);
}

function resolveVote(st) {
  const tally = {};
  for (const t of Object.values(st.votes)) tally[t] = (tally[t] || 0) + 1;
  const counts = Object.entries(tally).map(([t, c]) => ({ target: Number(t), count: c })).sort((a, b) => b.count - a.count);
  st.counts = counts;
  const top = counts.length && (counts.length === 1 || counts[0].count > counts[1].count) ? counts[0].target : null;
  st.accused = top;
  if (top !== null && st.imposters.includes(top)) {
    st.phase = 'guess';
    log(st, `${st.names[top]} was accused, and they ARE an imposter! They get one guess at the word.`);
    return;
  }
  finishRound(st, null);
}

// guessedRight: null when no imposter was caught, otherwise whether the caught imposter guessed the word.
function finishRound(st, guessedRight) {
  const gained = st.names.map(() => 0);
  const imps = st.imposters;
  let result;
  if (guessedRight === null) {
    result = st.accused === null ? 'tie' : 'wrong';
    for (const i of imps) gained[i] += 2;
  } else if (guessedRight) {
    result = 'guessed';
    for (const i of imps) gained[i] += 1;
  } else {
    result = 'caught';
    st.names.forEach((_, i) => { if (!imps.includes(i)) gained[i] += 1; });
  }
  st.names.forEach((_, i) => { if (!imps.includes(i) && imps.includes(st.votes[i])) gained[i] += 1; });
  gained.forEach((g, i) => (st.scores[i] += g));
  st.gained = gained;
  st.result = { kind: result, counts: st.counts || [] };
  st.phase = 'reveal';
  const who = imps.map((i) => st.names[i]).join(' and ');
  const msg = {
    tie: `The vote was a tie, so ${who} got away!`,
    wrong: `${st.names[st.accused]} was innocent. ${who} got away!`,
    guessed: `${st.names[st.accused]} was caught but guessed the word "${st.word}"!`,
    caught: `${st.names[st.accused]} was caught and couldn't guess the word "${st.word}".`,
  }[result];
  log(st, msg);
  if (st.round >= st.rounds) {
    st.over = true;
    const best = Math.max(...st.scores);
    st.winners = st.names.map((_, i) => i).filter((i) => st.scores[i] === best);
    log(st, `Game over! ${st.winners.map((i) => st.names[i]).join(' and ')} win${st.winners.length > 1 ? '' : 's'} with ${best} points.`);
  }
}

module.exports.norm = norm;
