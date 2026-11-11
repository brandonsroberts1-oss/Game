/** All resource changes are committed after the corresponding world animation. */
export type Resource =
  | "wood"
  | "fish"
  | "salmon"
  | "steak"
  | "plank"
  | "smoked"
  | "crab"
  | "kelp"
  | "ore"
  | "ingot"
  | "meal"
  | "tackle";
export type RawResource = "wood" | "fish" | "salmon" | "crab" | "kelp" | "ore";
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
  | "nets"
  | "crabpots"
  | "kelpfarm"
  | "quarry"
  | "forge"
  | "kitchen"
  | "boatyard"
  | "warehouse";
export type RecipeId =
  "steaks" | "planks" | "smoked" | "ingots" | "meals" | "tackle";
export type ActivityId =
  | "wood"
  | "fish"
  | "steaks"
  | "planks"
  | "smoked"
  | "market"
  | "crab"
  | "kelp"
  | "ore"
  | "ingots"
  | "meals"
  | "tackle"
  | "warehouse";
export type WorkerRole =
  | "forester"
  | "fisher"
  | "cutter"
  | "miner"
  | "porter"
  | "gardener"
  | "crabber"
  | "cook";
export interface WorkerJob {
  startedAt: number;
  finishAt: number;
  outputs: Partial<Record<Resource, number>>;
}
export interface GameState {
  version: 3;
  coins: number;
  gems: number;
  xp: number;
  inventory: Record<Resource, number>;
  stock: Record<Resource, number>;
  upgrades: Record<UpgradeId, number>;
  workerJobs: Partial<Record<WorkerRole, WorkerJob>>;
  gathered: Record<Resource, number>;
  processed: Record<RecipeId, number>;
  harvests: number;
  earned: number;
  trades: number;
  questsClaimed: string[];
  lastSaved: number;
  sound: boolean;
  playerName: string;
  daily: { date: string; harvests: number; earned: number; claimed: boolean };
  /** Uncollected v1/v2 wages. New crew deliver actual goods instead. */
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
    description: "A larger blade and 2 extra logs per tree at every tier.",
    icon: "Axe",
    maxLevel: 5,
    baseCost: 50,
  },
  {
    id: "rod",
    name: "Fishing rod",
    description: "Faster casts; tier 3 lands another tuna.",
    icon: "Fish",
    maxLevel: 5,
    baseCost: 65,
  },
  {
    id: "backpack",
    name: "Bigger backpack",
    description: "Add 12 cargo spaces with every tier.",
    icon: "Backpack",
    maxLevel: 5,
    baseCost: 80,
  },
  {
    id: "cutter",
    name: "Fish cutting station",
    description:
      "Powered cutting gear, faster work, and more steaks at tiers 2 and 4.",
    icon: "Scissors",
    maxLevel: 5,
    baseCost: 120,
  },
  {
    id: "sawmill",
    name: "Harbor sawmill",
    description:
      "Saw 3 logs into planks; faster work and extra output at tier 3.",
    icon: "Hammer",
    maxLevel: 5,
    baseCost: 150,
  },
  {
    id: "market",
    name: "Fish market",
    description: "A larger market counter and 12% more value per tier.",
    icon: "Store",
    maxLevel: 5,
    baseCost: 90,
  },
  {
    id: "dock",
    name: "Trading dock",
    description: "Extend the fishing pier and earn 6% more on sales per tier.",
    icon: "Anchor",
    maxLevel: 5,
    baseCost: 180,
  },
  {
    id: "crew",
    name: "Dock crew",
    description:
      "Recruit eight different workers who gather, process, haul, and sell real goods.",
    icon: "Users",
    maxLevel: 8,
    baseCost: 240,
  },
  {
    id: "smokehouse",
    name: "Smokehouse",
    description: "Turn steaks and timber into premium smoked fish.",
    icon: "Flame",
    maxLevel: 5,
    baseCost: 260,
  },
  {
    id: "freezer",
    name: "Cold storage",
    description:
      "Keep tuna, salmon, and crabs fresh for 10% more value per tier.",
    icon: "Snowflake",
    maxLevel: 5,
    baseCost: 220,
  },
  {
    id: "boots",
    name: "Captain’s boots",
    description: "Walk 12% faster per tier.",
    icon: "Footprints",
    maxLevel: 5,
    baseCost: 60,
  },
  {
    id: "nets",
    name: "Fishing nets",
    description: "Faster fishing and extra tuna at tiers 2 and 4.",
    icon: "Waves",
    maxLevel: 5,
    baseCost: 110,
  },
  {
    id: "crabpots",
    name: "Crab fishing dock",
    description: "Build pot racks and haul more crabs from the harbor.",
    icon: "Shell",
    maxLevel: 5,
    baseCost: 140,
  },
  {
    id: "kelpfarm",
    name: "Kelp greenhouse",
    description: "Grow and gather kelp for the seafood kitchen.",
    icon: "Sprout",
    maxLevel: 5,
    baseCost: 160,
  },
  {
    id: "quarry",
    name: "Iron quarry",
    description: "Work the rocky coast for ore and equip a miner.",
    icon: "Pickaxe",
    maxLevel: 5,
    baseCost: 180,
  },
  {
    id: "forge",
    name: "Harbor forge",
    description: "Fire timber and ore into useful iron ingots.",
    icon: "Flame",
    maxLevel: 5,
    baseCost: 300,
  },
  {
    id: "kitchen",
    name: "Seafood kitchen",
    description: "Cook tuna steaks and kelp into hot harbor meals.",
    icon: "CookingPot",
    maxLevel: 5,
    baseCost: 280,
  },
  {
    id: "boatyard",
    name: "Boathouse workshop",
    description: "Build fishing tackle from planks and iron.",
    icon: "Ship",
    maxLevel: 5,
    baseCost: 420,
  },
  {
    id: "warehouse",
    name: "Trading warehouse",
    description: "Store 150 more goods per tier and organize crew deliveries.",
    icon: "Warehouse",
    maxLevel: 5,
    baseCost: 150,
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
    description: "Cut one whole tuna into four steaks.",
    inputs: { fish: 1 },
    output: "steak",
    amount: 4,
    requiredUpgrade: null,
    seconds: 4,
  },
  {
    id: "planks",
    name: "Saw timber planks",
    description: "Saw three logs into two finished planks.",
    inputs: { wood: 3 },
    output: "plank",
    amount: 2,
    requiredUpgrade: "sawmill",
    seconds: 4,
  },
  {
    id: "smoked",
    name: "Smoke fish",
    description: "Smoke two steaks using one log.",
    inputs: { steak: 2, wood: 1 },
    output: "smoked",
    amount: 2,
    requiredUpgrade: "smokehouse",
    seconds: 5,
  },
  {
    id: "ingots",
    name: "Forge iron ingots",
    description: "Use three iron ore and a log to forge two ingots.",
    inputs: { ore: 3, wood: 1 },
    output: "ingot",
    amount: 2,
    requiredUpgrade: "forge",
    seconds: 5,
  },
  {
    id: "meals",
    name: "Cook seafood meals",
    description: "Cook a tuna steak with kelp for two hot meals.",
    inputs: { steak: 1, kelp: 1 },
    output: "meal",
    amount: 2,
    requiredUpgrade: "kitchen",
    seconds: 4,
  },
  {
    id: "tackle",
    name: "Make fishing tackle",
    description: "Craft two tackle kits from two planks and an iron ingot.",
    inputs: { plank: 2, ingot: 1 },
    output: "tackle",
    amount: 2,
    requiredUpgrade: "boatyard",
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
  "crab",
  "kelp",
  "ore",
  "ingot",
  "meal",
  "tackle",
];
export const resourceNames: Record<Resource, string> = {
  wood: "Timber",
  fish: "Fresh tuna",
  salmon: "Wild salmon",
  steak: "Tuna steaks",
  plank: "Timber planks",
  smoked: "Smoked fish",
  crab: "Harbor crabs",
  kelp: "Fresh kelp",
  ore: "Iron ore",
  ingot: "Iron ingots",
  meal: "Seafood meals",
  tackle: "Fishing tackle",
};
export const RESOURCE_PRICES: Record<Resource, number> = {
  wood: 3,
  fish: 12,
  salmon: 22,
  steak: 6,
  plank: 8,
  smoked: 16,
  crab: 18,
  kelp: 3,
  ore: 4,
  ingot: 14,
  meal: 16,
  tackle: 32,
};
export const DAILY_GOAL = { harvests: 30, earned: 300, reward: 90 } as const;
export interface WorkerDefinition {
  id: WorkerRole;
  name: string;
  requiredCrew: number;
  activity: ActivityId;
}
export const WORKERS: readonly WorkerDefinition[] = [
  { id: "forester", name: "Forester", requiredCrew: 1, activity: "wood" },
  { id: "fisher", name: "Fisher", requiredCrew: 2, activity: "fish" },
  { id: "cutter", name: "Fish cutter", requiredCrew: 3, activity: "steaks" },
  { id: "miner", name: "Miner", requiredCrew: 4, activity: "ore" },
  { id: "porter", name: "Market porter", requiredCrew: 5, activity: "market" },
  { id: "gardener", name: "Kelp gardener", requiredCrew: 6, activity: "kelp" },
  { id: "crabber", name: "Crab fisher", requiredCrew: 7, activity: "crab" },
  { id: "cook", name: "Harbor cook", requiredCrew: 8, activity: "meals" },
];
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
    description: "Build all 19 harbor upgrades.",
    type: "build",
    target: 19,
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
    description: "Complete all 98 harbor upgrade stages.",
    type: "upgrade",
    target: 98,
    reward: 3_000,
  },
  {
    id: "shellfish",
    title: "The crab haul",
    description: "Gather 3 crabs from the harbor pots.",
    type: "gather",
    resource: "crab",
    target: 3,
    reward: 45,
  },
  {
    id: "kelp-garden",
    title: "A greener tide",
    description: "Gather 9 bundles of kelp.",
    type: "gather",
    resource: "kelp",
    target: 9,
    reward: 45,
  },
  {
    id: "iron-coast",
    title: "Rock solid",
    description: "Mine 12 pieces of iron ore.",
    type: "gather",
    resource: "ore",
    target: 12,
    reward: 60,
  },
  {
    id: "first-ingots",
    title: "Fire and iron",
    description: "Forge 6 iron ingots.",
    type: "process",
    recipe: "ingots",
    target: 6,
    reward: 120,
  },
  {
    id: "harbor-kitchen",
    title: "Lunch on the dock",
    description: "Cook 8 seafood meals.",
    type: "process",
    recipe: "meals",
    target: 8,
    reward: 120,
  },
  {
    id: "first-tackle",
    title: "Ready for sea",
    description: "Make 6 fishing tackle kits.",
    type: "process",
    recipe: "tackle",
    target: 6,
    reward: 180,
  },
];
const MAX_NUMBER = 1_000_000_000_000,
  MAX_XP = 5_000_000,
  EIGHT_HOURS = 8 * 60 * 60 * 1000,
  MAX_SAVED_INVENTORY = 540;
