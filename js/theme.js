/*
 * Light / dark theme – runs in <head> before the first paint.
 *   choice: localStorage fs.theme = 'system' (default) | 'light' | 'dark'
 *   <html data-theme> always holds the resolved theme, so CSS only needs :root[data-theme="light"]
 *   'system' follows the phone setting live (prefers-color-scheme); the workout player stays dark in both.
 */
(function (global) {
  'use strict';
  var KEY = 'fs.theme', mq = global.matchMedia ? global.matchMedia('(prefers-color-scheme: light)') : null;
  var BAR = { dark: '#050a07', light: '#f5f7f4' };
  function choice() { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch (e) { return 'system'; } }
  function resolved() { var c = choice(); return c !== 'system' ? c : (mq && mq.matches ? 'light' : 'dark'); }
  function apply() {
    var t = resolved(), root = document.documentElement;
    root.setAttribute('data-theme', t);
    root.style.colorScheme = t;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', BAR[t]);
  }
  function set(v) {
    try { if (v === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch (e) {}
    apply();
  }
  if (mq) { var on = function () { if (choice() === 'system') apply(); }; if (mq.addEventListener) mq.addEventListener('change', on); else if (mq.addListener) mq.addListener(on); }
  apply();
  global.Theme = { choice: choice, resolved: resolved, set: set, apply: apply };
})(window);
