(() => {
  const nm = (v, i) => U.bdi(v.names[i]);
  const list = (v, arr) => T.list(arr.map((i) => ({ raw: `<b>${nm(v, i)}</b>`, text: v.names[i] })));
  const P = (x) => U.esc(U.loc(x)); // the question text, in this screen's language

  function question(v, big) {
    return `<div class="pp-q ${big ? 'big' : ''}"><span class="pp-lead">${T('Who is most likely to…')}</span>${P(v.prompt)}?</div>`;
  }

  function bars(v) {
    const max = Math.max(1, ...v.counts);
    const order = v.names.map((_, i) => i).filter((i) => v.counts[i] > 0).sort((a, b) => v.counts[b] - v.counts[a]);
    return `<div class="pp-bars">${order.map((i) => {
      const who = v.votes ? Object.keys(v.votes).filter((k) => v.votes[k] === i).map((k) => nm(v, Number(k))).join(', ') : '';
      return `<div class="pp-bar pc${i} ${v.top.includes(i) ? 'top' : ''}"><span class="pp-name"><span class="dot"></span>${nm(v, i)}${v.top.includes(i) ? ' 👑' : ''}</span><span class="pp-track"><span class="pp-fill" style="width:${(v.counts[i] / max) * 100}%"></span></span><b>${v.counts[i]}</b>${who ? `<div class="pp-who">${who}</div>` : ''}</div>`;
    }).join('')}</div>`;
  }

  function reveal(v, big) {
    return `<div class="panel ${big ? 'bi-news' : ''}" style="border-color:var(--accent)">
      <div class="tk-ended">🔔 ${T('The room has spoken')}</div>
      ${v.top.length ? `<div class="pp-winner">${v.top.length > 1 ? '🤝 ' : '👉 '}${list(v, v.top)}</div>
      <div class="muted">${T(v.top.length > 1 ? 'are tied as most likely to {prompt}!' : 'is most likely to {prompt}!', { prompt: P(v.prompt) })}</div>` : `<div class="pp-winner">${T('🤷 Split room!')}</div>
      <div class="muted">${T('Everyone picked someone different, so nobody is most likely to {prompt}.', { prompt: P(v.prompt) })}</div>`}${bars(v)}</div>`;
  }

  function scores(v) {
    const order = v.names.map((_, i) => i).sort((a, b) => v.scores[b] - v.scores[a]);
    return `<ul class="plist">${order.map((i) => `<li class="pc${i}"><span class="dot"></span><span class="grow">${U.bdi(v.names[i])}${v.titles[i] ? ` <span class="muted" title="${T('Titles won')}">👑${v.titles[i]}</span>` : ''}</span><b>${v.scores[i]}</b>${v.gained && v.gained[i] ? `<span class="bi-plus">+${v.gained[i]}</span>` : ''}</li>`).join('')}</ul>`;
  }

  function voters(v) {
    return `<div class="tk-grid">${v.names.map((n, i) => `<div class="tk-p pc${i}"><span class="badge">${v.voted[i] ? '✅' : '⏳'}</span><span class="dot"></span>${U.bdi(n)}</div>`).join('')}</div>`;
  }

  function titlesPanel(v) {
    const most = Math.max(...v.titles);
    const champs = v.names.map((_, i) => i).filter((i) => v.titles[i] === most && most > 0);
    return `<div class="panel"><h3 style="margin-top:0">${T('Titles')}</h3>${champs.length ? `<p>👑 ${T('Most titles: {who} with {n}', { who: list(v, champs), n: most })}</p>` : ''}<ul class="pp-hist">${v.history.map((h) => `<li>${T('Most likely to {prompt}:', { prompt: P(h.prompt) })} ${h.top.length ? list(v, h.top) : `<span class="muted">${T('split room')}</span>`}</li>`).join('')}</ul></div>`;
  }

  GameUI['point-party'] = {
    board(root, v) {
      let top;
      if (v.over) {
        top = `<div class="banner win">🏆 ${T('{who} read the room best!', { who: { raw: list(v, v.winners) } })}</div>${reveal(v, true)}`;
      } else if (v.phase === 'vote') {
        const waiting = v.voted.filter((d) => !d).length;
        top = `<div class="panel row" style="justify-content:space-between;flex-wrap:nowrap;gap:16px"><div style="flex:1;min-width:0"><div class="muted">${T('Question {n} of {m}', { n: v.round, m: v.rounds })}</div>${question(v, true)}<div class="muted">${T('Vote on your phones. You can change your vote until the last person votes.')}</div></div><div class="tk-count"><b>${waiting}</b><span>${T('still to vote')}</span></div></div>
          <div class="panel"><h3 style="margin-top:0">${T('Votes in')}</h3>${voters(v)}</div>`;
      } else {
        top = `<div class="muted" style="margin-bottom:6px">${T('Question {n} of {m}', { n: v.round, m: v.rounds })} · ${T('press "Next question" on any phone')}</div>${reveal(v, true)}`;
      }
      root.innerHTML = `${top}${v.over ? titlesPanel(v) : ''}<div class="panel"><h3 style="margin-top:0">${T('Scores')}</h3>${scores(v)}</div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      let main;
      if (v.phase === 'vote') {
        const opts = v.names.map((_, i) => i).filter((i) => v.self || i !== me);
        main = `${question(v, false)}
          ${v.myVote === null ? `<div class="status go">${T('Tap the player who fits best')}</div>` : `<div class="status">${T('✅ Voted. You can change it until everyone has voted.')}</div>`}
          <div class="tk-pick" style="margin-top:8px">${opts.map((i) => `<button class="secondary ${v.myVote === i ? 'on' : ''}" data-vote="${i}">${U.bdi(v.names[i])}${i === me ? ` ${T('(me)')}` : ''}</button>`).join('')}</div>`;
      } else {
        const mine = v.votesForMe;
        main = `${reveal(v, false)}
          <div class="status ${v.gained[me] ? 'go' : ''}">${v.gained[me] ? T('🎯 You read the room! +1') : T('No point this time.')}</div>
          <p class="muted">${mine ? T.n(mine, '1 vote pointed at you.', '{n} votes pointed at you.') : T('Nobody pointed at you this time.')}</p>
          ${v.over ? `<div class="panel" style="margin-top:12px"><b>${v.winners.includes(me) ? T('🏆 You win!') : T('Final scores')}</b>${scores(v)}</div>` : `<button id="nextBtn" style="width:100%;margin-top:8px">${T('Next question')} <span class="flip-rtl">▶</span></button>`}`;
      }
      root.innerHTML = `<div class="muted" style="margin-bottom:6px">${T('Question {n} of {m}', { n: v.round, m: v.rounds })}</div>${main}`;
      U.on(root, '[data-vote]', (b) => ctx.send({ type: 'vote', target: Number(b.dataset.vote) }));
      U.on(root, '#nextBtn', () => ctx.send({ type: 'next' }));
    },
  };
})();
