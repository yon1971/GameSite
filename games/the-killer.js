const { fail, log, shuffle } = require('./util');

const VOTE_SECONDS = 90;
const ROLE_NAMES = { villager: 'Villager', killer: 'Killer', spy: 'Spy' };

module.exports = {
  id: 'the-killer',
  name: 'The Killer',
  icon: '🔪',
  min: 4,
  max: 16,
  blurb: 'Secret roles. Talk, accuse, vote. Find the killers before they get you.',
  options: [
    { key: 'killers', label: 'Number of killers', type: 'number', min: 1, max: 5, default: 1 },
    { key: 'spy', label: 'Include a spy', type: 'bool', default: true },
    { key: 'minutes', label: 'Minutes to talk each round', type: 'number', min: 1, max: 15, default: 3 },
  ],
  rules: [
    'Everyone gets a secret role on their phone: Villager, Killer, or (if turned on) Spy. Don\'t show your phone to anyone!',
    'Killers can see who the other killers are. Villagers and the spy only know their own role.',
    'Each round starts with talking time (set by the host). Discuss, accuse and defend. When everyone taps "Ready to vote" or the timer runs out, voting starts.',
    'Voting: every living player picks someone to eliminate. The player with the most votes is out and their role is shown. If there is a tie for most votes, nobody is voted out.',
    'At the same time the killers secretly pick a villager to kill. With more than one killer, all living killers must pick the same person, or nobody is killed. Killers can see each other\'s picks on their phones to agree.',
    'The spy secretly picks one player to investigate, and their phone says whether that player is a killer. The spy counts as a villager and also votes.',
    `Voting closes when everyone has chosen, or after ${VOTE_SECONDS} seconds. Anyone who hasn't chosen skips.`,
    'The next round the big screen shows who was voted out and who was killed.',
    'Villagers win when every killer is out. Killers win when there are as many killers alive as everyone else.',
  ],

  setup(names, opts = {}) {
    const o = opts.options || {};
    const n = names.length;
    const maxKillers = Math.max(1, Math.floor((n - 1) / 2));
    const k = Math.max(1, Math.min(o.killers || 1, maxKillers));
    const seats = shuffle(names.map((_, i) => i));
    const roles = names.map(() => 'villager');
    seats.slice(0, k).forEach((i) => (roles[i] = 'killer'));
    const useSpy = o.spy !== false && n - k >= 2;
    if (useSpy) roles[seats[k]] = 'spy';
    const minutes = o.minutes || 3;
    const st = {
      names,
      roles,
      alive: names.map(() => true),
      killerCount: k,
      hasSpy: useSpy,
      minutes,
      round: 1,
      phase: 'talk',
      endsAt: Date.now() + minutes * 60000,
      ready: {},
      votes: {},
      kills: {},
      spyPick: null,
      spyResults: [],
      lastResult: null,
      over: false,
      winner: null,
      log: [],
    };
    log(st, `Roles are dealt: ${k} killer${k > 1 ? 's' : ''}${useSpy ? ' and a spy' : ''} are hiding among you.`);
    if (k < (o.killers || 1)) log(st, `Only ${k} killer${k > 1 ? 's' : ''} for ${n} players.`);
    return st;
  },

  act(st, p, a) {
    if (st.over) fail('Game is over');
    if (!st.alive[p]) fail('You have been eliminated');
    const target = a.target;
    const valid = (t) => Number.isInteger(t) && t >= 0 && t < st.names.length && st.alive[t];
    switch (a.type) {
      case 'ready':
        if (st.phase !== 'talk') fail('Voting has already started');
        st.ready[p] = !st.ready[p];
        if (aliveList(st).every((i) => st.ready[i])) startVote(st);
        return;
      case 'vote':
        if (st.phase !== 'vote') fail('Voting has not started');
        if (!valid(target) || target === p) fail('Pick another living player');
        st.votes[p] = target;
        break;
      case 'kill':
        if (st.phase !== 'vote') fail('Wait for the voting time');
        if (st.roles[p] !== 'killer') fail('Only killers can do that');
        if (!valid(target) || st.roles[target] === 'killer') fail('Pick a living non-killer');
        st.kills[p] = target;
        break;
      case 'spy':
        if (st.phase !== 'vote') fail('Wait for the voting time');
        if (st.roles[p] !== 'spy') fail('Only the spy can do that');
        if (st.spyPick !== null) fail('You already investigated this round');
        if (!valid(target) || target === p) fail('Pick another living player');
        st.spyPick = target;
        st.spyResults.push({ round: st.round, target, isKiller: st.roles[target] === 'killer' });
        break;
      default:
        fail('Unknown action');
    }
    if (allIn(st)) resolve(st);
  },

  tick(st, now) {
    if (st.over || now < st.endsAt) return false;
    if (st.phase === 'talk') startVote(st);
    else resolve(st);
    return true;
  },

  boardView(st) {
    const alive = aliveList(st);
    return {
      names: st.names,
      alive: st.alive,
      round: st.round,
      phase: st.phase,
      remainingMs: Math.max(0, st.endsAt - Date.now()),
      killerCount: st.killerCount,
      hasSpy: st.hasSpy,
      ready: st.names.map((_, i) => !!st.ready[i]),
      voted: st.names.map((_, i) => st.votes[i] !== undefined),
      aliveCount: alive.length,
      revealed: st.names.map((_, i) => (!st.alive[i] || st.over ? st.roles[i] : null)),
      lastResult: st.lastResult,
      over: st.over,
      winner: st.winner,
      log: st.log,
    };
  },

  playerView(st, p) {
    const v = this.boardView(st);
    const role = st.roles[p];
    v.me = p;
    v.role = role;
    v.roleName = ROLE_NAMES[role];
    v.meAlive = st.alive[p];
    v.myVote = st.votes[p] ?? null;
    v.myReady = !!st.ready[p];
    if (role === 'killer') {
      v.partners = st.names.map((_, i) => i).filter((i) => i !== p && st.roles[i] === 'killer');
      v.myKill = st.kills[p] ?? null;
      v.partnerKills = v.partners.map((i) => ({ who: i, target: st.kills[i] ?? null, alive: st.alive[i] }));
    }
    if (role === 'spy') {
      v.spyResults = st.spyResults;
      v.spyPick = st.spyPick;
    }
    return v;
  },
};

