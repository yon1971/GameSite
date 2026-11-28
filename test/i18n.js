// Checks that every English string shown on screen has a Hebrew translation in public/i18n/he.js,
// and that translations keep the same {placeholders}. Run: node test/i18n.js
const fs = require('fs');
const path = require('path');
const T = require('../public/js/i18n.js');
const HE = require('../public/i18n/he.js');
const GAMES = require('../games');

const root = path.join(__dirname, '..');
const keys = new Map(); // key -> where
const add = (k, where) => { if (typeof k === 'string' && k.trim() && !keys.has(k)) keys.set(k, where); };

// Literal string in JS source: '...', "..." or `...` without ${}
const LIT = String.raw`('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\x60(?:\\.|[^\x60\\$])*\x60)`;
const unquote = (s) => s[0] === '`' ? s.slice(1, -1) : JSON.parse(s[0] === "'" ? '"' + s.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"' : s);

function scan(file, patterns) {
  const src = fs.readFileSync(file, 'utf8');
  for (const re of patterns) for (const m of src.matchAll(re)) for (const g of m.slice(1)) if (g) add(unquote(g), path.relative(root, file));
}

// 1. Browser code: T('...'), T.n(n, '...', '...'), ternaries inside T(...), data-t attributes
const pub = ['public/js/common.js', 'public/js/board.js', 'public/js/play.js', ...fs.readdirSync(path.join(root, 'public/games')).map((f) => 'public/games/' + f)];
for (const f of pub) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  // every literal that appears directly inside a T( ... ) or T.n( ... ) call's argument list (one level deep)
  for (const m of src.matchAll(/\bT(?:\.n)?\(/g)) {
    let i = m.index + m[0].length, depth = 1, buf = '';
    while (i < src.length && depth) {
      const c = src[i];
      if (c === "'" || c === '"' || c === '`') {
        const lm = new RegExp('^' + LIT).exec(src.slice(i));
        if (lm) { if (depth === 1 || c !== '`') buf += '\u0000' + lm[0] + '\u0000'; i += lm[0].length; continue; }
        if (c === '`') { // template literal with ${}: skip to its end
          let j = i + 1; while (j < src.length && src[j] !== '`') j += src[j] === '\\' ? 2 : 1; i = j + 1; continue;
        }
      }
      if (c === '(' || c === '{' || c === '[') depth++;
      if (c === ')' || c === '}' || c === ']') depth--;
      if (depth === 1 && c === '{') {}
      i++;
    }
    for (const lit of buf.split('\u0000').filter((x) => /^['"`]/.test(x))) {
      const s = unquote(lit);
      // skip object keys / plain params like 'raw'
      if (/^[a-z]+$/.test(s) && !['and', 'red', 'yellow', 'drawing', 'turn', 'offline', 'guessing'].includes(s)) continue;
      add(s, f);
    }
  }
  // constant tables that are passed to T() later
  for (const m of src.matchAll(/const (?:CH|ROLES) = \{([^}]*)\}/g)) for (const l of m[1].matchAll(new RegExp(':\\s*' + LIT, 'g'))) add(unquote(l[1]), f);
}
for (const f of ['public/index.html', 'public/board.html', 'public/play.html']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/data-t(?:-ph|-doc|-title)?="([^"]*)"/g)) add(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'), f);
}
add('and', 'i18n');
['Spades', 'Hearts', 'Diamonds', 'Clubs'].forEach((s) => add(s, 'common.js'));

