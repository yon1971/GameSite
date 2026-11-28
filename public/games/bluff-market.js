(() => {
  let pickCard = null, pickClaim = null, price = 4;
  const good = (v, k, cls = '', id = '') => { const g = v.goods[k]; return `<div class="card good ${cls}" data-id="${id}"><span class="val">${g.value}</span><span class="em">${g.icon}</span><span class="nm">${U.esc(T(g.name))}</span></div>`; };
  const CH = { buy: '🛒 Buy', call: '🚨 Call bluff', pass: '🙅 Pass' };
  const ch = (c) => T(CH[c]);

  function resultHTML(v) {
    const r = v.result;
    if (!r || r.skipped) return '';
    const lines = Object.entries(r.choices).map(([i, c]) => `<li>${U.name(v, Number(i))}: <b>${ch(c)}</b></li>`).join('');
    let verdict = '';
    if (r.revealed) verdict = `<p>${T('Revealed: {good}.', { good: `<b>${v.goods[r.revealed].icon} ${U.esc(T(v.goods[r.revealed].name))}</b>` })} ${r.lied ? T('🤥 It was a bluff!') : T('✅ The seller told the truth.')}</p>`;
    const sale = r.buyer !== null ? `<p>🛒 ${T('{name} bought it.', { name: U.name(v, r.buyer) })}</p>` : `<p class="muted">${T('No sale.')}</p>`;
    const tx = r.transfers.map((t) => `<li>${U.bdi(v.names[t.from])} ${T.isRTL() ? '←' : '→'} ${U.bdi(v.names[t.to])}: <span class="coin">${t.amt}🪙</span></li>`).join('');
    return `${verdict}${sale}<ul>${lines}</ul>${tx ? `<ul class="muted">${tx}</ul>` : ''}`;
  }

  function offerHTML(v, big) {
    if (!v.offer) return '';
    return `<div class="row" style="justify-content:center;gap:24px">${U.back(big ? 'big' : 'mid')}<div><div style="font-size:${big ? 2 : 1.3}em">${v.offer.icon} <b>${U.esc(T(v.offer.claimName))}</b></div><div class="coin" style="font-size:${big ? 2.4 : 1.5}em">${v.offer.price} 🪙</div><div class="muted">${T('claimed value {n}', { n: v.goods[v.offer.claim].value })}</div></div></div>`;
  }

  GameUI['bluff-market'] = {
    board(root, v) {
      let main;
      if (v.over) {
        main = `<div class="banner win">🏆 ${v.winner === null ? T('A tie!') : T('{name} wins the market!', { name: U.bdi(v.names[v.winner]) })}</div>
          <div class="panel"><table style="width:100%;border-collapse:collapse"><tr class="muted"><th style="text-align:start">${T('Trader')}</th><th>${T('Coins')}</th><th>${T('Goods')}</th><th>${T('Total')}</th><th style="text-align:start">${T('Stash')}</th></tr>${v.final.map((f, i) => `<tr><td>${U.name(v, i)}</td><td align="center">${f.coins}</td><td align="center">${f.goods}</td><td align="center"><b>${f.total}</b></td><td>${f.stash.map((k) => v.goods[k].icon).join(' ')}</td></tr>`).join('')}</table></div>`;
      } else {
        const sellerName = U.name(v, v.seller);
        let body;
        if (v.phase === 'offer') body = `<p class="center" style="font-size:1.3em">${T('{name} is choosing what to sell…', { name: sellerName })}</p>`;
        else if (v.phase === 'respond') body = `${offerHTML(v, true)}<p class="center">${T('Buy, call the bluff, or pass on your phone.')}</p><div class="row" style="justify-content:center">${v.names.map((n, i) => (i === v.seller ? '' : `<span class="pill">${U.bdi(n)} ${v.responded[i] ? '✅' : '⏳'}</span>`)).join('')}</div>`;
        else body = `${offerHTML(v, false)}${resultHTML(v)}`;
        main = `<div class="banner">${T('Round {n} of {m}', { n: v.round, m: v.rounds })} · ${T('{name} is selling', { name: sellerName })}</div><div class="panel" style="padding:24px">${body}</div>`;
      }
      root.innerHTML = `${main}
        <div class="panel"><h3>${T('Traders')}</h3>${U.players({ ...v, turn: v.seller }, (i) => `<span class="pill">${T.n(v.stashCounts[i], '1 good', '{n} goods')}</span> <span class="coin">${v.coins[i]}🪙</span>`)}</div>
        <div class="panel muted" style="font-size:.9em">${T('Goods are worth:')} ${Object.values(v.goods).map((g) => `${g.icon} ${U.esc(T(g.name))} ${g.value}`).join(' · ')}</div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      const isSeller = v.seller === me;
      if (!v.hand.some((c) => c.id === pickCard)) pickCard = null;
      let main = '', actions = '';
      if (v.over) main = `<div class="status">${v.winner === me ? T('🏆 You win!') : T('Market closed')}</div><p>${T('Your total: {total} ({coins} coins + {goods} in goods)', { total: `<b>${v.final[me].total}</b>`, coins: v.final[me].coins, goods: v.final[me].goods })}</p>`;
      else if (v.phase === 'offer' && isSeller) {
        main = `<div class="status go">${T('Your turn to sell')}</div>
          <h3>${T('1. Pick a card to sell (face down)')}</h3><div class="hand" style="padding-top:10px">${v.hand.map((c) => good(v, c.k, `mid tap ${pickCard === c.id ? 'sel' : ''}`, c.id)).join('')}</div>
          <h3>${T('2. Say what it is (you may lie)')}</h3><div class="row">${Object.entries(v.goods).map(([k, g]) => `<button class="${pickClaim === k ? '' : 'secondary'} small" data-claim="${k}">${g.icon} ${U.esc(T(g.name))}</button>`).join('')}</div>
          <h3>${T('3. Price')}</h3><div class="row"><button class="secondary" id="minus">−</button><span class="coin" style="font-size:1.6em;min-width:2em;text-align:center">${price}🪙</span><button class="secondary" id="plus">+</button></div>`;
        actions = `<button id="sell" ${pickCard !== null && pickClaim ? '' : 'disabled'}>${T('Put up for sale')}</button>`;
      } else if (v.phase === 'offer') main = `<div class="status">${T('{name} is choosing what to sell', { name: U.bdi(v.names[v.seller]) })}</div>`;
      else if (v.phase === 'respond' && isSeller) main = `<div class="status">${T('Your offer is out. Keep a straight face! 😐')}</div>${offerHTML(v)}`;
      else if (v.phase === 'respond' && !v.myResponse) {
        main = `<div class="status go">${T('{name} is selling', { name: U.bdi(v.names[v.seller]) })}</div>${offerHTML(v)}`;
        actions = `<button class="choice-buy" data-r="buy" ${v.coins[me] < v.offer.price ? 'disabled' : ''}>${T('Buy {n}🪙', { n: v.offer.price })}</button><button class="choice-call" data-r="call">${T('Call bluff')}</button><button class="secondary" data-r="pass">${T('Pass')}</button>`;
      } else if (v.phase === 'respond') main = `<div class="status">${T('You chose {choice}. Waiting for others…', { choice: ch(v.myResponse) })}</div>${offerHTML(v)}`;
      else if (v.phase === 'result') {
        main = `<div class="status">${T('Results')}</div><div class="panel">${offerHTML(v)}${resultHTML(v)}${v.result && v.result.skipped ? `<p>${T('Nothing to sell this turn.')}</p>` : ''}</div>`;
        actions = `<button id="next">${T('Next seller')} <span class="flip-rtl">▶</span></button>`;
      }
      root.innerHTML = `<div class="panel row" style="justify-content:space-between;margin-bottom:10px"><span>${T('Round {n}/{m}', { n: v.round, m: v.rounds })}</span><span class="coin" style="font-size:1.3em">${v.coins[me]}🪙</span></div>
        ${main}
        ${!(v.phase === 'offer' && isSeller) ? `<h3 style="margin-top:14px">${T('Your hand')}</h3><div class="hand">${v.hand.map((c) => good(v, c.k, `sm ${c.id === v.mySellingCard ? 'sel' : ''}`)).join('')}</div>` : ''}
        <h3 style="margin-top:14px">${T('Your stash (secret)')}</h3><div class="cards">${v.stash.length ? v.stash.map((c) => good(v, c.k, 'sm')).join('') : `<span class="muted">${T('Nothing bought yet')}</span>`}</div>
        ${actions ? `<div class="actions">${actions}</div>` : ''}`;
      const rerender = () => GameUI['bluff-market'].player(root, v, ctx);
      U.on(root, '.hand .card.tap', (el) => { pickCard = Number(el.dataset.id); rerender(); });
      U.on(root, '[data-claim]', (b) => { pickClaim = b.dataset.claim; rerender(); });
      U.on(root, '#minus', () => { price = Math.max(1, price - 1); rerender(); });
      U.on(root, '#plus', () => { price = Math.min(9, price + 1); rerender(); });
      U.on(root, '#sell', async () => { const r = await ctx.send({ type: 'offer', cardId: pickCard, claim: pickClaim, price }); if (r.ok) { pickCard = null; pickClaim = null; } });
      U.on(root, '[data-r]', (b) => ctx.send({ type: 'respond', choice: b.dataset.r }));
      U.on(root, '#next', () => ctx.send({ type: 'next' }));
    },
  };
})();