const OLD_QUEST_IDS = ["new-horizons", "archipelago"];
export const emptyInventory = (): Record<Resource, number> =>
  Object.fromEntries(RESOURCES.map((id) => [id, 0])) as Record<
    Resource,
    number
  >;
const emptyUpgrades = (): Record<UpgradeId, number> =>
  Object.fromEntries(
    UPGRADES.map((upgrade) => [upgrade.id, upgrade.id === "crew" ? 1 : 0]),
  ) as Record<UpgradeId, number>;
const emptyProcessed = (): Record<RecipeId, number> =>
  Object.fromEntries(RECIPES.map((recipe) => [recipe.id, 0])) as Record<
    RecipeId,
    number
  >;
const utcDate = (now: number) => new Date(now).toISOString().slice(0, 10);
const validTime = (now: number) =>
  Number.isFinite(now) && now >= 0 && now <= 8_640_000_000_000_000;
const boundedInt = (
  value: unknown,
  fallback: number,
  max = MAX_NUMBER,
): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.floor(value)))
    : fallback;
const addBounded = (value: number, extra: number) =>
  Math.min(MAX_NUMBER, value + extra);
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const sumGoods = (goods: Partial<Record<Resource, number>>) =>
  RESOURCES.reduce((sum, id) => sum + (goods[id] || 0), 0);
