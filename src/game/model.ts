/** Frost & Fin's versioned, local single-player economy. Scene animations commit actions only when finished. */
export type Resource =
  "wood" | "fish" | "salmon" | "steak" | "plank" | "smoked";
export type RawResource = "wood" | "fish" | "salmon";
export type UpgradeId =
  | "axe"
  | "rod"
  | "backpack"
  | "cutter"
  | "sawmill"
  | "market"
  | "dock"
  | "crew"
  | "smokehouse"
  | "freezer"
  | "boots"
  | "nets";
export type RecipeId = "steaks" | "planks" | "smoked";
export type ActivityId =
  "wood" | "fish" | "steaks" | "planks" | "smoked" | "market";

export interface GameState {
  version: 2;
  coins: number;
  gems: number;
  xp: number;
  inventory: Record<Resource, number>;
  upgrades: Record<UpgradeId, number>;
  /** Lifetime raw resource units collected. Crafted goods are recorded in processed instead. */
  gathered: Record<Resource, number>;
  /** Lifetime OUTPUT units crafted by each recipe, rather than recipe batches. */
  processed: Record<RecipeId, number>;
  harvests: number;
  earned: number;
  trades: number;
  questsClaimed: string[];
  /** Worker accounting anchor; tick preserves fractional production intervals. */
  lastSaved: number;
  sound: boolean;
  playerName: string;
  daily: { date: string; harvests: number; earned: number; claimed: boolean };
  workersStored: number;
}

export interface Upgrade {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  baseCost: number;
}

export const UPGRADES: readonly Upgrade[] = [
  {
    id: "axe",
    name: "Forester’s axe",
    description: "Collect 2 extra logs from every felled tree at each stage.",
    icon: "Axe",
    maxLevel: 5,
    baseCost: 50,
  },
  {
    id: "rod",
    name: "Fishing rod",
    description: "Cast faster. Stage 3 lands an extra fish per catch.",
    icon: "Fish",
    maxLevel: 5,
    baseCost: 65,
  },
  {
    id: "backpack",
    name: "Bigger backpack",
    description:
      "Carry 12 more goods at each stage, with a larger visible pack.",
    icon: "Backpack",
    maxLevel: 5,
    baseCost: 80,
  },
  {
    id: "cutter",
    name: "Fish cutting station",
    description: "Cut faster. Stages 2 and 4 add an extra steak per fish.",
    icon: "Scissors",
    maxLevel: 5,
    baseCost: 120,
  },
  {
    id: "sawmill",
    name: "Harbor sawmill",
    description:
      "Turn 3 logs into 2 planks. Later stages cut faster; stage 3 adds a plank.",
    icon: "Hammer",
    maxLevel: 5,
    baseCost: 150,
  },
  {
    id: "market",
    name: "Fish market",
    description:
      "Improve the counter and earn 12% more on every sale per stage.",
    icon: "Store",
    maxLevel: 5,
    baseCost: 90,
  },
  {
    id: "dock",
    name: "Trading dock",
    description:
      "Expand the pier: +6% sale value and +1 crew coin per minute per stage.",
    icon: "Anchor",
    maxLevel: 5,
    baseCost: 180,
  },
  {
    id: "crew",
    name: "Dock crew",
    description:
      "Recruit a helper each stage. Each earns 3 coins per minute, plus dock bonuses.",
    icon: "Users",
    maxLevel: 5,
    baseCost: 240,
  },
  {
    id: "smokehouse",
    name: "Smokehouse",
    description:
      "Smoke 2 steaks and a log into 2 smoked fish. +10% smoked value per stage.",
    icon: "Flame",
    maxLevel: 5,
    baseCost: 260,
  },
  {
    id: "freezer",
    name: "Cold storage",
    description:
      "Preserve your catch for 10% more raw fish and salmon value per stage.",
    icon: "Snowflake",
    maxLevel: 5,
    baseCost: 220,
  },
  {
    id: "boots",
    name: "Captain’s boots",
    description:
      "Move 12% faster per stage, with a new pair of boots to match.",
    icon: "Footprints",
    maxLevel: 5,
    baseCost: 60,
  },
  {
    id: "nets",
    name: "Fishing nets",
    description:
      "Cast faster; stages 2 and 4 each land another fish per catch.",
    icon: "Waves",
    maxLevel: 5,
    baseCost: 110,
  },
];

