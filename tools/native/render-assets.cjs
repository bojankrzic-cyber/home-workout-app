// Renders the store/launcher artwork into assets/ for `npm run assets` (@capacitor/assets):
//   icon-only.png 1024 (iOS, full-bleed – iOS rounds the corners itself), icon-foreground/background (Android adaptive),
//   splash(-dark).png 2732 with the Rutina wordmark.   NODE_PATH=$(npm root -g) node tools/native/render-assets.cjs
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..'), out = path.join(root, 'assets');
const SYM = '<path d="M34.28 11.74A16 16 0 1 1 16 10.14" fill="none" stroke="#eef4ef" stroke-width="5.2" stroke-linecap="round"/><path d="M16 10.4C16.6 4 22.4 1 29.6 2.2C28.8 8.6 23.4 12.4 16 10.4Z" fill="#3ec46d"/><path d="M17.6 9.4C21 6.6 24.4 4.8 27.4 3.8" fill="none" stroke="#0b3d22" stroke-width=".9" stroke-linecap="round"/>';
const BG = '<defs><radialGradient id="g" cx="30%" cy="20%" r="95%"><stop offset="0" stop-color="#0f3b22"/><stop offset="1" stop-color="#050a07"/></radialGradient></defs>';
const svg = (size, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${inner}</svg>`;
const files = {
  'icon-only.png': [1024, svg(1024, BG + '<rect width="512" height="512" fill="url(#g)"/><g transform="translate(64 72) scale(8)">' + SYM + '</g>')],
  'icon-background.png': [1024, svg(1024, BG + '<rect width="512" height="512" fill="url(#g)"/>')],
  // adaptive icons crop to the inner ~66 % – the symbol sits inside that safe zone
  'icon-foreground.png': [1024, svg(1024, '<g transform="translate(128 136) scale(5.33)">' + SYM + '</g>')],
};
const splash = (dark) => `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@144,700,100&text=rutina&display=block"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rethink+Sans:wght@500&display=block"></head>
<body style="margin:0;width:2732px;height:2732px;display:grid;place-items:center;background:${dark ? '#050a07' : '#f5f7f4'}">
<div style="display:flex;flex-direction:column;align-items:stretch;color:${dark ? '#eef4ef' : '#0f1b14'}">
<span style="font-family:Fraunces;font-weight:700;font-variation-settings:'SOFT' 100,'opsz' 144;font-size:260px;letter-spacing:-.03em;line-height:.85;font-variant-ligatures:none">rutina</span>
<span style="display:flex;justify-content:space-between;font-family:'Rethink Sans';font-weight:500;font-size:62px;margin-top:40px;color:${dark ? '#8ea597' : '#5a6d61'}">${'BY NATURE’S FINEST'.split('').map(c => '<i style="font-style:normal">' + (c === ' ' ? '&nbsp;' : c) + '</i>').join('')}</span></div></body></html>`;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [name, [size, s]] of Object.entries(files)) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent('<html><body style="margin:0;background:transparent">' + s + '</body></html>');
    await p.screenshot({ path: path.join(out, name), omitBackground: true }); await p.close();
  }
  for (const dark of [false, true]) {
    const p = await b.newPage({ viewport: { width: 2732, height: 2732 } });
    await p.setContent(splash(dark)); await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(out, dark ? 'splash-dark.png' : 'splash.png') }); await p.close();
  }
  await b.close(); console.log('assets/ ready');
})();
