(() => {
  const nm = (v, i) => U.esc(v.names[i]);
  const list = (v, arr) => {
    const a = arr.map((i) => `<b>${nm(v, i)}</b>`);
    return a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
  };

  function question(v, big) {
    return `<div class="pp-q ${big ? 'big' : ''}"><span class="pp-lead">Who is most likely to…</span>${U.esc(v.prompt)}?</div>`;
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
      <div class="tk-ended">🔔 The room has spoken</div>
      ${v.top.length ? `<div class="pp-winner">${v.top.length > 1 ? '🤝 ' : '👉 '}${list(v, v.top)}</div>
      <div class="muted">${v.top.length > 1 ? 'are tied as' : 'is'} most likely to ${U.esc(v.prompt)}!</div>` : `<div class="pp-winner">🤷 Split room!</div>
      <div class="muted">Everyone picked someone different, so nobody is most likely to ${U.esc(v.prompt)}.</div>`}${bars(v)}</div>`;
  }

  function scores(v) {
    const order = v.names.map((_, i) => i).sort((a, b) => v.scores[b] - v.scores[a]);
    return `<ul class="plist">${order.map((i) => `<li class="pc${i}"><span class="dot"></span><span class="grow">${U.esc(v.names[i])}${v.titles[i] ? ` <span class="muted" title="Titles won">👑${v.titles[i]}</span>` : ''}</span><b>${v.scores[i]}</b>${v.gained && v.gained[i] ? `<span class="bi-plus">+${v.gained[i]}</span>` : ''}</li>`).join('')}</ul>`;
  }

  function voters(v) {
    return `<div class="tk-grid">${v.names.map((n, i) => `<div class="tk-p pc${i}"><span class="badge">${v.voted[i] ? '✅' : '⏳'}</span><span class="dot"></span>${U.esc(n)}</div>`).join('')}</div>`;
  }

  function titlesPanel(v) {
    const most = Math.max(...v.titles);
    const champs = v.names.map((_, i) => i).filter((i) => v.titles[i] === most && most > 0);
    return `<div class="panel"><h3 style="margin-top:0">Titles</h3>${champs.length ? `<p>👑 Most titles: ${list(v, champs)} with ${most}</p>` : ''}<ul class="pp-hist">${v.history.map((h) => `<li>Most likely to ${U.esc(h.prompt)}: ${h.top.length ? list(v, h.top) : '<span class="muted">split room</span>'}</li>`).join('')}</ul></div>`;
  }

  GameUI['point-party'] = {
    board(root, v) {
      let top;
      if (v.over) {
        top = `<div class="banner win">🏆 ${list(v, v.winners)} read the room best!</div>${reveal(v, true)}`;
      } else if (v.phase === 'vote') {
        const waiting = v.voted.filter((d) => !d).length;
        top = `<div class="panel row" style="justify-content:space-between;flex-wrap:nowrap;gap:16px"><div style="flex:1;min-width:0"><div class="muted">Question ${v.round} of ${v.rounds}</div>${question(v, true)}<div class="muted">Vote on your phones. You can change your vote until the last person votes.</div></div><div class="tk-count"><b>${waiting}</b><span>still to vote</span></div></div>
          <div class="panel"><h3 style="margin-top:0">Votes in</h3>${voters(v)}</div>`;
      } else {
        top = `<div class="muted" style="margin-bottom:6px">Question ${v.round} of ${v.rounds} · press "Next question" on any phone</div>${reveal(v, true)}`;
      }
      root.innerHTML = `${top}${v.over ? titlesPanel(v) : ''}<div class="panel"><h3 style="margin-top:0">Scores</h3>${scores(v)}</div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      let main;
      if (v.phase === 'vote') {
        const opts = v.names.map((_, i) => i).filter((i) => v.self || i !== me);
        main = `${question(v, false)}
          ${v.myVote === null ? '<div class="status go">Tap the player who fits best</div>' : '<div class="status">✅ Voted. You can change it until everyone has voted.</div>'}
          <div class="tk-pick" style="margin-top:8px">${opts.map((i) => `<button class="secondary ${v.myVote === i ? 'on' : ''}" data-vote="${i}">${U.esc(v.names[i])}${i === me ? ' (me)' : ''}</button>`).join('')}</div>`;
      } else {
        const mine = v.votesForMe;
        main = `${reveal(v, false)}
          <div class="status ${v.gained[me] ? 'go' : ''}">${v.gained[me] ? '🎯 You read the room! +1' : 'No point this time.'}</div>
          <p class="muted">${mine ? `${mine} vote${mine > 1 ? 's' : ''} pointed at you.` : 'Nobody pointed at you this time.'}</p>
          ${v.over ? `<div class="panel" style="margin-top:12px"><b>${v.winners.includes(me) ? '🏆 You win!' : 'Final scores'}</b>${scores(v)}</div>` : `<button id="nextBtn" style="width:100%;margin-top:8px">Next question ▶</button>`}`;
      }
      root.innerHTML = `<div class="muted" style="margin-bottom:6px">Question ${v.round} of ${v.rounds}</div>${main}`;
      U.on(root, '[data-vote]', (b) => ctx.send({ type: 'vote', target: Number(b.dataset.vote) }));
      U.on(root, '#nextBtn', () => ctx.send({ type: 'next' }));
    },
  };
})();