const transferPriority: Resource[] = [
  "tackle",
  "meal",
  "smoked",
  "steak",
  "ingot",
  "plank",
  "crab",
  "salmon",
  "fish",
  "ore",
  "kelp",
  "wood",
];
export function createInitialState(now = Date.now()): GameState {
  return {
    version: 3,
    coins: 120,
    gems: 0,
    xp: 0,
    inventory: emptyInventory(),
    stock: emptyInventory(),
    upgrades: emptyUpgrades(),
    workerJobs: {},
    gathered: emptyInventory(),
    processed: emptyProcessed(),
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
export const capacity = (state: GameState) => 24 + state.upgrades.backpack * 12;
export const inventoryCount = (state: GameState) => sumGoods(state.inventory);
export const stockCapacity = (state: GameState) =>
  150 + state.upgrades.warehouse * 150;
export const stockCount = (state: GameState) => sumGoods(state.stock);
export const reservedStockCount = (state: GameState) =>
  Object.values(state.workerJobs).reduce(
    (sum, job) => sum + sumGoods(job.outputs),
    0,
  );
const nextLevelXp = (current: number) => 80 + (current - 1) * 40;
export function level(state: GameState): number {
  let xp = state.xp,
    result = 1;
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
  let current = state.xp,
    value = 1;
  while (current >= nextLevelXp(value) && value < 100) {
    current -= nextLevelXp(value);
    value++;
  }
  const needed = nextLevelXp(value);
  return {
    current: value === 100 ? Math.min(current, needed) : current,
    needed,
  };
}
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
    case "crab":
      return 1 + Math.floor(state.upgrades.crabpots / 2);
    case "kelp":
      return 3 + state.upgrades.kelpfarm;
    case "ore":
      return 3 + state.upgrades.quarry;
    default:
      return 0;
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
    case "ingots":
      return 2 + Math.floor(state.upgrades.forge / 3);
    case "meals":
      return 2 + Math.floor(state.upgrades.kitchen / 3);
    case "tackle":
      return 2 + Math.floor(state.upgrades.boatyard / 3);
    default:
      return 0;
  }
}
export function recipeDuration(state: GameState, id: RecipeId): number {
  const recipe = RECIPES.find((entry) => entry.id === id);
  if (!recipe) return 0;
  const track: Record<RecipeId, UpgradeId> = {
    steaks: "cutter",
    planks: "sawmill",
    smoked: "smokehouse",
    ingots: "forge",
    meals: "kitchen",
    tackle: "boatyard",
  };
  return (
    Math.round((recipe.seconds / (1 + state.upgrades[track[id]] * 0.2)) * 100) /
    100
  );
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
  for (const resource of RESOURCES)
    if (state.inventory[resource] < (recipe.inputs[resource] || 0))
      return "inputs";
  if (
    inventoryCount(state) - sumGoods(recipe.inputs) + recipeYield(state, id) >
    capacity(state)
  )
    return "capacity";
  return null;
}
export const canProcess = (state: GameState, id: RecipeId) =>
  processBlockReason(state, id) === null;
