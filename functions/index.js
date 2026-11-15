// Aaromach Arcade: the only code allowed to write the leaderboard.
//
// Players can read scores, but the Firestore rules refuse every write from the browser. Instead
// the hub calls these functions, which check the score is believable and then save it with admin
// rights. App Check makes sure the calls come from the real arcade site.
//
//   startRun({ game })                   -> { runId }   when a game is opened
//   submitScore({ runId, game, score, time? })  -> { best, fastest }
//   setName({ name })                    -> { name }
//
// Data: scores/{uid} = { name, games: { [game]: { s, at, t?, tat? } }, updated }   (public)
//       runs/{runId} = { uid, game, startedAt }                                   (server only)
//       limits/{uid} = { lastScoreAt }                                             (server only)
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

// Per game: hard cap on one run's score, the most points a real player can make per minute of
// play, and (for timed games) the fastest believable finish in seconds. Generous on purpose: these
// stop fake numbers, not good players. Tune here if a real score is ever rejected.
const GAMES = {
  'pull-day':       { cap: 1e6,  perMin: 20000 },
  'terminate':      { cap: 9000, perMin: 6000, minTime: 40 },
  'rough-in':       { cap: 1e6,  perMin: 20000 },
  'lift-panic':     { cap: 5e6,  perMin: 40000 },
  'coverage':       { cap: 1e6,  perMin: 20000 },
  'splice':         { cap: 1e5,  perMin: 15000, minTime: 30 },
  'rack-and-stack': { cap: 1e7,  perMin: 60000 },
  'tool-drawer':    { cap: 1e6,  perMin: 20000 },
  'find-the-tool':  { cap: 1e6,  perMin: 20000 },
  'tone-trace':     { cap: 2100, perMin: 3000 },
  'rack-cleanup':   { cap: 5000, perMin: 3000 },
  'dispatch-board': { cap: 20000, perMin: 15000 },
};
// Leaderboard stats each game may send with a score: the most a run could believably reach, and
// whether lower is better. Each player's best of each is kept. Unknown keys are ignored.
const STATS = {
  'pull-day': { sheets: { max: 500 }, level: { max: 500 } },
  'terminate': { cables: { max: 10 } },
  'rough-in': { floor: { max: 500 } },
  'lift-panic': { ft: { max: 200000 }, cams: { max: 5000 } },
  'coverage': { level: { max: 500 } },
  'splice': { fibers: { max: 500 }, loss: { max: 10, low: true } },
  'rack-and-stack': { rows: { max: 20000 }, level: { max: 500 } },
  'rack-cleanup': { tidy: { max: 100 } },
  'tool-drawer': { drawer: { max: 500 } },
  'find-the-tool': { found: { max: 2000 } },
  'tone-trace': { fixed: { max: 6 }, first: { max: 6 } },
  'dispatch-board': { day: { max: 10000 } },
};
const MIN_GAP_MS = 10 * 1000;            // one score post per player every 10 seconds
const RUN_MAX_AGE_MS = 12 * 3600 * 1000; // a run (an open game) expires after 12 hours

// App Check is on unless the ENFORCE_APP_CHECK environment variable is "false"
// (only for first-time setup, before the site key exists).
const opts = { enforceAppCheck: process.env.ENFORCE_APP_CHECK !== 'false', cors: true };

const need = (ok, code, msg) => { if (!ok) throw new HttpsError(code, msg); };
const uidOf = req => { need(req.auth && req.auth.uid, 'unauthenticated', 'Sign in first.'); return req.auth.uid; };
const gameOf = g => { need(typeof g === 'string' && Object.prototype.hasOwnProperty.call(GAMES, g), 'invalid-argument', 'Unknown game.'); return g; };
const cleanName = n => String(n || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);

exports.startRun = onCall(opts, async req => {
  const uid = uidOf(req), game = gameOf(req.data && req.data.game);
  const ref = db.collection('runs').doc();
  await ref.set({ uid, game, startedAt: FieldValue.serverTimestamp() });
  return { runId: ref.id };
});

