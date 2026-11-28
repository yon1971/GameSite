(() => {
  let sel = new Set();
  let sortBy = 'suit';
  const SO = { S: 0, H: 1, C: 2, D: 3 };

  function meldsHTML(v, cls, tappable) {
    if (!v.melds.length) return `<p class="muted">${T('No melds on the table yet.')}</p>`;
    return `<div class="row" style="align-items:flex-start;gap:14px">${v.melds.map((m) => `<div class="${tappable ? 'tap meld' : ''}" data-meld="${m.id}" style="padding:6px;border-radius:10px;background:var(--bg2);${tappable ? 'outline:2px dashed var(--accent2)' : ''}"><div class="fan">${m.cards.map((c) => U.card(c, cls)).join('')}</div><div class="muted" style="font-size:.8em;margin-top:2px">${U.bdi(v.names[m.owner])}</div></div>`).join('')}</div>`;
  }

  GameUI.rummy = {
    board(root, v) {
      const head = v.over
        ? `<div class="banner win">🏆 ${T('{name} went out and scores {n} points!', { name: U.bdi(v.names[v.winner]), n: v.points })}</div>`
        : `<div class="banner">${T("{name}'s turn", { name: U.name(v, v.turn) })} · ${v.phase === 'draw' ? T('drawing') : T('melding / discarding')}</div>`;
      root.innerHTML = `${head}
        <div class="panel row" style="justify-content:center;gap:40px;padding:24px">
          <div class="center">${U.back('big')}<div class="muted">${T('{n} in stock', { n: v.deckCount })}</div></div>
          <div class="center">${U.card(v.top, 'big')}<div class="muted">${T('Discard pile')}</div></div>
        </div>
        <div class="panel"><h3>${T('On the table')}</h3>${meldsHTML(v, 'mid', false)}</div>
        <div class="game-grid">${v.names.map((n, i) => `<div class="panel" style="${v.turn === i && !v.over ? 'outline:3px solid var(--accent)' : ''}">
          <div>${U.name(v, i)} <span class="pill">${T.n(v.counts[i], '1 card', '{n} cards')}</span></div>
          ${v.over && v.leftovers[i].length ? `<div class="fan" style="margin-top:8px">${v.leftovers[i].map((c) => U.card(c, 'sm')).join('')}</div>` : `<div class="fan" style="margin-top:8px">${Array.from({ length: v.counts[i] }, () => U.back('sm')).join('')}</div>`}
        </div>`).join('')}</div>`;
    },
    player(root, v, ctx) {
      const ids = new Set(v.hand.map((c) => c.id));
      sel = new Set([...sel].filter((id) => ids.has(id)));
      if (!v.myTurn) sel.clear();
      const hand = [...v.hand].sort((a, b) => (sortBy === 'suit' ? SO[a.s] - SO[b.s] || a.r - b.r : a.r - b.r || SO[a.s] - SO[b.s]));
      const playPhase = v.myTurn && v.phase === 'play';
      let status;
      if (v.over) status = v.winner === ctx.seat ? T('🏆 You went out! +{n} points', { n: v.points }) : T('{name} went out', { name: U.bdi(v.names[v.winner]) });
      else if (!v.myTurn) status = T('Waiting for {name}', { name: U.bdi(v.names[v.turn]) });
      else if (v.phase === 'draw') status = T('Your turn: draw a card');
      else status = T('Select cards to meld, add to a meld, or discard 1 to end your turn');
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div>
        <div class="panel" style="padding:10px"><div class="row" style="justify-content:space-between"><b>${T('Table')}</b><span class="muted">${T('Stock {n}', { n: v.deckCount })} · ${T('Discard')} ${U.card(v.top, 'sm')}</span></div>
          <div style="margin-top:6px">${meldsHTML(v, 'sm', playPhase && sel.size > 0)}</div>
          ${playPhase && sel.size > 0 && v.melds.length ? `<div class="muted" style="font-size:.85em;margin-top:4px">${T('Tap a meld to add your selected cards to it.')}</div>` : ''}
        </div>
        <div class="row" style="justify-content:space-between;margin:12px 0 4px"><h3 style="margin:0">${T('Your hand ({n})', { n: v.hand.length })}</h3><button class="ghost small" id="sort">${sortBy === 'suit' ? T('Sort by rank') : T('Sort by suit')}</button></div>
        <div class="hand" style="padding-top:12px">${hand.map((c) => U.card(c, `mid tap ${sel.has(c.id) ? 'sel' : ''} ${c.id === v.takenId ? 'glow' : ''}`)).join('')}</div>
        ${v.myTurn ? `<div class="actions">${v.phase === 'draw'
          ? `<button id="stock">${T('Draw from stock')}</button><button class="secondary" id="take" ${v.top ? '' : 'disabled'}>${T('Take discard')}</button>`
          : `<button id="meld" ${sel.size >= 3 ? '' : 'disabled'}>${sel.size >= 3 ? T('Lay down {n}', { n: sel.size }) : T('Lay down')}</button><button class="secondary" id="discard" ${sel.size === 1 ? '' : 'disabled'}>${T('Discard')}</button>`}</div>` : ''}`;
      U.on(root, '#sort', () => { sortBy = sortBy === 'suit' ? 'rank' : 'suit'; GameUI.rummy.player(root, v, ctx); });
      U.on(root, '.hand .card', (el) => {
        if (!playPhase) return;
        const id = Number(el.dataset.id);
        sel.has(id) ? sel.delete(id) : sel.add(id);
        GameUI.rummy.player(root, v, ctx);
      });
      U.on(root, '#stock', () => ctx.send({ type: 'drawStock' }));
      U.on(root, '#take', () => ctx.send({ type: 'drawDiscard' }));
      U.on(root, '#meld', async () => { const r = await ctx.send({ type: 'meld', cardIds: [...sel] }); if (r.ok) sel.clear(); });
      U.on(root, '#discard', async () => { const r = await ctx.send({ type: 'discard', cardId: [...sel][0] }); if (r.ok) sel.clear(); });
      U.on(root, '.meld', async (el) => { const r = await ctx.send({ type: 'layoff', meldId: Number(el.dataset.meld), cardIds: [...sel] }); if (r.ok) sel.clear(); });
    },
  };
})();