function rawSaleValue(
  state: GameState,
  resource: Resource,
  quantity: number,
): number {
  let value = quantity * RESOURCE_PRICES[resource];
  if (["fish", "salmon", "crab"].includes(resource))
    value *= 1 + state.upgrades.freezer * 0.1;
  if (resource === "smoked") value *= 1 + state.upgrades.smokehouse * 0.1;
  if (resource === "meal") value *= 1 + state.upgrades.kitchen * 0.05;
  if (resource === "tackle") value *= 1 + state.upgrades.boatyard * 0.05;
  return value;
}
export function resourceSaleValue(
  state: GameState,
  resource: Resource,
  quantity: number,
): number {
  return Math.floor(
    rawSaleValue(state, resource, quantity) *
      (1 + state.upgrades.market * 0.12) *
      (1 + state.upgrades.dock * 0.06),
  );
}
export function sellValue(state: GameState): number {
  return Math.floor(
    RESOURCES.reduce(
      (sum, id) => sum + rawSaleValue(state, id, state.inventory[id]),
      0,
    ) *
      (1 + state.upgrades.market * 0.12) *
      (1 + state.upgrades.dock * 0.06),
  );
}
export function upgradeCost(id: UpgradeId, state: GameState): number {
  const upgrade = UPGRADES.find((entry) => entry.id === id);
  return upgrade
    ? Math.ceil(upgrade.baseCost * 1.7 ** state.upgrades[id])
    : Infinity;
}
export function upgradeEffect(id: UpgradeId, stage: number): string {
  const max = UPGRADES.find((u) => u.id === id)?.maxLevel || 5,
    value = Math.max(0, Math.min(max, Math.floor(stage)));
  switch (id) {
    case "axe":
      return `${6 + value * 2} logs per completed tree`;
    case "rod":
      return `+${value * 10}% cast speed; +${Math.floor(value / 3)} fish per catch`;
    case "backpack":
      return `${24 + value * 12} goods in your backpack`;
    case "cutter":
      return `${4 + Math.floor(value / 2)} steaks per tuna; ${(4 / (1 + value * 0.2)).toFixed(1)}s per cut`;
    case "sawmill":
      return `${2 + Math.floor(value / 3)} planks per 3 logs`;
    case "market":
      return `+${value * 12}% value on every sale`;
    case "dock":
      return `Pier extension; +${value * 6}% sale value`;
    case "crew":
      return `${value} working crew; ${WORKERS[Math.max(0, value - 1)]?.name || "apprentice"} joins the dock`;
    case "smokehouse":
      return `${2 + Math.floor(value / 3)} smoked fish per batch; +${value * 10}% value`;
    case "freezer":
      return `+${value * 10}% tuna, salmon and crab value`;
    case "boots":
      return `+${value * 12}% walking speed`;
    case "nets":
      return `+${value * 8}% cast speed; +${Math.floor(value / 2)} fish`;
    case "crabpots":
      return `${1 + Math.floor(value / 2)} crabs per pot haul`;
    case "kelpfarm":
      return `${3 + value} kelp per harvest`;
    case "quarry":
      return `${3 + value} ore per mining cycle`;
    case "forge":
      return `${2 + Math.floor(value / 3)} iron ingots per batch`;
    case "kitchen":
      return `${2 + Math.floor(value / 3)} meals per batch; +${value * 5}% meal value`;
    case "boatyard":
      return `${2 + Math.floor(value / 3)} tackle kits per batch; +${value * 5}% value`;
    case "warehouse":
      return `${150 + 150 * value} goods of warehouse storage`;
  }
}
export function questProgress(quest: Quest, state: GameState): number {
  let progress = 0;
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
      progress = Object.values(state.upgrades).reduce((s, n) => s + n, 0);
      break;
    case "process":
      progress = quest.recipe
        ? state.processed[quest.recipe]
        : Object.values(state.processed).reduce((s, n) => s + n, 0);
      break;
    case "build":
      progress = Object.values(state.upgrades).filter((n) => n > 0).length;
  }
  return Math.min(quest.target, progress);
}