export interface Recipe {
  id: RecipeId;
  name: string;
  description: string;
  inputs: Partial<Record<Resource, number>>;
  output: Resource;
  amount: number;
  requiredUpgrade: UpgradeId | null;
  seconds: number;
}

export const RECIPES: readonly Recipe[] = [
  {
    id: "steaks",
    name: "Cut tuna steaks",
    description:
      "Fillet one fresh fish into four valuable steaks at the cutting table.",
    inputs: { fish: 1 },
    output: "steak",
    amount: 4,
    requiredUpgrade: null,
    seconds: 4,
  },
  {
    id: "planks",
    name: "Saw timber planks",
    description:
      "Feed three logs through the sawmill to make two finished planks.",
    inputs: { wood: 3 },
    output: "plank",
    amount: 2,
    requiredUpgrade: "sawmill",
    seconds: 4,
  },
  {
    id: "smoked",
    name: "Smoke fish",
    description:
      "Use one log to smoke two fish steaks into two premium smoked fish.",
    inputs: { steak: 2, wood: 1 },
    output: "smoked",
    amount: 2,
    requiredUpgrade: "smokehouse",
    seconds: 5,
  },
];

export const RESOURCES: readonly Resource[] = [
  "wood",
  "fish",
  "salmon",
  "steak",
  "plank",
  "smoked",
];
export const resourceNames: Record<Resource, string> = {
  wood: "Timber",
  fish: "Fresh tuna",
  salmon: "Wild salmon",
  steak: "Tuna steaks",
  plank: "Timber planks",
  smoked: "Smoked fish",
};
export const RESOURCE_PRICES: Record<Resource, number> = {
  wood: 3,
  fish: 12,
  salmon: 22,
  steak: 6,
  plank: 8,
  smoked: 16,
};
export const DAILY_GOAL = { harvests: 30, earned: 300, reward: 90 } as const;

export type QuestType =
  "harvest" | "gather" | "earn" | "trade" | "upgrade" | "process" | "build";
export interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  type: QuestType;
  resource?: Resource;
  recipe?: RecipeId;
}

