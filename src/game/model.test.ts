import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  loadGame,
  serializeGame,
  reduceGame,
  capacity,
  inventoryCount,
  sellValue,
  level,
  xpProgress,
  upgradeCost,
  gatherYield,
  recipeDuration,
  recipeYield,
  canProcess,
  processBlockReason,
  workerRate,
  questProgress,
  UPGRADES,
  QUESTS,
  DAILY_GOAL,
  RESOURCE_PRICES,
  RESOURCES,
} from "./model.ts";
import type { GameState, Resource } from "./model.ts";

function pack(
  state: GameState,
  goods: Partial<Record<Resource, number>>,
): GameState {
  return { ...state, inventory: { ...state.inventory, ...goods } };
}

function built(
  state: GameState,
  upgrades: Partial<GameState["upgrades"]>,
): GameState {
  return { ...state, upgrades: { ...state.upgrades, ...upgrades } };
}

test("a new harbor starts empty with twelve five-stage starter upgrade tracks", () => {
  const state = createInitialState();
  assert.equal(state.version, 2);
  assert.equal(state.coins, 120);
  assert.equal(inventoryCount(state), 0);
  assert.equal(capacity(state), 24);
  assert.equal(UPGRADES.length, 12);
  assert.ok(UPGRADES.every((upgrade) => upgrade.maxLevel === 5));
  assert.ok(
    UPGRADES.filter((upgrade) => upgradeCost(upgrade.id, state) <= state.coins)
      .length >= 6,
  );
});

test("completed gathers use separate axe and rod yields and never produce crafted goods", () => {
  let state = createInitialState();
  assert.equal(gatherYield(state, "wood"), 6);
  assert.equal(gatherYield(state, "fish"), 1);
  state = reduceGame(state, { type: "harvest", resource: "wood" });
  assert.equal(state.inventory.wood, 6);
  assert.equal(state.gathered.wood, 6);
  assert.equal(state.harvests, 6);
  assert.equal(state.daily.harvests, 6);
  assert.equal(
    reduceGame(state, { type: "harvest", resource: "steak" }),
    state,
  );
  const improved = built(state, { axe: 2, rod: 3, nets: 4 });
  assert.equal(gatherYield(improved, "wood"), 10);
  assert.equal(gatherYield(improved, "fish"), 4);
  assert.equal(gatherYield(improved, "salmon"), 1);
});

test("gathering uses only remaining backpack space and gives no rewards when full", () => {
  let state = pack(createInitialState(), { wood: 23 });
  state = reduceGame(state, { type: "harvest", resource: "wood" });
  assert.equal(inventoryCount(state), capacity(state));
  assert.equal(state.inventory.wood, 24);
  assert.equal(state.harvests, 1);
  assert.equal(reduceGame(state, { type: "harvest", resource: "fish" }), state);
});

test("one fish is consumed atomically into four steaks, with no free duplicate processing", () => {
  const initial = pack(createInitialState(), { fish: 1 });
  assert.equal(canProcess(initial, "steaks"), true);
  assert.equal(recipeDuration(initial, "steaks"), 4);
  const state = reduceGame(initial, { type: "process", recipe: "steaks" });
  assert.equal(state.inventory.fish, 0);
  assert.equal(state.inventory.steak, 4);
  assert.equal(state.processed.steaks, 4);
  assert.equal(state.harvests, 0);
  assert.equal(initial.inventory.fish, 1, "input state is immutable");
  assert.equal(reduceGame(state, { type: "process", recipe: "steaks" }), state);
  assert.equal(processBlockReason(state, "steaks"), "inputs");
});

test("processing checks net output capacity before consuming any inputs", () => {
  const crowded = pack(createInitialState(), { wood: 21, fish: 1 });
  assert.equal(inventoryCount(crowded), 22);
  assert.equal(processBlockReason(crowded, "steaks"), "capacity");
  assert.equal(
    reduceGame(crowded, { type: "process", recipe: "steaks" }),
    crowded,
  );
  const exactFit = pack(createInitialState(), { wood: 20, fish: 1 });
  const processed = reduceGame(exactFit, { type: "process", recipe: "steaks" });
  assert.equal(inventoryCount(processed), capacity(processed));
  assert.equal(processed.inventory.wood, 20);
  assert.equal(processed.inventory.fish, 0);
  assert.equal(processed.inventory.steak, 4);
});

