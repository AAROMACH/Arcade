# Tools

The arcade also runs as a claude.ai artifact (a private page with its own leaderboard storage).
The games are the same files in both places; only the hub page differs. These tools turn the
claude.ai version into this Firebase app, and hold the bots used to balance the games.

```
artifact-hub.html   the hub as published on claude.ai (artifact storage for scores)
build_site.py       artifact hub + public/games/ -> plain static site in .build/site/
build_app.py        runs build_site.py, then rebuilds public/ (hub, manifest, icons, sw.js)
make_icons.js       renders the app icons (needs Playwright + Chromium)
scores.js           score storage for the Firebase app (shared leaderboard or this device)
bots/               balance bots that play the real game code in a headless browser
```

## Rebuild public/ after changing a game or the hub

Edit `public/games/<game>.html` (or `tools/artifact-hub.html` for the hub), then:

```bash
python3 tools/build_app.py
```

This regenerates `public/index.html`, `public/sw.js` (with a new cache name, so installed copies
update) and the icons. A filled-in `public/config.js` is kept.

## Balance bots

Serve `public/` locally, then run a bot suite:

```bash
python3 -m http.server 8765 --directory public
```

```bash
node tools/bots/dbbots.js 120
```

```bash
node tools/bots/dbgoal.js 1200,1500,1800,2000,2200,2300,2400,2400,2400,2400
```

```bash
node tools/bots/ttbots.js 300
```

- `dbbots.js`: Dispatch Board. Three skill levels (pro, average, weak) play full days at each
  difficulty; prints money percentiles and where it was lost. `dbgoal.js` then shows how often
  each bot meets a list of daily goals.
- `ttbots.js`: Tone & Trace. An expert investigator, a skimmer, a story-truster and a guesser
  each play shifts; prints how often each meets the shift goal.

## Leaderboard server tests

`tests/functions.test.js` signs in as test players against the Firebase emulators and checks that
the browser can't write scores, that the functions refuse fake or out-of-range scores, and that
honest scores and names are saved. See the comment at the top of the file for how to run it.
