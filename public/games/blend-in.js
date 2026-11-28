(() => {
  let showSecret = false;
  let draft = '';
  let draftKey = '';
  let typing = false;
  let seenRound = 0;

  const nm = (v, i) => `<b>${U.esc(v.names[i])}</b>`;

  function resultLine(v) {
    const r = v.result;
    if (!r) return '';
    const imps = v.imposters.map((i) => nm(v, i)).join(' and ');
    const plural = v.imposters.length > 1;
    return {
      tie: `🤝 The vote was a tie, so the imposter${plural ? 's' : ''} ${imps} got away!`,
      wrong: `😅 ${nm(v, v.accused)} was innocent. The imposter${plural ? 's were' : ' was'} ${imps}.`,
      guessed: `🎯 ${nm(v, v.accused)} was caught, but guessed the word${v.guess ? ` with “${U.esc(v.guess)}”` : ''}!`,
      caught: `🎉 ${nm(v, v.accused)} was caught and guessed “${U.esc(v.guess || '')}”. Wrong! ${plural ? `The imposters were ${imps}.` : ''}`,
    }[r.kind];
  }

  function reveal(v, big) {
    if (!v.result) return '';
    const tally = v.result.counts.length ? `<div class="muted" style="font-size:.7em;margin-top:8px">Votes: ${v.result.counts.map((c) => `${U.esc(v.names[c.target])} ${c.count}`).join(' · ')}</div>` : '';
    return `<div class="panel ${big ? 'bi-news' : ''}" style="border-color:var(--accent)">
      <div class="tk-ended">🔔 Word ${v.round} is over</div>
      <div class="bi-word">${U.esc(v.word)}</div>
      <div>${resultLine(v)}</div>${tally}</div>`;
  }

  function scores(v) {
    const order = v.names.map((_, i) => i).sort((a, b) => v.scores[b] - v.scores[a]);
    return `<ul class="plist">${order.map((i) => `<li class="pc${i}"><span class="dot"></span><span class="grow">${U.esc(v.names[i])}${v.imposters && v.imposters.includes(i) ? ' 🎭' : ''}</span><b>${v.scores[i]}</b>${v.gained && v.gained[i] ? `<span class="bi-plus">+${v.gained[i]}</span>` : ''}</li>`).join('')}</ul>`;
  }

  function clueTiles(v) {
    const n = v.names.length;
    return `<div class="tk-grid">${v.order.map((i, k) => {
      const mine = v.clues.filter((c) => c.who === i).map((c) => `<span class="bi-clue">${U.esc(c.word)}</span>`).join('');
      const now = v.phase === 'clues' && v.current === i;
      let badge = `${k + 1}`;
      if (v.phase === 'vote') badge = v.voted[i] ? '✅' : '⏳';
      return `<div class="tk-p pc${i} ${now ? 'bi-now' : ''}"><span class="badge">${badge}</span><span class="dot"></span>${U.esc(v.names[i])}${v.imposters && v.imposters.includes(i) ? ' 🎭' : ''}<div class="bi-clues">${mine || (now ? '<span class="muted">thinking…</span>' : '')}</div></div>`;
    }).join('')}</div>${v.laps > 1 && v.phase === 'clues' ? `<div class="muted" style="margin-top:8px">Clue lap ${Math.floor(v.turn / n) + 1} of ${v.laps}</div>` : ''}`;
  }

  function header(v) {
    if (v.over) {
      const w = v.winners.map((i) => U.esc(v.names[i])).join(' and ');
      return `<div class="banner win">🏆 ${w} win${v.winners.length > 1 ? '' : 's'}!</div>`;
    }
    const cat = v.category ? `Category: <b>${U.esc(v.category)}</b>` : 'Category: secret';
    let title = '', sub = '', count = '';
    if (v.phase === 'clues') {
      title = `${U.esc(v.names[v.current])}, give a clue`;
      sub = 'One word each, in order. Type it on your phone.';
    } else if (v.phase === 'vote') {
      const waiting = v.voted.filter((d) => !d).length;
      title = 'Who is the imposter?';
      sub = 'Vote on your phones. You can change your vote until the last person votes.';
      count = `<div class="tk-count"><b>${waiting}</b><span>still to vote</span></div>`;
    } else if (v.phase === 'guess') {
      title = `${U.esc(v.names[v.accused])} is an imposter!`;
      sub = 'They get one guess at the secret word…';
      count = `<div class="tk-count"><b>🤔</b><span>guessing</span></div>`;
    } else {
      title = 'The word is revealed';
      sub = 'Press "Next word" on any phone to carry on.';
    }
    return `<div class="panel row" style="justify-content:space-between;flex-wrap:nowrap;gap:16px"><div style="flex:1;min-width:0"><div class="muted">Word ${v.round} of ${v.rounds} · ${cat} · ${v.impCount} imposter${v.impCount > 1 ? 's' : ''}</div><h2 style="margin:4px 0">${title}</h2><div class="muted">${sub}</div></div>${count}</div>`;
  }

  function wordForm(id, label, placeholder, key) {
    if (draftKey !== key) { draft = ''; draftKey = key; }
    return `<form class="row bi-form" id="${id}" style="flex-wrap:nowrap"><input id="${id}In" maxlength="${id === 'clueF' ? 24 : 40}" placeholder="${placeholder}" autocomplete="off" autocapitalize="none" spellcheck="false" value="${U.esc(draft)}"/><button>${label}</button></form>`;
  }

  function bindForm(root, id, type, ctx) {
    const f = root.querySelector('#' + id);
    if (!f) return;
    const inp = f.querySelector('input');
    inp.addEventListener('input', () => (draft = inp.value));
    inp.addEventListener('focus', () => (typing = true));
    inp.addEventListener('blur', () => (typing = false));
    if (typing) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    f.onsubmit = async (e) => {
      e.preventDefault();
      const r = await ctx.send({ type, word: inp.value });
      if (r && r.ok !== false) { draft = ''; typing = false; }
    };
  }

  GameUI['blend-in'] = {
    board(root, v) {
      const body = v.phase === 'reveal' || v.over ? reveal(v, true) : '';
      root.innerHTML = `${header(v)}${body}
        <div class="panel"><h3 style="margin-top:0">Clues</h3>${clueTiles(v)}</div>
        <div class="panel"><h3 style="margin-top:0">Scores</h3>${scores(v)}</div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      if (v.round !== seenRound) { seenRound = v.round; showSecret = false; }
      const shown = showSecret || v.phase === 'reveal' || v.over;
      let card;
      if (!shown) card = `<div class="tk-role hide" id="secret">🙈 Tap to see your secret word</div>`;
      else if (v.amImposter) card = `<div class="tk-role killer" id="secret">🎭 You're the imposter!<div class="bi-cat">${v.myCategory ? `Category: ${U.esc(v.myCategory)}. Blend in!` : 'No category for you. Listen carefully and blend in!'}</div>${v.phase === 'reveal' || v.over ? '' : '<div class="bi-tap">Tap to hide</div>'}</div>`;
      else card = `<div class="tk-role villager" id="secret"><div class="bi-cat">${U.esc(v.myCategory)}</div>${U.esc(v.secret)}${v.phase === 'reveal' || v.over ? '' : '<div class="bi-tap">Tap to hide</div>'}</div>`;

      let main = '';
      const clueList = v.clues.length ? `<div class="panel" style="margin-top:12px"><b>Clues so far</b><div class="bi-cluelist">${v.clues.map((c) => `<span class="pc${c.who}"><span class="dot"></span>${U.esc(v.names[c.who])}: <b>${U.esc(c.word)}</b></span>`).join('')}</div></div>` : '';
      if (v.phase === 'clues') {
        if (v.myTurn) {
          main = `<div class="status go">Your turn: type one clue word</div>${wordForm('clueF', 'Send', 'Your clue', `clue-${v.round}-${v.turn}`)}<p class="muted" style="font-size:.85em">${v.amImposter ? 'Bluff! Pick a word that fits what others said.' : 'Hint at the word, but not too obviously.'}</p>`;
        } else {
          const upNext = v.order.indexOf(me);
          main = `<div class="status">⏳ ${U.esc(v.names[v.current])} is giving a clue…</div><p class="muted">You're number ${upNext + 1} in the clue order.</p>`;
        }
      } else if (v.phase === 'vote') {
        const others = v.names.map((_, i) => i).filter((i) => i !== me);
        main = `${v.myVote === null ? '<div class="status go">Vote: who is the imposter?</div>' : '<div class="status">✅ Voted. You can change it until everyone has voted.</div>'}
          <div class="tk-pick" style="margin-top:8px">${others.map((i) => `<button class="secondary ${v.myVote === i ? 'on' : ''}" data-vote="${i}">${U.esc(v.names[i])}</button>`).join('')}</div>`;
      } else if (v.phase === 'guess') {
        main = v.canGuess
          ? `<div class="status go">You were caught! Guess the secret word</div>${wordForm('guessF', 'Guess', 'The secret word', `guess-${v.round}`)}<p class="muted" style="font-size:.85em">One try. Use the clues!</p>`
          : `<div class="status">🤔 ${U.esc(v.names[v.accused])} was caught and is guessing the word…</div>`;
      } else {
        main = `${reveal(v, false)}${v.gained && v.gained[me] ? `<div class="status go">You scored +${v.gained[me]}</div>` : ''}${v.over ? '' : `<button id="nextBtn" style="width:100%;margin-top:8px">Next word ▶</button>`}`;
      }
      if (v.over) main += `<div class="panel" style="margin-top:12px"><b>${v.winners.includes(me) ? '🏆 You win!' : 'Final scores'}</b>${scores(v)}</div>`;
      root.innerHTML = `${card}<div style="margin-top:12px">${main}</div>${v.phase === 'reveal' || v.over ? '' : clueList}`;
      U.on(root, '#secret', () => { if (v.phase !== 'reveal' && !v.over) { showSecret = !showSecret; GameUI['blend-in'].player(root, v, ctx); } });
      U.on(root, '[data-vote]', (b) => ctx.send({ type: 'vote', target: Number(b.dataset.vote) }));
      U.on(root, '#nextBtn', () => { showSecret = false; ctx.send({ type: 'next' }); });
      bindForm(root, 'clueF', 'clue', ctx);
      bindForm(root, 'guessF', 'guess', ctx);
    },
  };
})();
