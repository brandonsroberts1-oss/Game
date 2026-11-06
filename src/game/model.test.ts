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
  QUESTS,
  DAILY_GOAL,
  REGIONS,
} from "./model.ts";

test("harvesting fills the remaining space without overflowing or producing rewards when full", () => {
  let state = createInitialState();
  state = { ...state, inventory: { wood: 38, fish: 0, salmon: 0 } };
  state = reduceGame(state, { type: "harvest", resource: "wood" });
  assert.equal(inventoryCount(state), capacity(state));
  assert.equal(state.inventory.wood, 40);
  assert.equal(state.harvests, 2);
  assert.equal(reduceGame(state, { type: "harvest", resource: "wood" }), state);
});

test("selling rewards exactly the inventory value and cannot be collected twice", () => {
  const initial = createInitialState();
  const value = sellValue(initial);
  const state = reduceGame(initial, { type: "sell" });
  assert.equal(state.coins, initial.coins + value);
  assert.equal(state.earned, value);
  assert.equal(state.trades, 1);
  assert.equal(inventoryCount(state), 0);
  assert.equal(reduceGame(state, { type: "sell" }), state);
});

test("upgrades enforce cost and maximum level and alter the actual economy", () => {
  const initial = createInitialState();
  const state = reduceGame(initial, { type: "upgrade", id: "backpack" });
  assert.equal(state.coins, initial.coins - upgradeCost("backpack", initial));
  assert.equal(capacity(state), 60);
  assert.ok(upgradeCost("backpack", state) > upgradeCost("backpack", initial));
  const poor = { ...state, coins: 0 };
  assert.equal(reduceGame(poor, { type: "upgrade", id: "market" }), poor);
  const maxed = {
    ...state,
    coins: 1_000_000,
    upgrades: { ...state.upgrades, rod: 25 },
  };
  assert.equal(reduceGame(maxed, { type: "upgrade", id: "rod" }), maxed);
  const market = reduceGame(
    { ...initial, coins: 1000 },
    { type: "upgrade", id: "market" },
  );
  assert.ok(sellValue(market) > sellValue(initial));
});

test("quests must be completed and rewards cannot be claimed twice", () => {
  const quest = QUESTS[0];
  const initial = createInitialState();
  assert.equal(
    reduceGame(initial, { type: "claimQuest", id: quest.id }),
    initial,
  );
  const completed = { ...initial, harvests: quest.target };
  const claimed = reduceGame(completed, { type: "claimQuest", id: quest.id });
  assert.equal(claimed.coins, initial.coins + quest.reward);
  assert.equal(claimed.gems, initial.gems + 2);
  assert.deepEqual(claimed.questsClaimed, [quest.id]);
  assert.equal(
    reduceGame(claimed, { type: "claimQuest", id: quest.id }),
    claimed,
  );
});

test("regions require both the requested level and coins, and cannot be purchased twice", () => {
  const region = REGIONS[1];
  const initial = createInitialState();
  assert.equal(
    reduceGame({ ...initial, coins: 10_000 }, { type: "unlock", id: region.id })
      .unlockedRegions.length,
    1,
  );
  assert.equal(
    reduceGame({ ...initial, xp: 1000 }, { type: "unlock", id: region.id })
      .unlockedRegions.length,
    1,
  );
  const prepared = { ...initial, coins: 10_000, xp: 1000 };
  const unlocked = reduceGame(prepared, { type: "unlock", id: region.id });
  assert.ok(unlocked.unlockedRegions.includes(region.id));
  assert.equal(unlocked.coins, prepared.coins - region.cost);
  assert.equal(
    reduceGame(unlocked, { type: "unlock", id: region.id }),
    unlocked,
  );
  const baseHarvest = reduceGame(prepared, {
    type: "harvest",
    resource: "wood",
  });
  assert.ok(
    reduceGame(unlocked, { type: "harvest", resource: "wood" }).inventory.wood >
      baseHarvest.inventory.wood,
  );
});

test("worker production is absent without crew and capped at eight offline hours with crew", () => {
  const now = Date.now();
  const initial = createInitialState(now);
  assert.equal(
    reduceGame(initial, { type: "tick", now: now + 24 * 60 * 60 * 1000 })
      .workersStored,
    0,
  );
  const crew = { ...initial, upgrades: { ...initial.upgrades, crew: 2 } };
  const later = reduceGame(crew, {
    type: "tick",
    now: now + 24 * 60 * 60 * 1000,
  });
  assert.equal(later.workersStored, 2 * 3 * 60 * 8);
  const collected = reduceGame(later, { type: "collectWorkers" });
  assert.equal(collected.coins, crew.coins + later.workersStored);
  assert.equal(reduceGame(collected, { type: "collectWorkers" }), collected);
});

test("frequent ticks preserve fractional worker intervals rather than discarding production", () => {
  const now = Date.now();
  const initial = createInitialState(now);
  let state = { ...initial, upgrades: { ...initial.upgrades, crew: 1 } };
  for (let second = 1; second <= 60; second++)
    state = reduceGame(state, { type: "tick", now: now + second * 1000 });
  assert.equal(state.workersStored, 3);
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

test("saves round-trip, malformed saves recover, and untrusted numbers and ids are bounded", () => {
  const now = Date.now();
  const initial = createInitialState(now);
  assert.deepEqual(loadGame(serializeGame(initial), now), initial);
  for (const raw of ["{", "null", "[]", '{"version":2}', "{}"])
    assert.deepEqual(loadGame(raw, now), initial);
  const dirty = {
    ...initial,
    coins: -5,
    gems: "bad",
    upgrades: { rod: 999, backpack: -10 },
    inventory: { wood: 999, fish: 999, salmon: 999 },
    unlockedRegions: ["bad", "pinewood", "pinewood"],
    questsClaimed: ["fake", "first-steps", "first-steps"],
    lastSaved: now + 1e9,
  };
  const cleaned = loadGame(JSON.stringify(dirty), now);
  assert.equal(cleaned.coins, 0);
  assert.equal(cleaned.gems, 12);
  assert.equal(cleaned.upgrades.rod, 25);
  assert.equal(cleaned.upgrades.backpack, 0);
  assert.equal(inventoryCount(cleaned), capacity(cleaned));
  assert.deepEqual(cleaned.unlockedRegions, ["harbor", "pinewood"]);
  assert.deepEqual(cleaned.questsClaimed, ["first-steps"]);
  assert.equal(cleaned.lastSaved, now);
});

test("load applies offline earnings and rolls over the daily goals", () => {
  const now = Date.parse("2026-11-06T23:30:00Z");
  const initial = createInitialState(now);
  const saved = {
    ...initial,
    upgrades: { ...initial.upgrades, crew: 1 },
    daily: { ...initial.daily, harvests: 20 },
  };
  const loaded = loadGame(serializeGame(saved), now + 60 * 60 * 1000);
  assert.equal(loaded.workersStored, 180);
  assert.equal(loaded.daily.harvests, 0);
  assert.equal(loaded.daily.date, "2026-11-07");
  const oversized = loadGame(
    serializeGame({ ...saved, workersStored: 1e12 }),
    now,
  );
  assert.equal(oversized.workersStored, 3 * 60 * 8);
});

test("XP thresholds agree with the level progress display", () => {
  const initial = createInitialState();
  assert.equal(level(initial), 1);
  assert.deepEqual(xpProgress(initial), { current: 0, needed: 80 });
  const state = { ...initial, xp: 205 };
  assert.equal(level(state), 3);
  assert.deepEqual(xpProgress(state), { current: 5, needed: 160 });
});
