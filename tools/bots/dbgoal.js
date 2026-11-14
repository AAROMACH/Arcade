const d = require('../../.build/dbbots.json');
const goals = process.argv[2].split(',').map(Number);
for (let L = 1; L <= 10; L++) {
  if (!d[`${L}-pro`]) continue;
  const g = goals[L - 1], row = ['pro', 'avg', 'weak'].map(p => { const t = d[`${L}-${p}`]; return `${p} ${String(Math.round(100 * t.filter(x => x >= g).length / t.length)).padStart(3)}%`; });
  console.log(`day ${String(L).padStart(2)} goal $${g}  ` + row.join('  '));
}