export const QUESTS: readonly Quest[] = [
  {
    id: "first-steps",
    title: "The first tree",
    description: "Fell a pine and collect 6 logs.",
    type: "gather",
    resource: "wood",
    target: 6,
    reward: 25,
  },
  {
    id: "first-catch",
    title: "A line in the water",
    description: "Land your first fresh fish.",
    type: "gather",
    resource: "fish",
    target: 1,
    reward: 20,
  },
  {
    id: "first-cut",
    title: "From catch to counter",
    description: "Cut your catch into 4 fish steaks.",
    type: "process",
    recipe: "steaks",
    target: 4,
    reward: 30,
  },
  {
    id: "market-day",
    title: "Market day",
    description: "Sell your goods at the market 3 times.",
    type: "trade",
    target: 3,
    reward: 65,
  },
  {
    id: "better-together",
    title: "A working harbor",
    description: "Build 3 different starter upgrades.",
    type: "build",
    target: 3,
    reward: 90,
  },
  {
    id: "first-planks",
    title: "Sawdust & sea air",
    description: "Produce 6 finished timber planks.",
    type: "process",
    recipe: "planks",
    target: 6,
    reward: 100,
  },
  {
    id: "first-smoked",
    title: "Slowly smoked",
    description: "Produce 6 smoked fish at the smokehouse.",
    type: "process",
    recipe: "smoked",
    target: 6,
    reward: 120,
  },
  {
    id: "winter-at-heart",
    title: "Winter at heart",
    description: "Gather 150 resources around the harbor.",
    type: "harvest",
    target: 150,
    reward: 130,
  },
  {
    id: "a-good-living",
    title: "A good living",
    description: "Earn 1,500 coins through trading.",
    type: "earn",
    target: 1_500,
    reward: 200,
  },
  {
    id: "busy-kitchen",
    title: "The busy cutting table",
    description: "Prepare 100 fish steaks.",
    type: "process",
    recipe: "steaks",
    target: 100,
    reward: 240,
  },
  {
    id: "familiar-face",
    title: "The harbor regular",
    description: "Complete 25 trades at the market.",
    type: "trade",
    target: 25,
    reward: 300,
  },
  {
    id: "starter-harbor",
    title: "All hands on deck",
    description: "Build all 12 starter upgrades.",
    type: "build",
    target: 12,
    reward: 600,
  },
  {
    id: "master-builder",
    title: "Made to last",
    description: "Purchase 30 upgrade stages across the harbor.",
    type: "upgrade",
    target: 30,
    reward: 900,
  },
  {
    id: "island-life",
    title: "Harbor life",
    description: "Gather 2,000 raw resources.",
    type: "harvest",
    target: 2_000,
    reward: 1_000,
  },
  {
    id: "merchant-prince",
    title: "A thriving harbor",
    description: "Earn 25,000 coins through trading.",
    type: "earn",
    target: 25_000,
    reward: 1_500,
  },
  {
    id: "blooming",
    title: "A harbor to call home",
    description: "Complete all 60 starter upgrade stages.",
    type: "upgrade",
    target: 60,
    reward: 3_000,
  },
];

const MAX_NUMBER = 1_000_000_000_000;
const MAX_XP = 5_000_000;
const EIGHT_HOURS = 8 * 60 * 60 * 1_000;
// V1 backpacks held up to 540 raw goods. Keep those legitimate goods across migration and later saves.
const MAX_SAVED_INVENTORY = 540;
const OLD_QUEST_IDS = ["new-horizons", "archipelago"];
const emptyInventory = (): Record<Resource, number> => ({
  wood: 0,
  fish: 0,
  salmon: 0,
  steak: 0,
  plank: 0,
  smoked: 0,
});
const emptyUpgrades = (): Record<UpgradeId, number> => ({
  axe: 0,
  rod: 0,
  backpack: 0,
  cutter: 0,
  sawmill: 0,
  market: 0,
  dock: 0,
  crew: 0,
  smokehouse: 0,
  freezer: 0,
  boots: 0,
  nets: 0,
});
const utcDate = (now: number): string =>
  new Date(now).toISOString().slice(0, 10);
const validTime = (now: number): boolean =>
  Number.isFinite(now) && now >= 0 && now <= 8_640_000_000_000_000;
const boundedInt = (
  value: unknown,
  fallback: number,
  max = MAX_NUMBER,
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.floor(value)))
    : fallback;
const addBounded = (value: number, extra: number): number =>
  Math.min(MAX_NUMBER, value + extra);
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export function createInitialState(now = Date.now()): GameState {
  return {
    version: 2,
    coins: 120,
    gems: 0,
    xp: 0,
    inventory: emptyInventory(),
    upgrades: emptyUpgrades(),
    gathered: emptyInventory(),
    processed: { steaks: 0, planks: 0, smoked: 0 },
    harvests: 0,
    earned: 0,
    trades: 0,
    questsClaimed: [],
    lastSaved: now,
    sound: true,
    playerName: "Harbor Captain",
    daily: { date: utcDate(now), harvests: 0, earned: 0, claimed: false },
    workersStored: 0,
  };
}

export const capacity = (state: GameState): number =>
  24 + state.upgrades.backpack * 12;
