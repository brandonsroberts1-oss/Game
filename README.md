# Frost & Fin

A playable browser fishing tycoon inspired by the winter harbor, isometric movement, stacked cargo, and gather–sell–upgrade loop in the supplied video. The models, illustrations, and interface are original and generated locally in code.

## Play without installing anything

**[Download and play Frost & Fin](https://github.com/brandonsroberts1-oss/Game/releases/latest/download/Play-Frost-and-Fin.html)**

Save **Play-Frost-and-Fin.html**, then double-click it to open the game in your browser. It contains the complete game, graphics, fonts, and sounds. You do not need Node.js, a terminal, a server, or an internet connection after downloading. If you downloaded the whole repository, just open the same file in its top folder. Keep this file in the same location to retain its browser save, or use Settings → Export save for a portable backup.

The download is published automatically after the **Launch Frost & Fin** build and launch checks succeed. Each release points to its exact source commit. Publishing the download works independently of GitHub Pages settings.

The game runs in a modern browser with WebGL, such as Chrome or Edge. If your browser opens a preview instead of playing, save the file to your computer and open it there.

### Play from a web link

The repository includes automatic GitHub Pages deployment. Once Pages is enabled, the browser launch address is:

**https://brandonsroberts1-oss.github.io/Game/**

For the repository owner, enable it once in **[Settings → Pages](https://github.com/brandonsroberts1-oss/Game/settings/pages)**: under **Build and deployment**, set **Source** to **GitHub Actions**. Then open **[Launch Frost & Fin](https://github.com/brandonsroberts1-oss/Game/actions/workflows/deploy-pages.yml)** and choose **Run workflow**. Every later push to `main` updates the site automatically. The web link becomes available after the deployment succeeds; the downloadable file above works independently of Pages.

Browser saves for the downloaded file and the website are separate. Use Export save / Import save to move progress between them.

## Development

Requires Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

Vite serves the game on port 5173. `npm run build` creates both the `dist/` website and the ready-to-play `Play-Frost-and-Fin.html` in the repository root. `npm run preview` serves the website. No API keys, accounts, remote assets, or backend services are required. The HTML download is generated from the same source and should be committed whenever the game is updated; do not edit the generated file by hand.

If the environment's default npm cache is not writable, add `--cache /tmp/frost-fin-npm-cache` to `npm ci`.

## Play

- Click or tap ground to walk. Click a swimming fish, fishing ring, or pine to gather. Your captain walks over, collects resources, and stacks cargo on their back. Depleted spots replenish after a short rest.
- Click the world to focus it, then use WASD or arrow keys to move and E or Space to interact.
- Visit the fish counter or choose **Sell your catch**. Tuna, salmon, and timber have different values.
- Improve the fishing rod, backpack, market, smokehouse, and dock crew. Tool, sale-price, and storage upgrades change the economy; building upgrades also change the harbor's scenery.
- Earn XP to unlock five further coastal regions. Each unlock adds gathering spots or harbor scenery and improves yields for its resource. The regions currently expand the shared harbor scene, rather than loading separate large maps.
- Claim twelve journal milestones and daily goals. Crew earnings accumulate while you are away, capped at eight hours, and can be collected at the market.

The initial pack includes a few supplies so you can try trading immediately. Pearls are milestone collectibles; there are no purchases or real-money transactions.

## Saves

Progress automatically saves in this browser's local storage under `frost-and-fin:save:v1`. Settings provides JSON export/import and a confirmed reset. Browser clearing, private browsing, or switching devices may lose local progress, so export a backup when needed. There is no cloud synchronization or multiplayer.

Daily goals reset at 00:00 UTC. Offline earnings use the device clock; this local single-player game is not designed to prevent save editing or clock manipulation.

## Validation

```sh
npm test
npm run test:browser
npm run test:launch
npm run build
```

The model tests cover trading, storage limits, progression, duplicate claims, save validation, daily rollover, and offline production. Playwright exercises actual canvas harvesting, desktop and mobile menus, purchases, persistence, and save backups. The launch checks exercise the production website under `/Game/` and the standalone HTML with the browser offline. The browser suite starts Vite if needed. This environment uses `/usr/bin/chromium`; on another machine set `PLAYWRIGHT_CHROMIUM_PATH` to a compatible Chromium executable.

The managed cloud browser blocks `file://` navigation through an administrator policy. The direct file-opening check reports that policy restriction as a skip. A separate test serves only the exact HTML bytes to an isolated browser document with networking disabled and rejects all external asset requests; it checks offline fishing, trading, upgrades, and save persistence. The direct file-opening test also runs on browsers where local files are permitted.

## Project

- `src/game/world.ts` — procedural Three.js scenery, characters, fish, and buildings
- `src/game/IslandScene.tsx` — rendering, animation, picking, navigation, and interaction
- `src/game/model.ts` — persistent state, economy, quests, and progression
- `src/App.tsx` — game HUD, themed menus, and save integration
- `src/Art.tsx` and `src/styles.css` — original illustrations and responsive interface

This is the first playable foundation. The upgrade tracks and daily/offline systems support repeat visits, but weeks of retention will need playtesting and further content. Separate regional maps, production chains, seasonal events, cloud saves, and player accounts are natural next development steps.
