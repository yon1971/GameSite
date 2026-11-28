// Tiny translation layer shared by the browser and the tests.
// Keys are the English text itself; public/i18n/he.js maps them to Hebrew.
// Server messages arrive as plain strings or { t: 'template {x}', p: { x: ... } }.
// Param values can be: plain strings/numbers (names, numbers), nested { t, p } entries,
// arrays (joined with "and"), or { en, he } content picked by the current language.
(function (root) {
  const DICTS = { en: {}, he: root.I18N_HE || (typeof require === 'function' ? require('../i18n/he.js') : {}) };
  const HEB = /[֐-׿]/;
  let lang = 'en';
  const missing = new Set();

  function look(s) {
    if (lang === 'en') return s;
    const d = DICTS[lang];
    if (d && Object.prototype.hasOwnProperty.call(d, s)) return d[s];
    if (!missing.has(s)) { missing.add(s); if (root.console && root.I18N_DEBUG) console.warn('[i18n] missing', s); }
    return s;
  }

  const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Join a list: "A, B and C" / "A, B ו־C"
  function joinList(parts) {
    if (parts.length < 2) return parts.map((p) => p.out).join('');
    const last = parts[parts.length - 1];
    const head = parts.slice(0, -1).map((p) => p.out).join(', ');
    if (lang === 'he') return `${head} ${HEB.test(String(last.raw).trim()[0] || '') ? 'ו' : 'ו־'}${last.out}`;
    return `${head} ${look('and')} ${last.out}`;
  }

  // Returns { raw, out }: raw is plain text (for list joining), out is the rendered piece.
  function piece(x, html) {
    if (x === null || x === undefined) return { raw: '', out: '' };
    if (Array.isArray(x)) {
      const parts = x.map((y) => piece(y, html));
      return { raw: parts.map((p) => p.raw).join(', '), out: joinList(parts) };
    }
    if (typeof x === 'object') {
      if ('t' in x) { const s = render(x.t, x.p, html); return { raw: s, out: s }; }
      if ('en' in x) {
        const s = x[lang] ?? x.en;
        return { raw: s, out: html ? `<bdi>${escHTML(s)}</bdi>` : s };
      }
      if ('raw' in x) return { raw: x.text ?? x.raw, out: x.raw }; // already-built HTML (text: plain version)
    }
    const s = String(x);
    return { raw: s, out: html && typeof x === 'string' ? `<bdi>${escHTML(s)}</bdi>` : html ? escHTML(s) : s };
  }

  function render(key, params, html) {
    let s = look(key);
    if (html) s = escHTML(s);
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? piece(params[k], html).out : m));
  }

  // T('Round {n}', { n: 3 }) for screen text. Params are inserted as-is (callers escape user text).
  // T(entry) also accepts a server entry { t, p }.
  function T(key, params) {
    if (key && typeof key === 'object') return key.t !== undefined ? render(key.t, key.p, false) : piece(key, false).out;
    return render(String(key ?? ''), params, false);
  }
  // Plural helper: T.n(3, 'one card', '{n} cards')
  T.n = (n, one, many, params) => T(n === 1 ? one : many, { n, ...(params || {}) });
  // Escaped HTML for server text (logs, toasts): user names are escaped and wrapped in <bdi>.
  T.html = (entry) => {
    if (entry && typeof entry === 'object') return entry.t !== undefined ? render(entry.t, entry.p, true) : piece(entry, true).out;
    return render(String(entry ?? ''), null, true);
  };
  // Plain text version of a server entry (for toasts).
  T.text = (entry) => (entry && typeof entry === 'object' ? T(entry) : look(String(entry ?? '')));
  T.list = (arr) => piece(arr, false).out;
  T.has = (key) => lang === 'en' || Object.prototype.hasOwnProperty.call(DICTS[lang] || {}, key);
  T.lang = () => lang;
  T.isRTL = () => lang === 'he';
  T.missing = () => [...missing];
  T.dict = (l) => DICTS[l];
  T.setLang = (l) => {
    lang = DICTS[l] ? l : 'en';
    if (root.document) {
      root.document.documentElement.lang = lang;
      root.document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    }
    return lang;
  };

  root.T = T;
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof window !== 'undefined' ? window : globalThis);