export const inventoryCount = (state: GameState): number =>
  RESOURCES.reduce((sum, resource) => sum + state.inventory[resource], 0);
const nextLevelXp = (currentLevel: number): number =>
  80 + (currentLevel - 1) * 40;

export function level(state: GameState): number {
  let xp = state.xp;
  let result = 1;
  while (xp >= nextLevelXp(result) && result < 100) {
    xp -= nextLevelXp(result);
    result++;
  }
  return result;
}

export function xpProgress(state: GameState): {
  current: number;
  needed: number;
} {
  let current = state.xp;
  let currentLevel = 1;
  while (current >= nextLevelXp(currentLevel) && currentLevel < 100) {
    current -= nextLevelXp(currentLevel);
    currentLevel++;
  }
  const needed = nextLevelXp(currentLevel);
  return {
    current: currentLevel === 100 ? Math.min(current, needed) : current,
    needed,
  };
}

/** Yield requested by a completed world interaction; capacity may reduce the actual collected amount. */
export function gatherYield(state: GameState, resource: Resource): number {
  switch (resource) {
    case "wood":
      return 6 + state.upgrades.axe * 2;
    case "fish":
      return (
        1 +
        Math.floor(state.upgrades.rod / 3) +
        Math.floor(state.upgrades.nets / 2)
      );
    case "salmon":
      return 1;
    default:
      return 0; // Crafted resources can never be gathered directly.
  }
}

export function recipeYield(state: GameState, id: RecipeId): number {
  switch (id) {
    case "steaks":
      return 4 + Math.floor(state.upgrades.cutter / 2);
    case "planks":
      return 2 + Math.floor(state.upgrades.sawmill / 3);
    case "smoked":
      return 2 + Math.floor(state.upgrades.smokehouse / 3);
    default:
      return 0;
  }
}

/** Duration in seconds; the renderer owns the animation and calls process only at its end. */
export function recipeDuration(state: GameState, id: RecipeId): number {
  const recipe = RECIPES.find((entry) => entry.id === id);
  if (!recipe) return 0;
  const speed =
    id === "steaks"
      ? state.upgrades.cutter * 0.22
      : id === "planks"
        ? state.upgrades.sawmill * 0.2
        : state.upgrades.smokehouse * 0.16;
  return Math.round((recipe.seconds / (1 + speed)) * 100) / 100;
}

export type ProcessBlockReason = "locked" | "inputs" | "capacity";
export function processBlockReason(
  state: GameState,
  id: RecipeId,
): ProcessBlockReason | null {
  const recipe = RECIPES.find((entry) => entry.id === id);
  if (
    !recipe ||
    (recipe.requiredUpgrade && state.upgrades[recipe.requiredUpgrade] < 1)
  )
    return "locked";
  let consumed = 0;
  for (const resource of RESOURCES) {
    const amount = recipe.inputs[resource] ?? 0;
    if (state.inventory[resource] < amount) return "inputs";
    consumed += amount;
  }
  if (
    inventoryCount(state) - consumed + recipeYield(state, id) >
    capacity(state)
  )
    return "capacity";
  return null;
}
export const canProcess = (state: GameState, id: RecipeId): boolean =>
  processBlockReason(state, id) === null;

/** Raw prices plus the actual market, dock, preservation and smokehouse bonuses. */
export function sellValue(state: GameState): number {
  let raw = 0;
  for (const resource of RESOURCES) {
    let value = state.inventory[resource] * RESOURCE_PRICES[resource];
    if (resource === "fish" || resource === "salmon")
      value *= 1 + state.upgrades.freezer * 0.1;
    if (resource === "smoked") value *= 1 + state.upgrades.smokehouse * 0.1;
    raw += value;
  }
  return Math.floor(
    raw * (1 + state.upgrades.market * 0.12) * (1 + state.upgrades.dock * 0.06),
  );
}

