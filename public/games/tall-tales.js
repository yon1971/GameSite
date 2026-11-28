(() => {
  let draft = '';
  let draftKey = '';
  let typing = false;
  let editing = false;
  let seenRound = 0;

  const L = (k) => String.fromCharCode(65 + k);
  const blank = (q) => U.esc(q).replace('____', '<span class="tt-blank">_____</span>');
  const chip = (v, i) => `<span class="tt-chip pc${i}"><span class="dot"></span>${U.esc(v.names[i])}</span>`;

  function scores(v) {
    const order = v.names.map((_, i) => i).sort((a, b) => v.scores[b] - v.scores[a]);
    return `<ul class="plist">${order.map((i) => `<li class="pc${i}"><span class="dot"></span><span class="grow">${U.esc(v.names[i])}</span><b>${v.scores[i]}</b>${v.gained && v.gained[i] ? `<span class="bi-plus">+${v.gained[i]}</span>` : ''}</li>`).join('')}</ul>`;
  }

  function header(v) {
    if (v.over) {
      const w = v.winners.map((i) => U.esc(v.names[i])).join(' and ');
      return `<div class="banner win">🏆 ${w} win${v.winners.length > 1 ? '' : 's'}!</div>`;
    }
    let sub = '', count = '';
    if (v.phase === 'write') {
      sub = 'Write a believable fake answer on your phone.';
      count = `<div class="tk-count"><b>${v.wrote.filter((d) => !d).length}</b><span>still writing</span></div>`;
    } else if (v.phase === 'vote') {
      sub = 'Which answer is true? Vote on your phone.';
      count = `<div class="tk-count"><b>${v.voted.filter((d) => !d).length}</b><span>still to vote</span></div>`;
    } else {
      sub = 'Press "Next question" on any phone to carry on.';
    }
    return `<div class="panel row" style="justify-content:space-between;flex-wrap:nowrap;gap:16px"><div style="flex:1;min-width:0"><div class="muted">Question ${v.round} of ${v.rounds} · ${U.esc(v.category)}</div><div class="muted">${sub}</div></div>${count}</div>`;
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
        const by = o.truth ? '<span class="tt-tag true">✔ The truth</span>' : `<span class="tt-tag">Fake by ${o.authors.map((i) => chip(v, i)).join(' ')}</span>`;
        const who = o.voters.length ? `<div class="tt-voters"><span class="muted">${o.truth ? 'Found by' : 'Fooled'}</span>${o.voters.map((i) => chip(v, i)).join('')}</div>` : `<div class="tt-voters muted">${o.truth ? 'Nobody found it' : 'Fooled nobody'}</div>`;
        extra = `${by}${who}`;
      }
      return `<div class="tt-opt ${reveal && o.truth ? 'true' : ''}"><span class="tt-letter">${L(k)}</span><div class="grow"><div class="tt-text">${U.esc(o.text)}</div>${extra}</div></div>`;
    }).join('')}</div>`;
  }

  function tiles(v) {
    const done = v.phase === 'write' ? v.wrote : v.voted;
    return `<div class="tk-grid">${v.names.map((n, i) => `<div class="tk-p pc${i}"><span class="badge">${v.phase === 'reveal' || v.over ? '' : done[i] ? '✅' : v.phase === 'write' ? '✍️' : '⏳'}</span><span class="dot"></span>${U.esc(n)}</div>`).join('')}</div>`;
  }

  function myResult(v) {
    const me = v.me;
    const k = v.myVote;
    const o = k !== null ? v.options[k] : null;
    const lines = [];
    if (o && o.truth) lines.push(`🎯 You found the truth! +${v.truthPoints}`);
    else if (o) lines.push(`😵 You fell for “${U.esc(o.text)}” by ${o.authors.map((i) => U.esc(v.names[i])).join(' and ')}.`);
    const fooled = v.options.filter((x) => !x.truth && x.authors.includes(me)).reduce((n, x) => n + x.voters.length, 0);
    lines.push(fooled ? `🤥 Your fake fooled ${fooled} player${fooled > 1 ? 's' : ''}! +${fooled * v.foolPoints}` : '🤷 Your fake fooled nobody this time.');
    return `<div class="panel" style="margin-top:12px">${lines.map((l) => `<div>${l}</div>`).join('')}</div>`;
  }

  function fakeForm(key) {
    if (draftKey !== key) { draft = ''; draftKey = key; }
    return `<form class="row bi-form" id="fakeF" style="flex-wrap:nowrap"><input id="fakeIn" maxlength="40" placeholder="Your fake answer" autocomplete="off" spellcheck="false" value="${U.esc(draft)}"/><button>Send</button></form>`;
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
        ${v.phase === 'reveal' || v.over ? '' : `<div class="panel"><h3 style="margin-top:0">Players</h3>${tiles(v)}</div>`}
        <div class="panel"><h3 style="margin-top:0">Scores</h3>${scores(v)}</div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      if (v.round !== seenRound) { seenRound = v.round; editing = false; }
      const rerender = () => GameUI['tall-tales'].player(root, v, ctx);
      let main = '';
      if (v.phase === 'write') {
        if (v.myFake === null || editing) {
          main = `<div class="status go">Write a fake answer that sounds true</div>${fakeForm(`fake-${v.round}`)}<p class="muted" style="font-size:.85em">Make it believable. You score when others pick it.</p>`;
        } else {
          const left = v.wrote.filter((d) => !d).length;
          main = `<div class="status">✅ Sent: <b>${U.esc(v.myFake)}</b></div><p class="muted">Waiting for ${left} more player${left === 1 ? '' : 's'}…</p><button class="secondary" id="editBtn" style="width:100%">Change my answer</button>`;
        }
      } else if (v.phase === 'vote') {
        main = `${v.myVote === null ? '<div class="status go">Which answer is true?</div>' : '<div class="status">✅ Voted. You can change it until everyone has voted.</div>'}
          <div class="tt-pick">${v.options.map((o, k) => {
            const mine = v.myOptions.includes(k);
            return `<button class="secondary ${v.myVote === k ? 'on' : ''}" ${mine ? 'disabled' : `data-vote="${k}"`}><span class="tt-letter">${L(k)}</span>${U.esc(o.text)}${mine ? '<span class="muted" style="margin-left:6px">(yours)</span>' : ''}</button>`;
          }).join('')}</div>`;
      } else {
        main = `${myResult(v)}${v.over ? '' : '<button id="nextBtn" style="width:100%;margin-top:12px">Next question ▶</button>'}`;
      }
      if (v.over) main += `<div class="panel" style="margin-top:12px"><b>${v.winners.includes(me) ? '🏆 You win!' : 'Final scores'}</b>${scores(v)}</div>`;
      root.innerHTML = `${question(v, false)}<div style="margin-top:12px">${main}</div>`;
      U.on(root, '[data-vote]', (b) => ctx.send({ type: 'vote', option: Number(b.dataset.vote) }));
      U.on(root, '#editBtn', () => { editing = true; draft = v.myFake || ''; typing = true; rerender(); });
      U.on(root, '#nextBtn', () => ctx.send({ type: 'next' }));
      bindForm(root, ctx, rerender);
    },
  };
})();
