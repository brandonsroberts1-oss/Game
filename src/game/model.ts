/** Frost & Fin's deterministic economy. Rendering and storage are kept outside it. */
export type Resource = "wood" | "fish" | "salmon";
export type UpgradeId = "rod" | "backpack" | "market" | "workshop" | "crew";

export interface GameState {
  version: 1;
  coins: number;
  gems: number;
  xp: number;
  inventory: Record<Resource, number>;
  upgrades: Record<UpgradeId, number>;
  unlockedRegions: string[];
  /** Number of resource units gathered, including harvest bonuses. */
  harvests: number;
  earned: number;
  trades: number;
  questsClaimed: string[];
  /** Worker accounting anchor. Tick advances it without losing partial intervals. */
  lastSaved: number;
  sound: boolean;
  playerName: string;
  daily: { date: string; harvests: number; earned: number; claimed: boolean };
  /** Coin stipend waiting at the harbor, independent of backpack storage. */
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
    id: "rod",
    name: "Fishing rod",
    description: "Land one extra catch with every cast.",
    icon: "Fish",
    maxLevel: 25,
    baseCost: 90,
  },
  {
    id: "backpack",
    name: "Bigger backpack",
    description: "Carry 20 more resources on every adventure.",
    icon: "Backpack",
    maxLevel: 25,
    baseCost: 120,
  },
  {
    id: "market",
    name: "Fish market",
    description: "Earn 12% more coins when you sell your goods.",
    icon: "Store",
    maxLevel: 20,
    baseCost: 180,
  },
  {
    id: "workshop",
    name: "Smokehouse",
    description: "Refine your goods for a 20% sale-value bonus.",
    icon: "Hammer",
    maxLevel: 15,
    baseCost: 450,
  },
  {
    id: "crew",
    name: "Dock crew",
    description: "Your crew earns 3 coins a minute, even while you’re away.",
    icon: "Users",
    maxLevel: 12,
    baseCost: 650,
  },
];

export interface Region {
  id: string;
  name: string;
  description: string;
  level: number;
  cost: number;
  color: string;
  resource: Resource;
}

export const REGIONS: readonly Region[] = [
  {
    id: "harbor",
    name: "Frosthaven Harbor",
    description:
      "Your little corner of the world. Every great adventure starts here.",
    level: 1,
    cost: 0,
    color: "#5f9168",
    resource: "wood",
  },
  {
    id: "pinewood",
    name: "Pinewood Coast",
    description: "Snow-dusted pines and a generous timber harvest.",
    level: 3,
    cost: 950,
    color: "#3f7861",
    resource: "wood",
  },
  {
    id: "salmonrun",
    name: "Salmon Run",
    description: "The silver river teems with valuable wild salmon.",
    level: 6,
    cost: 4_200,
    color: "#df937a",
    resource: "salmon",
  },
  {
    id: "frostlake",
    name: "Frost Lake",
    description: "An icy lake full of fresh fish beneath the winter sky.",
    level: 10,
    cost: 18_000,
    color: "#7fa8bd",
    resource: "fish",
  },
  {
    id: "moonlit",
    name: "Moonlight Bay",
    description:
      "Cast beneath the northern lights for an exceptional salmon yield.",
    level: 16,
    cost: 90_000,
    color: "#7585a6",
    resource: "salmon",
  },
  {
    id: "glacier",
    name: "Glacier Reach",
    description: "A frozen wilderness at the far edge of the archipelago.",
    level: 24,
    cost: 350_000,
    color: "#78b6c6",
    resource: "fish",
  },
];

export type QuestType = "harvest" | "earn" | "trade" | "upgrade" | "region";
export interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  reward: number;
  type: QuestType;
}

export const QUESTS: readonly Quest[] = [
  {
    id: "first-steps",
    title: "A fresh start",
    description: "Gather your first 15 resources.",
    type: "harvest",
    target: 15,
    reward: 80,
  },
  {
    id: "market-day",
    title: "Market day",
    description: "Sell a backpack of goods 3 times.",
    type: "trade",
    target: 3,
    reward: 150,
  },
  {
    id: "better-together",
    title: "A little improvement",
    description: "Purchase 3 island upgrades.",
    type: "upgrade",
    target: 3,
    reward: 250,
  },
  {
    id: "winter-at-heart",
    title: "Winter at heart",
    description: "Gather 150 resources from your island.",
    type: "harvest",
    target: 150,
    reward: 300,
  },
  {
    id: "a-good-living",
    title: "A good living",
    description: "Earn 1,500 coins through trading.",
    type: "earn",
    target: 1_500,
    reward: 400,
  },
  {
    id: "new-horizons",
    title: "New horizons",
    description: "Discover a second island region.",
    type: "region",
    target: 2,
    reward: 500,
  },
  {
    id: "familiar-face",
    title: "The harbor regular",
    description: "Complete 25 trades at the harbor.",
    type: "trade",
    target: 25,
    reward: 900,
  },
  {
    id: "master-builder",
    title: "Made to last",
    description: "Purchase 20 island upgrades.",
    type: "upgrade",
    target: 20,
    reward: 2_000,
  },
  {
    id: "island-life",
    title: "Island life",
    description: "Gather 5,000 resources.",
    type: "harvest",
    target: 5_000,
    reward: 3_500,
  },
  {
    id: "merchant-prince",
    title: "A thriving harbor",
    description: "Earn 100,000 coins through trading.",
    type: "earn",
    target: 100_000,
    reward: 8_000,
  },
  {
    id: "archipelago",
    title: "Across the archipelago",
    description: "Discover all 6 island regions.",
    type: "region",
    target: 6,
    reward: 15_000,
  },
  {
    id: "blooming",
    title: "In full bloom",
    description: "Purchase 75 island upgrades.",
    type: "upgrade",
    target: 75,
    reward: 30_000,
  },
];

