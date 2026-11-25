(() => {
  const EM = { crab: '🦀', octopus: '🐙', fish: '🐟', shrimp: '🦐' };
  let sel = new Set();
  const card = (c, cls = '', tide = 0) => `<div class="card sea k-${c.k} ${c.v < tide ? 'wash' : ''} ${cls}" data-id="${c.id}"><span class="corner">${c.v}</span><span class="em">${EM[c.k]}</span><span class="r">${c.v}</span></div>`;

  function meter(v) {
    const marks = Array.from({ length: v.maxTide }, (_, i) => `<div class="mark" style="bottom:${(i / v.maxTide) * 100}%">${i + 1}</div>`).join('');
    return `<div class="tide-meter"><div class="water" style="height:${(v.tide / v.maxTide) * 100}%"></div>${marks}</div>`;
  }

  GameUI['tide-pool'] = {
    board(root, v) {
      const head = v.over
        ? `<div class="banner win">🏆 ${v.winner === null ? 'A tie!' : U.esc(v.names[v.winner]) + ' wins!'}</div>`
        : `<div class="banner">${U.name(v, v.turn)}'s turn · Tide ${v.tide} of ${v.maxTide}</div>`;
      root.innerHTML = `${head}
        <div class="row" style="align-items:stretch;gap:16px">
          <div class="panel center">${meter(v)}<div style="margin-top:6px"><b>Tide ${v.tide}</b></div><div class="muted" style="font-size:.85em">Cards below ${v.tide}<br>wash away</div></div>
          <div class="col grow">
            <div class="panel"><h3>Just played</h3><div class="cards">${v.lastPlayed.length ? v.lastPlayed.map((c) => card(c, 'mid')).join('') : '<span class="muted">Nothing yet this turn</span>'}</div></div>
            <div class="panel"><h3>Washed out last turn</h3><div class="cards">${v.washed.length ? v.washed.map((c) => card(c, 'sm')).join('') : '<span class="muted">Nothing</span>'}</div></div>
            <div class="panel"><h3>Scores</h3>${U.players(v, (i) => `<span class="pill">${v.counts[i]} in hand</span> <b style="font-size:1.3em;min-width:2.5em;text-align:right">${v.scores[i]}</b>`)}<div class="muted" style="margin-top:6px">${v.deckCount} cards left in the deck</div></div>
          </div>
        </div>`;
    },
    player(root, v, ctx) {
      const ids = new Set(v.hand.map((c) => c.id));
      sel = new Set([...sel].filter((id) => ids.has(id)));
      const doomed = v.hand.filter((c) => c.v < v.tide).length;
      const status = v.over ? (v.winner === ctx.seat ? '🏆 You win!' : 'Game over') : v.myTurn ? 'Your turn: play sets, then end your turn' : `Waiting for ${U.esc(v.names[v.turn])}`;
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div>
        <div class="panel row" style="justify-content:space-between"><span>🌊 Tide <b>${v.tide}</b></span><span>Your score <b>${v.scores[ctx.seat]}</b></span></div>
        <p class="muted" style="font-size:.9em">Sets: 2+ cards of the same number, or 3+ of one creature in a row (+3 bonus). Cards marked 🌊 wash out when you end your turn (-1 each).</p>
        <div class="hand" style="padding-top:12px">${v.hand.map((c) => card(c, `mid tap ${sel.has(c.id) ? 'sel' : ''}`, v.tide)).join('')}</div>
        ${v.myTurn ? `<div class="actions"><button id="play" ${sel.size >= 2 ? '' : 'disabled'}>Play set${sel.size ? ` (${sel.size})` : ''}</button><button class="secondary" id="end">End turn${doomed ? ` (lose ${doomed})` : ''}</button></div>` : ''}`;
      U.on(root, '.hand .card', (el) => {
        const id = Number(el.dataset.id);
        sel.has(id) ? sel.delete(id) : sel.add(id);
        GameUI['tide-pool'].player(root, v, ctx);
      });
      U.on(root, '#play', async () => { const r = await ctx.send({ type: 'set', cardIds: [...sel] }); if (r.ok) sel.clear(); });
      U.on(root, '#end', () => { sel.clear(); ctx.send({ type: 'end' }); });
    },
  };
})();