test("sawmill and smokehouse recipes are locked until built and require every ingredient", () => {
  const initial = pack(createInitialState(), { wood: 6, steak: 2 });
  assert.equal(processBlockReason(initial, "planks"), "locked");
  assert.equal(processBlockReason(initial, "smoked"), "locked");
  assert.equal(
    reduceGame(initial, { type: "process", recipe: "planks" }),
    initial,
  );
  const unlocked = built(initial, { sawmill: 1, smokehouse: 1 });
  const planks = reduceGame(unlocked, { type: "process", recipe: "planks" });
  assert.equal(planks.inventory.wood, 3);
  assert.equal(planks.inventory.plank, 2);
  const smoked = reduceGame(planks, { type: "process", recipe: "smoked" });
  assert.equal(smoked.inventory.wood, 2);
  assert.equal(smoked.inventory.steak, 0);
  assert.equal(smoked.inventory.smoked, 2);
  assert.equal(
    reduceGame(smoked, { type: "process", recipe: "smoked" }),
    smoked,
  );
  const missingWood = pack(unlocked, { wood: 0 });
  assert.equal(processBlockReason(missingWood, "smoked"), "inputs");
  assert.equal(
    reduceGame(missingWood, { type: "process", recipe: "smoked" }),
    missingWood,
  );
});

test("processing upgrades improve real duration and output rather than only labels", () => {
  const initial = createInitialState();
  const upgraded = built(initial, { cutter: 4, sawmill: 3, smokehouse: 3 });
  assert.equal(recipeYield(upgraded, "steaks"), 6);
  assert.equal(recipeYield(upgraded, "planks"), 3);
  assert.equal(recipeYield(upgraded, "smoked"), 3);
  for (const recipe of ["steaks", "planks", "smoked"] as const) {
    assert.ok(
      recipeDuration(upgraded, recipe) < recipeDuration(initial, recipe),
    );
  }
  const processed = reduceGame(pack(upgraded, { fish: 1 }), {
    type: "process",
    recipe: "steaks",
  });
  assert.equal(processed.inventory.steak, 6);
});

test("selling empty packs gives no coins and selling goods pays exactly once", () => {
  const empty = createInitialState();
  assert.equal(reduceGame(empty, { type: "sell" }), empty);
  const initial = pack(empty, {
    wood: 6,
    fish: 1,
    salmon: 1,
    steak: 4,
    plank: 2,
    smoked: 2,
  });
  const value = RESOURCES.reduce(
    (sum, resource) =>
      sum + initial.inventory[resource] * RESOURCE_PRICES[resource],
    0,
  );
  assert.equal(sellValue(initial), value);
  const state = reduceGame(initial, { type: "sell" });
  assert.equal(state.coins, initial.coins + value);
  assert.equal(state.earned, value);
  assert.equal(state.trades, 1);
  assert.equal(inventoryCount(state), 0);
  assert.equal(reduceGame(state, { type: "sell" }), state);
});

test("all twelve starter tracks can purchase every stage, enforce cost, and stop at five", () => {
  let state = { ...createInitialState(), coins: 1_000_000 };
  for (const upgrade of UPGRADES) {
    for (let stage = 0; stage < 5; stage++) {
      const cost = upgradeCost(upgrade.id, state);
      const before = state.coins;
      state = reduceGame(state, { type: "upgrade", id: upgrade.id });
      assert.equal(state.upgrades[upgrade.id], stage + 1);
      assert.equal(state.coins, before - cost);
      assert.ok(upgradeCost(upgrade.id, state) > cost);
    }
    assert.equal(reduceGame(state, { type: "upgrade", id: upgrade.id }), state);
  }
  assert.equal(capacity(state), 84);
  const poor = {
    ...state,
    coins: 0,
    upgrades: { ...state.upgrades, market: 0 },
  };
  assert.equal(reduceGame(poor, { type: "upgrade", id: "market" }), poor);
});

