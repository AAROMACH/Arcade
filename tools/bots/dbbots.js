// Bots play full Dispatch Board days with the real game code (hooks injected into the page).
// Usage: node dbbots.js <N per level> [levels comma list]
const { chromium } = require('playwright'); const fs = require('fs');
const path = require('path'); const PUB = path.join(__dirname, '../../public/') ; const OUT = path.join(__dirname, '../../.build/');
const N = +process.argv[2] || 10, LEVELS = (process.argv[3] || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
const HOOK = `
window.__sim = (L, pol) => {
  const P = { pro: { every: 5 }, avg: { every: 20 }, weak: { every: 30 } }[pol];
  lvl = L; reset(); techs.forEach(t => { t.alert = 0; });
  const ev = o => { if (o.gamble) { const g = o.gamble, f = x => (x.m || 0) + 10 * (x.t || 0) + 10 * (x.c || 0); return g.p * f(g.win) + (1 - g.p) * f(g.lose); } const x = o.fx || {}; return (x.m || 0) + 10 * (x.t || 0) + 10 * (x.c || 0); };
  const valueOf = (t, tech) => {
    const skilled = tech.skills.includes(t.skill), j = schedule(tech, t).pop();
    const end = skilled ? j.end : j.start + Math.round(t.dur * 1.5);
    let pay = end <= t.due ? t.pay : Math.round(t.pay / 2); if (!skilled) pay = Math.round(pay * .4) - 75;
    return { v: pay - (end - clock) * .4, pay, onTime: end <= t.due, skilled, end };
  };
  const act = () => {
    const open = tickets.filter(t => !t.tech).sort((a, b) => a.due - b.due);
    if (pol === 'pro') {
      open.forEach(t => {
        const opts = techs.filter(x => !x.out && !bookedPast(x, t)).map(x => ({ x, ...valueOf(t, x) })).sort((a, b) => b.v - a.v);
        const o = opts[0]; if (!o) return;
        if ((o.onTime && o.skilled) || t.due - clock <= 60) { if (o.pay > -150) assign(t, o.x); }
      });
    } else {
      open.sort(() => Math.random() - .5).forEach(t => {
        const ok = techs.filter(x => !x.out && !bookedPast(x, t));
        const sk = ok.filter(x => x.skills.includes(t.skill));
        const blind = pol === 'weak' && Math.random() < .5;
        const pickT = !blind && sk.length ? sk[Math.floor(Math.random() * sk.length)] : (blind || t.due - clock < 50) && ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
        if (pickT) assign(t, pickT);
      });
    }
  };
  let guard = 0;
  while (!over && guard++ < 5000) {
    if (callOpen && curCall) {
      if (curCall.report) break;
      if (curCall.c && !curCall.done) { const evs = curCall.ch.map(ev); const i = pol === 'pro' ? evs.indexOf(Math.max(...evs)) : Math.floor(Math.random() * curCall.ch.length); chooseCall(i); }
      closeCall(); continue;
    }
    if ((clock - START) % P.every === 0) act();
    step(1);
  }
  const r = curCall && curCall.report; callOpen = false; curCall = null; document.getElementById('callBox').hidden = true; document.getElementById('toasts').innerHTML = '';
  return { total: r.total, made: r.made, s: r.s, bonus: r.bonus };
};
function pickCall() {`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 700 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/dispatch-board.html', async r => { let s = fs.readFileSync(PUB + 'games/dispatch-board.html', 'utf8');
    s = s.replace('function pickCall() {', HOOK); await r.fulfill({ body: s, contentType: 'text/html' }); });
  await p.addInitScript(() => { try { localStorage.clear(); } catch {} });
  await p.goto('http://localhost:8765/games/dispatch-board.html'); await p.waitForTimeout(400);
  await p.evaluate(() => { document.getElementById('howModal').hidden = true; });
  const out = {};
  for (const L of LEVELS) for (const pol of ['pro', 'avg', 'weak']) {
    const res = []; for (let i = 0; i < N; i++) res.push(await p.evaluate(([L, pol]) => window.__sim(L, pol), [L, pol]));
    const tot = res.map(r => r.total).sort((a, b) => a - b), q = f => tot[Math.min(tot.length - 1, Math.floor(f * tot.length))];
    const avg = k => Math.round(res.reduce((a, r) => a + r.s[k], 0) / N);
    out[`${L}-${pol}`] = tot;
    console.log(`day ${String(L).padStart(2)} ${pol.padEnd(4)} p10 ${String(q(.1)).padStart(6)} p25 ${String(q(.25)).padStart(6)} med ${String(q(.5)).padStart(6)} p75 ${String(q(.75)).padStart(6)} | full ${avg('full')} late −${avg('late')} wrong −${avg('wrong')} missed −${avg('missed')} cards ${avg('cards')} done ${avg('done')}`);
  }
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + 'dbbots.json', JSON.stringify(out));
  console.log('errors:', errs.slice(0, 3)); await b.close();
})();
