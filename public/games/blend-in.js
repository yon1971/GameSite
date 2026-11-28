(() => {
  let showSecret = false;
  let draft = '';
  let draftKey = '';
  let typing = false;
  let seenRound = 0;

  const nm = (v, i) => `<b>${U.bdi(v.names[i])}</b>`;

  function resultLine(v) {
    const r = v.result;
    if (!r) return '';
    const imps = U.nameList(v, v.imposters);
    const plural = v.imposters.length > 1;
    const p = { imps, name: v.accused === null ? '' : nm(v, v.accused), guess: U.esc(v.guess || '') };
    return {
      tie: '🤝 ' + T(plural ? 'The vote was a tie, so the imposters {imps} got away!' : 'The vote was a tie, so the imposter {imps} got away!', p),
      wrong: '😅 ' + T(plural ? '{name} was innocent. The imposters were {imps}.' : '{name} was innocent. The imposter was {imps}.', p),
      guessed: '🎯 ' + T(v.guess ? '{name} was caught, but guessed the word with “{guess}”!' : '{name} was caught, but guessed the word!', p),
      caught: '🎉 ' + T('{name} was caught and guessed “{guess}”. Wrong!', p) + (plural ? ' ' + T('The imposters were {imps}.', p) : ''),
    }[r.kind];
  }

  function reveal(v, big) {
    if (!v.result) return '';
    const tally = v.result.counts.length ? `<div class="muted" style="font-size:.7em;margin-top:8px">${T('Votes:')} ${v.result.counts.map((c) => `${U.bdi(v.names[c.target])} ${c.count}`).join(' · ')}</div>` : '';
    return `<div class="panel ${big ? 'bi-news' : ''}" style="border-color:var(--accent)">
      <div class="tk-ended">🔔 ${T('Word {n} is over', { n: v.round })}</div>
      <div class="bi-word">${U.esc(v.word)}</div>
      <div>${resultLine(v)}</div>${tally}</div>`;
  }

  function scores(v) {
    const order = v.names.map((_, i) => i).sort((a, b) => v.scores[b] - v.scores[a]);
    return `<ul class="plist">${order.map((i) => `<li class="pc${i}"><span class="dot"></span><span class="grow">${U.bdi(v.names[i])}${v.imposters && v.imposters.includes(i) ? ' 🎭' : ''}</span><b>${v.scores[i]}</b>${v.gained && v.gained[i] ? `<span class="bi-plus">+${v.gained[i]}</span>` : ''}</li>`).join('')}</ul>`;
  }

  function clueTiles(v) {
    const n = v.names.length;
    return `<div class="tk-grid">${v.order.map((i, k) => {
      const mine = v.clues.filter((c) => c.who === i).map((c) => `<span class="bi-clue">${U.esc(c.word)}</span>`).join('');
      const now = v.phase === 'clues' && v.current === i;
      let badge = `${k + 1}`;
      if (v.phase === 'vote') badge = v.voted[i] ? '✅' : '⏳';
      return `<div class="tk-p pc${i} ${now ? 'bi-now' : ''}"><span class="badge">${badge}</span><span class="dot"></span>${U.bdi(v.names[i])}${v.imposters && v.imposters.includes(i) ? ' 🎭' : ''}<div class="bi-clues">${mine || (now ? `<span class="muted">${T('thinking…')}</span>` : '')}</div></div>`;
    }).join('')}</div>${v.laps > 1 && v.phase === 'clues' ? `<div class="muted" style="margin-top:8px">${T('Clue lap {n} of {m}', { n: Math.floor(v.turn / n) + 1, m: v.laps })}</div>` : ''}`;
  }

  function header(v) {
    if (v.over) {
      const w = U.nameList(v, v.winners, false);
      return `<div class="banner win">🏆 ${T(v.winners.length > 1 ? '{who} win!' : '{who} wins!', { who: w })}</div>`;
    }
    const cat = v.category ? T('Category: {cat}', { cat: `<b>${U.esc(T(v.category))}</b>` }) : T('Category: secret');
    let title = '', sub = '', count = '';
    if (v.phase === 'clues') {
      title = T('{name}, give a clue', { name: U.bdi(v.names[v.current]) });
      sub = T('One word each, in order. Type it on your phone.');
    } else if (v.phase === 'vote') {
      const waiting = v.voted.filter((d) => !d).length;
      title = T('Who is the imposter?');
      sub = T('Vote on your phones. You can change your vote until the last person votes.');
      count = `<div class="tk-count"><b>${waiting}</b><span>${T('still to vote')}</span></div>`;
    } else if (v.phase === 'guess') {
      title = T('{name} is an imposter!', { name: U.bdi(v.names[v.accused]) });
      sub = T('They get one guess at the secret word…');
      count = `<div class="tk-count"><b>🤔</b><span>${T('guessing')}</span></div>`;
    } else {
      title = T('The word is revealed');
      sub = T('Press "Next word" on any phone to carry on.');
    }
    return `<div class="panel row" style="justify-content:space-between;flex-wrap:nowrap;gap:16px"><div style="flex:1;min-width:0"><div class="muted">${T('Word {n} of {m}', { n: v.round, m: v.rounds })} · ${cat} · ${T.n(v.impCount, '1 imposter', '{n} imposters')}</div><h2 style="margin:4px 0">${title}</h2><div class="muted">${sub}</div></div>${count}</div>`;
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
        <div class="panel"><h3 style="margin-top:0">${T('Clues')}</h3>${clueTiles(v)}</div>
        <div class="panel"><h3 style="margin-top:0">${T('Scores')}</h3>${scores(v)}</div>`;
    },
    player(root, v, ctx) {
      const me = ctx.seat;
      if (v.round !== seenRound) { seenRound = v.round; showSecret = false; }
      const shown = showSecret || v.phase === 'reveal' || v.over;
      let card;
      const hide = v.phase === 'reveal' || v.over ? '' : `<div class="bi-tap">${T('Tap to hide')}</div>`;
      if (!shown) card = `<div class="tk-role hide" id="secret">${T('🙈 Tap to see your secret word')}</div>`;
      else if (v.amImposter) card = `<div class="tk-role killer" id="secret">${T("🎭 You're the imposter!")}<div class="bi-cat">${v.myCategory ? T('Category: {cat}. Blend in!', { cat: U.esc(T(v.myCategory)) }) : T('No category for you. Listen carefully and blend in!')}</div>${hide}</div>`;
      else card = `<div class="tk-role villager" id="secret"><div class="bi-cat">${U.esc(T(v.myCategory))}</div><bdi>${U.esc(v.secret)}</bdi>${hide}</div>`;

      let main = '';
      const clueList = v.clues.length ? `<div class="panel" style="margin-top:12px"><b>${T('Clues so far')}</b><div class="bi-cluelist">${v.clues.map((c) => `<span class="pc${c.who}"><span class="dot"></span>${U.bdi(v.names[c.who])}: <b>${U.bdi(c.word)}</b></span>`).join('')}</div></div>` : '';
      if (v.phase === 'clues') {
        if (v.myTurn) {
          main = `<div class="status go">${T('Your turn: type one clue word')}</div>${wordForm('clueF', T('Send'), T('Your clue'), `clue-${v.round}-${v.turn}`)}<p class="muted" style="font-size:.85em">${v.amImposter ? T('Bluff! Pick a word that fits what others said.') : T('Hint at the word, but not too obviously.')}</p>`;
        } else {
          const upNext = v.order.indexOf(me);
          main = `<div class="status">⏳ ${T('{name} is giving a clue…', { name: U.bdi(v.names[v.current]) })}</div><p class="muted">${T("You're number {n} in the clue order.", { n: upNext + 1 })}</p>`;
        }
      } else if (v.phase === 'vote') {
        const others = v.names.map((_, i) => i).filter((i) => i !== me);
        main = `${v.myVote === null ? `<div class="status go">${T('Vote: who is the imposter?')}</div>` : `<div class="status">${T('✅ Voted. You can change it until everyone has voted.')}</div>`}
          <div class="tk-pick" style="margin-top:8px">${others.map((i) => `<button class="secondary ${v.myVote === i ? 'on' : ''}" data-vote="${i}">${U.bdi(v.names[i])}</button>`).join('')}</div>`;
      } else if (v.phase === 'guess') {
        main = v.canGuess
          ? `<div class="status go">${T('You were caught! Guess the secret word')}</div>${wordForm('guessF', T('Guess'), T('The secret word'), `guess-${v.round}`)}<p class="muted" style="font-size:.85em">${T('One try. Use the clues!')}</p>`
          : `<div class="status">🤔 ${T('{name} was caught and is guessing the word…', { name: U.bdi(v.names[v.accused]) })}</div>`;
      } else {
        main = `${reveal(v, false)}${v.gained && v.gained[me] ? `<div class="status go">${T('You scored +{n}', { n: v.gained[me] })}</div>` : ''}${v.over ? '' : `<button id="nextBtn" style="width:100%;margin-top:8px">${T('Next word')} <span class="flip-rtl">▶</span></button>`}`;
      }
      if (v.over) main += `<div class="panel" style="margin-top:12px"><b>${v.winners.includes(me) ? T('🏆 You win!') : T('Final scores')}</b>${scores(v)}</div>`;
      root.innerHTML = `${card}<div style="margin-top:12px">${main}</div>${v.phase === 'reveal' || v.over ? '' : clueList}`;
      U.on(root, '#secret', () => { if (v.phase !== 'reveal' && !v.over) { showSecret = !showSecret; GameUI['blend-in'].player(root, v, ctx); } });
      U.on(root, '[data-vote]', (b) => ctx.send({ type: 'vote', target: Number(b.dataset.vote) }));
      U.on(root, '#nextBtn', () => { showSecret = false; ctx.send({ type: 'next' }); });
      bindForm(root, 'clueF', 'clue', ctx);
      bindForm(root, 'guessF', 'guess', ctx);
    },
  };
})();
