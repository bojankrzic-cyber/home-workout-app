/* Local persistence (localStorage) + JSON backup. */
(function (global) {
  'use strict';
  var KEY = 'homeworkout.v1';

  function defaults() {
    return {
      settings: { days: 4, level: 'mid', voice: true, beeps: true, previewSec: 15, startDate: new Date().toISOString().slice(0, 10), name: '' },
      log: [],   // [{ date, session, min, sets: [{ id, reps, load }] }]
      ex: {}     // per-exercise progression: { load, reps: [..], fails, date }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      var s = JSON.parse(raw), d = defaults();
      s.settings = Object.assign(d.settings, s.settings || {});
      s.log = s.log || []; s.ex = s.ex || {};
      return s;
    } catch (e) { return defaults(); }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full / private mode */ }
  }

  // Record a finished session and update progression memory
  function recordSession(state, entry) {
    state.log.push(entry);
    var byEx = {};
    entry.sets.forEach(function (s) { (byEx[s.id] = byEx[s.id] || []).push(s); });
    Object.keys(byEx).forEach(function (id) {
      var sets = byEx[id], item = entry.items[id];
      if (!item || !item.reps) return;
      var reps = sets.map(function (s) { return s.reps; });
      var prev = state.ex[id] || {};
      var anyLow = reps.some(function (r) { return r < item.reps[0]; });
      state.ex[id] = {
        load: sets[sets.length - 1].load,
        reps: reps,
        fails: anyLow ? (prev.fails || 0) + 1 : 0,
        date: entry.date
      };
    });
    delete entry.items;
    save(state);
  }

  function exportJSON(state) {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trening-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function importJSON(text) {
    var s = JSON.parse(text);
    if (!s.settings || !Array.isArray(s.log)) throw new Error('Neveljavna datoteka');
    localStorage.setItem(KEY, JSON.stringify(s));
    return load();
  }

  function reset() { localStorage.removeItem(KEY); return defaults(); }

  global.Store = { load: load, save: save, recordSession: recordSession, exportJSON: exportJSON, importJSON: importJSON, reset: reset };
})(window);
