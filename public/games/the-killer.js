(() => {
  const ROLE = { villager: '🧑‍🌾 Villager', killer: '🔪 Killer', spy: '🕵️ Spy' };
  let showRole = false;

  function news(v, big) {
    const r = v.lastResult;
    if (!r) return '';
    const n = (i) => `<b>${U.esc(v.names[i])}</b>`;
    const lines = [];
    if (r.votedOut !== null) lines.push(`🗳️ The village voted out ${n(r.votedOut)}. They were a <b>${ROLE[r.votedOutRole]}</b>.`);
    else lines.push(r.tie ? '🗳️ The vote was a tie. Nobody was voted out.' : '🗳️ Nobody voted.');
    if (r.killed !== null) lines.push(`🔪 ${n(r.killed)} was killed by the killer${v.killerCount > 1 ? 's' : ''}. They were a <b>${ROLE[r.killedRole]}</b>.`);
    else lines.push(r.killFail ? `🔪 ${U.esc(r.killFail)}` : '🔪 Nobody was killed.');
    const tally = r.counts.length ? `<div class="muted" style="font-size:.7em;margin-top:6px">Votes: ${r.counts.map((c) => `${U.esc(v.names[c.target])} ${c.count}`).join(' · ')}</div>` : '';
    return `<div class="panel ${big ? 'tk-news' : ''}" style="border-color:var(--accent)"><div class="tk-ended">🔔 Round ${r.round} has ended</div>${lines.map((l) => `<div>${l}</div>`).join('')}${tally}</div>`;
  }

  function header(v) {
    if (v.over) return `<div class="banner win">${v.winner === 'villagers' ? '🧑‍🌾 The villagers win!' : '🔪 The killers win!'}</div>`;
    const waiting = v.voted.filter((d, i) => v.alive[i] && !d).length;
    const count = waiting
      ? `<div class="tk-count"><b>${waiting}</b><span>still to vote</span></div>`
      : `<div class="tk-count"><b>🤫</b><span>waiting for secret picks</span></div>`;
    return `<div class="panel row" style="justify-content:space-between;flex-wrap:nowrap;gap:16px"><div style="flex:1;min-width:0"><h2 style="margin:0">Round ${v.round} · Talk it over and vote</h2><div class="muted">Vote on your phones. Killers and the spy also make a secret choice. The round ends when everyone is done.</div></div>${count}</div>`;
  }

  GameUI['the-killer'] = {
    board(root, v) {
      const tiles = v.names.map((nm, i) => {
        const dead = !v.alive[i];
        let badge = '';
        if (!dead && !v.over) badge = v.voted[i] ? '✅' : '⏳';
        return `<div class="tk-p pc${i} ${dead ? 'dead' : ''}"><span class="badge">${dead ? '💀' : badge}</span><span class="dot"></span>${U.esc(nm)}${v.revealed[i] ? `<span class="role">${ROLE[v.revealed[i]]}</span>` : ''}</div>`;
      }).join('');
      root.innerHTML = `${header(v)}
        ${news(v, true)}
        <div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Players · ${v.aliveCount} alive</h3><span class="muted">${v.killerCount} killer${v.killerCount > 1 ? 's' : ''}${v.hasSpy ? ' · 1 spy' : ''} in this game</span></div><div class="tk-grid">${tiles}</div></div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      const others = v.names.map((_, i) => i).filter((i) => i !== me && v.alive[i]);
      const roleCard = showRole || v.over
        ? `<div class="tk-role ${v.role}" id="role">${ROLE[v.role]}<div style="font-size:.8rem;font-family:Nunito;margin-top:6px">${v.over ? '' : 'Tap to hide'}</div></div>`
        : `<div class="tk-role hide" id="role">🙈 Tap to see your secret role</div>`;
      let secret = '';
      if (showRole && v.role === 'killer') secret += `<div class="panel" style="margin-top:8px">${v.partners.length ? `Your fellow killer${v.partners.length > 1 ? 's' : ''}: ${v.partners.map((i) => `<b>${U.esc(v.names[i])}</b>${v.alive[i] ? '' : ' (out)'}`).join(', ')}` : 'You are the only killer.'}</div>`;
      if (showRole && v.role === 'spy') secret += `<div class="panel" style="margin-top:8px"><b>Your findings</b>${v.spyResults.length ? `<ul>${v.spyResults.map((r) => `<li>Round ${r.round}: ${U.esc(v.names[r.target])} ${r.isKiller ? '<b style="color:var(--danger)">IS a killer!</b>' : 'is not a killer.'}</li>`).join('')}</ul>` : '<div class="muted">Nothing yet. You investigate during voting.</div>'}</div>`;

      let main = '';
      if (v.over) main = `<div class="status">${(v.winner === 'killers') === (v.role === 'killer') ? '🏆 Your side won!' : 'Your side lost.'}</div>`;
      else if (!v.meAlive) main = `<div class="status">💀 You've been eliminated. Watch the big screen, and no hints!</div>`;
      else {
        const todo = v.myVote === null || (v.role === 'killer' && v.myKill === null) || (v.role === 'spy' && v.spyPick === null);
        main = todo
          ? `<div class="status go">Round ${v.round}: talk it over, then vote</div>`
          : `<div class="status">✅ You're done. Waiting for everyone else…</div>`;
        main += `
          <h3>🗳️ Who should be eliminated?</h3><div class="tk-pick">${others.map((i) => `<button class="secondary ${v.myVote === i ? 'on' : ''}" data-vote="${i}">${U.esc(v.names[i])}</button>`).join('')}</div>`;
        if (v.role === 'killer' && v.myVote === null) main += `<p class="muted" style="margin-top:12px">🔪 After you vote, you'll secretly pick who the killers kill.</p>`;
        if (v.role === 'killer' && v.myVote !== null) {
          const targets = others.filter((i) => !v.partners.includes(i));
          const pk = v.partnerKills.filter((x) => x.alive).map((x) => `${U.esc(v.names[x.who])} picked ${x.target === null ? '…' : `<b>${U.esc(v.names[x.target])}</b>`}`).join(' · ');
          main += `<h3 style="margin-top:16px;color:var(--danger)">🔪 Secret: who do the killers kill?</h3>${pk ? `<div class="muted" style="margin-bottom:6px">${pk}. The person most of you pick is killed.</div>` : ''}<div class="tk-pick">${targets.map((i) => `<button class="danger ${v.myKill === i ? 'on' : ''}" data-kill="${i}">${U.esc(v.names[i])}</button>`).join('')}</div>`;
        }
        if (v.role === 'spy') {
          const done = v.spyPick !== null;
          const res = done ? v.spyResults[v.spyResults.length - 1] : null;
          main += `<h3 style="margin-top:16px;color:#b197fc">🕵️ Secret: who do you investigate?</h3>${done ? `<div class="panel">${U.esc(v.names[res.target])} ${res.isKiller ? '<b style="color:var(--danger)">IS a killer!</b>' : 'is <b>not</b> a killer.'}</div>` : `<div class="tk-pick">${others.map((i) => `<button style="background:#5f3dc4;color:#fff" data-spy="${i}">${U.esc(v.names[i])}</button>`).join('')}</div>`}`;
        }
        main += `<p class="muted" style="font-size:.85em">You can change your vote${v.role === 'killer' ? ' and kill pick' : ''} until everyone is done. Hold your phone close!</p>`;
      }
      root.innerHTML = `${roleCard}${secret}<div style="margin-top:12px">${main}</div>${news(v, false)}`;
      U.on(root, '#role', () => { if (!v.over) { showRole = !showRole; GameUI['the-killer'].player(root, v, ctx); } });
      U.on(root, '[data-vote]', (b) => ctx.send({ type: 'vote', target: Number(b.dataset.vote) }));
      U.on(root, '[data-kill]', (b) => ctx.send({ type: 'kill', target: Number(b.dataset.kill) }));
      U.on(root, '[data-spy]', (b) => ctx.send({ type: 'spy', target: Number(b.dataset.spy) }));
    },
  };
})();
