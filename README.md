# Aaromach Arcade

Eleven field-work games (cabling, cameras, fiber, tools, dispatch) as an installable web app on
Firebase Hosting. No build step and no server code: every game is a self-contained HTML page.
It is its own Firebase project; Command Center only links to it.

```
firebase.json            Hosting (public/) + Firestore rules
apphosting.yaml          App Hosting settings (server.js serves public/)
server.js, package.json  dependency-free Node server for App Hosting
.firebaserc              which Firebase project to deploy to (default: aaromach-arcade)
firestore.rules          leaderboard security rules
public/
  index.html             the arcade hub (game list, leaderboards, player name)
  games/                 one page per game + tools-lib.js (shared tool artwork)
  config.js              the only file you edit: the arcade's Firebase web config
  scores.js              score storage: shared leaderboard, or this device only
  manifest.webmanifest   install as an app (home screen / desktop)
  sw.js                  offline play: caches every game after the first visit
  icons/                 app icons
```

## 1. Run it locally

```bash
npx firebase-tools emulators:start --only hosting
```

or any static server pointed at `public/`:

```bash
python3 -m http.server 8080 --directory public
```

With `config.js` left as `null`, leaderboards are saved in each browser only.

## 2. Create the Firebase project (one time)

Use a **separate** project from Command Center so the arcade can never touch the app's data.

1. In the [Firebase console](https://console.firebase.google.com), create a project. If you pick an
   ID other than `aaromach-arcade`, change it in `.firebaserc`.
2. **Build → Authentication → Sign-in method:** enable **Anonymous**. Players are signed in
   invisibly and choose a display name on the Leaderboard tab.
3. **Build → Firestore Database:** create a database in production mode.
4. **Project settings → Your apps → Add app → Web:** register it and copy `apiKey`, `authDomain`,
   `projectId` and `appId` into `public/config.js`. These values are public by design; the
   security rules are what protect the data.

## 3. Deploy

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
firebase deploy --only hosting,firestore
```

The arcade is then live at `https://<project-id>.web.app`.

### Or: Firebase App Hosting (deploys on every push to `main`)

App Hosting runs a Node server instead of serving files directly, so this repo includes
`package.json`, `server.js` (a dependency-free static server for `public/`) and
`apphosting.yaml`. Create a backend under **Build → App Hosting**, connect this repo, use the
root directory `/` and the live branch `main`. Each push rolls out automatically.

Firestore rules still deploy from the CLI: `firebase deploy --only firestore`.

Local check of the App Hosting server:

```bash
npm start
```

then visit http://localhost:8080.

**Custom domain (for example `arcade.aaromach.com`):** Hosting → Add custom domain, follow the DNS
steps, then add the same domain under Authentication → Settings → Authorized domains so the
leaderboard sign-in works there.

## 4. Install it as an app

- **iPhone / iPad:** open the site in Safari → Share → Add to Home Screen.
- **Android:** Chrome menu → Install app.
- **Desktop Chrome / Edge:** the install icon in the address bar.

After the first visit every game works offline. Scores made offline post the next time a
run ends with a connection.

## 5. Link it from Command Center

In Command Center's `apphosting.yaml`:

```yaml
  - variable: NEXT_PUBLIC_ARCADE_URL
    value: https://aaromach-arcade.web.app
    availability:
      - BUILD
      - RUNTIME
```

Command Center then shows an **Arcade** item in the account menu (tech and admin portals).

## Updating games

Edit the files in `public/games/` and redeploy. The service worker's cache name is a hash of the
site's files, so `public/sw.js` must be regenerated when files change; the build script that
produced this repo does that. If you edit by hand, change the `CACHE` string at the top of
`sw.js` (any new value) so installed copies pick up the update.

## Leaderboard rules

- Anyone can read the leaderboard.
- Each player can write only their own row (`scores/<their uid>`): a name of up to 24 characters
  and their game scores.
- Nobody can delete rows from the site. To clear a player or reset the boards, delete documents in
  the Firebase console under Firestore → `scores`.
- Scores are posted from the player's browser, so a determined player could fake one. Fine for a
  team leaderboard; if prizes ever ride on it, move score checks into a Cloud Function.
