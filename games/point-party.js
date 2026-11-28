const { fail, log, shuffle } = require('./util');
const PROMPTS = require('./point-party-prompts');

module.exports = {
  id: 'point-party',
  name: 'Point Party',
  icon: '👉',
  min: 3,
  max: 16,
  blurb: 'Who is most likely to…? Everyone secretly points at a friend. Guess who the room picks!',
  options: [
    { key: 'rounds', label: 'Questions to play', type: 'number', min: 3, max: 20, default: 8 },
    { key: 'self', label: 'You can vote for yourself', type: 'bool', default: true },
    { key: 'showVotes', label: 'Show who voted for whom', type: 'bool', default: false },
  ],
  rules: [
    'The big screen shows a question like "Who is most likely to adopt ten cats?"',
    'Everyone votes on their phone for the player who fits best. There is no timer: you can change your vote until the last person votes.',
    'When everyone has voted, the big screen reveals the results. The player with the most votes wins the title for that question.',
    'Scoring: if you voted for the player who got the most votes, you score 1 point for reading the room. If there is a tie for most votes, voting for any of the tied players counts. If nobody gets more than one vote, the room is split: no title and no points.',
    'Votes are secret unless the "Show who voted for whom" setting is on.',
    'Press "Next question" on any phone to carry on. Most points after the last question wins, and the big screen shows who collected the most titles.',
  ],

  setup(names, opts = {}) {
    const o = opts.options || {};
    const st = {
      names,
      rounds: Math.max(3, Math.min(20, o.rounds || 8)),
      self: o.self !== false,
      showVotes: !!o.showVotes,
      deck: shuffle(PROMPTS.slice()),
      scores: names.map(() => 0),
      titles: names.map(() => 0),
      history: [],
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
      case 'vote': {
        if (st.phase !== 'vote') fail('Voting is closed');
        const t = a.target;
        if (!Number.isInteger(t) || t < 0 || t >= st.names.length) fail('Pick a player');
        if (t === p && !st.self) fail('Pick someone other than yourself');
        st.votes[p] = t;
        if (Object.keys(st.votes).length === st.names.length) resolve(st);
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
    const reveal = st.phase === 'reveal';
    return {
      names: st.names,
      round: st.round,
      rounds: st.rounds,
      phase: st.phase,
      prompt: st.prompt,
      self: st.self,
      voted: st.names.map((_, i) => st.votes[i] !== undefined),
      counts: reveal ? st.counts : null,
      top: reveal ? st.top : null,
      votes: reveal && st.showVotes ? st.votes : null,
      gained: reveal ? st.gained : null,
      scores: st.scores,
      titles: st.titles,
      history: st.over ? st.history : null,
      over: st.over,
      winners: st.over ? st.winners : null,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    v.me = p;
    v.myVote = st.votes[p] ?? null;
    v.votesForMe = st.phase === 'reveal' ? st.counts[p] : null;
    return v;
  },
};

function newRound(st) {
  if (!st.deck.length) st.deck = shuffle(PROMPTS.slice());
  st.prompt = st.deck.pop();
  st.round++;
  st.votes = {};
  st.counts = null;
  st.top = null;
  st.gained = null;
  st.phase = 'vote';
  log(st, `Question ${st.round} of ${st.rounds}: who is most likely to ${st.prompt}?`);
}

function resolve(st) {
  const counts = st.names.map(() => 0);
  for (const t of Object.values(st.votes)) counts[t]++;
  const best = Math.max(...counts);
  let top = st.names.map((_, i) => i).filter((i) => counts[i] === best);
  // Nobody got more than one vote: the room is split, so there's no title and no points.
  if (best === 1 && top.length > 1) top = [];
  const gained = st.names.map((_, i) => (top.includes(st.votes[i]) ? 1 : 0));
  gained.forEach((g, i) => (st.scores[i] += g));
  top.forEach((i) => st.titles[i]++);
  st.counts = counts;
  st.top = top;
  st.gained = gained;
  st.phase = 'reveal';
  st.history.push({ prompt: st.prompt, top });
  const who = joinNames(top.map((i) => st.names[i]));
  log(st, top.length ? `${who} ${top.length > 1 ? 'are' : 'is'} most likely to ${st.prompt}!` : 'Everyone picked someone different. No title this time!');
  if (st.round >= st.rounds) {
    st.over = true;
    const hi = Math.max(...st.scores);
    st.winners = st.names.map((_, i) => i).filter((i) => st.scores[i] === hi);
    log(st, `Game over! ${joinNames(st.winners.map((i) => st.names[i]))} read the room best with ${hi} point${hi === 1 ? '' : 's'}.`);
  }
}

function joinNames(a) {
  return a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}