function aliveList(st) {
  return st.names.map((_, i) => i).filter((i) => st.alive[i]);
}

function startVote(st) {
  st.phase = 'vote';
  st.endsAt = Date.now() + VOTE_SECONDS * 1000;
  st.votes = {};
  st.kills = {};
  st.spyPick = null;
  log(st, `Round ${st.round}: time to vote!`);
}

function allIn(st) {
  const alive = aliveList(st);
  if (!alive.every((i) => st.votes[i] !== undefined)) return false;
  if (!alive.filter((i) => st.roles[i] === 'killer').every((i) => st.kills[i] !== undefined)) return false;
  const spy = alive.find((i) => st.roles[i] === 'spy');
  if (spy !== undefined && st.spyPick === null) return false;
  return true;
}

function resolve(st) {
  const alive = aliveList(st);
  // villager vote
  const tally = {};
  for (const i of alive) if (st.votes[i] !== undefined) tally[st.votes[i]] = (tally[st.votes[i]] || 0) + 1;
  const counts = Object.entries(tally).map(([t, c]) => ({ target: Number(t), count: c })).sort((a, b) => b.count - a.count);
  let votedOut = null;
  if (counts.length && (counts.length === 1 || counts[0].count > counts[1].count)) votedOut = counts[0].target;
  // killers' kill: every living killer must choose the same target
  const killers = alive.filter((i) => st.roles[i] === 'killer');
  const picks = killers.map((i) => st.kills[i]);
  let killed = null;
  let killFail = null;
  if (picks.length && picks.every((t) => t !== undefined && t === picks[0])) killed = picks[0];
  else if (picks.some((t) => t !== undefined)) killFail = killers.length > 1 ? 'The killers did not agree, so nobody was killed.' : null;
  if (killed === votedOut) killed = null; // already out

  const res = { round: st.round, votedOut, votedOutRole: null, killed, killedRole: null, tie: !votedOut && counts.length > 0, noVotes: !counts.length, counts, killFail };
  if (votedOut !== null) {
    st.alive[votedOut] = false;
    res.votedOutRole = st.roles[votedOut];
    log(st, `${st.names[votedOut]} was voted out. They were a ${ROLE_NAMES[st.roles[votedOut]]}.`);
  } else log(st, res.tie ? 'The vote was a tie. Nobody was voted out.' : 'Nobody voted.');
  if (killed !== null) {
    st.alive[killed] = false;
    res.killedRole = st.roles[killed];
    log(st, `${st.names[killed]} was killed by the killers.`);
  } else log(st, killFail || 'Nobody was killed.');
  st.lastResult = res;

  const left = aliveList(st);
  const k = left.filter((i) => st.roles[i] === 'killer').length;
  if (k === 0) return end(st, 'villagers', 'All the killers are gone. Villagers win!');
  if (k >= left.length - k) return end(st, 'killers', 'The killers have taken over. Killers win!');
  st.round++;
  st.phase = 'talk';
  st.endsAt = Date.now() + st.minutes * 60000;
  st.ready = {};
  st.votes = {};
  st.kills = {};
  st.spyPick = null;
}

function end(st, side, msg) {
  st.over = true;
  st.winner = side;
  st.phase = 'over';
  log(st, msg);
}
