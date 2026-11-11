# Frost & Fin

## [▶ PLAY THE GAME](https://brandonsroberts1-oss.github.io/Game/?v=3)

Open the link on your phone or computer. No installation or terminal commands.

A phone-first 3D harbor tycoon. Walk through a connected winter harbor: chop trees, land whole tuna, haul crab pots, harvest kelp, mine ore, craft products, and serve customers. Build workshops and hire a crew to keep goods moving.

## What happens on the dock

- **Timber:** the captain swings an axe, wood chips fly, the pine falls, logs bounce on the ground, and the logs are collected into a stack on the captain’s back. Stumps remain while trees regrow.
- **Fishing:** the captain casts a line, the bobber dips, a tuna jumps out of the water, and the catch lands in the cargo stack.
- **Cutting:** a textured whole tuna goes onto the cutting table. Successive knife contacts reveal marbled cut faces and separate steaks, which travel along the conveyor and into cargo. Upgrade the table into a yellow powered cutter with saw blades and a piston.
- **Trading:** customers walk in from the harbor approach, join the queue, step forward, inspect goods, pay, and leave carrying purchases. Your captain and porter wait for a real customer before completing a sale.
- **Building:** nineteen upgrade tracks change equipment, machinery, buildings, or dock geometry. Most have five stages; crew has eight specialist hires. Construction appears in the world; buying closes the menu so you can see it happen.
- **Crew:** your first apprentice fells trees, picks up logs, walks to storage, and unloads them. Further hires fish, cut tuna, mine, grow kelp, haul pots, cook, or carry warehouse goods to customers. Active crew deliver goods rather than earning invisible passive cash.
- **New industries:** crabbing docks, kelp beds, an inland quarry, forge, seafood kitchen, boathouse, and warehouse extend the original fishing and timber loop.

Resources and cash are awarded at the end of the corresponding work animation. Processing consumes actual inputs and checks output capacity; it cannot generate steaks without a tuna.

## Phone controls

Drag the joystick to walk. Tap a tree, fish, or work station to walk over and work. The **Pines**, **Fish**, **Cut tuna**, and **Market** buttons also direct the captain to that spot on the same dock. Tap **WORK** to interact nearby. Open **MAP** at the top left for all thirteen workplaces, including the new shore and inland stations. Activity progress stays in the top job board so the center remains clear.

Use **BUILD** for dock upgrades, **CARGO** for carried goods and recipes, and **GOALS** for job rewards. The starting area has no region portals. The camera follows the captain and briefly focuses on newly built equipment.

On a computer, click the world and use WASD or the arrow keys to walk, and E or Space to work.

## Harbor upgrades and production

Use the four BUILD tabs: Yard, Industry, Gear, and Crew. Build crab pots, kelp cultivation beds, quarry equipment, a furnace, seafood kitchen, boathouse, and a larger warehouse alongside the original cutter, sawmill, smokehouse, market, cold store, and dock. Tools, cargo racks, buildings, roofs, cranes, and workshop fittings change as tiers increase.

Production chains:

- 1 whole tuna → 4 steaks at the manual cutting bench; upgraded cutters work faster and improve yields.
- 3 logs → 2 planks after building a sawmill.
- 2 steaks + 1 log → 2 smoked fish after building a smokehouse.
- 3 ore + 1 log → 2 ingots at the forge.
- 1 steak + 1 kelp → 2 seafood meals at the kitchen.
- 2 planks + 1 ingot → 2 tackle kits at the boathouse.

The basic crab pots, natural kelp beds, and ore rocks can be worked immediately. Their upgrades improve yields and add equipment. Warehouse buttons send the captain there to drop off cargo or collect stored goods. Crew processing reserves actual ingredients when work starts and delivers output once; full storage pauses deliveries. At crew tier 5, the porter serves stored goods through the market.

There are twenty-two lifetime jobs and daily haul rewards. Offline crew production is conservative and capped at eight hours; active sales require a customer. There are no real-money purchases.

## Saves and offline play

The game automatically saves in this browser. **Game settings → Export save** creates a backup; Import save restores it. Older version 1 and 2 saves migrate to version 3 while retaining cash, goods, and purchased upgrades. Oversized old cargo can be sold before gathering more.

**[Download the offline game](https://github.com/brandonsroberts1-oss/Game/releases/latest/download/Play-Frost-and-Fin.html)**, then open the downloaded HTML file in your browser. Everything needed to play is embedded in that file. A copy is also included at the top of this repository.

The website and downloaded file have separate browser storage. Export/import moves progress between them. Clearing browser data or moving the offline file may affect its local save. Daily goals reset at 00:00 UTC. Offline production uses the device clock; there is no account or server synchronization.

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

The model tests cover processing, capacity, upgrades, payments, migration, quests, daily resets, worker reservations, storage deliveries, and offline production. Browser checks exercise the real animated work cycle, deferred inventory awards, actual rendered-object movement, starter construction, joystick/camera movement, phone layouts, and save backups. Launch checks cover production hosting under `/Game/` and offline execution of the exact standalone artifact without asset requests.

The managed cloud browser blocks direct `file://` navigation by administrator policy. That check reports an explicit skip here. A separate offline test supplies only the HTML document to an isolated browser and rejects all other requests. Direct file opening is also tested by GitHub Actions where it is permitted.

The local tests use `/usr/bin/chromium`. Set `PLAYWRIGHT_CHROMIUM_PATH` for another installed browser. CI uses Playwright’s installed Chromium. `FROST_RECORD_VIDEO=1` enables a phone gameplay recording when Playwright’s FFmpeg binary is available.

## Source

- `src/game/world.ts`: connected scenery, people, trees, textured fish, tools, and visible upgrade models.
- `src/game/npc.ts`: crew work, deliveries, customer queues, physical stock sales, and actor movement.
- `src/game/artAssets.ts`, `src/assets/`: original ChatGPT-generated material and building atlases, loaded locally.
- `src/HarborPanels.tsx`: workplace navigation, warehouse supplies, and crew status menus.
- `src/game/IslandScene.tsx`: navigation, follow camera, staged work animations, and world interaction.
- `src/game/model.ts`: versioned economy, crafting, upgrades, jobs, and save migration.
- `src/App.tsx`, `src/Art.tsx`, `src/styles.css`: touch controls, themed game menus, illustrations, and local saving.

The video is a visual reference only; its footage and assets are not included. The tuna skin, marbled cut surfaces, timber, and metal use original ChatGPT-generated textures; building menus use a generated illustration atlas. These images are mapped onto animated 3D geometry and bundled into both launch formats. The WebP assets preserve the generated pixels losslessly. This remains a local single-player game; weeks-long retention and balancing require further playtesting.
