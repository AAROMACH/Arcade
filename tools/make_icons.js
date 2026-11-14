// Renders the arcade's app icons (PNG) from one SVG. Usage: node make_icons.js <outdir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
// Hard hat over a hazard stripe, on the arcade's dark panel. `pad` shrinks the art for maskable icons.
const svg = (pad, round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <pattern id="hz" width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="28" height="56" fill="#ffc21a"/><rect x="28" width="28" height="56" fill="#121417"/></pattern>
    <linearGradient id="hat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd75a"/><stop offset="1" stop-color="#f0a800"/></linearGradient>
  </defs>
  <rect width="512" height="512" rx="${round ? 96 : 0}" fill="#1b2027"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)">
    <rect x="40" y="370" width="432" height="58" rx="10" fill="url(#hz)"/>
    <path d="M118 318 C118 196 178 132 256 132 C334 132 394 196 394 318 Z" fill="url(#hat)"/>
    <path d="M232 136 C226 180 226 250 232 318 L280 318 C286 250 286 180 280 136 Z" fill="#ffe08a" opacity=".7"/>
    <rect x="84" y="306" width="344" height="36" rx="18" fill="#f0a800"/>
    <rect x="84" y="306" width="344" height="12" rx="6" fill="#ffd75a"/>
    <rect x="236" y="104" width="40" height="34" rx="8" fill="#f0a800"/>
  </g>
</svg>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const jobs = [['icon-192.png', 192, 0, true], ['icon-512.png', 512, 0, true], ['maskable-512.png', 512, .22, false], ['apple-touch-icon.png', 180, .08, false], ['favicon-32.png', 32, 0, true]];
  for (const [name, size, pad, round] of jobs) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg(pad, round)).toString('base64')}" width="${size}" height="${size}" style="display:block">`);
    await p.screenshot({ path: path.join(out, name), omitBackground: true });
  }
  fs.writeFileSync(path.join(out, 'icon.svg'), svg(0, true));
  await b.close(); console.log('icons ->', out);
})();