// 2. Server: messages in log()/fail()/tr()/end() and constant name tables
const srv = fs.readdirSync(path.join(root, 'games')).filter((f) => /\.js$/.test(f) && !/(word-lists|trivia-questions|point-party-prompts|index|util)/.test(f));
for (const f of srv) {
  const file = path.join(root, 'games', f);
  scan(file, [
    new RegExp(String.raw`\b(?:log\(st,|fail\(|tr\()\s*` + LIT, 'g'),
    new RegExp(String.raw`\blog\(st,\s*[^;]*?\?\s*` + LIT + String.raw`\s*:\s*` + LIT, 'g'),
    new RegExp(String.raw`\bend\(st,\s*(?:'[a-z]+',\s*)?` + LIT, 'g'),
    new RegExp(String.raw`\bt:\s*` + LIT, 'g'),
    new RegExp(String.raw`\b(?:tie|wrong|guessed|caught):\s*` + LIT, 'g'),
  ]);
  const src = fs.readFileSync(file, 'utf8');
  // nested ternaries inside log(st, ...): grab every literal on those lines
  for (const line of src.split('\n')) if (/\blog\(st,/.test(line) && /\?/.test(line)) for (const m of line.matchAll(new RegExp(LIT, 'g'))) { const s = unquote(m[1]); if (/[A-Z{]/.test(s[0]) && / /.test(s)) add(s, f); }
}
for (const m of fs.readFileSync(path.join(root, 'server.js'), 'utf8').matchAll(/error: '([^']+)'/g)) add(m[1], 'server.js');
add('{game} needs {min}-{max} players (you have {n})', 'server.js');
add('That room has closed. Ask the host for the new code.', 'play.js');
add('You were removed from the room.', 'play.js');

// 3. Game metadata and data tables
for (const g of Object.values(GAMES)) {
  add(g.name, g.id); add(g.blurb, g.id);
  g.rules.forEach((r) => add(r, g.id));
  (g.options || []).forEach((o) => { add(o.label, g.id); (o.choices || []).forEach((c) => add(c, g.id)); });
}
['amber', 'jade', 'azure', 'rose'].forEach((c) => add(c, 'lantern-keepers'));
['Gem', 'Silk', 'Spice', 'Tea', 'Clay pot', 'Junk'].forEach((c) => add(c, 'bluff-market'));
['Straight', 'Gentle left', 'Gentle right', 'Sharp left', 'Sharp right'].forEach((c) => add(c, 'rivers'));
['Villager', 'Killer', 'Spy'].forEach((c) => add(c, 'the-killer'));

// ---- checks ----
let bad = 0;
const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const [k, where] of keys) {
  if (!Object.prototype.hasOwnProperty.call(HE, k)) { console.log(`missing  [${where}] ${JSON.stringify(k)}`); bad++; continue; }
  if (ph(k) !== ph(HE[k]).split(',').filter((x, i, a) => a.indexOf(x) === i).join(',') && ph(k).split(',').filter((x, i, a) => a.indexOf(x) === i).join(',') !== [...new Set(ph(HE[k]).split(','))].join(',')) {
    console.log(`placeholders differ [${where}] ${JSON.stringify(k)} -> ${JSON.stringify(HE[k])}`); bad++;
  }
}
const unused = Object.keys(HE).filter((k) => !keys.has(k));
if (unused.length && process.argv.includes('--unused')) console.log('unused:', unused);

// Hebrew content sanity
const WL = { en: require('../games/word-lists'), he: require('../games/word-lists-he') };
const TQ = { en: require('../games/trivia-questions'), he: require('../games/trivia-questions-he') };
for (const k of Object.keys(WL.en)) if (!WL.he[k] || WL.he[k].length < 10) { console.log('Hebrew word list missing or short:', k); bad++; }
for (const k of Object.keys(TQ.en)) if (!TQ.he[k] || TQ.he[k].length < 6) { console.log('Hebrew trivia missing or short:', k); bad++; }
for (const qs of Object.values(TQ.he)) for (const q of qs) if (!q.q.includes('____')) { console.log('No blank in', q.q); bad++; }
const tt = require('../games/tall-tales');
for (const qs of Object.values(TQ.he)) for (const q of qs) if (!tt.isTruth(q, q.a)) { console.log('Answer does not match itself', q.a); bad++; }
for (const p of require('../games/point-party-prompts')) if (!p.en || !p.he) { console.log('Prompt missing a language', p); bad++; }

console.log(`${keys.size} strings checked, ${bad} problem${bad === 1 ? '' : 's'}`);
process.exit(bad ? 1 : 0);
