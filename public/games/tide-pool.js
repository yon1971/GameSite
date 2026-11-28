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
        ? `<div class="banner win">🏆 ${v.winner === null ? T('A tie!') : T('{name} wins!', { name: U.bdi(v.names[v.winner]) })}</div>`
        : `<div class="banner">${T("{name}'s turn", { name: U.name(v, v.turn) })} · ${T('Tide {n} of {m}', { n: v.tide, m: v.maxTide })}</div>`;
      root.innerHTML = `${head}
        <div class="row" style="align-items:stretch;gap:16px">
          <div class="panel center">${meter(v)}<div style="margin-top:6px"><b>${T('Tide {n}', { n: v.tide })}</b></div><div class="muted" style="font-size:.85em">${T('Cards below {n}<br>wash away', { n: v.tide })}</div></div>
          <div class="col grow">
            <div class="panel"><h3>${T('Just played')}</h3><div class="cards">${v.lastPlayed.length ? v.lastPlayed.map((c) => card(c, 'mid')).join('') : `<span class="muted">${T('Nothing yet this turn')}</span>`}</div></div>
            <div class="panel"><h3>${T('Washed out last turn')}</h3><div class="cards">${v.washed.length ? v.washed.map((c) => card(c, 'sm')).join('') : `<span class="muted">${T('Nothing')}</span>`}</div></div>
            <div class="panel"><h3>${T('Scores')}</h3>${U.players(v, (i) => `<span class="pill">${T('{n} in hand', { n: v.counts[i] })}</span> <b style="font-size:1.3em;min-width:2.5em;text-align:end">${v.scores[i]}</b>`)}<div class="muted" style="margin-top:6px">${T('{n} cards left in the deck', { n: v.deckCount })}</div></div>
          </div>
        </div>`;
    },
    player(root, v, ctx) {
      const ids = new Set(v.hand.map((c) => c.id));
      sel = new Set([...sel].filter((id) => ids.has(id)));
      const doomed = v.hand.filter((c) => c.v < v.tide).length;
      const status = v.over ? (v.winner === ctx.seat ? T('🏆 You win!') : T('Game over')) : v.myTurn ? T('Your turn: play sets, then end your turn') : T('Waiting for {name}', { name: U.bdi(v.names[v.turn]) });
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div>
        <div class="panel row" style="justify-content:space-between"><span>🌊 ${T('Tide')} <b>${v.tide}</b></span><span>${T('Your score')} <b>${v.scores[ctx.seat]}</b></span></div>
        <p class="muted" style="font-size:.9em">${T('Sets: 2+ cards of the same number, or 3+ of one creature in a row (+3 bonus). Cards marked 🌊 wash out when you end your turn (-1 each).')}</p>
        <div class="hand" style="padding-top:12px">${v.hand.map((c) => card(c, `mid tap ${sel.has(c.id) ? 'sel' : ''}`, v.tide)).join('')}</div>
        ${v.myTurn ? `<div class="actions"><button id="play" ${sel.size >= 2 ? '' : 'disabled'}>${sel.size ? T('Play set ({n})', { n: sel.size }) : T('Play set')}</button><button class="secondary" id="end">${doomed ? T('End turn (lose {n})', { n: doomed }) : T('End turn')}</button></div>` : ''}`;
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
