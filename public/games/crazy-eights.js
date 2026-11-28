(() => {
  const playable = (v, c) => c.r === 8 || c.s === v.suit || c.r === v.top.r;
  const suitBadge = (s) => `<span style="font-size:1.4em;color:${s === 'H' || s === 'D' ? '#ff6b6b' : 'var(--text)'}">${U.SUIT[s]}</span> ${U.SUITNAME[s]}`;

  function banner(v) {
    if (v.over) return `<div class="banner win">🏆 ${U.esc(v.names[v.winner])} wins!</div>`;
    return `<div class="banner">${U.name(v, v.turn)}'s turn</div>`;
  }

  GameUI['crazy-eights'] = {
    board(root, v) {
      root.innerHTML = `${banner(v)}
        <div class="panel row" style="justify-content:center;gap:40px;padding:30px">
          <div class="center">${U.back('big')}<div class="muted">${v.deckCount} in deck</div></div>
          <div class="center">${U.card(v.top, 'big')}<div style="margin-top:6px">Follow: ${suitBadge(v.suit)}</div></div>
        </div>
        <div class="game-grid">${v.names.map((n, i) => `<div class="panel ${v.turn === i && !v.over ? 'pc' + i : ''}" style="${v.turn === i && !v.over ? 'outline:3px solid var(--accent)' : ''}">
          <div>${U.name(v, i)} <span class="pill">${v.counts[i]} card${v.counts[i] === 1 ? '' : 's'}</span></div>
          <div class="fan" style="margin-top:8px">${Array.from({ length: Math.min(v.counts[i], 12) }, () => U.back('sm')).join('')}</div>
          ${v.over ? `<div class="muted" style="margin-top:6px">${v.winner === i ? 'Winner!' : v.scores[i] + ' penalty points'}</div>` : ''}
        </div>`).join('')}</div>`;
    },
    player(root, v, ctx) {
      const status = v.over ? (v.winner === ctx.seat ? '🏆 You win!' : `${U.esc(v.names[v.winner])} wins`) : v.myTurn ? (v.drew ? 'Play the card you drew, or pass' : 'Your turn: play a card or draw') : `Waiting for ${U.esc(v.names[v.turn])}`;
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div>
        <div class="panel row" style="justify-content:center;gap:20px">
          ${U.card(v.top, 'mid')}<div>Follow:<br>${suitBadge(v.suit)}</div>
        </div>
        <h3 style="margin-top:14px">Your hand (${v.hand.length})</h3>
        <div class="hand">${v.hand.map((c) => {
          const ok = v.myTurn && playable(v, c) && (!v.drew || c.id === v.drawnId);
          return U.card(c, `mid ${ok ? 'tap glow' : v.myTurn ? 'dim' : ''}`);
        }).join('')}</div>
        ${v.myTurn ? `<div class="actions">${v.drew ? '<button class="secondary" id="pass">Pass</button>' : '<button class="secondary" id="draw">Draw a card</button>'}</div>` : ''}`;
      U.on(root, '.card.tap', (el) => {
        const c = v.hand.find((x) => x.id === Number(el.dataset.id));
        if (c.r === 8) {
          const m = U.modal(`<h2>Pick the new suit</h2><div class="row" style="justify-content:center">${['S', 'H', 'D', 'C'].map((s) => `<button class="secondary" data-suit="${s}" style="font-size:1.6em">${U.SUIT[s]}</button>`).join('')}</div>`);
          U.on(m, '[data-suit]', (b) => { m.remove(); ctx.send({ type: 'play', cardId: c.id, suit: b.dataset.suit }); });
        } else ctx.send({ type: 'play', cardId: c.id });
      });
      U.on(root, '#draw', () => ctx.send({ type: 'draw' }));
      U.on(root, '#pass', () => ctx.send({ type: 'pass' }));
    },
  };
})();