export const DAILY_GOAL = { harvests: 30, earned: 500, reward: 180 } as const;
export const RESOURCE_PRICES: Record<Resource, number> = {
  wood: 6,
  fish: 9,
  salmon: 14,
};
const RESOURCES: Resource[] = ["wood", "fish", "salmon"];
const MAX_NUMBER = 1_000_000_000_000;
const EIGHT_HOURS = 8 * 60 * 60 * 1000;
const utcDate = (now: number) => new Date(now).toISOString().slice(0, 10);

export function createInitialState(now = Date.now()): GameState {
  return {
    version: 1,
    coins: 240,
    gems: 12,
    xp: 0,
    inventory: { wood: 8, fish: 4, salmon: 3 },
    upgrades: { rod: 0, backpack: 0, market: 0, workshop: 0, crew: 0 },
    unlockedRegions: ["harbor"],
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
  40 + state.upgrades.backpack * 20;
export const inventoryCount = (state: GameState): number =>
  RESOURCES.reduce((sum, key) => sum + state.inventory[key], 0);
const nextLevelXp = (currentLevel: number) => 80 + (currentLevel - 1) * 40;

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
  return { current, needed: nextLevelXp(currentLevel) };
}

export function level(state: GameState): number {
  let xp = state.xp;
  let result = 1;
  while (xp >= nextLevelXp(result) && result < 100) {
    xp -= nextLevelXp(result);
    result++;
  }
  return result;
}

export function sellValue(state: GameState): number {
  const raw = RESOURCES.reduce(
    (sum, key) => sum + state.inventory[key] * RESOURCE_PRICES[key],
    0,
  );
  return Math.floor(
    raw *
      (1 + state.upgrades.market * 0.12) *
      (1 + state.upgrades.workshop * 0.2),
  );
}

export function upgradeCost(id: UpgradeId, state: GameState): number {
  const upgrade = UPGRADES.find((entry) => entry.id === id);
  return upgrade
    ? Math.ceil(upgrade.baseCost * 1.55 ** state.upgrades[id])
    : Infinity;
}

export function questProgress(quest: Quest, state: GameState): number {
  switch (quest.type) {
    case "harvest":
      return Math.min(quest.target, state.harvests);
    case "earn":
      return Math.min(quest.target, state.earned);
    case "trade":
      return Math.min(quest.target, state.trades);
    case "upgrade":
      return Math.min(
        quest.target,
        Object.values(state.upgrades).reduce((sum, val) => sum + val, 0),
      );
    case "region":
      return Math.min(quest.target, state.unlockedRegions.length);
  }
}

function rollDaily(state: GameState, now: number): GameState {
  const date = utcDate(now);
  return state.daily.date === date
    ? state
    : { ...state, daily: { date, harvests: 0, earned: 0, claimed: false } };
}

function advanceTime(state: GameState, now: number): GameState {
  const current = rollDaily(state, now);
  const elapsed = Math.max(0, Math.min(EIGHT_HOURS, now - current.lastSaved));
  if (!current.upgrades.crew) return { ...current, lastSaved: now };
  const interval = 20_000 / current.upgrades.crew;
  const produced = Math.floor(elapsed / interval);
  if (!produced && now >= current.lastSaved) return current;
  const storageCap = Math.floor(EIGHT_HOURS / interval);
  const exhaustedOfflineCap = now - current.lastSaved > EIGHT_HOURS;
  return {
    ...current,
    workersStored: Math.min(storageCap, current.workersStored + produced),
    lastSaved:
      exhaustedOfflineCap || now < current.lastSaved
        ? now
        : current.lastSaved + produced * interval,
  };
}

export type GameAction =
  | { type: "harvest"; resource: Resource }
  | { type: "sell" }
  | { type: "upgrade"; id: UpgradeId }
  | { type: "unlock"; id: string }
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
      if (!RESOURCES.includes(action.resource)) return state;
      const space = capacity(state) - inventoryCount(state);
      if (space <= 0) return state;
      const regionBonus =
        REGIONS.filter(
          (region) =>
            region.id !== "harbor" &&
            region.resource === action.resource &&
            state.unlockedRegions.includes(region.id),
        ).length * 2;
      const amount = Math.min(
        space,
        { wood: 3, fish: 2, salmon: 1 }[action.resource] +
          state.upgrades.rod +
          regionBonus,
      );
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.resource]: state.inventory[action.resource] + amount,
        },
        harvests: state.harvests + amount,
        xp: state.xp + amount * 3,
        daily: { ...state.daily, harvests: state.daily.harvests + amount },
      };
    }
    case "sell": {
      const count = inventoryCount(state);
      if (!count) return state;
      const value = sellValue(state);
      return {
        ...state,
        coins: Math.min(MAX_NUMBER, state.coins + value),
        inventory: { wood: 0, fish: 0, salmon: 0 },
        earned: state.earned + value,
        trades: state.trades + 1,
        xp: state.xp + count * 2,
        daily: { ...state.daily, earned: state.daily.earned + value },
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
        xp: state.xp + 15,
        upgrades: {
          ...state.upgrades,
          [action.id]: state.upgrades[action.id] + 1,
        },
        // A new crew begins work now; time before recruitment never generates income.
        lastSaved:
          action.id === "crew" && !state.upgrades.crew
            ? Date.now()
            : state.lastSaved,
      };
    }
    case "unlock": {
      const region = REGIONS.find((entry) => entry.id === action.id);
      if (
        !region ||
        state.unlockedRegions.includes(region.id) ||
        level(state) < region.level ||
        state.coins < region.cost
      )
        return state;
      return {
        ...state,
        coins: state.coins - region.cost,
        xp: state.xp + 100,
        unlockedRegions: [...state.unlockedRegions, region.id],
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
        coins: Math.min(MAX_NUMBER, state.coins + quest.reward),
        gems: state.gems + 2,
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
        coins: Math.min(MAX_NUMBER, state.coins + DAILY_GOAL.reward),
        gems: state.gems + 3,
        daily: { ...state.daily, claimed: true },
      };
    }
    case "toggleSound":
      return { ...state, sound: !state.sound };
    case "collectWorkers": {
      if (!state.workersStored) return state;
      return {
        ...state,
        coins: Math.min(MAX_NUMBER, state.coins + state.workersStored),
        workersStored: 0,
      };
    }
    case "tick":
      return Number.isFinite(action.now)
        ? advanceTime(state, action.now)
        : state;
    case "rename":
      return {
        ...state,
        playerName: action.name.trim().slice(0, 32) || "Harbor Captain",
      };
    case "reset":
      return createInitialState();
    default:
      return state;
  }
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const boundedInt = (
  value: unknown,
  fallback: number,
  max = MAX_NUMBER,
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.floor(value)))
    : fallback;

