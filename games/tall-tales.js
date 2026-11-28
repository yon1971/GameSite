const { fail, log, tr, shuffle } = require('./util');
// Same categories in both languages; the room's language picks the questions.
const QUESTIONS = { en: require('./trivia-questions'), he: require('./trivia-questions-he') };

const CATEGORIES = Object.keys(QUESTIONS.en);
const CATEGORY_CHOICES = ['Mixed (random)', ...CATEGORIES];
const TRUTH_POINTS = 2;
const FOOL_POINTS = 1;

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

// Lower-case, drop accents, punctuation, spaces and a leading "a"/"an"/"the",
// so "The Moon!", "moon" and "MOON" are the same answer.
// Hebrew: niqqud, final letters and a leading "ה" (the) on each word are ignored.
function norm(s) {
  const t = String(s || '').normalize('NFD').replace(/[\u0300-\u036f\u0591-\u05c7]/g, '').toLowerCase();
  if (/[א-ת]/.test(t)) {
    return t.split(/[\s\-־]+/).map((w) => w.replace(/[^א-ת0-9]/g, '')).map((w) => (w.length > 2 && w.startsWith('ה') ? w.slice(1) : w))
      .join('').replace(/[ךםןףץ]/g, (c) => FINALS[c]);
  }
  return t.replace(/^\s*(a|an|the)\s+/, '').replace(/[^a-z0-9]/g, '');
}

function isTruth(q, text) {
  const t = norm(text);
  return [q.a, ...(q.also || [])].some((x) => norm(x) === t);
}

