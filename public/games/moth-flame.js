(() => {
  function grid(v, clickable) {
    const fr = new Set(v.frontier.map(([r, c]) => r + ',' + c));
    const last = new Set((v.last || []).map(([r, c]) => r + ',' + c));
    let h = `<div class="grid-board" style="grid-template-columns:repeat(${v.n},1fr);max-width:600px;background:#0a1420;padding:8px;border-radius:14px">`;
    for (let r = 0; r < v.n; r++)
      for (let c = 0; c < v.n; c++) {
        const x = v.grid[r][c];
        const edge = r === 0 || c === 0 || r === v.n - 1 || c === v.n - 1;
        const isFr = fr.has(r + ',' + c);
        const canTap = clickable && !x && (clickable === 'moth' || isFr);
        const bg = x === 'F' ? 'radial-gradient(circle,#ffd43b,#ff6b00)' : x === 'M' ? '#3b3f5c' : isFr ? '#3a2a1a' : edge ? '#1c2f45' : '#13263a';
        h += `<div class="cell ${canTap ? 'tap' : ''}" data-r="${r}" data-c="${c}" style="background:${bg};${last.has(r + ',' + c) ? 'outline:2px solid #fff;' : ''}">${x === 'F' ? '🔥' : x === 'M' ? '🦋' : ''}</div>`;
      }
    return h + '</div>';
  }
  const role = (v, i) => (v.roles.flame === i ? '🔥 Flame' : '🦋 Moths');
  GameUI['moth-flame'] = {
    board(root, v) {
      const head = v.over ? `<div class="banner win">🏆 ${U.esc(v.names[v.winner])} (${role(v, v.winner)}) wins!</div>` : `<div class="banner">${U.esc(v.names[v.turn])} (${role(v, v.turn)}) ${v.turn === v.roles.moth ? `places moth ${v.placed + 1} of ${v.perTurn}` : 'spreads the flame'}</div>`;
      root.innerHTML = `${head}<div class="row" style="justify-content:center"><span class="pill">🔥 ${U.esc(v.names[v.roles.flame])}</span><span class="pill">🦋 ${U.esc(v.names[v.roles.moth])}</span></div>${grid(v, null)}<p class="muted center">The flame wins by reaching the edge. The moths win by sealing it in.</p>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      const iAmMoth = v.roles.moth === me;
      const status = v.over ? (v.winner === me ? '🏆 You win!' : 'You lost this one') : v.myTurn ? (iAmMoth ? `Place moth ${v.placed + 1} of ${v.perTurn}` : 'Spread the flame to a glowing square') : `Waiting for ${U.esc(v.names[v.turn])}`;
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div><p class="center">You are the <b>${role(v, me)}</b></p>${grid(v, v.myTurn ? (iAmMoth ? 'moth' : 'flame') : null)}`;
      U.on(root, '.cell.tap', (el) => ctx.send({ type: 'cell', r: Number(el.dataset.r), c: Number(el.dataset.c) }));
    },
  };
})();