/** Versioned, bounded local saves. Invalid/unrecognized saves always recover safely. */
export function loadGame(raw: string | null, now = Date.now()): GameState {
  const initial = createInitialState(now);
  if (!raw) return initial;
  try {
    const data = record(JSON.parse(raw));
    if (data.version !== 1) return initial;
    const inv = record(data.inventory);
    const upgrades = record(data.upgrades);
    const daily = record(data.daily);
    const safe: GameState = {
      version: 1,
      coins: boundedInt(data.coins, initial.coins),
      gems: boundedInt(data.gems, initial.gems),
      xp: boundedInt(data.xp, 0, 5_000_000),
      inventory: {
        wood: boundedInt(inv.wood, 0, 540),
        fish: boundedInt(inv.fish, 0, 540),
        salmon: boundedInt(inv.salmon, 0, 540),
      },
      upgrades: Object.fromEntries(
        UPGRADES.map((upgrade) => [
          upgrade.id,
          boundedInt(upgrades[upgrade.id], 0, upgrade.maxLevel),
        ]),
      ) as Record<UpgradeId, number>,
      unlockedRegions: [
        ...new Set([
          "harbor",
          ...(Array.isArray(data.unlockedRegions)
            ? data.unlockedRegions.filter(
                (id): id is string =>
                  typeof id === "string" &&
                  REGIONS.some((region) => region.id === id),
              )
            : []),
        ]),
      ],
      harvests: boundedInt(data.harvests, 0),
      earned: boundedInt(data.earned, 0),
      trades: boundedInt(data.trades, 0),
      questsClaimed: [
        ...new Set(
          Array.isArray(data.questsClaimed)
            ? data.questsClaimed.filter(
                (id): id is string =>
                  typeof id === "string" &&
                  QUESTS.some((quest) => quest.id === id),
              )
            : [],
        ),
      ],
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
      workersStored: boundedInt(data.workersStored, 0),
    };
    // A corrupt/old save cannot leave the backpack over its current capacity.
    let remaining = capacity(safe);
    for (const resource of RESOURCES) {
      safe.inventory[resource] = Math.min(remaining, safe.inventory[resource]);
      remaining -= safe.inventory[resource];
    }
    safe.workersStored = Math.min(
      safe.workersStored,
      safe.upgrades.crew * 3 * 60 * 8,
    );
    return advanceTime(safe, now);
  } catch {
    return initial;
  }
}

export const serializeGame = (state: GameState): string =>
  JSON.stringify(state);