export function upgradeCost(id: UpgradeId, state: GameState): number {
  const upgrade = UPGRADES.find((entry) => entry.id === id);
  return upgrade
    ? Math.ceil(upgrade.baseCost * 1.7 ** state.upgrades[id])
    : Infinity;
}

/** Exact current-stage description, also suitable for comparing the next stage in menus. */
export function upgradeEffect(id: UpgradeId, stage: number): string {
  const value = Math.max(0, Math.min(5, Math.floor(stage)));
  switch (id) {
    case "axe":
      return `${6 + value * 2} logs per completed tree`;
    case "rod":
      return `+${value * 10}% cast speed; +${Math.floor(value / 3)} fish per catch`;
    case "backpack":
      return `${24 + value * 12} goods in your backpack`;
    case "cutter":
      return `${4 + Math.floor(value / 2)} steaks per fish; ${(4 / (1 + value * 0.22)).toFixed(1)}s per cut`;
    case "sawmill":
      return value
        ? `${2 + Math.floor(value / 3)} planks per 3 logs; ${(4 / (1 + value * 0.2)).toFixed(1)}s per batch`
        : "Build to turn 3 logs into 2 planks";
    case "market":
      return `+${value * 12}% value on every sale`;
    case "dock":
      return `+${value * 6}% sale value; +${value} crew coins/min per helper`;
    case "crew":
      return `${value} helpers earning ${value * 3} coins/min before dock bonuses`;
    case "smokehouse":
      return value
        ? `${2 + Math.floor(value / 3)} smoked fish per batch; +${value * 10}% smoked value`
        : "Build to smoke 2 steaks with 1 log";
    case "freezer":
      return `+${value * 10}% raw fish and salmon value`;
    case "boots":
      return `+${value * 12}% walking speed`;
    case "nets":
      return `+${value * 8}% cast speed; +${Math.floor(value / 2)} fish per catch`;
  }
}

export function questProgress(quest: Quest, state: GameState): number {
  let progress: number;
  switch (quest.type) {
    case "harvest":
      progress = state.harvests;
      break;
    case "gather":
      progress = quest.resource
        ? state.gathered[quest.resource]
        : state.harvests;
      break;
    case "earn":
      progress = state.earned;
      break;
    case "trade":
      progress = state.trades;
      break;
    case "upgrade":
      progress = Object.values(state.upgrades).reduce(
        (sum, value) => sum + value,
        0,
      );
      break;
    case "build":
      progress = Object.values(state.upgrades).filter(
        (value) => value > 0,
      ).length;
      break;
    case "process":
      progress = quest.recipe
        ? state.processed[quest.recipe]
        : Object.values(state.processed).reduce((sum, value) => sum + value, 0);
      break;
  }
  return Math.min(quest.target, progress);
}

export const workerRate = (state: GameState): number =>
  state.upgrades.crew * (3 + state.upgrades.dock);
const workerStorageCap = (state: GameState): number =>
  workerRate(state) * 60 * 8;

function rollDaily(state: GameState, now: number): GameState {
  const date = utcDate(now);
  return state.daily.date === date
    ? state
    : { ...state, daily: { date, harvests: 0, earned: 0, claimed: false } };
}

function advanceTime(state: GameState, now: number): GameState {
  const current = rollDaily(state, now);
  const elapsed = Math.max(0, Math.min(EIGHT_HOURS, now - current.lastSaved));
  const rate = workerRate(current);
  if (!rate) return { ...current, lastSaved: now, workersStored: 0 };
  const interval = 60_000 / rate;
  const produced = Math.floor(elapsed / interval + 1e-9);
  if (!produced && now >= current.lastSaved) return current;
  const expired = now - current.lastSaved > EIGHT_HOURS;
  return {
    ...current,
    workersStored: Math.min(
      workerStorageCap(current),
      current.workersStored + produced,
    ),
    lastSaved:
      expired || now < current.lastSaved
        ? now
        : current.lastSaved + produced * interval,
  };
}

