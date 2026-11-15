# Aaromach Arcade

Twelve field-work games (cabling, cameras, fiber, tools, dispatch) as an installable web app on
Firebase Hosting. No build step and no server code: every game is a self-contained HTML page.
It is its own Firebase project; Command Center only links to it.

```
firebase.json            Hosting (public/), Firestore rules, Cloud Functions, emulators
functions/               server-side score checks (the only writer of the leaderboard)
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
  sw.js                  removes the old offline cache from browsers that still have it
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
2. **Upgrade to the Blaze plan** (Usage and billing). The score-checking Cloud Functions need it.
   At arcade traffic this stays inside the free allowance; set a budget alert anyway.
3. **Build → Authentication → Sign-in method:** enable **Anonymous** and **Google**. Players start
   as an invisible guest; "Sign in with Google" on the Leaderboard tab links their scores to their
   Google account so they follow them to any device.
4. **Authentication → Settings → Authorized domains:** add every address the arcade is served
   from (for example `arcade.aaromach.com`, and the App Hosting URL if you use it).
5. **Build → Firestore Database:** create a database in production mode.
6. **Project settings → Your apps → Add app → Web:** register it and copy `apiKey`, `authDomain`,
   `projectId` and `appId` into `public/config.js`. These values are public by design; the
   security rules and the functions are what protect the data.
7. **App Check:** in the [reCAPTCHA admin console](https://www.google.com/recaptcha/admin) create a
   **reCAPTCHA v3** site key for your arcade domains. In Firebase, **Build → App Check → Apps**,
   register the web app with that key's secret, and put the **site key** in `public/config.js` as
   `window.ARCADE_APPCHECK_KEY`. Then under **App Check → APIs**, enforce it for Cloud Functions.

## 3. Deploy

```bash
npm install -g firebase-tools
```

```bash
firebase login
```

```bash
cd functions && npm install && cd ..
```

```bash
firebase deploy --only hosting,firestore,functions
```

The arcade is then live at `https://<project-id>.web.app`.

**Check it's working:** open the arcade, play a game to the end, and the Leaderboard tab shows
your score. In the Firebase console, Functions shows `submitScore` calls, and App Check's metrics
show them as verified. If scores stop posting with "Score not posted: Unauthenticated", the App
Check site key is missing or the domain isn't on the reCAPTCHA key.

**Test locally without touching the real project** (Auth, Firestore and Functions emulators):

```bash
firebase emulators:start --project demo-arcade
```

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

### Automatic deploys (GitHub Actions)

`.github/workflows/deploy-functions.yml` deploys the Cloud Functions and Firestore rules whenever
`functions/`, `firestore.rules` or `firebase.json` change on `main`, and can also be run by hand
from the repo's **Actions** tab. It signs in with **Workload Identity Federation**: no key or
secret is stored anywhere, and Google only trusts this repository. One-time setup in the
aaromach-arcade project:

1. Enable the **IAM Service Account Credentials API**.
2. Create the service account `arcade-deployer` with: Firebase Admin, Cloud Functions Admin,
   Cloud Run Admin, Service Account User, Artifact Registry Administrator, Service Usage Consumer.
3. Create a Workload Identity pool `github` with an OIDC provider `arcade`: issuer
   `https://token.actions.githubusercontent.com`, mappings `google.subject = assertion.sub` and
   `attribute.repository = assertion.repository`, condition
   `assertion.repository == "AAROMACH/Arcade"`.
4. On the pool, **Grant access** (service account impersonation) to `arcade-deployer` for
   principals whose `repository` is `AAROMACH/Arcade`.

## 4. Install it as an app

- **iPhone / iPad:** open the site in Safari → Share → Add to Home Screen.
- **Android:** Chrome menu → Install app.
- **Desktop Chrome / Edge:** the install icon in the address bar.

The arcade needs a connection (there is no offline mode), so every deploy shows up on the next load.

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

- Anyone can read the leaderboard (`firestore.rules`).
- **Nobody can write it from the browser**, not even their own row. Scores and names are saved only
  by the Cloud Functions in `functions/`, which check each one first:
  - the player is signed in, and the call comes from the real site (App Check);
  - the game exists and the score was posted from a run of that game the player started;
  - the score is under the game's cap and no higher than that game's points-per-minute allows for
    the time the game has been open; finish times aren't faster than possible;
  - at most one post every 10 seconds; a lower score never replaces a best.
- The limits per game are in `GAMES` at the top of `functions/index.js`. They're deliberately
  generous; raise one if a real score is ever refused.
- Public names are cleaned (24 characters, no markup). A Google sign-in shows first name + last
  initial by default, never the full name or email.
- Nobody can delete rows from the site. To clear a player or reset the boards, delete documents in
  the Firebase console under Firestore → `scores`.
- This stops editing your own row and obviously fake scores. It can't prove a believable score was
  earned, because the games run in the browser; that would need the server to replay each run.
