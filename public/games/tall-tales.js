(() => {
  let draft = '';
  let draftKey = '';
  let typing = false;
  let editing = false;
  let seenRound = 0;

  const L = (k) => (T.isRTL() ? 'אבגדהוזחטיכלמנסעפצקרשת'[k] || String(k + 1) : String.fromCharCode(65 + k));
  const blank = (q) => U.esc(q).replace('____', '<span class="tt-blank">_____</span>');
  const chip = (v, i) => `<span class="tt-chip pc${i}"><span class="dot"></span>${U.bdi(v.names[i])}</span>`;

  function scores(v) {
    const order = v.names.map((_, i) => i).sort((a, b) => v.scores[b] - v.scores[a]);
    return `<ul class="plist">${order.map((i) => `<li class="pc${i}"><span class="dot"></span><span class="grow">${U.bdi(v.names[i])}</span><b>${v.scores[i]}</b>${v.gained && v.gained[i] ? `<span class="bi-plus">+${v.gained[i]}</span>` : ''}</li>`).join('')}</ul>`;
  }

  function header(v) {
    if (v.over) {
      const w = U.nameList(v, v.winners, false);
      return `<div class="banner win">🏆 ${T(v.winners.length > 1 ? '{who} win!' : '{who} wins!', { who: w })}</div>`;
    }
    let sub = '', count = '';
    if (v.phase === 'write') {
      sub = T('Write a believable fake answer on your phone.');
      count = `<div class="tk-count"><b>${v.wrote.filter((d) => !d).length}</b><span>${T('still writing')}</span></div>`;
    } else if (v.phase === 'vote') {
      sub = T('Which answer is true? Vote on your phone.');
      count = `<div class="tk-count"><b>${v.voted.filter((d) => !d).length}</b><span>${T('still to vote')}</span></div>`;
    } else {
      sub = T('Press "Next question" on any phone to carry on.');
    }
    return `<div class="panel row" style="justify-content:space-between;flex-wrap:nowrap;gap:16px"><div style="flex:1;min-width:0"><div class="muted">${T('Question {n} of {m}', { n: v.round, m: v.rounds })} · ${U.esc(T(v.category))}</div><div class="muted">${sub}</div></div>${count}</div>`;
  }

  function question(v, big) {
    let q = blank(v.question);
    if (v.answer) q = U.esc(v.question).replace('____', `<span class="tt-truth">${U.esc(v.answer)}</span>`);
    return `<div class="panel tt-q ${big ? 'big' : ''}">${q}</div>`;
  }

  // Board list of answers. During the vote: just letters and text. At the reveal: truth, authors and voters.
  function answers(v) {
    if (!v.options) return '';
    const reveal = v.phase === 'reveal' || v.over;
    return `<div class="tt-opts">${v.options.map((o, k) => {
      let extra = '';
      if (reveal) {
        const by = o.truth ? `<span class="tt-tag true">${T('✔ The truth')}</span>` : `<span class="tt-tag">${T('Fake by {who}', { who: o.authors.map((i) => chip(v, i)).join(' ') })}</span>`;
        const who = o.voters.length ? `<div class="tt-voters"><span class="muted">${o.truth ? T('Found by') : T('Fooled')}</span>${o.voters.map((i) => chip(v, i)).join('')}</div>` : `<div class="tt-voters muted">${o.truth ? T('Nobody found it') : T('Fooled nobody')}</div>`;
        extra = `${by}${who}`;
      }
      return `<div class="tt-opt ${reveal && o.truth ? 'true' : ''}"><span class="tt-letter">${L(k)}</span><div class="grow"><div class="tt-text"><bdi>${U.esc(o.text)}</bdi></div>${extra}</div></div>`;
    }).join('')}</div>`;
  }

  function tiles(v) {
    const done = v.phase === 'write' ? v.wrote : v.voted;
    return `<div class="tk-grid">${v.names.map((n, i) => `<div class="tk-p pc${i}"><span class="badge">${v.phase === 'reveal' || v.over ? '' : done[i] ? '✅' : v.phase === 'write' ? '✍️' : '⏳'}</span><span class="dot"></span>${U.bdi(n)}</div>`).join('')}</div>`;
  }

  function myResult(v) {
    const me = v.me;
    const k = v.myVote;
    const o = k !== null ? v.options[k] : null;
    const lines = [];
    if (o && o.truth) lines.push(T('🎯 You found the truth! +{n}', { n: v.truthPoints }));
    else if (o) lines.push(T('😵 You fell for “{text}” by {who}.', { text: U.bdi(o.text), who: U.nameList(v, o.authors, false) }));
    const fooled = v.options.filter((x) => !x.truth && x.authors.includes(me)).reduce((n, x) => n + x.voters.length, 0);
    lines.push(fooled ? T.n(fooled, '🤥 Your fake fooled 1 player! +{pts}', '🤥 Your fake fooled {n} players! +{pts}', { pts: fooled * v.foolPoints }) : T('🤷 Your fake fooled nobody this time.'));
    return `<div class="panel" style="margin-top:12px">${lines.map((l) => `<div>${l}</div>`).join('')}</div>`;
  }

  function fakeForm(key) {
    if (draftKey !== key) { draft = ''; draftKey = key; }
    return `<form class="row bi-form" id="fakeF" style="flex-wrap:nowrap"><input id="fakeIn" maxlength="40" placeholder="${T('Your fake answer')}" autocomplete="off" spellcheck="false" value="${U.esc(draft)}"/><button>${T('Send')}</button></form>`;
  }

  function bindForm(root, ctx, rerender) {
    const f = root.querySelector('#fakeF');
    if (!f) return;
    const inp = f.querySelector('input');
    inp.addEventListener('input', () => (draft = inp.value));
    inp.addEventListener('focus', () => (typing = true));
    inp.addEventListener('blur', () => (typing = false));
    if (typing) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = await ctx.send({ type: 'fake', text: inp.value });
      if (r && r.ok !== false) { draft = ''; typing = false; editing = false; rerender(); }
    };
  }

  GameUI['tall-tales'] = {
    board(root, v) {
      root.innerHTML = `${header(v)}${question(v, true)}${v.options ? `<div class="panel">${answers(v)}</div>` : ''}
        ${v.phase === 'reveal' || v.over ? '' : `<div class="panel"><h3 style="margin-top:0">${T('Players')}</h3>${tiles(v)}</div>`}
        <div class="panel"><h3 style="margin-top:0">${T('Scores')}</h3>${scores(v)}</div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      if (v.round !== seenRound) { seenRound = v.round; editing = false; }
      const rerender = () => GameUI['tall-tales'].player(root, v, ctx);
      let main = '';
      if (v.phase === 'write') {
        if (v.myFake === null || editing) {
          main = `<div class="status go">${T('Write a fake answer that sounds true')}</div>${fakeForm(`fake-${v.round}`)}<p class="muted" style="font-size:.85em">${T('Make it believable. You score when others pick it.')}</p>`;
        } else {
          const left = v.wrote.filter((d) => !d).length;
          main = `<div class="status">${T('✅ Sent: {text}', { text: `<b>${U.bdi(v.myFake)}</b>` })}</div><p class="muted">${T.n(left, 'Waiting for 1 more player…', 'Waiting for {n} more players…')}</p><button class="secondary" id="editBtn" style="width:100%">${T('Change my answer')}</button>`;
        }
      } else if (v.phase === 'vote') {
        main = `${v.myVote === null ? `<div class="status go">${T('Which answer is true?')}</div>` : `<div class="status">${T('✅ Voted. You can change it until everyone has voted.')}</div>`}
          <div class="tt-pick">${v.options.map((o, k) => {
            const mine = v.myOptions.includes(k);
            return `<button class="secondary ${v.myVote === k ? 'on' : ''}" ${mine ? 'disabled' : `data-vote="${k}"`}><span class="tt-letter">${L(k)}</span><bdi>${U.esc(o.text)}</bdi>${mine ? `<span class="muted" style="margin-inline-start:6px">${T('(yours)')}</span>` : ''}</button>`;
          }).join('')}</div>`;
      } else {
        main = `${myResult(v)}${v.over ? '' : `<button id="nextBtn" style="width:100%;margin-top:12px">${T('Next question')} <span class="flip-rtl">▶</span></button>`}`;
      }
      if (v.over) main += `<div class="panel" style="margin-top:12px"><b>${v.winners.includes(me) ? T('🏆 You win!') : T('Final scores')}</b>${scores(v)}</div>`;
      root.innerHTML = `${question(v, false)}<div style="margin-top:12px">${main}</div>`;
      U.on(root, '[data-vote]', (b) => ctx.send({ type: 'vote', option: Number(b.dataset.vote) }));
      U.on(root, '#editBtn', () => { editing = true; draft = v.myFake || ''; typing = true; rerender(); });
      U.on(root, '#nextBtn', () => ctx.send({ type: 'next' }));
      bindForm(root, ctx, rerender);
    },
  };
})();
