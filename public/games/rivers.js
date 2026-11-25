(() => {
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const COLORS = ['#ff6b6b', '#ffd93d'];
  const S = 30;
  const SQ3 = Math.sqrt(3);
  let selTile = null;
  const center = (q, r) => [S * SQ3 * (q + r / 2), S * 1.5 * r];
  const half = (d) => { const [dq, dr] = DIRS[d]; return [(S * SQ3 * (dq + dr / 2)) / 2, (S * 1.5 * dr) / 2]; };
  const hexPts = (x, y, s = S) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 30); return `${(x + s * Math.cos(a)).toFixed(1)},${(y + s * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const onBoard = (q, r, R) => Math.abs(q) <= R && Math.abs(r) <= R && Math.abs(q + r) <= R;

  function riverPath(x, y, inDir, outDir) {
    const [ix, iy] = half(inDir);
    const [ox, oy] = half(outDir);
    return `M${(x - ix).toFixed(1)},${(y - iy).toFixed(1)} Q${x.toFixed(1)},${y.toFixed(1)} ${(x + ox).toFixed(1)},${(y + oy).toFixed(1)}`;
  }

  function svg(v, preview) {
    const R = v.radius;
    const W = S * SQ3 * (2 * R + 2), H = S * 1.5 * (2 * R) + S * 2 + 20;
    let cells = '', rivers = '', marks = '';
    for (let q = -R; q <= R; q++)
      for (let r = -R; r <= R; r++) {
        if (!onBoard(q, r, R)) continue;
        const [x, y] = center(q, r);
        const edge = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === R;
        cells += `<polygon points="${hexPts(x, y, S - 1)}" fill="${edge ? '#4b7a47' : '#5c8f55'}" stroke="#2f4f2c" stroke-width="1.5"/>`;
        const c = v.cells[`${q},${r}`];
        if (!c) continue;
        const col = COLORS[c.owner];
        if (c.spring) {
          const [ox, oy] = half(c.out);
          rivers += `<line x1="${x}" y1="${y}" x2="${x + ox}" y2="${y + oy}" stroke="${col}" stroke-width="9" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="9" fill="#9fe7ff" stroke="${col}" stroke-width="4"/>`;
        } else rivers += `<path d="${riverPath(x, y, c.in, c.out)}" stroke="${col}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="${riverPath(x, y, c.in, c.out)}" stroke="#9fe7ff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>`;
      }
    v.heads.forEach((h, p) => {
      if (v.over) return;
      const [dq, dr] = DIRS[h.dir];
      const tq = h.q + dq, tr = h.r + dr;
      if (!onBoard(tq, tr, R)) return;
      const [x, y] = center(tq, tr);
      marks += `<polygon points="${hexPts(x, y, S - 4)}" fill="none" stroke="${COLORS[p]}" stroke-width="3" stroke-dasharray="6 4" ${v.turn === p ? '' : 'opacity=".5"'}/>`;
      if (preview && p === preview.p) marks += `<path d="${riverPath(x, y, h.dir, (h.dir + preview.turn + 6) % 6)}" stroke="${COLORS[p]}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".6"/>`;
    });
    return `<svg viewBox="${-W / 2} ${-H / 2} ${W} ${H}" style="width:100%;max-height:78vh;display:block;background:radial-gradient(circle,#2a6f97 55%,#1b4965);border-radius:18px">${cells}${rivers}${marks}</svg>`;
  }

  function tileIcon(turn, dir) {
    const [x, y] = [0, 0];
    const out = (dir + turn + 6) % 6;
    return `<svg viewBox="-34 -34 68 68" width="64" height="64"><polygon points="${hexPts(0, 0, 31)}" fill="#5c8f55" stroke="#2f4f2c" stroke-width="2"/><path d="${riverPath(x, y, dir, out)}" stroke="#9fe7ff" stroke-width="9" fill="none" stroke-linecap="round"/></svg>`;
  }

  function scores(v) {
    return `<div class="row">${v.names.map((n, i) => `<span class="pill" style="border:2px solid ${COLORS[i]}">${U.esc(n)}: <b>${v.scores[i]}</b> pts · river ${v.lengths[i]}</span>`).join('')}<span class="pill">Bag ${v.bagCount}</span></div>`;
  }

  GameUI.rivers = {
    board(root, v) {
      const head = v.over ? `<div class="banner win">🏆 ${v.winner === null ? 'A tie!' : U.esc(v.names[v.winner]) + ' wins!'}</div>` : `<div class="banner"><span style="color:${COLORS[v.turn]}">●</span> ${U.esc(v.names[v.turn])}'s turn</div>`;
      root.innerHTML = `${head}<div class="panel">${scores(v)}</div>${svg(v)}<p class="muted center">Dashed hexes show where each river flows next. Reach the sea (off the edge) to score 1 point per tile.</p>`;
    },
    player(root, v, ctx) {
      if (!v.myTurn || !v.hand.some((t) => t.id === selTile)) selTile = v.myTurn && selTile !== null && v.hand.some((t) => t.id === selTile) ? selTile : null;
      const sel = v.hand.find((t) => t.id === selTile);
      const status = v.over ? (v.winner === ctx.seat ? '🏆 You win!' : 'Game over') : v.myTurn ? 'Your turn: choose a tile' : `Waiting for ${U.esc(v.names[v.turn])}`;
      const myDir = v.heads[ctx.seat].dir;
      root.innerHTML = `<div class="status ${v.myTurn ? 'go' : ''}">${status}</div>
        <div class="panel" style="padding:8px;margin-bottom:8px">${scores(v)}<div class="muted" style="font-size:.85em;margin-top:4px">You are <b style="color:${COLORS[ctx.seat]}">${ctx.seat === 0 ? 'red' : 'yellow'}</b>.</div></div>
        ${svg(v, sel ? { p: ctx.seat, turn: sel.turn } : null)}
        <h3 style="margin-top:10px">Your tiles</h3>
        <div class="row" style="justify-content:center">${v.hand.map((t) => `<div class="tap tile center" data-id="${t.id}" style="padding:6px;border-radius:12px;background:var(--panel);border:2px solid ${t.id === selTile ? 'var(--accent)' : 'transparent'}">${tileIcon(t.turn, myDir)}<div style="font-size:.8em">${t.name}</div></div>`).join('')}</div>
        ${v.myTurn ? `<div class="actions"><button id="place" ${sel ? '' : 'disabled'}>Place tile</button></div>` : ''}`;
      U.on(root, '.tile', (el) => { if (!v.myTurn) return; selTile = Number(el.dataset.id); GameUI.rivers.player(root, v, ctx); });
      U.on(root, '#place', async () => { const r = await ctx.send({ type: 'tile', tileId: selTile }); if (r.ok) selTile = null; });
    },
  };
})();
