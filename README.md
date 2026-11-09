# Frost & Fin

## [▶ PLAY THE GAME](https://brandonsroberts1-oss.github.io/Game/?v=2)

Open the link on your phone or computer. No installation or terminal commands.

A phone-first 3D fishing and timber tycoon. The starting dock is the game: chop trees, land whole tuna, cut steaks, serve customers, and build the machinery that makes each trip more valuable.

## What happens on the dock

- **Timber:** the captain swings an axe, wood chips fly, the pine falls, logs bounce on the ground, and the logs are collected into a stack on the captain’s back. Stumps remain while trees regrow.
- **Fishing:** the captain casts a line, the bobber dips, a tuna jumps out of the water, and the catch lands in the cargo stack.
- **Cutting:** a whole tuna goes onto the cutting table. A cleaver cuts it into round tuna steaks. The steaks travel off the bench and are collected. Upgrade the table into a yellow powered cutter with saw blades, a piston, and a conveyor.
- **Trading:** carried goods move onto the counter, a customer is served, green cash stacks appear, and payment is collected.
- **Building:** twelve upgrade tracks with five stages each change equipment, machinery, buildings, or dock geometry. Construction is shown on the dock; buying closes the menu so you can see it happen.

Resources and cash are awarded at the end of the corresponding work animation. Processing consumes actual inputs and checks output capacity; it cannot generate steaks without a tuna.

## Phone controls

Drag the joystick to walk. Tap a tree, fish, or work station to walk over and work. The **Pines**, **Fish**, **Cut tuna**, and **Market** buttons also direct the captain to that spot on the same dock. Tap **WORK** to interact nearby.

Use **BUILD** for dock upgrades, **CARGO** for carried goods and recipes, and **GOALS** for job rewards. The starting area has no region portals. The camera follows the captain and briefly focuses on newly built equipment.

On a computer, click the world and use WASD or the arrow keys to walk, and E or Space to work.

## Starting-area upgrades

| Yard                    | Gear              | Crew           |
| ----------------------- | ----------------- | -------------- |
| Powered fish cutter     | Forester’s axe    | Five dockhands |
| Sawmill                 | Fishing rod       |                |
| Market counter and roof | Larger cargo pack |                |
| Trading pier            | Winter boots      |                |
| Smokehouse              | River nets        |                |
| Cold storage            |                   |                |

Production chains:

- 1 whole tuna → 4 steaks at the manual cutting bench; upgraded cutters work faster and improve yields.
- 3 logs → 2 planks after building a sawmill.
- 2 steaks + 1 log → 2 smoked fish after building a smokehouse.

There are sixteen lifetime jobs, daily haul rewards, and crew earnings capped at eight hours offline. There are no real-money purchases.

## Saves and offline play

The game automatically saves in this browser. **Game settings → Export save** creates a backup; Import save restores it. Older version 1 saves migrate to version 2 while retaining cash and raw goods. Oversized old cargo can be sold before gathering more.

**[Download the offline game](https://github.com/brandonsroberts1-oss/Game/releases/latest/download/Play-Frost-and-Fin.html)**, then open the downloaded HTML file in your browser. Everything needed to play is embedded in that file. A copy is also included at the top of this repository.

The website and downloaded file have separate browser storage. Export/import moves progress between them. Clearing browser data or moving the offline file may affect its local save. Daily goals reset at 00:00 UTC. Offline earnings use the device clock; there is no account or server synchronization.

## Development

Node.js 22 or newer and npm are required for development only.

```sh
npm ci
npm run dev
```

If this environment's default npm cache is not writable, use `npm ci --cache /tmp/frost-fin-npm-cache`.

`npm run build` creates the `dist/` website and refreshes the self-contained `Play-Frost-and-Fin.html`. Commit the refreshed HTML whenever the game changes. Each push to `main` runs the build and launch checks, publishes a versioned downloadable game, and updates GitHub Pages.

```sh
npm test
npm run test:browser
npm run test:launch
```

The model tests cover processing, capacity, upgrades, payments, migration, quests, daily resets, and offline earnings. Browser checks exercise the real animated work cycle, deferred inventory awards, actual rendered-object movement, starter construction, joystick/camera movement, phone layouts, and save backups. Launch checks cover production hosting under `/Game/` and offline execution of the exact standalone artifact without asset requests.

The managed cloud browser blocks direct `file://` navigation by administrator policy. That check reports an explicit skip here. A separate offline test supplies only the HTML document to an isolated browser and rejects all other requests. Direct file opening is also tested by GitHub Actions where it is permitted.

The local tests use `/usr/bin/chromium`. Set `PLAYWRIGHT_CHROMIUM_PATH` for another installed browser. CI uses Playwright’s installed Chromium. `FROST_RECORD_VIDEO=1` enables a phone gameplay recording when Playwright’s FFmpeg binary is available.

## Source

- `src/game/world.ts`: original procedural scenery, people, trees, fish, tools, and upgrade models.
- `src/game/IslandScene.tsx`: navigation, follow camera, staged work animations, and world interaction.
- `src/game/model.ts`: versioned economy, crafting, upgrades, jobs, and save migration.
- `src/App.tsx`, `src/Art.tsx`, `src/styles.css`: touch controls, themed game menus, illustrations, and local saving.

The video is a visual reference only; its footage and assets are not included. All models and illustrations are created in code. This remains a local single-player game; weeks-long retention and balancing require further playtesting.