export interface WorkerJobSpec {
  inputs: Partial<Record<Resource, number>>;
  outputs: Partial<Record<Resource, number>>;
  seconds: number;
}
export function workerJobSpec(
  state: GameState,
  role: WorkerRole,
): WorkerJobSpec | null {
  const worker = WORKERS.find((entry) => entry.id === role);
  if (!worker || state.upgrades.crew < worker.requiredCrew) return null;
  switch (role) {
    case "forester":
      return {
        inputs: {},
        outputs: { wood: gatherYield(state, "wood") },
        seconds: 4.25,
      };
    case "fisher":
      return {
        inputs: {},
        outputs: { fish: gatherYield(state, "fish") },
        seconds:
          3.8 / (1 + state.upgrades.rod * 0.1 + state.upgrades.nets * 0.08),
      };
    case "cutter":
      return state.upgrades.cutter
        ? {
            inputs: { fish: 1 },
            outputs: { steak: recipeYield(state, "steaks") },
            seconds: recipeDuration(state, "steaks"),
          }
        : null;
    case "miner":
      return state.upgrades.quarry
        ? {
            inputs: {},
            outputs: { ore: gatherYield(state, "ore") },
            seconds: 4,
          }
        : null;
    case "gardener":
      return state.upgrades.kelpfarm
        ? {
            inputs: {},
            outputs: { kelp: gatherYield(state, "kelp") },
            seconds: 3,
          }
        : null;
    case "crabber":
      return state.upgrades.crabpots
        ? {
            inputs: {},
            outputs: { crab: gatherYield(state, "crab") },
            seconds: 4,
          }
        : null;
    case "cook":
      return state.upgrades.kitchen
        ? {
            inputs: { steak: 1, kelp: 1 },
            outputs: { meal: recipeYield(state, "meals") },
            seconds: recipeDuration(state, "meals"),
          }
        : null;
    case "porter":
      return null;
  }
}
export const canWorkerStart = (state: GameState, role: WorkerRole): boolean => {
  const spec = workerJobSpec(state, role);
  if (!spec || state.workerJobs[role]) return false;
  for (const resource of RESOURCES)
    if (state.stock[resource] < (spec.inputs[resource] || 0)) return false;
  return (
    stockCount(state) -
      sumGoods(spec.inputs) +
      reservedStockCount(state) +
      sumGoods(spec.outputs) <=
    stockCapacity(state)
  );
};
/** Compatibility estimate only; active workers now deliver stock, never passive coins. */
export const workerRate = (state: GameState): number => state.upgrades.crew * 3;
function rollDaily(state: GameState, now: number): GameState {
  const date = utcDate(now);
  return state.daily.date === date
    ? state
    : { ...state, daily: { date, harvests: 0, earned: 0, claimed: false } };
}
function advanceTime(state: GameState, now: number): GameState {
  return { ...rollDaily(state, now), lastSaved: now };
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
  | { type: "reset" }
  | { type: "workerStart"; role: WorkerRole; now: number }
  | { type: "workerComplete"; role: WorkerRole; now: number }
  | { type: "takeStock"; resource?: Resource }
  | { type: "depositStock"; resource?: Resource; quantity?: number }
  | { type: "sellStock"; resource: Resource; quantity: number };
export function reduceGame(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "harvest": {
      const amount = Math.min(
        gatherYield(state, action.resource),
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
      const recipe = RECIPES.find((entry) => entry.id === action.recipe)!,
        amount = recipeYield(state, action.recipe),
        inventory = { ...state.inventory };
      for (const resource of RESOURCES)
        inventory[resource] -= recipe.inputs[resource] || 0;
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
    case "claimDaily":
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
    case "workerStart": {
      if (!validTime(action.now) || !canWorkerStart(state, action.role))
        return state;
      const spec = workerJobSpec(state, action.role)!,
        stock = { ...state.stock };
      for (const resource of RESOURCES)
        stock[resource] -= spec.inputs[resource] || 0;
      return {
        ...state,
        stock,
        workerJobs: {
          ...state.workerJobs,
          [action.role]: {
            startedAt: action.now,
            finishAt: action.now + Math.ceil(spec.seconds * 1000),
            outputs: { ...spec.outputs },
          },
        },
        lastSaved: Math.max(state.lastSaved, action.now),
      };
    }
    case "workerComplete": {
      const job = Object.hasOwn(state.workerJobs, action.role)
        ? state.workerJobs[action.role]
        : undefined;
      if (
        !job ||
        !validTime(action.now) ||
        action.now < job.finishAt ||
        stockCount(state) + sumGoods(job.outputs) > stockCapacity(state)
      )
        return state;
      const stock = { ...state.stock },
        workerJobs = { ...state.workerJobs };
      for (const resource of RESOURCES)
        stock[resource] += job.outputs[resource] || 0;
      delete workerJobs[action.role];
      return {
        ...state,
        stock,
        workerJobs,
        lastSaved: Math.max(state.lastSaved, action.now),
      };
    }
    case "takeStock": {
      if (action.resource && !RESOURCES.includes(action.resource)) return state;
      let space = capacity(state) - inventoryCount(state),
        moved = 0;
      if (space <= 0) return state;
      const inventory = { ...state.inventory },
        stock = { ...state.stock };
      for (const resource of action.resource
        ? [action.resource]
        : transferPriority) {
        const amount = Math.min(space, stock[resource]);
        if (amount) {
          inventory[resource] += amount;
          stock[resource] -= amount;
          space -= amount;
          moved += amount;
        }
      }
      return moved ? { ...state, inventory, stock } : state;
    }
    case "depositStock": {
      if (action.resource && !RESOURCES.includes(action.resource)) return state;
      if (
        action.quantity !== undefined &&
        (!Number.isSafeInteger(action.quantity) || action.quantity <= 0)
      )
        return state;
      let space =
          stockCapacity(state) - stockCount(state) - reservedStockCount(state),
        moved = 0;
      if (space <= 0) return state;
      const inventory = { ...state.inventory },
        stock = { ...state.stock };
      let requested = action.quantity ?? Infinity;
      for (const resource of action.resource
        ? [action.resource]
        : transferPriority) {
        const amount = Math.min(space, inventory[resource], requested);
        if (amount) {
          inventory[resource] -= amount;
          stock[resource] += amount;
          space -= amount;
          requested -= amount;
          moved += amount;
        }
      }
      return moved ? { ...state, inventory, stock } : state;
    }
    case "sellStock": {
      if (
        !RESOURCES.includes(action.resource) ||
        !Number.isSafeInteger(action.quantity) ||
        action.quantity <= 0 ||
        state.stock[action.resource] < action.quantity
      )
        return state;
      const value = resourceSaleValue(state, action.resource, action.quantity);
      return {
        ...state,
        stock: {
          ...state.stock,
          [action.resource]: state.stock[action.resource] - action.quantity,
        },
        coins: addBounded(state.coins, value),
        earned: addBounded(state.earned, value),
        trades: addBounded(state.trades, 1),
        xp: Math.min(MAX_XP, state.xp + action.quantity),
        daily: {
          ...state.daily,
          earned: addBounded(state.daily.earned, value),
        },
      };
    }
    default:
      return state;
  }
}

/** Simulate conservative minute-long work rounds only while the app was closed. */
function applyOffline(state: GameState, now: number): GameState {
  const elapsed = Math.max(0, Math.min(EIGHT_HOURS, now - state.lastSaved));
  let result = state;
  // Reserved inputs were already consumed before closing. Deliver their output once.
  for (const worker of WORKERS)
    result = reduceGame(result, {
      type: "workerComplete",
      role: worker.id,
      now,
    });
  if (elapsed >= 60_000) {
    const minutes = Math.floor(elapsed / 60_000),
      start = now - elapsed;
    for (let minute = 0; minute < minutes; minute++) {
      const at = start + minute * 60_000;
      for (const worker of WORKERS) {
        result = reduceGame(result, {
          type: "workerComplete",
          role: worker.id,
          now: at + 10_000,
        });
        if (worker.id === "porter" || result.workerJobs[worker.id]) continue;
        const started = reduceGame(result, {
          type: "workerStart",
          role: worker.id,
          now: at,
        });
        if (started !== result)
          result = reduceGame(started, {
            type: "workerComplete",
            role: worker.id,
            now: at + 10_000,
          });
      }
      if (result.upgrades.crew >= 5) {
        let budget = 4 + result.upgrades.dock;
        for (const resource of transferPriority) {
          const quantity = Math.min(budget, result.stock[resource]);
          if (quantity) {
            result = reduceGame(result, {
              type: "sellStock",
              resource,
              quantity,
            });
            budget -= quantity;
          }
          if (!budget) break;
        }
      }
    }
  }
  return { ...rollDaily(result, now), lastSaved: now };
}

/** Existing v1/v2 saves are migrated without dropping coins or carried goods. */
export function loadGame(raw: string | null, now = Date.now()): GameState {
  const initial = createInitialState(now);
  if (!raw) return initial;
  try {
    const data = record(JSON.parse(raw));
    if (![1, 2, 3].includes(data.version as number)) return initial;
    const legacy = data.version !== 3,
      version1 = data.version === 1,
      inv = record(data.inventory),
      stored = record(data.stock),
      upgradeData = record(data.upgrades),
      gathered = record(data.gathered),
      processed = record(data.processed),
      daily = record(data.daily);
    const upgrades = Object.fromEntries(
      UPGRADES.map((upgrade) => [
        upgrade.id,
        boundedInt(
          upgrade.id === "smokehouse" && version1
            ? (upgradeData.workshop ?? upgradeData.smokehouse)
            : upgradeData[upgrade.id],
          upgrade.id === "crew" ? 1 : 0,
          upgrade.maxLevel,
        ),
      ]),
    ) as Record<UpgradeId, number>;
    if (legacy) upgrades.crew = Math.max(1, upgrades.crew);
    const inventory = Object.fromEntries(
      RESOURCES.map((id) => [id, boundedInt(inv[id], 0, MAX_SAVED_INVENTORY)]),
    ) as Record<Resource, number>;
    let remaining = MAX_SAVED_INVENTORY;
    for (const id of RESOURCES) {
      inventory[id] = Math.min(remaining, inventory[id]);
      remaining -= inventory[id];
    }
    const safe: GameState = {
      version: 3,
      coins: boundedInt(data.coins, initial.coins),
      gems: boundedInt(data.gems, 0),
      xp: boundedInt(data.xp, 0, MAX_XP),
      inventory,
      stock: Object.fromEntries(
        RESOURCES.map((id) => [id, boundedInt(stored[id], 0, 900)]),
      ) as Record<Resource, number>,
      upgrades,
      workerJobs: {},
      gathered: Object.fromEntries(
        RESOURCES.map((id) => [id, boundedInt(gathered[id], 0)]),
      ) as Record<Resource, number>,
      processed: Object.fromEntries(
        RECIPES.map((recipe) => [
          recipe.id,
          boundedInt(processed[recipe.id], 0),
        ]),
      ) as Record<RecipeId, number>,
      harvests: boundedInt(data.harvests, 0),
      earned: boundedInt(data.earned, 0),
      trades: boundedInt(data.trades, 0),
      questsClaimed: [
        ...new Set(
          Array.isArray(data.questsClaimed)
            ? data.questsClaimed.filter(
                (id): id is string =>
                  typeof id === "string" &&
                  (QUESTS.some((q) => q.id === id) ||
                    OLD_QUEST_IDS.includes(id)),
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
    let stockSpace = stockCapacity(safe);
    for (const id of transferPriority) {
      safe.stock[id] = Math.min(stockSpace, safe.stock[id]);
      stockSpace -= safe.stock[id];
    }
    if (data.version === 3) {
      const jobs = record(data.workerJobs);
      for (const worker of WORKERS) {
        const job = record(jobs[worker.id]);
        if (
          !Object.keys(job).length ||
          worker.id === "porter" ||
          safe.upgrades.crew < worker.requiredCrew
        )
          continue;
        const startedAt = boundedInt(job.startedAt, now, now),
          finishAt = boundedInt(job.finishAt, startedAt, startedAt + 60_000),
          outputsData = record(job.outputs),
          outputs: Partial<Record<Resource, number>> = {};
        for (const id of RESOURCES) {
          const amount = boundedInt(outputsData[id], 0, 64);
          if (amount) outputs[id] = amount;
        }
        if (finishAt < startedAt || !sumGoods(outputs)) continue;
        safe.workerJobs[worker.id] = { startedAt, finishAt, outputs };
      }
    }
    return applyOffline(safe, now);
  } catch {
    return initial;
  }
}
export const serializeGame = (state: GameState): string =>
  JSON.stringify(state);
