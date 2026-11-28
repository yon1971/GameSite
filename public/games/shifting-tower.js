(() => {
  const COL = ['#ff6b6b', '#ffd93d'];
  function grid(v, tappable) {
    const win = new Set((v.winCells || []).map(([c, r]) => c + ',' + r));
    let html = `<div dir="ltr"><div style="display:grid;grid-template-columns:repeat(${v.cols},1fr);gap:6px;text-align:center;margin-bottom:6px">${Array.from({ length: v.cols }, (_, c) => `<div style="font-size:1.4em;${c === v.shiftCol && !v.over ? '' : 'visibility:hidden'}" title="${T('This column sinks after the next move')}">⬇️</div>`).join('')}</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(${v.cols},1fr);gap:6px;background:#1f4e8c;padding:10px;border-radius:16px;box-shadow:inset 0 -6px 0 #163a69">`;
    for (let r = v.rows - 1; r >= 0; r--)
      for (let c = 0; c < v.cols; c++) {
        const who = v.grid[c][r];
        const isLast = v.lastDrop && v.lastDrop[0] === c && v.lastDrop[1] === r;
        html += `<div class="${tappable ? 'tap dropcol' : ''}" data-c="${c}" style="aspect-ratio:1;border-radius:50%;background:${who === undefined ? '#1b1422' : COL[who]};${c === v.shiftCol && !v.over ? 'box-shadow:inset 0 0 0 3px #5ad1c4;' : ''}${win.has(c + ',' + r) ? 'outline:4px solid #fff;' : ''}${isLast ? 'box-shadow:0 0 0 3px #fff8;' : ''}"></div>`;
      }
    html += `</div><div style="display:grid;grid-template-columns:repeat(${v.cols},1fr);gap:6px;text-align:center;margin-top:4px" class="muted">${Array.from({ length: v.cols }, (_, c) => `<div>${c + 1}</div>`).join('')}</div></div>`;
    return html;
  }
  const who = (v, i) => `<span style="color:${COL[i]}">●</span> ${U.bdi(v.names[i])}`;
  GameUI['shifting-tower'] = {
    board(root, v) {
      const head = v.over ? `<div class="banner win">${v.winner === null ? T('Draw!') : '🏆 ' + T('{name} wins!', { name: who(v, v.winner) })}</div>` : `<div class="banner">${T("{name}'s turn", { name: who(v, v.turn) })} · ${T('move {n}', { n: v.moves + 1 })}</div>`;
      root.innerHTML = `${head}<div class="panel" style="max-width:640px;margin:0 auto;width:100%">${grid(v, false)}</div><p class="muted center">⬇️ ${T('After this move, column {n} sinks: its bottom disc falls out.', { n: v.shiftCol + 1 })}</p>`;
    },
    player(root, v, ctx) {
      const status = v.over ? (v.winner === null ? T('Draw!') : v.winner === ctx.seat ? T('🏆 You win!') : T('{name} wins', { name: U.bdi(v.names[v.winner]) })) : v.myTurn ? T('Your turn: tap a column') : T('Waiting for {name}', { name: U.bdi(v.names[v.turn]) });
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div><p class="center">${T('You are {who}', { who: who(v, ctx.seat) })}</p>${grid(v, v.myTurn)}<p class="muted center" style="font-size:.9em">⬇️ ${T('Column {n} sinks after the next move.', { n: v.shiftCol + 1 })}</p>`;
      U.on(root, '.dropcol', (el) => ctx.send({ type: 'drop', col: Number(el.dataset.c) }));
    },
  };
})();
