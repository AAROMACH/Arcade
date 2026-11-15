"""Assemble the deployable Firebase project for the Aaromach Arcade.
Runs build_site.py (artifact -> plain static site), then lays it out as a Firebase project:

  <DEST>/firebase.json  .firebaserc  firestore.rules  firestore.indexes.json  README.md  .gitignore
  <DEST>/public/        index.html  games/  scores.js  config.js  manifest.webmanifest  sw.js  icons/
"""
import os, shutil, subprocess, hashlib, json, sys
T = os.path.dirname(os.path.abspath(__file__)) + '/'
REPO = os.path.dirname(T.rstrip('/')) + '/'
SITE = REPO + '.build/site/'
DEST = sys.argv[1] if len(sys.argv) > 1 else REPO
PUB = DEST + 'public/'

subprocess.run(['python3', T + 'build_site.py'], check=True, stdout=subprocess.DEVNULL)

# Keep a filled-in config.js if one is already there (it holds the arcade's Firebase settings).
kept_cfg = None
if os.path.exists(PUB + 'config.js'):
    c = open(PUB + 'config.js').read()
    if 'window.ARCADE_FIREBASE = null;' not in c: kept_cfg = c
if os.path.exists(PUB): shutil.rmtree(PUB)
os.makedirs(PUB + 'games'); os.makedirs(PUB + 'icons')
for f in os.listdir(SITE + 'games'): shutil.copy(SITE + 'games/' + f, PUB + 'games/' + f)
SVER = hashlib.sha256(open(T + 'scores.js', 'rb').read()).hexdigest()[:10]
open(PUB + 'scores.js', 'w').write(open(T + 'scores.js').read().rstrip('\n') + f"\nwindow.ArcadeScores.ver = '{SVER}';   // checked by index.html: a stale cached copy repairs itself\n")
shutil.copy(SITE + 'config.js', PUB + 'config.js')
if kept_cfg: open(PUB + 'config.js', 'w').write(kept_cfg)
subprocess.run(['node', T + 'make_icons.js', PUB + 'icons'], check=True, stdout=subprocess.DEVNULL, cwd=T)

# ── Hub page: install metadata + service worker ──
s = open(SITE + 'index.html').read()
def R(a, b):
    global s
    assert s.count(a) == 1, (a[:80], s.count(a))
    s = s.replace(a, b)
R('<script src="scores.js"></script>', '''<script src="scores.js"></script>
<script>
// If an old offline cache served an out-of-date scores.js, clear that cache and reload once.
(function () {
  var want = '%s', S = window.ArcadeScores;
  if (S && S.ver === want) { try { sessionStorage.removeItem('arcade:refetched'); } catch (e) {} return; }
  try { if (sessionStorage.getItem('arcade:refetched')) return; sessionStorage.setItem('arcade:refetched', '1'); } catch (e) { return; }
  var regs = navigator.serviceWorker && navigator.serviceWorker.getRegistrations ? navigator.serviceWorker.getRegistrations() : Promise.resolve([]);
  regs.then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })
    .then(function () { return window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : 0; })
    .catch(function () {}).then(function () { location.reload(); });
})();
</script>''' % SVER)
R('<meta name="theme-color" content="#121417">', '''<meta name="theme-color" content="#121417">
<meta name="description" content="Field-work games from Aaromach: pull cable, terminate, hang cameras, splice fiber, dispatch the crew.">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="icon" type="image/svg+xml" href="icons/icon.svg">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Arcade">''')
R('\n</body></html>\n', '''
<script>
// No offline cache: every deploy shows up on the next load, like any website. Browsers that still
// run the old offline service worker get it removed, its cached copies deleted, and one reload.
if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
  navigator.serviceWorker.getRegistrations().then(function (rs) {
    if (!rs.length) return;
    Promise.all(rs.map(function (r) { return r.unregister(); }))
      .then(function () { return window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : 0; })
      .catch(function () {}).then(function () { if (navigator.serviceWorker.controller) location.reload(); });
  }).catch(function () {});
}
</script>
</body></html>
''')
open(PUB + 'index.html', 'w').write(s)

open(PUB + 'manifest.webmanifest', 'w').write(json.dumps({
    "name": "Aaromach Arcade", "short_name": "Arcade", "id": "/", "start_url": "/", "scope": "/",
    "display": "standalone", "orientation": "any", "background_color": "#121417", "theme_color": "#121417",
    "description": "Field-work games: pull cable, terminate, hang cameras, splice fiber, dispatch the crew.",
    "categories": ["games", "education"],
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
        {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}, indent=2) + '\n')

# ── sw.js: a clean-up worker. Browsers that installed the old offline worker fetch this on their next
#    visit; it deletes every cached copy, unregisters itself and reloads open pages onto the live site. ──
open(PUB + 'sw.js', 'w').write("""// Aaromach Arcade: offline mode is retired. This worker only removes the old one and its caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(cs => cs.forEach(c => c.navigate(c.url))));
});
""")

# ── Firebase project files ──
# firestore.rules lives in the repo (server-only writes); it is not generated.
open(DEST + 'firestore.indexes.json', 'w').write('{\n  "indexes": [],\n  "fieldOverrides": []\n}\n')
open(DEST + 'firebase.json', 'w').write(json.dumps({
    "hosting": {
        "public": "public",
        "cleanUrls": False,
        "headers": [
            {"source": "**/*.@(html|js|webmanifest)", "headers": [{"key": "Cache-Control", "value": "no-cache"}]},
            {"source": "sw.js", "headers": [{"key": "Cache-Control", "value": "no-store"}, {"key": "Service-Worker-Allowed", "value": "/"}]},
            {"source": "icons/**", "headers": [{"key": "Cache-Control", "value": "public, max-age=604800"}]},
            {"source": "**", "headers": [
                {"key": "X-Content-Type-Options", "value": "nosniff"},
                {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"}]},
        ],
    },
    "firestore": {"rules": "firestore.rules", "indexes": "firestore.indexes.json"},
    "functions": [{"source": "functions", "codebase": "default", "runtime": "nodejs22", "ignore": ["node_modules", ".git", "*.log"]}],
    "emulators": {"auth": {"port": 9099}, "firestore": {"port": 8085}, "functions": {"port": 5001}, "hosting": {"port": 5000}, "ui": {"enabled": True, "port": 4000}, "singleProjectMode": True},
}, indent=2) + '\n')
if not os.path.exists(DEST + '.firebaserc'):
    open(DEST + '.firebaserc', 'w').write('{\n  "projects": {\n    "default": "aaromach-arcade"\n  }\n}\n')
open(DEST + '.gitignore', 'w').write('.build/\nfunctions/node_modules/\nfunctions/.env.local\n.firebase/\nfirebase-debug.log\nfirestore-debug.log\nui-debug.log\n')
print('built', DEST)