test("market, dock, freezer and smokehouse bonuses affect the goods they describe", () => {
  const initial = pack(createInitialState(), { fish: 2, salmon: 1 });
  assert.ok(sellValue(built(initial, { freezer: 2 })) > sellValue(initial));
  assert.ok(sellValue(built(initial, { market: 1 })) > sellValue(initial));
  assert.ok(sellValue(built(initial, { dock: 1 })) > sellValue(initial));
  const timber = pack(createInitialState(), { wood: 4 });
  assert.equal(sellValue(built(timber, { freezer: 5 })), sellValue(timber));
  const smoked = pack(createInitialState(), { smoked: 4 });
  assert.ok(sellValue(built(smoked, { smokehouse: 5 })) > sellValue(smoked));
});

test("crafted-goods and distinct starter-build quests record real progress and rewards pay once", () => {
  const initial = createInitialState();
  const craftedQuest = QUESTS.find((quest) => quest.id === "first-cut")!;
  assert.equal(questProgress(craftedQuest, initial), 0);
  assert.equal(
    reduceGame(initial, { type: "claimQuest", id: craftedQuest.id }),
    initial,
  );
  const crafted = reduceGame(pack(initial, { fish: 1 }), {
    type: "process",
    recipe: "steaks",
  });
  const claimed = reduceGame(crafted, {
    type: "claimQuest",
    id: craftedQuest.id,
  });
  assert.equal(claimed.coins, crafted.coins + craftedQuest.reward);
  assert.equal(claimed.gems, crafted.gems + 2);
  assert.equal(
    reduceGame(claimed, { type: "claimQuest", id: craftedQuest.id }),
    claimed,
  );
  const buildQuest = QUESTS.find((quest) => quest.id === "better-together")!;
  assert.equal(questProgress(buildQuest, built(initial, { axe: 5 })), 1);
  assert.equal(
    questProgress(buildQuest, built(initial, { axe: 1, rod: 1, market: 1 })),
    3,
  );
});

test("v1 migration preserves money, raw goods, upgrades, settings and claimed rewards", () => {
  const now = Date.now();
  const old = {
    version: 1,
    coins: 5432,
    gems: 27,
    xp: 1100,
    inventory: { wood: 65, fish: 15, salmon: 10 },
    upgrades: { rod: 7, backpack: 5, market: 4, workshop: 2, crew: 3 },
    unlockedRegions: ["harbor", "pinewood", "salmonrun"],
    harvests: 432,
    earned: 1000,
    trades: 9,
    questsClaimed: ["first-steps", "new-horizons"],
    lastSaved: now,
    sound: false,
    playerName: "Old Captain",
    daily: {
      date: new Date(now).toISOString().slice(0, 10),
      harvests: 8,
      earned: 55,
      claimed: false,
    },
    workersStored: 7,
  };
  const migrated = loadGame(JSON.stringify(old), now);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.coins, old.coins);
  assert.equal(migrated.gems, old.gems);
  assert.equal(migrated.xp, old.xp);
  assert.deepEqual(migrated.inventory, {
    ...createInitialState().inventory,
    ...old.inventory,
  });
  assert.equal(migrated.upgrades.rod, 5);
  assert.equal(migrated.upgrades.backpack, 5);
  assert.equal(migrated.upgrades.smokehouse, 2);
  assert.equal(migrated.upgrades.crew, 3);
  assert.equal(migrated.sound, false);
  assert.equal(migrated.playerName, old.playerName);
  assert.deepEqual(migrated.questsClaimed, old.questsClaimed);
  assert.ok(inventoryCount(migrated) > capacity(migrated));
  assert.equal(
    reduceGame(migrated, { type: "harvest", resource: "wood" }),
    migrated,
  );
  assert.deepEqual(
    loadGame(serializeGame(migrated), now).inventory,
    migrated.inventory,
  );
  assert.equal(inventoryCount(reduceGame(migrated, { type: "sell" })), 0);
});

