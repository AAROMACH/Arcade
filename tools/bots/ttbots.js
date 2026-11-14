const { chromium } = require('playwright'); const fs = require('fs');
const path = require('path'); const PUB = path.join(__dirname, '../../public/') ; const OUT = path.join(__dirname, '../../.build/');
const N = +process.argv[2] || 200;
const HOOK = `
// What a careful tech reads from each result (ignores random numbers that don't matter).
const sigOf = (id, txt) => {
  if (id === 'cert') { const m = txt.match(/at (\\d+) ft|, (\\d+) ft from/); if (/PASS/.test(txt)) return 'pass'; if (/No continuity/.test(txt)) return 'nocont';
    const d = +(txt.match(/(\\d+) ft from the jack/) || txt.match(/at (\\d+) ft/))[1]; return d <= 3 ? 'jack' : d >= tk.L - 3 ? 'panel' : 'mid'; }
  if (id === 'dhcpck') return /254 of 254/.test(txt) ? 'full' : 'ok';
  return txt.replace(/\\d+ of 254/, '');
};
const predict = (id, c) => { const f = tk.fault; tk.fault = c; const r = sigOf(id, result(id)); tk.fault = f; return r; };
window.__shift = pol => {
  score = 0; n = 0; let fails = 0;
  for (let i = 0; i < SHIFT; i++) {
    newTicket(); let cand = tk.opts.slice();
    const use = id => { const t = TOOLS.find(x => x.id === id); mins += used.has(id) ? Math.ceil(t.min / 2) : t.min; used.add(id); const s = sigOf(id, result(id)); cand = cand.filter(c => predict(id, c) === s); };
    const fix = c => { if (closed) return; if (c === tk.fault) return close(true); wrong.add(c); mins += 12; cand = cand.filter(x => x !== c); if (wrong.size >= 2) return close(false, ''); if (mins >= 45) return close(false, ''); };
    const tryList = list => { for (const c of list) { if (closed) break; fix(c); } };
    if (pol === 'expert') {
      while (cand.length > 1 && !closed) {
        let bestT = null, bestV = 1e9;
        TOOLS.forEach(t => { if (used.has(t.id)) return; const g = {}; cand.forEach(c => { const k = predict(t.id, c); g[k] = (g[k] || 0) + 1; });
          const exp = Object.values(g).reduce((a, v) => a + v * v, 0) / cand.length; if (exp >= cand.length) return; const v = exp + t.min * .08; if (v < bestV) { bestV = v; bestT = t; } });
        if (!bestT) break; use(bestT.id);
      }
      tryList(cand.sort(() => Math.random() - .5));
    } else if (pol === 'skim') {
      use('link'); use('laptop'); tryList(cand.sort(() => Math.random() - .5));
    } else if (pol === 'story') {
      tryList([tk.story, ...tk.opts.filter(c => c !== tk.story).sort(() => Math.random() - .5)]);
    } else {
      tryList(tk.opts.slice().sort(() => Math.random() - .5));
    }
    if (!closed) close(false, '');
    if (!document.querySelector('.stamp') || /Escalated/.test(document.getElementById('result').textContent)) fails++;
  }
  return { score, fails };
};
newTicket();
})();`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/tone-trace.html', async r => { let s = fs.readFileSync(PUB + 'games/tone-trace.html', 'utf8');
    s = s.replace('newTicket();\n})();', HOOK); await r.fulfill({ body: s, contentType: 'text/html' }); });
  await p.goto('http://localhost:8765/games/tone-trace.html'); await p.waitForTimeout(300);
  for (const pol of ['expert', 'skim', 'story', 'guess']) {
    const res = []; for (let i = 0; i < N; i++) res.push(await p.evaluate(pol => window.__shift(pol), pol));
    const sc = res.map(r => r.score).sort((a, b) => a - b), q = f => sc[Math.floor(f * sc.length)];
    const pass = res.filter(r => r.score >= 1500).length / N, esc = res.reduce((a, r) => a + r.fails, 0) / N;
    console.log(`${pol.padEnd(6)} goal met ${String(Math.round(pass * 100)).padStart(3)}% | p10 ${q(.1)} med ${q(.5)} p90 ${q(.9)} | escalations/shift ${esc.toFixed(2)}`);
  }
  console.log('errors:', errs.slice(0, 3)); await b.close();
})();
