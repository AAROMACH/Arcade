"""Build the standalone Aaromach Arcade site from the artifact version.
Inputs: public/games/ (the games; identical in both versions) and tools/artifact-hub.html (the claude.ai hub).
Output: .build/site/  (index.html, games/, scores.js, config.js, firebase.json, firestore.rules, README.md)
"""
import os, shutil
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
GAMES, HUB, OUT = REPO + 'public/games/', REPO + 'tools/artifact-hub.html', REPO + '.build/site/'
os.makedirs(OUT + 'games', exist_ok=True)
for f in os.listdir(GAMES):
    if not f.startswith('_'):
        shutil.copy(GAMES + f, OUT + 'games/' + f)

s = open(HUB).read()
def R(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a))
    s = s.replace(a, b)

R("  if (!$('frame').src.endsWith(`games/${id}.html`)) $('frame').src = `games/${id}.html`;",
  "  if (!$('frame').src.endsWith(`games/${id}.html`)) { $('frame').src = `games/${id}.html`; S.startRun(id); }")
R("$('restart').onclick = () => { if (!current) return; $('toast').textContent = '';",
  "$('restart').onclick = () => { if (!current) return; $('toast').textContent = ''; S.startRun(current);")
# Artifact-only meta out; storage swapped for scores.js.
R('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
R("let db = null, user = null, me = null, rows = new Map(), mine = {}, loaded = false;",
  "let me = null, rows = new Map(), names = new Map(), mine = {}, loaded = false;\nconst S = window.ArcadeScores;")
R("  const ps = user && ids.length ? await user.profiles(ids) : {};",
  "  const ps = Object.fromEntries(ids.map(id => [id, { name: names.get(id) || 'Someone' }]));")
# Initials avatar instead of a profile photo.
R("""<div class="who"><img alt="" src="${ps[r.pid]?.avatarUrl || ''}">""",
  """<div class="who"><b class="av" style="background:hsl(${[...r.pid].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 42%)">${(ps[r.pid]?.name || '?').split(/\\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase().replace(/[<>&"]/g, '')}</b>""")
R(".rank .who img { width: 22px; height: 22px; border-radius: 50%; flex: none; }",
  ".rank .who img, .rank .who .av { width: 22px; height: 22px; border-radius: 50%; flex: none; }\n.rank .who .av { display: grid; place-items: center; font-size: 10px; font-weight: 700; color: #fff; }")
R("  if (!db || !me || !loaded || !G(gameId)) return;", "  if (!me || !loaded || !G(gameId)) return;")
R("  writing = writing.then(() => db.doc('scores/' + me).set(body)).then(() => {", "  writing = writing.then(() => S.save(body, { game: gameId, score: Number.isFinite(score) ? Math.round(score) : 0, time: faster ? Math.round(time) : null, stats: ns })).then(() => {")
R("""  }).catch(err => { $('toast').textContent = err?.code === 'permission_denied' || err?.code === 'not_granted' ? 'Score not posted: needs Contributor access' : 'Score not posted'; });""",
  """  }).catch(err => {
    $('toast').textContent = err && err.code && err.code !== 'functions/internal' && err.code !== 'functions/unavailable' ? `Score not posted: ${err.message}` : 'Score not posted. Check your connection.';
    // Keep the reason on the Leaderboard tab (the toast fades), with the code, so it can be reported.
    $('postErr').hidden = false;
    $('postErr').textContent = `Your last ${G(gameId).t} score didn\u2019t save: ${(err && err.message) || 'no reply from the server'} [${(err && err.code) || 'no code'}]`;
  });""")
a = s.index("(async () => {\n  const timer = setTimeout(() => { if (!loaded)"); b = s.index("</script>", a)
s = s[:a] + """// Scores: a shared leaderboard (separate Firebase project, set in config.js) or this device only.
S.start({
  onRows(next) {
    loaded = true; me = S.me;
    rows = new Map([...next].map(([id, v]) => [id, v.games || {}])); names = new Map([...next].map(([id, v]) => [id, v.name]));
    if (me && rows.has(me)) mine = { ...rows.get(me) };
    render();
  },
  onAccount: showAccount,
  onStatus(st) {
    $('lbnote').textContent = st === 'shared' ? 'Each player’s best run, shared with everyone who plays. Scores post automatically when a run ends.'
      : st === 'local' ? 'Scores are saved on this device only. (The shared leaderboard switches on once the arcade’s Firebase project is set up.)'
      : st === 'offline' ? `Couldn’t connect to the shared leaderboard (${S.failReason}), so scores are saved on this device for now. An ad blocker or privacy extension can cause this: allow this site, or try a private window. `
      : 'Scores stopped updating. Reopen the page to reconnect.';
    if (st === 'offline') { const b = document.createElement('button'); b.type = 'button'; b.className = 'retry'; b.textContent = 'Try again'; b.onclick = () => location.reload(); $('lbnote').appendChild(b); }
    $('nameRow').hidden = st === 'error'; $('pname').value = S.name || '';
  },
});
// Say why Google sign-in failed, so the fix is obvious (and the code can be passed on).
function googleError(e) {
  const c = (e && e.code) || '', host = location.hostname;
  const why = {
    'auth/popup-closed-by-user': '', 'auth/cancelled-popup-request': '',
    'auth/unauthorized-domain': `This address (${host}) isn’t on the arcade’s list of allowed sign-in domains yet. The arcade’s owner adds it in Firebase: Authentication → Settings → Authorized domains.`,
    'auth/operation-not-allowed': 'Google sign-in isn’t switched on for the arcade yet (Firebase: Authentication → Sign-in method → Google).',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.',
    'auth/network-request-failed': 'Couldn’t reach Google. Check your connection and try again.',
    'auth/web-storage-unsupported': 'This browser is blocking the storage sign-in needs (private mode or strict privacy settings). Try a normal window, or another browser.',
    'auth/operation-not-supported-in-this-environment': 'This browser can’t open the Google sign-in. If you opened the arcade from inside another app (Messenger, Gmail…), open it in Safari or Chrome instead.',
    'auth/internal-error': 'Google sign-in hit a browser problem. If you’re in a private window or have strict privacy settings, try a normal window or another browser.',
  }[c];
  return why !== undefined ? why : `Google sign-in didn’t finish${c ? ` (${c})` : ''}. Try again.`;
}
function showAccount(a) {
  const g = a && a.kind === 'google';
  $('acct').hidden = !a || a.kind === 'local';
  $('acctWho').textContent = g ? `Signed in with Google${a.email ? ` (${a.email})` : ''}.` : 'Playing as a guest on this device.';
  $('gIn').hidden = g; $('gOut').hidden = !g; $('keepIn').checked = S.keep !== false;
}
$('gIn').onclick = async () => {
  $('acctMsg').textContent = '';
  try { const r = await S.signInGoogle($('keepIn').checked); if (r && r.switched) $('acctMsg').textContent = 'That Google account already had scores, so you switched to it.'; if (r && r.again) $('acctMsg').textContent = 'That Google account already has scores here. Tap Sign in with Google again to switch to it.'; $('pname').value = S.name || ''; }
  catch (e) { $('acctMsg').textContent = googleError(e); }
};
$('gOut').onclick = async () => { await S.signOut(); $('acctMsg').textContent = 'Signed out. You\u2019re a guest again.'; };
$('keepIn').onchange = () => { if (S.setKeep) S.setKeep($('keepIn').checked); };
$('nameRow').addEventListener('submit', async e => {
  e.preventDefault(); $('nameSaved').textContent = 'Saving\u2026';
  try { await S.setName($('pname').value); $('nameSaved').textContent = 'Saved'; $('postErr').hidden = true; setTimeout(() => $('nameSaved').textContent = '', 1500); }
  catch (err) {
    // Show the server's reason and code (same place as a failed score), so a setup problem is visible.
    $('nameSaved').textContent = '';
    $('postErr').hidden = false;
    $('postErr').textContent = `Your name didn\u2019t save: ${(err && err.message) || 'no reply from the server'} [${(err && err.code) || 'no code'}]`;
  }
});
""" + s[b:]
R("""        <p class="lbnote" id="lbnote">Loading scores…</p>""",
  """        <p class="lbnote" id="lbnote">Loading scores…</p>
        <p class="posterr" id="postErr" role="status" hidden></p>
        <form class="namerow" id="nameRow" hidden><label for="pname">Playing as</label><input id="pname" maxlength="24" autocomplete="nickname" placeholder="Your name"><button type="submit">Save</button><span id="nameSaved"></span></form>
        <div class="acct" id="acct" hidden><span id="acctWho"></span><button type="button" id="gIn"><svg viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.5 1.4l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"/></svg>Sign in with Google</button><label class="keep"><input type="checkbox" id="keepIn" checked> Keep me signed in</label><button type="button" id="gOut" hidden>Sign out</button><span id="acctMsg" role="status"></span></div>""")
R(".lbnote { font-size: 13px; color: var(--muted); margin: 0; }",
  """.lbnote { font-size: 13px; color: var(--muted); margin: 0; }
.namerow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; color: var(--muted); }
.namerow input { font: inherit; color: var(--fg); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; width: 180px; }
.namerow button { font: inherit; font-weight: 700; color: #111; background: var(--safety); border: 0; border-radius: 6px; padding: 5px 12px; cursor: pointer; }
.namerow #nameSaved { color: #4cc38a; }
.lbnote .retry { font: inherit; font-weight: 700; color: #111; background: var(--safety); border: 0; border-radius: 6px; padding: 3px 10px; margin-left: 6px; cursor: pointer; }
.posterr { margin: 0; font-size: 13px; color: #ff8a7a; border-left: 3px solid #ff6a55; padding: 4px 8px; background: rgba(255,106,85,.08); border-radius: 4px; }
.acct { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 13px; color: var(--muted); }
.acct button { font: inherit; font-weight: 700; display: inline-flex; align-items: center; gap: 7px; color: #1f1f1f; background: #fff; border: 1px solid #dadce0; border-radius: 6px; padding: 5px 12px; cursor: pointer; }
.acct button svg { width: 16px; height: 16px; } .acct #gOut { color: var(--fg); background: var(--panel); border-color: var(--line); }
.acct .keep { display: inline-flex; gap: 5px; align-items: center; cursor: pointer; } .acct #acctMsg { color: var(--fg); }""")
# Wrap as a full document for normal web hosting.
head = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#121417">
<script src="config.js"></script>
<script src="scores.js"></script>
"""
title_end = s.index("</style>") + len("</style>")
s = head + s[:title_end] + "\n</head><body>\n" + s[title_end:] + "\n</body></html>\n"
open(OUT + 'index.html', 'w').write(s)

open(OUT + 'config.js', 'w').write("""// Aaromach Arcade — shared leaderboard settings.
// Leave this as null and scores are kept on each device only.
// To turn on the shared leaderboard, create a SEPARATE Firebase project for the arcade
// (not the Command Center project), add a Web app, and paste its config here. See README.md.
window.ARCADE_FIREBASE = null;
// App Check: the reCAPTCHA Enterprise site key registered for this site (Firebase console, App Check).
// (For a classic reCAPTCHA v3 key instead, also set window.ARCADE_APPCHECK_PROVIDER = 'v3'.)
window.ARCADE_APPCHECK_KEY = null;
// Region the Cloud Functions are deployed to (functions/index.js).
window.ARCADE_FUNCTIONS_REGION = 'us-central1';
/* Example:
window.ARCADE_FIREBASE = {
  apiKey: "…",
  authDomain: "aaromach-arcade.firebaseapp.com",
  projectId: "aaromach-arcade",
  appId: "…",
};
*/
""")
open(OUT + 'firestore.rules', 'w').write("""rules_version = '2';
// Aaromach Arcade: anyone can read the leaderboard; each player (anonymous sign-in) can only
// write their own row, with a short name and a map of game scores.
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{uid} {
      allow read: if true;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['name', 'games', 'updated'])
        && request.resource.data.name is string && request.resource.data.name.size() <= 24
        && (!('games' in request.resource.data) || request.resource.data.games is map);
      allow delete: if false;
    }
  }
}
""")
open(OUT + 'firebase.json', 'w').write("""{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "firestore.rules", "README.md", "**/.*"],
    "headers": [{ "source": "**/*.@(js|html)", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }]
  },
  "firestore": { "rules": "firestore.rules" }
}
""")
print('built', sorted(os.listdir(OUT)), len(os.listdir(OUT + 'games')), 'game files')