export type GameAction =
  | { type: "harvest"; resource: Resource }
  | { type: "process"; recipe: RecipeId }
  | { type: "sell" }
  | { type: "upgrade"; id: UpgradeId }
  | { type: "claimQuest"; id: string }
  | { type: "claimDaily" }
  | { type: "toggleSound" }
  | { type: "collectWorkers" }
  | { type: "tick"; now: number }
  | { type: "rename"; name: string }
  | { type: "reset" };

export function reduceGame(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "harvest": {
      const yieldAmount = gatherYield(state, action.resource);
      const amount = Math.min(
        yieldAmount,
        capacity(state) - inventoryCount(state),
      );
      if (amount <= 0) return state;
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.resource]: state.inventory[action.resource] + amount,
        },
        gathered: {
          ...state.gathered,
          [action.resource]: addBounded(
            state.gathered[action.resource],
            amount,
          ),
        },
        harvests: addBounded(state.harvests, amount),
        xp: Math.min(MAX_XP, state.xp + amount * 3),
        daily: {
          ...state.daily,
          harvests: addBounded(state.daily.harvests, amount),
        },
      };
    }
    case "process": {
      if (!canProcess(state, action.recipe)) return state;
      const recipe = RECIPES.find((entry) => entry.id === action.recipe)!;
      const amount = recipeYield(state, action.recipe);
      const inventory = { ...state.inventory };
      for (const resource of RESOURCES)
        inventory[resource] -= recipe.inputs[resource] ?? 0;
      inventory[recipe.output] += amount;
      return {
        ...state,
        inventory,
        processed: {
          ...state.processed,
          [action.recipe]: addBounded(state.processed[action.recipe], amount),
        },
        xp: Math.min(MAX_XP, state.xp + amount * 4),
      };
    }
    case "sell": {
      const count = inventoryCount(state);
      if (!count) return state;
      const value = sellValue(state);
      return {
        ...state,
        coins: addBounded(state.coins, value),
        inventory: emptyInventory(),
        earned: addBounded(state.earned, value),
        trades: addBounded(state.trades, 1),
        xp: Math.min(MAX_XP, state.xp + count * 2),
        daily: {
          ...state.daily,
          earned: addBounded(state.daily.earned, value),
        },
      };
    }
    case "upgrade": {
      const upgrade = UPGRADES.find((entry) => entry.id === action.id);
      if (!upgrade || state.upgrades[action.id] >= upgrade.maxLevel)
        return state;
      const cost = upgradeCost(action.id, state);
      if (state.coins < cost) return state;
      return {
        ...state,
        coins: state.coins - cost,
        xp: Math.min(MAX_XP, state.xp + 15),
        upgrades: {
          ...state.upgrades,
          [action.id]: state.upgrades[action.id] + 1,
        },
      };
    }
    case "claimQuest": {
      const quest = QUESTS.find((entry) => entry.id === action.id);
      if (
        !quest ||
        state.questsClaimed.includes(quest.id) ||
        questProgress(quest, state) < quest.target
      )
        return state;
      return {
        ...state,
        coins: addBounded(state.coins, quest.reward),
        gems: addBounded(state.gems, 2),
        questsClaimed: [...state.questsClaimed, quest.id],
      };
    }
    case "claimDaily": {
      if (
        state.daily.claimed ||
        state.daily.harvests < DAILY_GOAL.harvests ||
        state.daily.earned < DAILY_GOAL.earned
      )
        return state;
      return {
        ...state,
        coins: addBounded(state.coins, DAILY_GOAL.reward),
        gems: addBounded(state.gems, 3),
        daily: { ...state.daily, claimed: true },
      };
    }
    case "toggleSound":
      return { ...state, sound: !state.sound };
    case "collectWorkers":
      return !state.workersStored
        ? state
        : {
            ...state,
            coins: addBounded(state.coins, state.workersStored),
            workersStored: 0,
          };
    case "tick":
      return validTime(action.now) ? advanceTime(state, action.now) : state;
    case "rename":
      return {
        ...state,
        playerName: action.name.trim().slice(0, 32) || "Harbor Captain",
      };
    case "reset":
      return createInitialState(state.lastSaved);
    default:
      return state;
  }
}