test("worker income is absent without crew, capped at eight hours, and collectible only once", () => {
  const now = Date.now();
  const initial = createInitialState(now);
  assert.equal(
    reduceGame(initial, { type: "tick", now: now + 24 * 60 * 60 * 1000 })
      .workersStored,
    0,
  );
  const crew = built(initial, { crew: 2, dock: 3 });
  assert.equal(workerRate(crew), 12);
  const later = reduceGame(crew, {
    type: "tick",
    now: now + 24 * 60 * 60 * 1000,
  });
  assert.equal(later.workersStored, 12 * 60 * 8);
  const collected = reduceGame(later, { type: "collectWorkers" });
  assert.equal(collected.coins, crew.coins + later.workersStored);
  assert.equal(reduceGame(collected, { type: "collectWorkers" }), collected);
  assert.equal(
    reduceGame(collected, { type: "tick", now: now + 24 * 60 * 60 * 1000 })
      .workersStored,
    0,
  );
});

test("frequent ticks preserve fractional worker intervals, and offline loading applies earnings", () => {
  const now = Date.now();
  let state = built(createInitialState(now), { crew: 1, dock: 4 });
  for (let second = 1; second <= 60; second++)
    state = reduceGame(state, { type: "tick", now: now + second * 1000 });
  assert.equal(state.workersStored, 7);
  const loaded = loadGame(serializeGame(state), now + 60 * 60 * 1000);
  assert.equal(loaded.workersStored, 420);
});

test("daily goals enforce both requirements, pay once, and reset at UTC midnight", () => {
  const now = Date.parse("2026-11-06T23:59:00Z");
  const initial = createInitialState(now);
  assert.equal(reduceGame(initial, { type: "claimDaily" }), initial);
  const ready = {
    ...initial,
    daily: {
      ...initial.daily,
      harvests: DAILY_GOAL.harvests,
      earned: DAILY_GOAL.earned,
    },
  };
  const claimed = reduceGame(ready, { type: "claimDaily" });
  assert.equal(claimed.coins, initial.coins + DAILY_GOAL.reward);
  assert.equal(reduceGame(claimed, { type: "claimDaily" }), claimed);
  const next = reduceGame(claimed, { type: "tick", now: now + 120_000 });
  assert.deepEqual(next.daily, {
    date: "2026-11-07",
    harvests: 0,
    earned: 0,
    claimed: false,
  });
});

test("versioned saves round-trip and malformed values, resource ids and upgrade levels are bounded", () => {
  const now = Date.now();
  const initial = createInitialState(now);
  assert.deepEqual(loadGame(serializeGame(initial), now), initial);
  for (const raw of ["{", "null", "[]", '{"version":3}', "{}"])
    assert.deepEqual(loadGame(raw, now), initial);
  const dirty = {
    ...initial,
    coins: -5,
    gems: "bad",
    upgrades: { axe: 999, backpack: -10 },
    inventory: { wood: 999, fish: -2, salmon: 999 },
    questsClaimed: ["fake", "first-steps", "first-steps"],
    lastSaved: now + 1e9,
  };
  const cleaned = loadGame(JSON.stringify(dirty), now);
  assert.equal(cleaned.coins, 0);
  assert.equal(cleaned.gems, 0);
  assert.equal(cleaned.upgrades.axe, 5);
  assert.equal(cleaned.upgrades.backpack, 0);
  assert.ok(inventoryCount(cleaned) <= 540);
  assert.equal(cleaned.inventory.fish, 0);
  assert.deepEqual(cleaned.questsClaimed, ["first-steps"]);
  assert.equal(cleaned.lastSaved, now);
  assert.equal(reduceGame(initial, { type: "tick", now: Infinity }), initial);
  assert.equal(reduceGame(initial, { type: "tick", now: -1 }), initial);
});

test("XP thresholds agree with the level display, and completed max-level XP stays bounded", () => {
  const initial = createInitialState();
  assert.equal(level(initial), 1);
  assert.deepEqual(xpProgress(initial), { current: 0, needed: 80 });
  assert.equal(level({ ...initial, xp: 205 }), 3);
  assert.deepEqual(xpProgress({ ...initial, xp: 205 }), {
    current: 5,
    needed: 160,
  });
  const maxed = xpProgress({ ...initial, xp: 5_000_000 });
  assert.ok(maxed.current <= maxed.needed);
});

test("reset is deterministic and reuses the current clock anchor", () => {
  const now = Date.parse("2026-11-06T15:00:00Z");
  const initial = createInitialState(now);
  const changed = reduceGame(initial, { type: "harvest", resource: "wood" });
  assert.deepEqual(reduceGame(changed, { type: "reset" }), initial);
});
