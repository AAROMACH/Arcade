// Aaromach Arcade — score storage.
//
// Two modes, picked automatically:
//  • Shared leaderboard: when config.js sets window.ARCADE_FIREBASE, scores live in that
//    Firebase project's Firestore (collection "scores", one doc per player). The browser can only
//    READ them. Every write goes through the arcade's Cloud Functions (functions/), which check
//    the score before saving it. Players sign in anonymously behind the scenes and pick a name.
//    App Check (window.ARCADE_APPCHECK_KEY, a reCAPTCHA Enterprise site key; set
//    window.ARCADE_APPCHECK_PROVIDER = 'v3' for a classic reCAPTCHA v3 key) proves calls come from
//    this site.
//  • This device only: with no Firebase config, scores are kept in this browser's storage.
//
// Players start as an invisible guest. "Sign in with Google" links the guest to their Google account
// (scores carry over) so the same scores follow them to any device. "Keep me signed in" picks
// whether that sign-in survives closing the browser.
//
// The hub uses: ArcadeScores.start({ onRows, onStatus, onAccount }), .startRun(game),
// .save(allGames, { game, score, time }), .setName(name), .signInGoogle(keep), .signOut(),
// .account, .me, .shared
(function () {
  const NAME_KEY = 'arcade:name', LOCAL_KEY = 'arcade:localScores', KEEP_KEY = 'arcade:keepSignedIn';
  const keepPref = () => { try { return localStorage.getItem(KEEP_KEY) !== '0'; } catch { return true; } };
  const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
  // Games opened before the connection is ready are remembered and their runs started once it is.
  const pendingRuns = new Set();
  const api = { me: null, shared: false, name: getName(), account: { kind: 'local' }, keep: keepPref(), startRun: game => { pendingRuns.add(game); } };

  function loadScript(src) {
    return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src)); document.head.appendChild(s); });
  }
  const clean = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 24);

  // ── This-device mode ──
  function startLocal({ onRows, onStatus }) {
    api.me = 'local'; api.shared = false; api.startRun = () => {}; pendingRuns.clear();
    const read = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; } };
    const emit = () => onRows(new Map([['local', { name: api.name || 'You', games: read() }]]));
    api.save = async games => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(games)); } catch {} emit(); };
    api.setName = async n => { api.name = clean(n); try { localStorage.setItem(NAME_KEY, api.name); } catch {} emit(); };
    onStatus('local');
    emit();
  }

  // ── Shared (Firebase) mode: read Firestore, write through Cloud Functions ──
  async function startShared(cfg, { onRows, onStatus, onAccount = () => {} }) {
    const V = '10.12.2';
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`);
    await Promise.all(['auth', 'firestore', 'functions', 'app-check'].map(m => loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-${m}-compat.js`)));
    const app = firebase.initializeApp(cfg, 'arcade');
    if (window.ARCADE_APPCHECK_KEY) {
      const AC = firebase.appCheck, Provider = window.ARCADE_APPCHECK_PROVIDER === 'v3' ? AC.ReCaptchaV3Provider : AC.ReCaptchaEnterpriseProvider;
      app.appCheck().activate(new Provider(window.ARCADE_APPCHECK_KEY), true);
    }
    const auth = app.auth(), db = app.firestore(), fn = app.functions(window.ARCADE_FUNCTIONS_REGION || 'us-central1');
    if (window.ARCADE_EMULATORS) { auth.useEmulator('http://127.0.0.1:9099'); db.useEmulator('127.0.0.1', 8085); fn.useEmulator('127.0.0.1', 5001); }
    const call = (name, data) => fn.httpsCallable(name)(data).then(r => r.data);
    const P = firebase.auth.Auth.Persistence;
    await auth.setPersistence(api.keep ? P.LOCAL : P.SESSION);
    try { await auth.getRedirectResult(); } catch (e) { if (e.code === 'auth/credential-already-in-use' && e.credential) await auth.signInWithCredential(e.credential); }

    // Public name from a Google account: first name + last initial, never the full name or email.
    const shortName = full => { const w = String(full || '').trim().split(/\s+/).filter(Boolean); return w.length ? (w[0] + (w.length > 1 ? ' ' + w[w.length - 1][0] + '.' : '')).slice(0, 24) : ''; };
    const runs = {};
    const describe = u => u && !u.isAnonymous ? { kind: 'google', name: u.displayName || '', email: u.email || '' } : { kind: 'guest' };
    // Wait for the saved sign-in (if any); otherwise become a guest.
    let user = await new Promise(res => { const off = auth.onAuthStateChanged(u => { off(); res(u); }); });
    if (!user) user = (await auth.signInAnonymously()).user;
    const adopt = async (u, fresh) => {
      if (api.me && api.me !== u.uid) for (const k in runs) delete runs[k];   // runs belong to the old account
      api.me = u.uid; api.account = describe(u); onAccount(api.account);
      if (fresh && api.account.kind === 'google') {
        const doc = await db.collection('scores').doc(u.uid).get().catch(() => null), cur = doc && doc.exists ? doc.get('name') : '';
        const gp = (u.providerData || []).find(x => x && x.providerId === 'google.com');
        if (!cur || /^Tech-[A-Z0-9]{4}$/.test(cur)) { const n = shortName(u.displayName || (gp && gp.displayName)); if (n) await api.setName(n).catch(() => {}); }
      }
    };
    api.shared = true;

    // A "run" starts when a game is opened; the server uses it to judge whether a score is believable.
    // Keep the reason a run couldn't start, so a failed score post says why (not just "no run").
    const runErr = {};
    api.startRun = game => { delete runErr[game]; runs[game] = call('startRun', { game }).then(r => { if (!r || !r.runId) throw new Error('The score server answered without a run id: ' + JSON.stringify(r)); return r.runId; }).catch(e => { runErr[game] = e; console.warn('startRun failed:', e); return null; }); };
    api.save = async (_all, post) => {
      if (!post || !post.game) return;
      if (!runs[post.game]) api.startRun(post.game);
      const runId = await runs[post.game];
      if (!runId) { const e = runErr[post.game]; if (e) throw e; throw new Error('No run'); }
      return call('submitScore', { runId, game: post.game, score: post.score, time: Number.isFinite(post.time) ? post.time : null, stats: post.stats || null });
    };
    api.setName = async n => {
      const name = clean(n); if (!name) return;
      const r = await call('setName', { name }); api.name = r.name; try { localStorage.setItem(NAME_KEY, api.name); } catch {}
    };
    api.signInGoogle = async keep => {
      // No await before the pop-up: browsers only allow pop-ups opened straight from the click.
      if ((keep !== false) !== api.keep) api.setKeep(keep !== false);
      const provider = new firebase.auth.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' });
      const cur = auth.currentUser, popupFail = e => ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e.code);
      try {
        // A guest links Google to the same account, so their scores carry over.
        if (cur && cur.isAnonymous && !api.nextIsSignIn) await cur.linkWithPopup(provider); else { api.nextIsSignIn = false; await auth.signInWithPopup(provider); }
      } catch (e) {
        if (e.code === 'auth/credential-already-in-use') {
          // That Google account already has an arcade account: switch to it (the guest's scores stay behind).
          const c = e.credential || (firebase.auth.GoogleAuthProvider.credentialFromError && firebase.auth.GoogleAuthProvider.credentialFromError(e));
          if (c) { await auth.signInWithCredential(c); return { switched: true }; }
          api.nextIsSignIn = true; return { again: true };
        }
        if (popupFail(e)) { if (cur && cur.isAnonymous) await cur.linkWithRedirect(provider); else await auth.signInWithRedirect(provider); return; }
        throw e;
      }
    };
    api.setKeep = async keep => { api.keep = !!keep; try { localStorage.setItem(KEEP_KEY, api.keep ? '1' : '0'); } catch {} await auth.setPersistence(api.keep ? P.LOCAL : P.SESSION); };
    api.signOut = async () => { await auth.signOut(); await auth.signInAnonymously(); };
    pendingRuns.forEach(g => api.startRun(g)); pendingRuns.clear();
    // Any change of account (first load, Google pop-up or redirect, linking, sign-out) goes through here.
    let lastSig = '';
    const watch = u => { if (!u) return; const sig = u.uid + (u.isAnonymous ? ':guest' : ':google'); if (sig === lastSig) return; lastSig = sig; adopt(u, true); };
    auth.onIdTokenChanged(watch); auth.onAuthStateChanged(watch); watch(user);
    if (api.name && !getName.synced && api.account.kind === 'guest') { getName.synced = true; api.setName(api.name).catch(() => {}); }

    db.collection('scores').onSnapshot(snap => {
      onRows(new Map(snap.docs.map(d => { const v = d.data() || {}; return [d.id, { name: v.name || 'Someone', games: v.games || {} }]; })));
    }, () => onStatus('error'));
    onStatus('shared');
  }

  api.start = async handlers => {
    const cfg = window.ARCADE_FIREBASE;
    if (cfg && cfg.apiKey && cfg.projectId) {
      try { await startShared(cfg, handlers); return; }
      catch (e) { console.warn('Shared leaderboard unavailable, using this device:', e); }
    }
    startLocal(handlers);
  };
  window.ArcadeScores = api;
})();
window.ArcadeScores.ver = '959525045d';   // checked by index.html: a stale cached copy repairs itself
