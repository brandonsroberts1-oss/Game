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
  WORKERS,
  stockCount,
  stockCapacity,
  reservedStockCount,
  workerJobSpec,
  canWorkerStart,
  resourceSaleValue,
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

test("a new harbor starts empty with nineteen upgrade tracks and a free working forester", () => {
  const state = createInitialState();
  assert.equal(state.version, 3);
  assert.equal(state.coins, 120);
  assert.equal(inventoryCount(state), 0);
  assert.equal(capacity(state), 24);
  assert.equal(UPGRADES.length, 19);
  assert.ok(
    UPGRADES.every(
      (upgrade) => upgrade.maxLevel === (upgrade.id === "crew" ? 8 : 5),
    ),
  );
  assert.equal(state.upgrades.crew, 1);
  assert.equal(stockCount(state), 0);
  assert.deepEqual(state.workerJobs, {});
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

test("all nineteen tracks purchase their documented stages and enforce maximum levels", () => {
  let state = { ...createInitialState(), coins: 1_000_000 };
  for (const upgrade of UPGRADES) {
    for (
      let stage = state.upgrades[upgrade.id];
      stage < upgrade.maxLevel;
      stage++
    ) {
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
  assert.equal(questProgress(buildQuest, built(initial, { axe: 5 })), 2);
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
  assert.equal(migrated.version, 3);
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
  for (const raw of ["{", "null", "[]", '{"version":99}', "{}"])
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

test("new raw activities and three additional production chains are real, gated, and profitable", () => {
  const initial = createInitialState();
  for (const resource of ["crab", "kelp", "ore"] as const) {
    const gathered = reduceGame(initial, { type: "harvest", resource });
    assert.ok(gathered.inventory[resource] > 0);
    assert.equal(gathered.gathered[resource], gathered.inventory[resource]);
  }
  const ingredients = pack(initial, {
    ore: 3,
    wood: 1,
    steak: 1,
    kelp: 1,
    plank: 2,
    ingot: 1,
  });
  for (const recipe of ["ingots", "meals", "tackle"] as const)
    assert.equal(processBlockReason(ingredients, recipe), "locked");
  const unlocked = built(ingredients, { forge: 1, kitchen: 1, boatyard: 1 });
  const iron = reduceGame(unlocked, { type: "process", recipe: "ingots" });
  assert.equal(iron.inventory.ore, 0);
  assert.equal(iron.inventory.wood, 0);
  assert.equal(iron.inventory.ingot, 3);
  const meals = reduceGame(iron, { type: "process", recipe: "meals" });
  assert.equal(meals.inventory.meal, 2);
  assert.equal(meals.inventory.steak, 0);
  assert.equal(meals.inventory.kelp, 0);
  const tackle = reduceGame(meals, { type: "process", recipe: "tackle" });
  assert.equal(tackle.inventory.tackle, 2);
  assert.equal(tackle.inventory.plank, 0);
  assert.equal(tackle.inventory.ingot, 2);
  assert.equal(
    reduceGame(tackle, { type: "process", recipe: "tackle" }),
    tackle,
  );
});

test("worker deliveries require a real reserved job, its finished timestamp, and cannot be duplicated", () => {
  const now = Date.parse("2026-11-09T15:00:00Z"),
    initial = createInitialState(now);
  assert.equal(WORKERS.length, 8);
  assert.equal(workerJobSpec(initial, "fisher"), null);
  assert.equal(workerJobSpec(initial, "porter"), null);
  assert.equal(
    reduceGame(initial, {
      type: "workerComplete",
      role: "forester",
      now: now + 10_000,
    }),
    initial,
  );
  const start = reduceGame(initial, {
    type: "workerStart",
    role: "forester",
    now,
  });
  assert.ok(start.workerJobs.forester);
  assert.equal(stockCount(start), 0);
  assert.equal(reservedStockCount(start), 6);
  assert.equal(
    reduceGame(start, { type: "workerStart", role: "forester", now }),
    start,
  );
  assert.equal(
    reduceGame(start, {
      type: "workerComplete",
      role: "forester",
      now: now + 4249,
    }),
    start,
  );
  const finish = reduceGame(start, {
    type: "workerComplete",
    role: "forester",
    now: now + 4250,
  });
  assert.equal(finish.stock.wood, 6);
  assert.equal(inventoryCount(finish), 0);
  assert.equal(finish.workerJobs.forester, undefined);
  assert.equal(finish.coins, initial.coins);
  assert.equal(
    finish.gathered.wood,
    0,
    "the apprentice does not complete the captain tutorial",
  );
  assert.equal(
    reduceGame(finish, {
      type: "workerComplete",
      role: "forester",
      now: now + 20_000,
    }),
    finish,
  );
});

test("processing workers reserve actual warehouse inputs and deliver their outputs only once", () => {
  const now = Date.now(),
    initial = built(createInitialState(now), { crew: 3, cutter: 1 });
  assert.equal(canWorkerStart(initial, "cutter"), false);
  const supplied = { ...initial, stock: { ...initial.stock, fish: 1 } };
  const started = reduceGame(supplied, {
    type: "workerStart",
    role: "cutter",
    now,
  });
  assert.equal(started.stock.fish, 0);
  assert.equal(started.stock.steak, 0);
  assert.equal(started.workerJobs.cutter?.outputs.steak, 4);
  const finish = reduceGame(started, {
    type: "workerComplete",
    role: "cutter",
    now: now + 10_000,
  });
  assert.equal(finish.stock.steak, 4);
  assert.equal(finish.stock.fish, 0);
  assert.equal(finish.processed.steaks, 0);
  assert.equal(
    reduceGame(finish, {
      type: "workerStart",
      role: "cutter",
      now: now + 10_000,
    }),
    finish,
  );
  const noMachine = {
    ...supplied,
    upgrades: { ...supplied.upgrades, cutter: 0 },
  };
  assert.equal(canWorkerStart(noMachine, "cutter"), false);
});

test("worker output reservations prevent overfilling and unfinished deliveries wait safely for storage", () => {
  const now = Date.now(),
    initial = createInitialState(now);
  const full = { ...initial, stock: { ...initial.stock, wood: 149 } };
  assert.equal(stockCapacity(full), 150);
  assert.equal(canWorkerStart(full, "forester"), false);
  const started = reduceGame(initial, {
    type: "workerStart",
    role: "forester",
    now,
  });
  const crowded = { ...started, stock: { ...started.stock, wood: 149 } };
  assert.equal(
    reduceGame(crowded, {
      type: "workerComplete",
      role: "forester",
      now: now + 10_000,
    }),
    crowded,
  );
  const freed = reduceGame(crowded, { type: "takeStock" });
  const delivered = reduceGame(freed, {
    type: "workerComplete",
    role: "forester",
    now: now + 10_000,
  });
  assert.equal(delivered.stock.wood, 131);
  assert.equal(inventoryCount(delivered), 24);
  assert.equal(delivered.workerJobs.forester, undefined);
  const almost = {
    ...initial,
    stock: { ...initial.stock, wood: 140 },
    inventory: { ...initial.inventory, fish: 20 },
  };
  const reserved = reduceGame(almost, {
    type: "workerStart",
    role: "forester",
    now,
  });
  const deposit = reduceGame(reserved, {
    type: "depositStock",
    resource: "fish",
  });
  assert.equal(deposit.stock.fish, 4);
  assert.equal(deposit.inventory.fish, 16);
  assert.equal(stockCount(deposit) + reservedStockCount(deposit), 150);
});

test("warehouse transfers preserve goods, prioritize crafted cargo, and respect both capacities", () => {
  const initial = createInitialState();
  const supplied = {
    ...initial,
    stock: { ...initial.stock, wood: 100, meal: 10, tackle: 4 },
  };
  const taken = reduceGame(supplied, { type: "takeStock" });
  assert.equal(taken.inventory.tackle, 4);
  assert.equal(taken.inventory.meal, 10);
  assert.equal(taken.inventory.wood, 10);
  assert.equal(inventoryCount(taken), 24);
  assert.equal(stockCount(taken) + inventoryCount(taken), stockCount(supplied));
  assert.equal(reduceGame(taken, { type: "takeStock" }), taken);
  const restored = reduceGame(taken, { type: "depositStock" });
  assert.deepEqual(restored.stock, supplied.stock);
  assert.equal(inventoryCount(restored), 0);
  const onlyWood = reduceGame(supplied, {
    type: "takeStock",
    resource: "wood",
  });
  assert.equal(onlyWood.inventory.wood, 24);
  assert.equal(onlyWood.stock.meal, 10);
  assert.equal(
    reduceGame(supplied, { type: "depositStock", quantity: -1 }),
    supplied,
  );
});

test("customer stock sales require available goods and pay their exact enhanced value once", () => {
  const initial = built(createInitialState(), {
    market: 2,
    dock: 1,
    freezer: 1,
  });
  assert.equal(
    reduceGame(initial, { type: "sellStock", resource: "crab", quantity: 1 }),
    initial,
  );
  const supplied = { ...initial, stock: { ...initial.stock, crab: 2 } };
  const value = resourceSaleValue(supplied, "crab", 2),
    sold = reduceGame(supplied, {
      type: "sellStock",
      resource: "crab",
      quantity: 2,
    });
  assert.equal(sold.stock.crab, 0);
  assert.equal(sold.coins, supplied.coins + value);
  assert.equal(sold.trades, 1);
  assert.equal(sold.earned, value);
  assert.equal(sold.daily.earned, value);
  assert.equal(
    reduceGame(sold, { type: "sellStock", resource: "crab", quantity: 2 }),
    sold,
  );
  for (const quantity of [0, -1, NaN, Infinity, 0.5])
    assert.equal(
      reduceGame(supplied, { type: "sellStock", resource: "crab", quantity }),
      supplied,
    );
});

test("active ticks never pay phantom wages or generate worker goods", () => {
  const now = Date.now(),
    initial = built(createInitialState(now), { crew: 8, dock: 5 });
  const ticked = reduceGame(initial, {
    type: "tick",
    now: now + 24 * 60 * 60 * 1000,
  });
  assert.equal(ticked.coins, initial.coins);
  assert.equal(ticked.workersStored, 0);
  assert.equal(stockCount(ticked), 0);
  const legacy = { ...initial, workersStored: 25 };
  const collected = reduceGame(legacy, { type: "collectWorkers" });
  assert.equal(collected.coins, legacy.coins + 25);
  assert.equal(reduceGame(collected, { type: "collectWorkers" }), collected);
});

test("offline work waits a minute, fills bounded stock, caps at eight hours, and is not replayed on reload", () => {
  const now = Date.parse("2026-11-09T00:00:00Z"),
    initial = createInitialState(now);
  assert.equal(stockCount(loadGame(serializeGame(initial), now + 59_999)), 0);
  const oneMinute = loadGame(serializeGame(initial), now + 60_000);
  assert.equal(oneMinute.stock.wood, 6);
  assert.equal(oneMinute.coins, 120);
  assert.equal(stockCount(loadGame(serializeGame(oneMinute), now + 60_000)), 6);
  const rich = built(initial, {
    crew: 8,
    cutter: 1,
    quarry: 1,
    kelpfarm: 1,
    crabpots: 1,
    kitchen: 1,
    warehouse: 5,
    dock: 5,
  });
  const eight = loadGame(serializeGame(rich), now + 8 * 60 * 60 * 1000),
    day = loadGame(serializeGame(rich), now + 24 * 60 * 60 * 1000);
  assert.equal(eight.coins, day.coins);
  assert.deepEqual(eight.stock, day.stock);
  assert.ok(eight.coins > rich.coins);
  assert.ok(stockCount(eight) <= stockCapacity(eight));
  assert.equal(eight.workersStored, 0);
  assert.equal(day.lastSaved, now + 24 * 60 * 60 * 1000);
  assert.deepEqual(
    loadGame(serializeGame(eight), now + 8 * 60 * 60 * 1000),
    eight,
  );
});

test("reserved jobs survive reload, deliver once offline, and do not consume their inputs twice", () => {
  const now = Date.now(),
    initial = built(createInitialState(now), { crew: 3, cutter: 1 });
  const supplied = { ...initial, stock: { ...initial.stock, fish: 1 } };
  const started = reduceGame(supplied, {
    type: "workerStart",
    role: "cutter",
    now,
  });
  const early = loadGame(serializeGame(started), now + 1000);
  assert.equal(early.stock.fish, 0);
  assert.equal(early.stock.steak, 0);
  assert.ok(early.workerJobs.cutter);
  const done = loadGame(serializeGame(early), now + 10_000);
  assert.equal(done.stock.steak, 4);
  assert.equal(done.stock.fish, 0);
  assert.equal(done.workerJobs.cutter, undefined);
  const twice = loadGame(serializeGame(done), now + 10_000);
  assert.deepEqual(twice.stock, done.stock);
});

test("v2 migration preserves existing goods and cash while supplying a free apprentice and new stock schema", () => {
  const now = Date.now(),
    old = {
      ...createInitialState(now),
      version: 2,
      coins: 4321,
      inventory: {
        wood: 40,
        fish: 2,
        salmon: 1,
        steak: 4,
        plank: 3,
        smoked: 2,
      },
      upgrades: {
        axe: 2,
        rod: 3,
        backpack: 2,
        cutter: 1,
        sawmill: 1,
        market: 2,
        dock: 1,
        crew: 0,
        smokehouse: 1,
        freezer: 1,
        boots: 2,
        nets: 2,
      },
      processed: { steaks: 12, planks: 4, smoked: 2 },
    };
  const migrated = loadGame(JSON.stringify(old), now);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.coins, 4321);
  assert.equal(migrated.upgrades.crew, 1);
  assert.equal(migrated.upgrades.cutter, 1);
  assert.equal(migrated.inventory.wood, 40);
  assert.equal(migrated.inventory.steak, 4);
  assert.equal(migrated.inventory.ore, 0);
  assert.equal(stockCount(migrated), 0);
  assert.deepEqual(migrated.workerJobs, {});
});
