/*
 * FinestMe in the customer's language.
 *
 * The app renders English; this layer translates what is on screen. A MutationObserver walks every
 * rendered node and looks each "unit" up in the dictionary for the chosen language (lang/<code>.js):
 *   - a unit is an element whose content is text plus inline tags (<b>, <span>, <br> …): its key is the
 *     text with the tags as <0>…</0> / <1/> and every number as {0}, {1} … (so "6 more to go" and
 *     "5 more to go" share one entry, and word order can change around bold parts)
 *   - when a unit has no entry, its text nodes are looked up one by one
 *   - placeholder / title / aria-label attributes too; I18N.t(text) for canvas, speech and notifications
 * Untranslated text simply stays English – nothing breaks when a new string appears before its
 * translation. Language: phone setting → stored choice (localStorage + profile, syncs with the account).
 * Elements with translate="no" or .notranslate (names the user typed, product names) are left alone.
 * Dictionaries: tools/i18n/ (extract → translate → build). Under automation in English the layer only
 * collects keys (console.debug "I18N\t<key>") so the test suites double as string extraction.
 */
(function (global) {
  'use strict';
  var NAMES = {
    en: 'English', bg: 'Български', cs: 'Čeština', da: 'Dansk', de: 'Deutsch', el: 'Ελληνικά', es: 'Español', et: 'Eesti',
    fr: 'Français', hr: 'Hrvatski', hu: 'Magyar', it: 'Italiano', lt: 'Lietuvių', lv: 'Latviešu', nl: 'Nederlands', pl: 'Polski',
    pt: 'Português', ro: 'Română', sk: 'Slovenčina', sl: 'Slovenščina', sv: 'Svenska'
  };
  var LOCALE = {
    en: 'en-GB', bg: 'bg-BG', cs: 'cs-CZ', da: 'da-DK', de: 'de-DE', el: 'el-GR', es: 'es-ES', et: 'et-EE', fr: 'fr-FR', hr: 'hr-HR',
    hu: 'hu-HU', it: 'it-IT', lt: 'lt-LT', lv: 'lv-LV', nl: 'nl-NL', pl: 'pl-PL', pt: 'pt-PT', ro: 'ro-RO', sk: 'sk-SK', sl: 'sl-SI', sv: 'sv-SE'
  };
  // country codes people (and old labels) use for languages
  var ALIAS = { cz: 'cs', si: 'sl', gr: 'el', se: 'sv', dk: 'da', ee: 'et', nb: 'da', no: 'da', nn: 'da', sr: 'hr', bs: 'hr', ga: 'en' };

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function locales() {
    try { return (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']).map(function (x) { return String(x).toLowerCase(); }); } catch (e) { return ['en']; }
  }
  function norm(code) { code = String(code || '').toLowerCase().split(/[-_]/)[0]; code = ALIAS[code] || code; return NAMES[code] ? code : null; }
  function detect() {
    var q = null;
    try { q = norm(new URLSearchParams(location.search).get('lang')); } catch (e) {}
    if (q) { put('fs.lang', q); return q; }
    var s = norm(get('fs.lang'));
    if (s) return s;
    var l = locales();
    for (var i = 0; i < l.length; i++) { var c = norm(l[i]); if (c) return c; }
    return 'en';
  }

  var lang = detect(), dict = null, collecting = false;
  try { collecting = lang === 'en' && navigator.webdriver === true; } catch (e) {}
  if (global.document) {
    document.documentElement.lang = lang;
    if (lang !== 'en') {
      var me = document.currentScript, v = me && /\?v=([\w.]+)/.exec(me.src);
      document.write('<script src="lang/' + lang + '.js' + (v ? '?v=' + v[1] : '') + '"><\/script>');
    }
  }
  function D() { if (!dict) dict = global.I18N_DICT || null; return dict; }

  // ------------------------------------------------------------------ keys
  var NUM = /\d+(?:[.,:]\d+)*/g;
  function keyOf(s, nums) {
    return s.replace(/\s+/g, ' ').trim().replace(NUM, function (m) { nums.push(m); return '{' + (nums.length - 1) + '}'; });
  }
  function fill(s, nums) { return s.replace(/\{(\d+)\}/g, function (m, i) { return nums[+i] != null ? nums[+i] : m; }); }
  var seen = {};
  function collect(k) { if (!seen[k]) { seen[k] = 1; try { console.debug('I18N\t' + k); } catch (e) {} } }
  function wordy(s) { return /[A-Za-z]{2}/.test(s); }

  // plain string → translated string (numbers carried over); unknown → as is
  function t(s) {
    if (s == null) return s;
    s = String(s);
    if (!wordy(s)) return s;
    var nums = [], k = keyOf(s, nums);
    if (collecting) collect(k);
    var d = D(), tr = d && d[k];
    if (!tr) return s;
    var lead = /^\s*/.exec(s)[0], tail = /\s*$/.exec(s)[0];
    return lead + fill(tr, nums) + tail;
  }

  // ------------------------------------------------------------------ DOM
  // phrase-level tags only: a <span>/<small> is usually layout (chips, labels), so it splits units instead
  var INLINE = { B: 1, STRONG: 1, I: 1, EM: 1, BR: 1, A: 1, CODE: 1, U: 1, MARK: 1, SUB: 1, SUP: 1, KBD: 1, ABBR: 1 };
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, CANVAS: 1, VIDEO: 1, AUDIO: 1, IMG: 1, NOSCRIPT: 1, svg: 0 };
  var ATTRS = ['placeholder', 'title', 'aria-label'];
  // placeholders inside a sentence: a name (translate="no") or a title (class "ph") stays one token <0/>,
  // so "Good morning, <0/>" is one entry for every name; a .ph title is then translated on its own
  function isPh(el) { return el.nodeType === 1 && (el.getAttribute('translate') === 'no' || (el.classList && el.classList.contains('ph'))); }
  function skipEl(el) { return SKIP[el.nodeName] || el.getAttribute('translate') === 'no' || (el.classList && el.classList.contains('notranslate')) || el.isContentEditable; }
  // element made of text + inline tags only (any depth)?
  function isUnit(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) { if (isPh(c)) continue; if (!INLINE[c.nodeName] || skipEl(c) || !isUnit(c)) return false; }
      else if (c.nodeType !== 3 && c.nodeType !== 8) return false;
    }
    return true;
  }
  function directText(el) { var t = ''; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) t += c.nodeValue; return t; }
  // serialise a unit: tags become <0>…</0> / <0/>, numbers {0}
  function ser(el, tags, nums) {
    var out = '';
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) out += c.nodeValue.replace(NUM, function (m) { nums.push(m); return '{' + (nums.length - 1) + '}'; });
      else if (c.nodeType === 1) {
        var i = tags.length; tags.push(c);
        out += c.firstChild && !isPh(c) ? '<' + i + '>' + ser(c, tags, nums) + '</' + i + '>' : '<' + i + '/>';
      }
    }
    return out;
  }
  // rebuild translated markup with clones of the original inline elements
  function build(str, tags, nums, into) {
    var re = /<(\d+)\/>|<(\d+)>([\s\S]*?)<\/\2>/g, last = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > last) into.appendChild(document.createTextNode(fill(str.slice(last, m.index), nums)));
      var src = tags[+(m[1] || m[2])];
      if (src) {
        var el = src.cloneNode(isPh(src));
        if (m[2] != null && !isPh(src)) build(m[3], tags, nums, el);
        if (isPh(src) && src.getAttribute('translate') !== 'no') walk(el);
        into.appendChild(el);
      }
      last = re.lastIndex;
    }
    if (last < str.length) into.appendChild(document.createTextNode(fill(str.slice(last), nums)));
  }
  function textNode(n) {
    var s = n.nodeValue;
    if (!s || !wordy(s)) return;
    var nums = [], k = keyOf(s, nums);
    if (collecting) { collect(k); return; }
    var d = D(), tr = d && d[k];
    if (tr) n.nodeValue = /^\s*/.exec(s)[0] + fill(tr, nums) + /\s*$/.exec(s)[0];
  }
  function attrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a && wordy(a)) { var x = t(a); if (x !== a) el.setAttribute(ATTRS[i], x); }
    }
  }
  function walk(el) {
    if (el.nodeType === 3) return textNode(el);
    if (el.nodeType !== 1 || skipEl(el)) return;
    if (el.attributes && el.attributes.length) attrs(el);
    if (el.firstChild && el.firstChild !== el.lastChild && isUnit(el) && wordy(directText(el))) {
      var tags = [], nums = [], raw = ser(el, tags, nums), k = raw.replace(/\s+/g, ' ').trim();
      if (tags.length) {
        if (collecting) collect(k);
        var d = D(), tr = d && d[k];
        if (tr) {
          var frag = document.createDocumentFragment(), lead = /^\s*/.exec(raw)[0];
          if (lead) frag.appendChild(document.createTextNode(lead));
          build(tr, tags, nums, frag);
          while (el.firstChild) el.removeChild(el.firstChild);
          el.appendChild(frag);
          return;
        }
      }
    }
    for (var c = el.firstChild; c; c = c.nextSibling) walk(c);
  }
  // HTML helpers for the app: a name never translated, a title translated on its own
  function nm(s) { return '<span translate="no">' + esc(s) + '</span>'; }
  function ph(s) { return '<span class="ph">' + esc(s) + '</span>'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var obs = null;
  function run(nodes) {
    if (obs) obs.disconnect();
    try { nodes.forEach(function (n) { if (n.isConnected !== false) walk(n); }); } catch (e) {}
    if (obs) obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function start() {
    if (lang === 'en' && !collecting) return;
    if (!D() && !collecting) return;
    run([document.body]);
    obs = new MutationObserver(function (list) {
      var nodes = [];
      list.forEach(function (m) {
        if (m.type === 'childList') for (var i = 0; i < m.addedNodes.length; i++) nodes.push(m.addedNodes[i]);
        else if (m.type === 'characterData') nodes.push(m.target);
        else if (m.type === 'attributes') nodes.push(m.target);
      });
      if (nodes.length) run(nodes);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (global.document) {
    document.addEventListener('change', function (e) { var el = e.target; if (el && el.classList && el.classList.contains('lang-pick')) set(el.value); });
    // the dictionary arrives as the next parser script – start once the document is parsed
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }

  function set(code) {
    code = norm(code) || 'en';
    put('fs.lang', code);
    try { if (global.Store && Store.active && Store.active()) { Store.active().settings.lang = code; Store.save(); } } catch (e) {}
    if (code !== lang) location.reload();
  }
  // a picker that works the same everywhere: native <select>, names in their own language
  function select(id, cls) {
    return '<select id="' + id + '" class="lang-pick focusable ' + (cls || '') + '" aria-label="Language" translate="no">' +
      Object.keys(NAMES).sort(function (a, b) { return a === 'en' ? -1 : b === 'en' ? 1 : NAMES[a].localeCompare(NAMES[b]); })
        .map(function (c) { return '<option value="' + c + '"' + (c === lang ? ' selected' : '') + '>' + NAMES[c] + '</option>'; }).join('') + '</select>';
  }
  function bind(root) {
    var els = (root || document).querySelectorAll('select.lang-pick');
    for (var i = 0; i < els.length; i++) els[i].onchange = function () { set(this.value); };
  }
  global.I18N = { lang: lang, locale: LOCALE[lang], NAMES: NAMES, LOCALE: LOCALE, t: t, set: set, select: select, bind: bind, norm: norm, keyOf: keyOf, nm: nm, ph: ph, translate: function (n) { run([n || document.body]); } };
})(typeof window !== 'undefined' ? window : global);
