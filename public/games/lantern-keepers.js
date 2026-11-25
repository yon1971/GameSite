(() => {
  const HEX = { amber: '#f59f00', jade: '#37b24d', azure: '#1c7ed6', rose: '#e64980' };
  const Cap = (s) => s[0].toUpperCase() + s.slice(1);
  const card = (c, cls = '', hintHTML = '') => `<div class="card lk lk-${c.color} ${cls}" data-id="${c.id}"><span class="r">${c.v}</span>${hintHTML}</div>`;
  const knownMarks = (h) => `<div class="hints">${h.color ? '🎨' : ''}${h.v ? '🔢' : ''}</div>`;

  function ownCard(c, cls) {
    const h = c.hint;
    const bg = h.color ? `lk-${h.color}` : 'lk-unknown';
    const not = [...h.notColors.map((x) => `<span style="color:${HEX[x]}">✕</span>`), ...(h.notValues.length ? ['✕' + h.notValues.join(',')] : [])].join(' ');
    return `<div class="card lk ${bg} ${cls}" data-id="${c.id}"><span class="r">${h.v || '?'}</span><div class="hints" style="font-size:9px">${not}</div></div>`;
  }

  function lanterns(v) {
    return v.colors.map((col) => `<div class="row" style="flex-wrap:nowrap"><b style="width:70px;color:${HEX[col]}">${Cap(col)}</b><div class="lanterns grow">${Array.from({ length: 10 }, (_, i) => `<div class="lantern ${v.lit[col] > i ? 'on' : ''}" style="${v.lit[col] > i ? `background:${HEX[col]};--glow:${HEX[col]}` : ''}">${i + 1}</div>`).join('')}</div></div>`).join('');
  }

  function tokens(v) {
    return `<div class="row"><span>Sparks ${'✨'.repeat(v.sparks)}<span style="opacity:.25">${'✨'.repeat(v.maxSparks - v.sparks)}</span></span><span>Gusts ${'💨'.repeat(v.gusts)}<span style="opacity:.25">${'💨'.repeat(v.maxGusts - v.gusts)}</span></span><span class="pill">Deck ${v.deckCount}</span>${v.finalTurns !== null ? `<span class="pill" style="background:var(--danger)">Final turns: ${v.finalTurns}</span>` : ''}</div>`;
  }

  GameUI['lantern-keepers'] = {
    board(root, v) {
      const head = v.over ? `<div class="banner win">🏮 Night's end · Score ${v.score} / 40</div>` : `<div class="banner">${U.name(v, v.turn)}'s turn · Team score ${Object.values(v.lit).reduce((a, b) => a + b, 0)}</div>`;
      const byColor = v.colors.map((col) => v.discards.filter((c) => c.color === col).sort((a, b) => a.v - b.v));
      root.innerHTML = `${head}
        <div class="panel">${tokens(v)}</div>
        <div class="panel col" style="gap:10px">${lanterns(v)}</div>
        <div class="panel"><h3>Discarded</h3>${byColor.some((x) => x.length) ? byColor.map((cs) => cs.length ? `<div class="cards" style="margin-bottom:6px">${cs.map((c) => card(c, 'sm')).join('')}</div>` : '').join('') : '<span class="muted">Nothing yet</span>'}</div>
        <p class="muted center">Hands are only shown on phones. No peeking at your own cards!</p>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      const status = v.over ? `Game over · Score ${v.score} / 40` : v.myTurn ? 'Your turn: hint, light or discard' : `Waiting for ${U.esc(v.names[v.turn])}`;
      const hl = v.lastEvent && v.lastEvent.type === 'hint' ? new Set(v.lastEvent.ids) : new Set();
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div>
        <div class="panel" style="padding:10px">${tokens(v)}<div style="margin-top:8px" class="row">${v.colors.map((c) => `<span class="pill" style="background:${HEX[c]};color:#fff">${Cap(c)} ${v.lit[c]}</span>`).join('')}</div></div>
        <h3 style="margin-top:12px">Your cards ${v.myTurn ? '<span class="muted" style="font-size:.7em">(tap to light or discard)</span>' : ''}</h3>
        <div class="hand">${v.myHand.map((c) => ownCard(c, `mid ${v.myTurn ? 'tap' : ''} ${hl.has(c.id) ? 'glow' : ''}`)).join('')}</div>
        <h3 style="margin-top:16px">Other keepers ${v.myTurn && v.sparks > 0 ? '<span class="muted" style="font-size:.7em">(tap a player to hint)</span>' : ''}</h3>
        <div class="col">${v.others.map((h, i) => h ? `<div class="panel ${v.myTurn && v.sparks > 0 ? 'tap hintable' : ''}" data-p="${i}" style="padding:10px"><div>${U.name(v, i)}${v.turn === i ? ' <span class="pill">turn</span>' : ''}</div><div class="cards" style="margin-top:6px">${h.map((c) => card(c, `sm ${hl.has(c.id) ? 'glow' : ''}`, knownMarks(c.hint))).join('')}</div></div>` : '').join('')}</div>
        <p class="muted" style="font-size:.85em">🎨 = they know the colour · 🔢 = they know the number. On your own cards ✕ marks what a card is not.</p>`;
      U.on(root, '.hand .card.tap', (el) => {
        const id = Number(el.dataset.id);
        const m = U.modal(`<h2>This card…</h2><div class="col"><button data-a="light">🏮 Light it</button><button class="secondary" data-a="discard" ${v.sparks >= v.maxSparks ? 'disabled' : ''}>Discard it (+1 spark)</button></div>`);
        U.on(m, '[data-a]', (b) => { m.remove(); ctx.send({ type: b.dataset.a, cardId: id }); });
      });
      U.on(root, '.hintable', (el) => {
        const t = Number(el.dataset.p);
        const h = v.others[t];
        const cols = [...new Set(h.map((c) => c.color))];
        const vals = [...new Set(h.map((c) => c.v))].sort((a, b) => a - b);
        const m = U.modal(`<h2>Hint for ${U.esc(v.names[t])}</h2><p class="muted">Costs 1 spark. They'll learn every card that matches.</p>
          <h3>Colour</h3><div class="row">${cols.map((c) => `<button data-c="${c}" style="background:${HEX[c]};color:#fff">${Cap(c)}</button>`).join('')}</div>
          <h3 style="margin-top:12px">Number</h3><div class="row">${vals.map((x) => `<button class="secondary" data-v="${x}">${x}</button>`).join('')}</div>`);
        U.on(m, '[data-c]', (b) => { m.remove(); ctx.send({ type: 'hint', target: t, color: b.dataset.c }); });
        U.on(m, '[data-v]', (b) => { m.remove(); ctx.send({ type: 'hint', target: t, value: Number(b.dataset.v) }); });
      });
    },
  };
})();