exports.submitScore = onCall(opts, async req => {
  const uid = uidOf(req), d = req.data || {}, game = gameOf(d.game), rule = GAMES[game];
  need(typeof d.runId === 'string' && /^[A-Za-z0-9]{10,40}$/.test(d.runId), 'invalid-argument', 'Missing run.');
  const score = Number(d.score), time = d.time == null || !rule.minTime ? null : Number(d.time);   // times count only for timed games
  need(Number.isFinite(score) && score >= 0, 'invalid-argument', 'Bad score.');
  need(time === null || (Number.isFinite(time) && time > 0), 'invalid-argument', 'Bad time.');

  const runRef = db.collection('runs').doc(d.runId), scoreRef = db.collection('scores').doc(uid), limRef = db.collection('limits').doc(uid);
  return db.runTransaction(async tx => {
    const [run, cur, lim] = await Promise.all([tx.get(runRef), tx.get(scoreRef), tx.get(limRef)]);
    need(run.exists && run.get('uid') === uid && run.get('game') === game, 'permission-denied', 'That run isn’t yours.');
    const now = Timestamp.now().toMillis(), started = run.get('startedAt').toMillis(), playedMin = (now - started) / 60000;
    need(now - started < RUN_MAX_AGE_MS, 'failed-precondition', 'That run has expired. Reopen the game.');
    const last = lim.exists ? lim.get('lastScoreAt').toMillis() : 0;
    need(now - last >= MIN_GAP_MS, 'resource-exhausted', 'Too many scores too fast.');

    // Believable? Under the game's cap, and no more than its points-per-minute for the time played.
    need(score <= rule.cap, 'out-of-range', 'Score is over this game’s limit.');
    need(score <= rule.perMin * (playedMin + 0.25), 'out-of-range', 'Score is too high for the time played.');
    if (time !== null) {
      need(time >= rule.minTime, 'out-of-range', 'Time is too fast to be real.');
      need(time <= (now - started) / 1000 + 5, 'out-of-range', 'Time is longer than the game has been open.');
    }

    const games = (cur.exists && cur.get('games')) || {}, prev = games[game] || {};
    const next = { ...prev };
    const better = Math.round(score) > (+prev.s || 0), faster = time !== null && (!prev.t || Math.round(time) < prev.t);
    if (better) { next.s = Math.round(score); next.at = now; }
    if (faster) { next.t = Math.round(time); next.tat = now; }
    // Stats: only this game's known keys, within range; keep the best of each.
    const sent = d.stats && typeof d.stats === 'object' ? d.stats : {}, px = prev.x || {}, nx = { ...px };
    let statBetter = false;
    for (const [k, rule2] of Object.entries(STATS[game] || {})) {
      const v = Number(sent[k]); if (!Number.isFinite(v) || v < 0 || v > rule2.max || (!rule2.low && v <= 0)) continue;
      const val = rule2.low ? Math.round(v * 100) / 100 : Math.round(v), old = Number(px[k]);
      if (!Number.isFinite(old) || (rule2.low ? val < old : val > old)) { nx[k] = val; statBetter = true; }
    }
    if (statBetter) { next.x = nx; if (!next.at) next.at = now; }
    tx.set(limRef, { lastScoreAt: Timestamp.fromMillis(now) });
    if (better || faster || statBetter) {
      tx.set(scoreRef, { games: { [game]: next }, updated: FieldValue.serverTimestamp(), ...(cur.exists && cur.get('name') ? {} : { name: 'Tech-' + uid.slice(-4).toUpperCase() }) }, { merge: true });
    }
    return { best: next.s || 0, fastest: next.t || null, stats: next.x || {}, improved: better || faster || statBetter };
  });
});

exports.setName = onCall(opts, async req => {
  const uid = uidOf(req), name = cleanName(req.data && req.data.name);
  need(name.length >= 1, 'invalid-argument', 'Pick a name.');
  await db.collection('scores').doc(uid).set({ name, updated: FieldValue.serverTimestamp() }, { merge: true });
  return { name };
});
