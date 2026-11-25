(() => {
  const COL = ['#ff6b6b', '#ffd93d'];
  function grid(v, tappable) {
    const win = new Set((v.winCells || []).map(([c, r]) => c + ',' + r));
    let html = `<div style="display:grid;grid-template-columns:repeat(${v.cols},1fr);gap:6px;text-align:center;margin-bottom:6px">${Array.from({ length: v.cols }, (_, c) => `<div style="font-size:1.4em;${c === v.shiftCol && !v.over ? '' : 'visibility:hidden'}" title="This column sinks after the next move">⬇️</div>`).join('')}</div>`;
    html += `<div style="display:grid;grid-template-columns:repeat(${v.cols},1fr);gap:6px;background:#1f4e8c;padding:10px;border-radius:16px;box-shadow:inset 0 -6px 0 #163a69">`;
    for (let r = v.rows - 1; r >= 0; r--)
      for (let c = 0; c < v.cols; c++) {
        const who = v.grid[c][r];
        const isLast = v.lastDrop && v.lastDrop[0] === c && v.lastDrop[1] === r;
        html += `<div class="${tappable ? 'tap dropcol' : ''}" data-c="${c}" style="aspect-ratio:1;border-radius:50%;background:${who === undefined ? '#0d1b2a' : COL[who]};${c === v.shiftCol && !v.over ? 'box-shadow:inset 0 0 0 3px #5ad1c4;' : ''}${win.has(c + ',' + r) ? 'outline:4px solid #fff;' : ''}${isLast ? 'box-shadow:0 0 0 3px #fff8;' : ''}"></div>`;
      }
    html += `</div><div style="display:grid;grid-template-columns:repeat(${v.cols},1fr);gap:6px;text-align:center;margin-top:4px" class="muted">${Array.from({ length: v.cols }, (_, c) => `<div>${c + 1}</div>`).join('')}</div>`;
    return html;
  }
  const who = (v, i) => `<span style="color:${COL[i]}">●</span> ${U.esc(v.names[i])}`;
  GameUI['shifting-tower'] = {
    board(root, v) {
      const head = v.over ? `<div class="banner win">${v.winner === null ? 'Draw!' : '🏆 ' + who(v, v.winner) + ' wins!'}</div>` : `<div class="banner">${who(v, v.turn)}'s turn · move ${v.moves + 1}</div>`;
      root.innerHTML = `${head}<div class="panel" style="max-width:640px;margin:0 auto;width:100%">${grid(v, false)}</div><p class="muted center">⬇️ After this move, column ${v.shiftCol + 1} sinks: its bottom disc falls out.</p>`;
    },
    player(root, v, ctx) {
      const status = v.over ? (v.winner === null ? 'Draw!' : v.winner === ctx.seat ? '🏆 You win!' : `${U.esc(v.names[v.winner])} wins`) : v.myTurn ? 'Your turn: tap a column' : `Waiting for ${U.esc(v.names[v.turn])}`;
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div><p class="center">You are ${who(v, ctx.seat)}</p>${grid(v, v.myTurn)}<p class="muted center" style="font-size:.9em">⬇️ Column ${v.shiftCol + 1} sinks after the next move.</p>`;
      U.on(root, '.dropcol', (el) => ctx.send({ type: 'drop', col: Number(el.dataset.c) }));
    },
  };
})();
