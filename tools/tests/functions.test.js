// Run against the emulators, with App Check relaxed for the test only:
//   printf "ENFORCE_APP_CHECK=false\\n" > functions/.env.local
//   firebase emulators:exec --only auth,firestore,functions --project demo-arcade "node tools/tests/functions.test.js"
//   rm functions/.env.local
// End-to-end checks against the Firebase emulators (auth 9099, firestore 8085, functions 5001).
const P = 'demo-arcade', FN = `http://127.0.0.1:5001/${P}/us-central1/`, FS = `http://127.0.0.1:8085/v1/projects/${P}/databases/(default)/documents/`;
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass++; console.log('  ✓', label); } else { fail++; console.log('  ✗', label, extra); } };
const j = r => r.json().catch(() => ({}));
async function signIn() {
  const r = await j(await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"returnSecureToken":true}' }));
  return { token: r.idToken, uid: r.localId };
}
async function call(name, data, token) {
  const res = await fetch(FN + name, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ data }) });
  const b = await j(res); return b.error ? { err: b.error.status, msg: b.error.message } : b.result;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const a = await signIn(), b = await signIn();
  console.log('Firestore rules (browser writes):');
  let r = await fetch(FS + 'scores/' + a.uid, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + a.token }, body: JSON.stringify({ fields: { name: { stringValue: 'Hacker' }, games: { mapValue: { fields: {} } } } }) });
  ok(r.status === 403, 'player cannot write their own score row', r.status);
  r = await fetch(FS + 'runs/x', { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + a.token }, body: '{"fields":{}}' });
  ok(r.status === 403, 'player cannot write runs', r.status);

  console.log('Functions:');
  ok((await call('startRun', { game: 'tone-trace' })).err === 'UNAUTHENTICATED', 'signed-out call is refused');
  ok((await call('startRun', { game: 'not-a-game' }, a.token)).err === 'INVALID_ARGUMENT', 'unknown game is refused');
  const run = (await call('startRun', { game: 'tone-trace' }, a.token)).runId;
  ok(typeof run === 'string', 'run started', run);
  ok((await call('submitScore', { runId: run, game: 'tone-trace', score: 2101 }, a.token)).err === 'OUT_OF_RANGE', 'score over the game cap is refused');
  ok((await call('submitScore', { runId: run, game: 'tone-trace', score: 1900 }, a.token)).err === 'OUT_OF_RANGE', 'score too high for seconds of play is refused');
  ok((await call('submitScore', { runId: run, game: 'tone-trace', score: -5 }, a.token)).err === 'INVALID_ARGUMENT', 'negative score is refused');
  ok((await call('submitScore', { runId: run, game: 'tone-trace', score: 500 }, b.token)).err === 'PERMISSION_DENIED', "another player's run is refused");
  ok((await call('submitScore', { runId: run, game: 'lift-panic', score: 100 }, a.token)).err === 'PERMISSION_DENIED', 'run used for a different game is refused');
  let s = await call('submitScore', { runId: run, game: 'tone-trace', score: 600 }, a.token);
  ok(s && s.best === 600 && s.improved, 'believable score is saved', JSON.stringify(s));
  ok((await call('submitScore', { runId: run, game: 'tone-trace', score: 650 }, a.token)).err === 'RESOURCE_EXHAUSTED', 'second post within 10 s is refused');
  await sleep(10500);
  s = await call('submitScore', { runId: run, game: 'tone-trace', score: 300 }, a.token);
  ok(s && s.best === 600 && !s.improved, 'a lower score never replaces the best', JSON.stringify(s));
  const trun = (await call('startRun', { game: 'terminate' }, a.token)).runId;
  await sleep(10500);
  ok((await call('submitScore', { runId: trun, game: 'terminate', score: 100, time: 5 }, a.token)).err === 'OUT_OF_RANGE', 'impossibly fast time is refused');
  ok((await call('submitScore', { runId: trun, game: 'terminate', score: 100, time: 600 }, a.token)).err === 'OUT_OF_RANGE', 'time longer than the game was open is refused');
  const n = await call('setName', { name: '  <b>Corey</b>\u0007   the   tech  ' }, a.token);
  ok(n && n.name === 'bCorey/b the tech', 'name is cleaned', JSON.stringify(n));
  ok((await call('setName', { name: '   ' }, a.token)).err === 'INVALID_ARGUMENT', 'empty name is refused');

  console.log('Sheet games (best stars per sheet):');
  // An old running total from before v2 (seeded directly, as the emulator's owner).
  await fetch(FS + 'scores/' + b.uid, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer owner' }, body: JSON.stringify({ fields: { name: { stringValue: 'B' }, games: { mapValue: { fields: { 'pull-day': { mapValue: { fields: { s: { integerValue: '99999' } } } } } } } } }) });
  const lvOf = async () => { const d = await j(await fetch(FS + 'scores/' + b.uid)); const g = d.fields.games.mapValue.fields['pull-day'].mapValue.fields; const lv = g.lv ? g.lv.mapValue.fields : {}; return { s: +g.s.integerValue, lv: Object.fromEntries(Object.entries(lv).map(([k, v]) => [k, +v.integerValue])) }; };
  const prun = (await call('startRun', { game: 'pull-day' }, b.token)).runId;
  s = await call('submitScore', { runId: prun, game: 'pull-day', score: 800, sheet: { n: 1, stars: 2 }, stats: { level: 1 } }, b.token);
  let L = await lvOf();
  ok(L.s === 800 && L.lv[1] === 2, 'old running total is dropped; sheet 1 = 2 stars, best sheet $800', JSON.stringify(L));
  await sleep(10500);
  await call('submitScore', { runId: prun, game: 'pull-day', score: 100, sheet: { n: 5, stars: 3 } }, b.token);
  L = await lvOf(); ok(!L.lv[5], 'a sheet past the furthest reached is ignored', JSON.stringify(L));
  await sleep(10500);
  await call('submitScore', { runId: prun, game: 'pull-day', score: 600, sheet: { n: 2, stars: 3 }, stats: { level: 2 } }, b.token);
  await sleep(10500);
  await call('submitScore', { runId: prun, game: 'pull-day', score: 600, sheet: { n: 1, stars: 1 } }, b.token);
  L = await lvOf(); ok(L.lv[1] === 2 && L.lv[2] === 3 && L.s === 800, 'stars only go up; best single sheet kept', JSON.stringify(L));
  await sleep(10500);
  await call('submitScore', { runId: prun, game: 'pull-day', score: 600, sheet: { n: 2, stars: 7 } }, b.token);
  L = await lvOf(); ok(L.lv[2] === 3, 'impossible star count is ignored', JSON.stringify(L));

  console.log('Reading the leaderboard:');
  r = await fetch(FS + 'scores/' + a.uid); const doc = await j(r);
  ok(r.status === 200, 'anyone can read scores', r.status);
  ok(doc.fields && doc.fields.games.mapValue.fields['tone-trace'].mapValue.fields.s.integerValue === '600', 'saved best is 600');
  ok(doc.fields && doc.fields.name.stringValue === 'bCorey/b the tech', 'saved name');
  r = await fetch(FS + 'runs/' + run); ok(r.status === 403, 'runs are not readable', r.status);
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