module.exports = {
  id: 'tall-tales',
  name: 'Tall Tales',
  icon: '🤥',
  min: 3,
  max: 12,
  blurb: 'A weird true fact with a blank. Everyone writes a believable fake answer, then hunts for the real one.',
  options: [
    { key: 'rounds', label: 'Questions to play', type: 'number', min: 1, max: 15, default: 6 },
    { key: 'category', label: 'Category', type: 'choice', choices: CATEGORY_CHOICES, min: 0, max: CATEGORY_CHOICES.length - 1, default: 0 },
  ],
  rules: [
    'The big screen shows a weird but true fact with a blank in it, like "Scotland\'s national animal is the ____."',
    'Everyone types a fake answer on their phone that sounds believable enough to fool the others. If you happen to type the real answer, you\'ll be asked to write something else.',
    'When everyone has written an answer, all the fakes and the real answer are shuffled together and shown on the big screen and every phone. There is no timer: you can change your fake until the last person sends theirs.',
    'Vote on your phone for the answer you think is true. You can\'t vote for your own fake. You can change your vote until the last person votes.',
    `Scoring: finding the real answer scores ${TRUTH_POINTS}. Every player you fool with your fake scores you ${FOOL_POINTS}. If two players write the same fake, it shows once and they share the credit.`,
    'Then the big screen reveals the truth and who wrote each fake. Press "Next question" on any phone to carry on. Most points after the last question wins.',
  ],

  setup(names, opts = {}) {
    const o = opts.options || {};
    const st = {
      names,
      lang: opts.lang === 'he' ? 'he' : 'en',
      rounds: Math.max(1, Math.min(15, o.rounds || 6)),
      catChoice: Math.max(0, Math.min(CATEGORIES.length, o.category || 0)),
      scores: names.map(() => 0),
      used: [],
      round: 0,
      over: false,
      log: [],
    };
    newRound(st);
    return st;
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    switch (a.type) {
      case 'fake': {
        if (st.phase !== 'write') fail('It\'s not time to write answers');
        const text = String(a.text || '').trim().replace(/\s+/g, ' ');
        if (!text) fail('Type a fake answer first');
        if (text.length > 40) fail('Keep it under 40 letters');
        if (!norm(text)) fail('Use some letters or numbers');
        if (isTruth(st.q, text)) fail('Lucky! That\'s actually the real answer. Write a fake one instead');
        st.fakes[p] = text;
        if (Object.keys(st.fakes).length === st.names.length) startVote(st);
        break;
      }
      case 'vote': {
        if (st.phase !== 'vote') fail('It\'s not time to vote');
        const opt = st.options[a.option];
        if (!Number.isInteger(a.option) || !opt) fail('Pick an answer');
        if (opt.authors.includes(p)) fail('You can\'t vote for your own answer');
        st.votes[p] = a.option;
        if (Object.keys(st.votes).length === st.names.length) finishRound(st);
        break;
      }
      case 'next':
        if (st.phase !== 'reveal') fail('Finish this question first');
        if (st.round >= st.rounds) fail('That was the last question');
        newRound(st);
        break;
      default:
        fail('Unknown action');
    }
  },

  boardView(st) {
    const reveal = st.phase === 'reveal' || st.over;
    return {
      names: st.names,
      round: st.round,
      rounds: st.rounds,
      phase: st.phase,
      category: st.category,
      question: st.q.q,
      wrote: st.names.map((_, i) => st.fakes[i] !== undefined),
      voted: st.names.map((_, i) => st.votes[i] !== undefined),
      // During voting only the texts are shown; who wrote what stays hidden until the reveal.
      options: st.phase === 'write' ? null : st.options.map((o, k) => ({
        text: o.text,
        truth: reveal ? o.truth : undefined,
        authors: reveal ? o.authors : undefined,
        voters: reveal ? st.names.map((_, i) => i).filter((i) => st.votes[i] === k) : undefined,
      })),
      answer: reveal ? st.q.a : null,
      scores: st.scores,
      gained: reveal ? st.gained : null,
      over: st.over,
      winners: st.over ? st.winners : null,
      truthPoints: TRUTH_POINTS,
      foolPoints: FOOL_POINTS,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.me = p;
    v.myFake = st.fakes[p] ?? null;
    v.myVote = st.votes[p] ?? null;
    v.myOptions = st.phase === 'write' ? [] : st.options.map((o, k) => (o.authors.includes(p) ? k : -1)).filter((k) => k >= 0);
    return v;
  },
};

function newRound(st) {
  const cat = st.catChoice ? CATEGORIES[st.catChoice - 1] : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const list = QUESTIONS[st.lang || 'en'][cat];
  let pool = list.filter((q) => !st.used.includes(q.q));
  if (!pool.length) pool = list;
  const q = shuffle(pool.slice())[0];
  st.used.push(q.q);
  st.round++;
  st.category = cat;
  st.q = q;
  st.fakes = {};
  st.votes = {};
  st.options = [];
  st.gained = null;
  st.phase = 'write';
  log(st, 'Question {n} of {m} ({cat}). Write a fake answer on your phone!', { n: st.round, m: st.rounds, cat: tr(cat) });
}

function startVote(st) {
  const byKey = new Map();
  st.names.forEach((_, i) => {
    const text = st.fakes[i];
    const k = norm(text);
    if (byKey.has(k)) byKey.get(k).authors.push(i);
    else byKey.set(k, { text, truth: false, authors: [i] });
  });
  st.options = shuffle([...byKey.values(), { text: st.q.a, truth: true, authors: [] }]);
  st.phase = 'vote';
  log(st, 'All answers are in. Which one is true? Vote on your phone!');
}

function finishRound(st) {
  const gained = st.names.map(() => 0);
  for (const [voter, k] of Object.entries(st.votes)) {
    const opt = st.options[k];
    if (opt.truth) gained[voter] += TRUTH_POINTS;
    else for (const a of opt.authors) gained[a] += FOOL_POINTS;
  }
  gained.forEach((g, i) => (st.scores[i] += g));
  st.gained = gained;
  st.phase = 'reveal';
  const found = Object.values(st.votes).filter((k) => st.options[k].truth).length;
  log(st, found === 0 ? 'The truth was "{a}". Nobody found it.' : found === st.names.length ? 'The truth was "{a}". Everybody found it.' : found === 1 ? 'The truth was "{a}". 1 player found it.' : 'The truth was "{a}". {n} players found it.', { a: st.q.a, n: found });
  if (st.round >= st.rounds) {
    st.over = true;
    const best = Math.max(...st.scores);
    st.winners = st.names.map((_, i) => i).filter((i) => st.scores[i] === best);
    log(st, st.winners.length > 1 ? 'Game over! {who} win with {n} points.' : 'Game over! {who} wins with {n} points.', { who: st.winners.map((i) => st.names[i]), n: best });
  }
}

module.exports.norm = norm;
module.exports.isTruth = isTruth;