/** Version 1 migrates in-place under the original storage key, preserving money and validated raw goods. */
export function loadGame(raw: string | null, now = Date.now()): GameState {
  const initial = createInitialState(now);
  if (!raw) return initial;
  try {
    const data = record(JSON.parse(raw));
    if (data.version !== 1 && data.version !== 2) return initial;
    const legacy = data.version === 1;
    const inv = record(data.inventory);
    const upgradeData = record(data.upgrades);
    const gathered = record(data.gathered);
    const processed = record(data.processed);
    const daily = record(data.daily);
    const upgrades = Object.fromEntries(
      UPGRADES.map((upgrade) => [
        upgrade.id,
        boundedInt(
          legacy && upgrade.id === "smokehouse"
            ? upgradeData.workshop
            : upgradeData[upgrade.id],
          0,
          upgrade.maxLevel,
        ),
      ]),
    ) as Record<UpgradeId, number>;
    const inventory = Object.fromEntries(
      RESOURCES.map((resource) => [
        resource,
        boundedInt(inv[resource], 0, MAX_SAVED_INVENTORY),
      ]),
    ) as Record<Resource, number>;
    // Bound malformed saves, while retaining any legitimate V1 pack that exceeds the new capacity.
    let available = legacy
      ? 40 + boundedInt(upgradeData.backpack, 0, 25) * 20
      : MAX_SAVED_INVENTORY;
    for (const resource of RESOURCES) {
      inventory[resource] = Math.min(available, inventory[resource]);
      available -= inventory[resource];
    }
    const state: GameState = {
      version: 2,
      coins: boundedInt(data.coins, initial.coins),
      gems: boundedInt(data.gems, 0),
      xp: boundedInt(data.xp, 0, MAX_XP),
      inventory,
      upgrades,
      gathered: Object.fromEntries(
        RESOURCES.map((resource) => [
          resource,
          boundedInt(gathered[resource], 0),
        ]),
      ) as Record<Resource, number>,
      processed: {
        steaks: boundedInt(processed.steaks, 0),
        planks: boundedInt(processed.planks, 0),
        smoked: boundedInt(processed.smoked, 0),
      },
      harvests: boundedInt(data.harvests, 0),
      earned: boundedInt(data.earned, 0),
      trades: boundedInt(data.trades, 0),
      questsClaimed: [
        ...new Set(
          Array.isArray(data.questsClaimed)
            ? data.questsClaimed.filter(
                (id): id is string =>
                  typeof id === "string" &&
                  (QUESTS.some((quest) => quest.id === id) ||
                    OLD_QUEST_IDS.includes(id)),
              )
            : [],
        ),
      ],
      // Rounding worker fractional anchors down loses less than 1ms, never a whole production interval.
      lastSaved: boundedInt(data.lastSaved, now, now),
      sound: typeof data.sound === "boolean" ? data.sound : true,
      playerName:
        typeof data.playerName === "string"
          ? data.playerName.trim().slice(0, 32) || initial.playerName
          : initial.playerName,
      daily: {
        date:
          typeof daily.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(daily.date)
            ? daily.date
            : utcDate(now),
        harvests: boundedInt(daily.harvests, 0),
        earned: boundedInt(daily.earned, 0),
        claimed: daily.claimed === true,
      },
      workersStored: 0,
    };
    state.workersStored = Math.min(
      boundedInt(data.workersStored, 0),
      workerStorageCap(state),
    );
    return advanceTime(state, now);
  } catch {
    return initial;
  }
}

export const serializeGame = (state: GameState): string =>
  JSON.stringify(state);
