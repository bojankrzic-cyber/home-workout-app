/*
 * Native shell (App Store / Google Play via Capacitor). The same web app runs inside; this file only adapts
 * what differs in a native app. In a browser it does nothing.
 *   - status bar follows the light / dark theme
 *   - links that leave the app (webshop, labels, privacy) open in the system browser
 *   - Android back button = the app's own back, and leaves the app from Today
 *   - no "add to home screen" asks and no service worker (the files are bundled)
 */
(function (global) {
  'use strict';
  var C = global.Capacitor, native = !!(C && C.isNativePlatform && C.isNativePlatform());
  global.Native = { is: native, platform: native ? C.getPlatform() : 'web' };
  if (!native) return;
  var P = C.Plugins || {};
  document.documentElement.classList.add('native', 'native-' + C.getPlatform());

  function bar() {
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    try { P.StatusBar && P.StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); } catch (e) {}
    try { if (C.getPlatform() === 'android' && P.StatusBar) P.StatusBar.setBackgroundColor({ color: dark ? '#050a07' : '#f5f7f4' }); } catch (e) {}
  }
  bar();
  new MutationObserver(bar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/^https?:\/\//.test(href) && (a.target === '_blank' || href.indexOf(location.host) < 0)) {
      e.preventDefault();
      if (P.Browser) P.Browser.open({ url: href }); else global.open(href, '_system');
    }
  }, true);

  if (P.App) P.App.addListener('backButton', function () {
    var sheet = document.querySelector('.sheet-wrap, .dlg');
    if (sheet) { sheet.remove(); return; }
    if (global.App && App.back && document.querySelector('.back-bar')) { App.back(); return; }
    P.App.exitApp();
  });
})(window);
