// Aaromach Arcade — score storage.
//
// Two modes, picked automatically:
//  • Shared leaderboard: when config.js sets window.ARCADE_FIREBASE, scores live in that
//    Firebase project's Firestore (collection "scores", one doc per player). Players sign in
//    anonymously behind the scenes and choose a display name. This is a separate project from
//    Command Center, so nothing here touches the app's data.
//  • This device only: with no Firebase config, scores are kept in this browser's storage.
//
// The hub uses: ArcadeScores.start({ onRows, onStatus }), .save(games), .setName(name), .me, .shared
(function () {
  const NAME_KEY = 'arcade:name', LOCAL_KEY = 'arcade:localScores';
  const getName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
  const api = { me: null, shared: false, name: getName() };

  function loadScript(src) {
    return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src)); document.head.appendChild(s); });
  }
  const clean = n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 24);

  // ── This-device mode ──
  function startLocal({ onRows, onStatus }) {
    api.me = 'local'; api.shared = false;
    const read = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch { return {}; } };
    const emit = () => onRows(new Map([['local', { name: api.name || 'You', games: read() }]]));
    api.save = async games => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(games)); } catch {} emit(); };
    api.setName = async n => { api.name = clean(n); try { localStorage.setItem(NAME_KEY, api.name); } catch {} emit(); };
    onStatus('local');
    emit();
  }

  // ── Shared (Firebase) mode ──
  async function startShared(cfg, { onRows, onStatus }) {
    const V = '10.12.2';
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-auth-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore-compat.js`);
    const app = firebase.initializeApp(cfg, 'arcade');
    const auth = app.auth(), db = app.firestore();
    const cred = await auth.signInAnonymously();
    api.me = cred.user.uid; api.shared = true;
    if (!api.name) { api.name = 'Tech-' + api.me.slice(-4).toUpperCase(); try { localStorage.setItem(NAME_KEY, api.name); } catch {} }
    const ref = db.collection('scores').doc(api.me);
    api.save = games => ref.set({ name: api.name, games, updated: firebase.firestore.FieldValue.serverTimestamp() });
    api.setName = async n => { api.name = clean(n) || api.name; try { localStorage.setItem(NAME_KEY, api.name); } catch {} await ref.set({ name: api.name }, { merge: true }); };
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
