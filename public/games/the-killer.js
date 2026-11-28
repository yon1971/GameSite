(() => {
  const ROLES = { villager: '🧑‍🌾 Villager', killer: '🔪 Killer', spy: '🕵️ Spy' };
  const ROLE = new Proxy(ROLES, { get: (o, k) => T(o[k]) });
  let showRole = false;

  function news(v, big) {
    const r = v.lastResult;
    if (!r) return '';
    const n = (i) => `<b>${U.bdi(v.names[i])}</b>`;
    const lines = [];
    if (r.votedOut !== null) lines.push(`🗳️ ${T('The village voted out {name}. They were a {role}.', { name: n(r.votedOut), role: `<b>${ROLE[r.votedOutRole]}</b>` })}`);
    else lines.push(r.tie ? `🗳️ ${T('The vote was a tie. Nobody was voted out.')}` : `🗳️ ${T('Nobody voted.')}`);
    if (r.killed !== null) lines.push(`🔪 ${T(v.killerCount > 1 ? '{name} was killed by the killers. They were a {role}.' : '{name} was killed by the killer. They were a {role}.', { name: n(r.killed), role: `<b>${ROLE[r.killedRole]}</b>` })}`);
    else lines.push(r.killFail ? `🔪 ${T.html(r.killFail)}` : `🔪 ${T('Nobody was killed.')}`);
    const tally = r.counts.length ? `<div class="muted" style="font-size:.7em;margin-top:6px">${T('Votes:')} ${r.counts.map((c) => `${U.bdi(v.names[c.target])} ${c.count}`).join(' · ')}</div>` : '';
    return `<div class="panel ${big ? 'tk-news' : ''}" style="border-color:var(--accent)"><div class="tk-ended">🔔 ${T('Round {n} has ended', { n: r.round })}</div>${lines.map((l) => `<div>${l}</div>`).join('')}${tally}</div>`;
  }

  function header(v) {
    if (v.over) return `<div class="banner win">${v.winner === 'villagers' ? T('🧑‍🌾 The villagers win!') : T('🔪 The killers win!')}</div>`;
    const waiting = v.voted.filter((d, i) => v.alive[i] && !d).length;
    const count = waiting
      ? `<div class="tk-count"><b>${waiting}</b><span>${T('still to vote')}</span></div>`
      : `<div class="tk-count"><b>🤫</b><span>${T('waiting for secret picks')}</span></div>`;
    return `<div class="panel row" style="justify-content:space-between;flex-wrap:nowrap;gap:16px"><div style="flex:1;min-width:0"><h2 style="margin:0">${T('Round {n} · Talk it over and vote', { n: v.round })}</h2><div class="muted">${T('Vote on your phones. Killers and the spy also make a secret choice. The round ends when everyone is done.')}</div></div>${count}</div>`;
  }

  GameUI['the-killer'] = {
    board(root, v) {
      const tiles = v.names.map((nm, i) => {
        const dead = !v.alive[i];
        let badge = '';
        if (!dead && !v.over) badge = v.voted[i] ? '✅' : '⏳';
        return `<div class="tk-p pc${i} ${dead ? 'dead' : ''}"><span class="badge">${dead ? '💀' : badge}</span><span class="dot"></span>${U.bdi(nm)}${v.revealed[i] ? `<span class="role">${ROLE[v.revealed[i]]}</span>` : ''}</div>`;
      }).join('');
      root.innerHTML = `${header(v)}
        ${news(v, true)}
        <div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">${T('Players · {n} alive', { n: v.aliveCount })}</h3><span class="muted">${T(v.killerCount > 1 ? (v.hasSpy ? '{n} killers · 1 spy in this game' : '{n} killers in this game') : v.hasSpy ? '1 killer · 1 spy in this game' : '1 killer in this game', { n: v.killerCount })}</span></div><div class="tk-grid">${tiles}</div></div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      const others = v.names.map((_, i) => i).filter((i) => i !== me && v.alive[i]);
      const roleCard = showRole || v.over
        ? `<div class="tk-role ${v.role}" id="role">${ROLE[v.role]}<div style="font-size:.8rem;font-family:Nunito, Rubik, sans-serif;margin-top:6px">${v.over ? '' : T('Tap to hide')}</div></div>`
        : `<div class="tk-role hide" id="role">${T('🙈 Tap to see your secret role')}</div>`;
      let secret = '';
      if (showRole && v.role === 'killer') secret += `<div class="panel" style="margin-top:8px">${v.partners.length ? `${v.partners.length > 1 ? T('Your fellow killers:') : T('Your fellow killer:')} ${v.partners.map((i) => `<b>${U.bdi(v.names[i])}</b>${v.alive[i] ? '' : ` ${T('(out)')}`}`).join(', ')}` : T('You are the only killer.')}</div>`;
      if (showRole && v.role === 'spy') secret += `<div class="panel" style="margin-top:8px"><b>${T('Your findings')}</b>${v.spyResults.length ? `<ul>${v.spyResults.map((r) => `<li>${T('Round {n}:', { n: r.round })} ${U.bdi(v.names[r.target])} ${r.isKiller ? `<b style="color:var(--danger)">${T('IS a killer!')}</b>` : T('is not a killer.')}</li>`).join('')}</ul>` : `<div class="muted">${T('Nothing yet. You investigate during voting.')}</div>`}</div>`;

      let main = '';
      if (v.over) main = `<div class="status">${(v.winner === 'killers') === (v.role === 'killer') ? T('🏆 Your side won!') : T('Your side lost.')}</div>`;
      else if (!v.meAlive) main = `<div class="status">${T("💀 You've been eliminated. Watch the big screen, and no hints!")}</div>`;
      else {
        const todo = v.myVote === null || (v.role === 'killer' && v.myKill === null) || (v.role === 'spy' && v.spyPick === null);
        main = todo
          ? `<div class="status go">${T('Round {n}: talk it over, then vote', { n: v.round })}</div>`
          : `<div class="status">${T("✅ You're done. Waiting for everyone else…")}</div>`;
        main += `
          <h3>${T('🗳️ Who should be eliminated?')}</h3><div class="tk-pick">${others.map((i) => `<button class="secondary ${v.myVote === i ? 'on' : ''}" data-vote="${i}">${U.bdi(v.names[i])}</button>`).join('')}</div>`;
        if (v.role === 'killer' && v.myVote === null) main += `<p class="muted" style="margin-top:12px">${T("🔪 After you vote, you'll secretly pick who the killers kill.")}</p>`;
        if (v.role === 'killer' && v.myVote !== null) {
          const targets = others.filter((i) => !v.partners.includes(i));
          const pk = v.partnerKills.filter((x) => x.alive).map((x) => T('{name} picked {target}', { name: U.bdi(v.names[x.who]), target: x.target === null ? '…' : `<b>${U.bdi(v.names[x.target])}</b>` })).join(' · ');
          main += `<h3 style="margin-top:16px;color:var(--danger)">${T('🔪 Secret: who do the killers kill?')}</h3>${pk ? `<div class="muted" style="margin-bottom:6px">${pk}. ${T('The person most of you pick is killed.')}</div>` : ''}<div class="tk-pick">${targets.map((i) => `<button class="danger ${v.myKill === i ? 'on' : ''}" data-kill="${i}">${U.bdi(v.names[i])}</button>`).join('')}</div>`;
        }
        if (v.role === 'spy') {
          const done = v.spyPick !== null;
          const res = done ? v.spyResults[v.spyResults.length - 1] : null;
          main += `<h3 style="margin-top:16px;color:#b197fc">${T('🕵️ Secret: who do you investigate?')}</h3>${done ? `<div class="panel">${U.bdi(v.names[res.target])} ${res.isKiller ? `<b style="color:var(--danger)">${T('IS a killer!')}</b>` : T('is <b>not</b> a killer.')}</div>` : `<div class="tk-pick">${others.map((i) => `<button style="background:#5f3dc4;color:#fff" data-spy="${i}">${U.bdi(v.names[i])}</button>`).join('')}</div>`}`;
        }
        main += `<p class="muted" style="font-size:.85em">${v.role === 'killer' ? T('You can change your vote and kill pick until everyone is done. Hold your phone close!') : T('You can change your vote until everyone is done. Hold your phone close!')}</p>`;
      }
      root.innerHTML = `${roleCard}${secret}<div style="margin-top:12px">${main}</div>${news(v, false)}`;
      U.on(root, '#role', () => { if (!v.over) { showRole = !showRole; GameUI['the-killer'].player(root, v, ctx); } });
      U.on(root, '[data-vote]', (b) => ctx.send({ type: 'vote', target: Number(b.dataset.vote) }));
      U.on(root, '[data-kill]', (b) => ctx.send({ type: 'kill', target: Number(b.dataset.kill) }));
      U.on(root, '[data-spy]', (b) => ctx.send({ type: 'spy', target: Number(b.dataset.spy) }));
    },
  };
})();
