import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, PointerEvent } from "react";
import {
  Anchor,
  ArrowDownToLine,
  ArrowRight,
  Axe,
  Backpack,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Fish,
  Flag,
  Hammer,
  Maximize2,
  Minus,
  Plus,
  Settings,
  Ship,
  ShoppingBasket,
  Snowflake,
  Sparkles,
  Store,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/nunito/latin-900.css";
import "@fontsource/lilita-one/latin-400.css";
import IslandScene from "./game/IslandScene";
import {
  capacity,
  createInitialState,
  DAILY_GOAL,
  inventoryCount,
  level,
  loadGame,
  questProgress,
  QUESTS,
  RECIPES,
  reduceGame,
  RESOURCES,
  RESOURCE_PRICES,
  resourceNames,
  sellValue,
  serializeGame,
  UPGRADES,
  upgradeCost,
  upgradeEffect,
  xpProgress,
} from "./game/model";
import type {
  ActivityId,
  GameAction,
  GameState,
  RecipeId,
  Resource,
  UpgradeId,
} from "./game/model";
import { CashArt, ResourceArt, UpgradeArt } from "./Art";

const SAVE_KEY = "frost-and-fin:save:v1";
type Menu = "build" | "cargo" | "goals" | "settings" | "help" | null;
type Category = "Yard" | "Gear" | "Crew";
type WorkInfo = {
  id: ActivityId | null;
  label: string;
  progress: number;
  busy: boolean;
};
const groupFor = (id: UpgradeId): Category =>
  id === "crew"
    ? "Crew"
    : ["axe", "rod", "backpack", "boots", "nets"].includes(id)
      ? "Gear"
      : "Yard";
const pretty = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: value >= 100000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
const activityNames: Record<ActivityId, string> = {
  wood: "CHOP",
  fish: "FISH",
  steaks: "CUT",
  planks: "SAW",
  smoked: "SMOKE",
  market: "SELL",
};
const visualStages: Record<UpgradeId, string[]> = {
  axe: [
    "Reinforced axe head",
    "Steel grip & larger blade",
    "Brass fittings",
    "Gold-edged blade",
    "Masterwork axe",
  ],
  rod: [
    "Longer pole & new guides",
    "Reinforced fishing pole",
    "Deep-water rig",
    "Brass rod fittings",
    "Master angler’s rig",
  ],
  backpack: [
    "New timber back rack",
    "Extra cargo rails",
    "Bigger wooden pack",
    "Reinforced cargo crate",
    "Full cargo frame",
  ],
  cutter: [
    "Powered saw & conveyor",
    "Twin-blade cutting frame",
    "Extra machine fittings",
    "Heavy-duty cutter",
    "Complete cutting line",
  ],
  sawmill: [
    "Build a working sawmill",
    "Add a log feeder",
    "Expand the log rack",
    "Upgrade the mill frame",
    "Full timber line",
  ],
  market: [
    "Build a stall frame",
    "Add a striped awning",
    "Build a snow-capped roof",
    "Open a second counter",
    "Add crates & cash storage",
  ],
  dock: [
    "Extend the timber pier",
    "Lay another deck section",
    "Add a longer fishing deck",
    "Expand the pier again",
    "Complete the trading pier",
  ],
  crew: [
    "Hire a working dockhand",
    "Hire a second helper",
    "Bring in a third hand",
    "Add another dockhand",
    "Hire the full crew",
  ],
  smokehouse: [
    "Build a fired smoker",
    "Add a smoking rack",
    "Hang more smoked goods",
    "Expand the smokehouse",
    "Full smoking station",
  ],
  freezer: [
    "Add an ice chest",
    "Build a metal icebox",
    "Add a cold-storage shed",
    "Fit a cooling panel",
    "Complete the cold store",
  ],
  boots: [
    "New leather soles",
    "Steel-blue boot fittings",
    "Brass boot fittings",
    "Reinforced winter boots",
    "Captain’s best boots",
  ],
  nets: [
    "Build a river net",
    "Add a second net",
    "Set a third river net",
    "Add a fourth net",
    "Full fishing-net rack",
  ],
};

function initialGame() {
  try {
    return loadGame(localStorage.getItem(SAVE_KEY));
  } catch {
    return createInitialState();
  }
}

function Sheet({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    host.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = host.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,a[href],[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === host.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="sheet-shade"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="game-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        ref={host}
      >
        <header className="sheet-header">
          <div>
            <h2 id="sheet-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="round-button close-menu"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={26} strokeWidth={3} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function objectiveFor(game: GameState): {
  title: string;
  detail: string;
  target: ActivityId | "build";
  upgrade?: UpgradeId;
  progress: number;
  total: number;
} {
  if (game.gathered.wood < 6)
    return {
      title: "Chop your first pine",
      detail: "Swing, fell the tree & collect the logs",
      target: "wood",
      progress: game.gathered.wood,
      total: 6,
    };
  if (game.trades < 1)
    return {
      title: "Make your first sale",
      detail: "Carry your timber to the counter",
      target: "market",
      progress: 0,
      total: 1,
    };
  if (game.gathered.fish < 1)
    return {
      title: "Land a whole tuna",
      detail: "Head to the river. Cast & reel it in!",
      target: "fish",
      progress: game.gathered.fish,
      total: 1,
    };
  if (game.processed.steaks < 4)
    return {
      title: "Turn tuna into steaks",
      detail: "Take your fish to the cutting bench",
      target: "steaks",
      progress: game.processed.steaks,
      total: 4,
    };
  if (game.upgrades.cutter < 1)
    return {
      title: "Build a powered cutter",
      detail: "A yellow saw, motor & moving belt",
      target: "build",
      upgrade: "cutter",
      progress: 0,
      total: 1,
    };
  if (game.upgrades.sawmill < 1)
    return {
      title: "Open your sawmill",
      detail: "Turn those logs into valuable planks",
      target: "build",
      upgrade: "sawmill",
      progress: 0,
      total: 1,
    };
  if (game.processed.planks < 2)
    return {
      title: "Get the sawmill running",
      detail: "Bring 3 logs. Watch the saw work.",
      target: "planks",
      progress: game.processed.planks,
      total: 2,
    };
  if (game.upgrades.crew < 1)
    return {
      title: "Hire your first dockhand",
      detail: "A real helper, working on your dock",
      target: "build",
      upgrade: "crew",
      progress: 0,
      total: 1,
    };
  if (game.upgrades.smokehouse < 1)
    return {
      title: "Fire up a smokehouse",
      detail: "Wood, steaks & a new line of goods",
      target: "build",
      upgrade: "smokehouse",
      progress: 0,
      total: 1,
    };
  return {
    title: "Build a working harbor",
    detail: "12 upgrades. All right here on your dock.",
    target: "build",
    progress: UPGRADES.filter((u) => game.upgrades[u.id] > 0).length,
    total: 12,
  };
}

export default function App() {
  const [game, setGame] = useState<GameState>(initialGame),
    stateRef = useRef(game);
  const [menu, setMenu] = useState<Menu>(null),
    [category, setCategory] = useState<Category>("Yard");
  const [command, setCommand] = useState<{
      id: number;
      target: ActivityId;
    } | null>(null),
    commandId = useRef(0);
  const [joystick, setJoystick] = useState({ x: 0, y: 0 }),
    [interactToken, setInteractToken] = useState(0);
  const [work, setWork] = useState<WorkInfo>({
    id: null,
    label: "Tap a pine or fish to get to work",
    progress: 0,
    busy: false,
  });
  const [ready, setReady] = useState(false),
    [notice, setNotice] = useState(""),
    [saveError, setSaveError] = useState(false);
  const [name, setName] = useState(game.playerName),
    [resetConfirm, setResetConfirm] = useState(false);
  const [coinFlash, setCoinFlash] = useState(0),
    [recentBuild, setRecentBuild] = useState("");
  const frame = useRef<HTMLDivElement>(null),
    importFile = useRef<HTMLInputElement>(null),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joy = useRef<HTMLDivElement>(null),
    joyPointer = useRef<number | null>(null);
  const notify = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 3800);
  }, []);
  const act = useCallback((action: GameAction) => {
    const next = reduceGame(stateRef.current, action);
    stateRef.current = next;
    setGame(next);
    return next;
  }, []);
  const close = useCallback(() => {
    setMenu(null);
    setResetConfirm(false);
  }, []);
  const open = useCallback((next: Menu) => {
    setJoystick({ x: 0, y: 0 });
    setMenu(next);
    setResetConfirm(false);
  }, []);
  const go = useCallback(
    (target: ActivityId) => {
      close();
      setCommand({ id: ++commandId.current, target });
    },
    [close],
  );
  const openBuild = useCallback(
    (id?: UpgradeId) => {
      if (id) setCategory(groupFor(id));
      open("build");
    },
    [open],
  );
  const objective = objectiveFor(game),
    pack = inventoryCount(game),
    maxPack = capacity(game),
    xp = xpProgress(game),
    playerLevel = level(game);
  const harvest = useCallback(
    (resource: Resource) => {
      const before = stateRef.current;
      const next = act({ type: "harvest", resource });
      const amount = next.inventory[resource] - before.inventory[resource];
      if (!amount) notify("Cargo full! Take your goods to the market.");
      if (level(next) > level(before)) notify(`Captain level ${level(next)}!`);
      return amount;
    },
    [act, notify],
  );
  const process = useCallback(
    (recipe: RecipeId) => {
      const before = stateRef.current;
      const next = act({ type: "process", recipe });
      return next.processed[recipe] > before.processed[recipe];
    },
    [act],
  );
  const sell = useCallback(() => {
    const before = stateRef.current;
    act({ type: "sell" });
    if (stateRef.current.workersStored > 0) act({ type: "collectWorkers" });
    const earned = stateRef.current.coins - before.coins;
    if (earned) {
      setCoinFlash(earned);
      setTimeout(() => setCoinFlash(0), 1700);
      notify(`SOLD! +${pretty(earned)} cash`);
    }
    return earned;
  }, [act, notify]);
  const buy = (id: UpgradeId) => {
    act({ type: "tick", now: Date.now() });
    const before = stateRef.current;
    const next = act({ type: "upgrade", id });
    if (next.upgrades[id] > before.upgrades[id]) {
      close();
      const upgrade = UPGRADES.find((u) => u.id === id)!;
      setRecentBuild(`${upgrade.name} · Tier ${next.upgrades[id]}`);
      setTimeout(() => setRecentBuild(""), 3300);
      notify(`Watch your ${upgrade.name.toLowerCase()} upgrade!`);
    } else notify("Sell another load to afford this upgrade.");
  };
  const claim = (id: string) => {
    const before = stateRef.current;
    const next = act({ type: "claimQuest", id });
    if (next !== before) notify("JOB DONE! Reward collected.");
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, serializeGame(game));
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [game]);
  useEffect(() => {
    const timer = setInterval(
      () => act({ type: "tick", now: Date.now() }),
      5000,
    );
    const save = () => {
      try {
        localStorage.setItem(SAVE_KEY, serializeGame(stateRef.current));
      } catch {
        /* Export is always available. */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [act]);
  useEffect(() => {
    const release = () => {
      joyPointer.current = null;
      setJoystick({ x: 0, y: 0 });
    };
    window.addEventListener("blur", release);
    window.addEventListener("pointerup", release);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("pointerup", release);
    };
  }, []);
  const moveJoy = (event: PointerEvent<HTMLDivElement>) => {
    if (joyPointer.current !== event.pointerId) return;
    const rect = joy.current!.getBoundingClientRect(),
      dx = event.clientX - rect.left - rect.width / 2,
      dy = event.clientY - rect.top - rect.height / 2;
    const radius = rect.width * 0.32,
      length = Math.hypot(dx, dy),
      scale = Math.max(radius, length);
    setJoystick({ x: dx / scale, y: dy / scale });
  };
  const exportGame = () => {
    const link = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([serializeGame(stateRef.current)], {
          type: "application/json",
        }),
      );
    link.href = url;
    link.download = "Frost-and-Fin-save.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Save exported. Keep it safe, captain.");
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch {
      notify("Your browser does not support full screen here.");
    }
  };
  const incomplete = QUESTS.filter((q) => !game.questsClaimed.includes(q.id));
  const rewardReady = incomplete.some(
    (q) => questProgress(q, game) >= q.target,
  );
  const dailyReady =
    game.daily.harvests >= DAILY_GOAL.harvests &&
    game.daily.earned >= DAILY_GOAL.earned;
  return (
    <div className="game-screen" ref={frame}>
      <div className="world-layer">
        <IslandScene
          game={game}
          paused={!!menu}
          command={command}
          joystick={joystick}
          interactToken={interactToken}
          onHarvest={harvest}
          onProcess={process}
          onSell={sell}
          onReady={() => setReady(true)}
          onActivity={setWork}
          onNotice={notify}
          onOpenBuild={openBuild}
        />
      </div>
      {!ready && (
        <div className="game-loading">
          <div className="loading-crest">
            <Anchor size={58} strokeWidth={2.5} />
          </div>
          <h1>
            FROST <span>&</span> FIN
          </h1>
          <p>Getting the dock ready…</p>
          <div className="loading-track">
            <span />
          </div>
        </div>
      )}
      <header className="game-hud">
        <div className="harbor-brand">
          <Fish size={32} strokeWidth={2.8} />
          <span>
            FROST <small>&</small> FIN
          </span>
        </div>
        <div
          className={`money-board ${coinFlash ? "cash-flash" : ""}`}
          aria-label={`${pretty(game.coins)} cash`}
        >
          <CashArt size={41} />
          <strong className="money-value">{pretty(game.coins)}</strong>
          {coinFlash > 0 && (
            <span className="cash-gain">+{pretty(coinFlash)}</span>
          )}
        </div>
        <button
          className="round-button settings-button"
          onClick={() => open("settings")}
          aria-label="Game settings"
        >
          <Settings size={25} strokeWidth={2.7} />
        </button>
      </header>
      <div className="captain-rank" aria-label={`Captain level ${playerLevel}`}>
        <span>{playerLevel}</span>
        <div>
          <strong>CAPTAIN</strong>
          <div className="rank-track">
            <i style={{ width: `${(xp.current / xp.needed) * 100}%` }} />
          </div>
        </div>
      </div>
      <button
        className="cargo-badge"
        onClick={() => open("cargo")}
        aria-label={`Cargo ${pack} of ${maxPack}`}
      >
        <Backpack size={22} strokeWidth={2.7} />
        <span className="pack-count">
          {pack}
          <small>/{maxPack}</small>
        </span>
        <div className="cargo-fill">
          <i style={{ height: `${Math.min(100, (pack / maxPack) * 100)}%` }} />
        </div>
      </button>
      <section className="objective-board" aria-label="Current job">
        <div className="objective-flag">
          <Flag size={25} strokeWidth={2.5} />
        </div>
        <div className="objective-copy">
          <span>
            DOCK JOB{" "}
            <i>
              {Math.min(objective.progress, objective.total)}/{objective.total}
            </i>
          </span>
          <h1>{objective.title}</h1>
          <p>{objective.detail}</p>
        </div>
        <button
          className="objective-go"
          aria-label={`Go: ${objective.title}`}
          onClick={() =>
            objective.target === "build"
              ? openBuild(objective.upgrade)
              : go(objective.target)
          }
        >
          <ArrowRight size={24} strokeWidth={3} />
        </button>
      </section>
      <div
        className={`work-readout ${work.busy ? "working" : ""}`}
        aria-live="polite"
      >
        <span>{work.busy ? <Hammer size={18} /> : <MouseHint />}</span>
        <strong>{work.label || "Tap a tree, fish or workbench"}</strong>
        {work.busy && (
          <div className="work-progress">
            <i
              style={{
                width: `${Math.max(0, Math.min(1, work.progress)) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
      {recentBuild && (
        <div className="build-announcement">
          <Hammer size={30} />
          <div>
            <small>BUILT ON YOUR DOCK</small>
            <strong>{recentBuild}</strong>
          </div>
        </div>
      )}
      <div className="activity-shortcuts" aria-label="Work on this dock">
        {(
          [
            {
              id: "wood",
              name: "Pines",
              icon: <ResourceArt type="wood" size={27} />,
            },
            {
              id: "fish",
              name: "Fish",
              icon: <ResourceArt type="fish" size={29} />,
            },
            {
              id: "steaks",
              name: "Cut tuna",
              icon: <ResourceArt type="steak" size={28} />,
            },
            { id: "market", name: "Market", icon: <CashArt size={29} /> },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            className={command?.target === item.id ? "selected" : ""}
            onClick={() => go(item.id)}
            aria-label={item.name}
          >
            {item.icon}
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <div className="movement-controls">
        <div
          ref={joy}
          className={`joystick ${joystick.x || joystick.y ? "moving" : ""}`}
          role="button"
          aria-label="Move captain"
          tabIndex={0}
          onPointerDown={(event) => {
            joyPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            moveJoy(event);
          }}
          onPointerMove={moveJoy}
          onPointerUp={() => {
            joyPointer.current = null;
            setJoystick({ x: 0, y: 0 });
          }}
          onPointerCancel={() => {
            joyPointer.current = null;
            setJoystick({ x: 0, y: 0 });
          }}
        >
          <span className="joystick-cross" />
          <span
            className="joystick-thumb"
            style={{
              transform: `translate(${joystick.x * 29}px,${joystick.y * 29}px)`,
            }}
          >
            <Anchor size={25} strokeWidth={2} />
          </span>
        </div>
        <button
          className={`work-button ${work.busy ? "busy" : ""}`}
          aria-label="Work nearby"
          onClick={() => setInteractToken((n) => n + 1)}
        >
          <span>
            {work.id === "wood" ? (
              <Axe size={34} strokeWidth={2.6} />
            ) : work.id === "market" ? (
              <ShoppingBasket size={34} strokeWidth={2.6} />
            ) : work.id === "steaks" || work.id === "planks" ? (
              <Hammer size={34} strokeWidth={2.6} />
            ) : (
              <Fish size={35} strokeWidth={2.6} />
            )}
          </span>
          <strong>
            {work.busy ? "WORKING" : work.id ? activityNames[work.id] : "WORK"}
          </strong>
        </button>
      </div>
      <nav className="dock-nav" aria-label="Game menus">
        <button onClick={() => openBuild()} aria-label="Build">
          <span className="nav-plaque">
            <Hammer size={29} strokeWidth={2.7} />
          </span>
          <strong>BUILD</strong>
          <small>
            {UPGRADES.filter((u) => game.upgrades[u.id] > 0).length}/12
          </small>
        </button>
        <button onClick={() => open("cargo")} aria-label="Cargo">
          <span className="nav-plaque">
            <Backpack size={29} strokeWidth={2.6} />
          </span>
          <strong>CARGO</strong>
          <small>
            {pack}/{maxPack}
          </small>
        </button>
        <button onClick={() => open("goals")} aria-label="Goals">
          <span className="nav-plaque">
            <Flag size={29} strokeWidth={2.6} />
          </span>
          <strong>GOALS</strong>
          {rewardReady && <i className="reward-ping">!</i>}
        </button>
      </nav>
      {notice && (
        <div
          className="game-notice"
          role="status"
          onClick={() => setNotice("")}
        >
          <CheckCheck size={22} />
          <span>{notice}</span>
        </div>
      )}
      {menu === "build" && (
        <Sheet
          title="BUILD YOUR DOCK"
          subtitle="Every upgrade changes something right here."
          onClose={close}
        >
          <div className="sheet-cash">
            <CashArt size={27} />
            <strong>{pretty(game.coins)}</strong>
            <span>CASH TO BUILD</span>
          </div>
          <div className="build-tabs" role="tablist" aria-label="Upgrade types">
            {(["Yard", "Gear", "Crew"] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={category === tab}
                onClick={() => setCategory(tab)}
              >
                {tab === "Yard" ? (
                  <Store size={21} />
                ) : tab === "Gear" ? (
                  <Axe size={21} />
                ) : (
                  <Users size={21} />
                )}
                <span>{tab}</span>
              </button>
            ))}
          </div>
          <div className="sheet-scroll upgrade-list">
            {UPGRADES.filter((u) => groupFor(u.id) === category).map(
              (upgrade) => {
                const current = game.upgrades[upgrade.id],
                  cost = upgradeCost(upgrade.id, game),
                  max = current >= upgrade.maxLevel;
                return (
                  <article
                    className="upgrade-card"
                    data-upgrade={upgrade.id}
                    key={upgrade.id}
                  >
                    <div className="upgrade-picture">
                      <UpgradeArt type={upgrade.id} level={current} />
                      <span>{current === 0 ? "NEW" : `TIER ${current}`}</span>
                    </div>
                    <div className="upgrade-information">
                      <h3>{upgrade.name}</h3>
                      <div
                        className="upgrade-stars"
                        aria-label={`Tier ${current} of ${upgrade.maxLevel}`}
                      >
                        {Array.from({ length: upgrade.maxLevel }, (_, i) => (
                          <span key={i} className={i < current ? "earned" : ""}>
                            ★
                          </span>
                        ))}
                      </div>
                      <p>
                        <b>{visualStages[upgrade.id][Math.min(current, 4)]}</b>
                        <br />
                        {upgradeEffect(
                          upgrade.id,
                          Math.min(upgrade.maxLevel, current + 1),
                        )}
                      </p>
                      <button
                        className={`upgrade-buy ${max ? "maxed" : ""}`}
                        data-upgrade={upgrade.id}
                        aria-label={`Buy ${upgrade.name}`}
                        disabled={max || game.coins < cost}
                        onClick={() => buy(upgrade.id)}
                      >
                        {max ? (
                          <>
                            <Check size={21} />
                            MAXED
                          </>
                        ) : (
                          <>
                            <span>{current === 0 ? "BUILD" : "UPGRADE"}</span>
                            <CashArt size={23} />
                            <strong>{pretty(cost)}</strong>
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
          <footer className="sheet-note">
            <Hammer size={18} /> Buy an upgrade, then watch it get built.
          </footer>
        </Sheet>
      )}
      {menu === "cargo" && (
        <Sheet
          title="YOUR CARGO"
          subtitle="Real goods. Better products. Bigger payday."
          onClose={close}
        >
          <div className="cargo-heading">
            <Backpack size={32} />
            <strong>
              {pack} <small>/ {maxPack}</small>
            </strong>
            <span>ON YOUR BACK</span>
          </div>
          <div className="sheet-scroll cargo-content">
            <div className="inventory-list">
              {RESOURCES.map((resource) => (
                <div
                  className="inventory-row"
                  data-resource={resource}
                  key={resource}
                >
                  <ResourceArt type={resource} size={45} />
                  <div>
                    <strong>{resourceNames[resource]}</strong>
                    <small>{RESOURCE_PRICES[resource]} cash each</small>
                  </div>
                  <span className="inventory-amount">
                    {game.inventory[resource]}
                  </span>
                </div>
              ))}
            </div>
            <h3 className="subheading">MAKE SOMETHING WORTH MORE</h3>
            <div className="recipe-list">
              {RECIPES.map((recipe) => (
                <button
                  className="recipe-row"
                  key={recipe.id}
                  onClick={() => {
                    if (
                      recipe.requiredUpgrade &&
                      game.upgrades[recipe.requiredUpgrade] < 1
                    )
                      openBuild(recipe.requiredUpgrade);
                    else go(recipe.id);
                  }}
                >
                  <span className="recipe-icons">
                    {Object.entries(recipe.inputs).map(([resource, amount]) => (
                      <span key={resource}>
                        <ResourceArt type={resource as Resource} size={28} />
                        <b>{amount}</b>
                      </span>
                    ))}
                    <ArrowRight size={18} />
                    <span>
                      <ResourceArt type={recipe.output} size={32} />
                      <b>{recipe.amount}</b>
                    </span>
                  </span>
                  <strong>{recipe.name}</strong>
                  <ChevronRight size={20} />
                </button>
              ))}
            </div>
            {game.upgrades.crew > 0 && (
              <div className="worker-share">
                <Users size={24} />
                <div>
                  <strong>Dock crew earnings</strong>
                  <span>
                    {pretty(game.workersStored)} cash waiting at the market
                  </span>
                </div>
              </div>
            )}
          </div>
          <footer className="sheet-footer">
            <span>
              LOAD VALUE{" "}
              <strong>
                <CashArt size={26} />
                {pretty(sellValue(game))}
              </strong>
            </span>
            <button
              className="large-game-button green"
              onClick={() => go("market")}
              aria-label="Take to market"
            >
              TAKE TO MARKET <ArrowRight size={21} />
            </button>
          </footer>
        </Sheet>
      )}
      {menu === "goals" && (
        <Sheet
          title="CAPTAIN’S JOBS"
          subtitle="Build a business on this dock. Collect your rewards."
          onClose={close}
        >
          <div className="sheet-scroll goals-content">
            <div className="daily-board">
              <span className="daily-badge">
                <Trophy size={30} />
              </span>
              <div>
                <h3>DAILY HAUL</h3>
                <p>
                  Gather {DAILY_GOAL.harvests} goods · Earn {DAILY_GOAL.earned}{" "}
                  cash
                </p>
                <div className="daily-bars">
                  <span>
                    Gathered{" "}
                    {Math.min(game.daily.harvests, DAILY_GOAL.harvests)}/
                    {DAILY_GOAL.harvests}
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${Math.min(100, (game.daily.harvests / DAILY_GOAL.harvests) * 100)}%`,
                      }}
                    />
                  </div>
                  <span>
                    Earned {Math.min(game.daily.earned, DAILY_GOAL.earned)}/
                    {DAILY_GOAL.earned}
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${Math.min(100, (game.daily.earned / DAILY_GOAL.earned) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <button
                  className="large-game-button green"
                  disabled={!dailyReady || game.daily.claimed}
                  onClick={() => {
                    act({ type: "claimDaily" });
                    notify("Daily haul complete! Reward collected.");
                  }}
                >
                  {game.daily.claimed ? (
                    "COLLECTED"
                  ) : (
                    <>
                      <CashArt size={26} />
                      {DAILY_GOAL.reward} CASH
                    </>
                  )}
                </button>
              </div>
            </div>
            {QUESTS.map((quest) => {
              const progress = questProgress(quest, game),
                claimed = game.questsClaimed.includes(quest.id),
                done = progress >= quest.target;
              return (
                <article
                  className={`quest-card ${claimed ? "claimed" : ""}`}
                  key={quest.id}
                >
                  <span className="quest-emblem">
                    {claimed ? <Check size={27} /> : <Flag size={27} />}
                  </span>
                  <div>
                    <h3>{quest.title}</h3>
                    <p>{quest.description}</p>
                    <div className="quest-meter">
                      <span>
                        <i
                          style={{
                            width: `${(progress / quest.target) * 100}%`,
                          }}
                        />
                      </span>
                      <strong>
                        {pretty(progress)}/{pretty(quest.target)}
                      </strong>
                    </div>
                    <button
                      className="large-game-button gold"
                      disabled={!done || claimed}
                      onClick={() => claim(quest.id)}
                    >
                      {claimed ? (
                        <>
                          <Check size={18} />
                          COLLECTED
                        </>
                      ) : (
                        <>
                          {done ? "CLAIM" : "REWARD"}
                          <CashArt size={23} />
                          {pretty(quest.reward)}
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </Sheet>
      )}
      {menu === "settings" && (
        <Sheet title="CAPTAIN’S CABIN" onClose={close}>
          <div className="sheet-scroll settings-content">
            <label className="captain-name" htmlFor="captain-name">
              CAPTAIN’S NAME
              <div>
                <input
                  id="captain-name"
                  value={name}
                  onChange={(event) => setName(event.target.value.slice(0, 28))}
                />
                <button
                  aria-label="Save captain name"
                  className="square-button"
                  onClick={() => {
                    act({ type: "rename", name });
                    notify("Captain’s name saved.");
                  }}
                >
                  <Check size={24} />
                </button>
              </div>
            </label>
            <button
              className="setting-button"
              onClick={() => act({ type: "toggleSound" })}
            >
              {game.sound ? <Volume2 size={27} /> : <VolumeX size={27} />}
              <strong>Sound effects</strong>
              <span>{game.sound ? "ON" : "OFF"}</span>
            </button>
            <button
              className="setting-button"
              onClick={() => void fullscreen()}
            >
              <Maximize2 size={25} />
              <strong>Full screen</strong>
              <ChevronRight size={24} />
            </button>
            <button className="setting-button" onClick={() => open("help")}>
              <CircleHelp size={27} />
              <strong>How to play</strong>
              <ChevronRight size={24} />
            </button>
            <h3 className="subheading">KEEP YOUR PROGRESS</h3>
            <p className="save-explanation">
              {saveError
                ? "Browser saving is unavailable. Export a backup to keep your progress."
                : "Your dock saves automatically in this browser."}
            </p>
            <div className="save-buttons">
              <button
                className="large-game-button blue"
                onClick={exportGame}
                aria-label="Export save"
              >
                <ArrowDownToLine size={23} />
                EXPORT SAVE
              </button>
              <button
                className="large-game-button blue"
                onClick={() => importFile.current?.click()}
                aria-label="Import save"
              >
                <Ship size={23} />
                IMPORT SAVE
              </button>
            </div>
            <input
              className="hidden-file"
              type="file"
              accept="application/json,.json"
              ref={importFile}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 100000) throw Error();
                  const text = await file.text(),
                    data = JSON.parse(text);
                  if (
                    ![1, 2].includes(data.version) ||
                    !data.inventory ||
                    !data.upgrades
                  )
                    throw Error();
                  const next = loadGame(text);
                  stateRef.current = next;
                  setGame(next);
                  setName(next.playerName);
                  notify("Welcome back, captain. Save restored.");
                } catch {
                  notify("Could not load that save. Your dock is safe.");
                }
                event.target.value = "";
              }}
            />
            <div className="reset-box">
              <p>
                {resetConfirm
                  ? "This clears your dock and goods. Export a backup first if you want to keep them."
                  : "Want to start from a fresh dock?"}
              </p>
              <button
                className="large-game-button red"
                onClick={() => {
                  if (!resetConfirm) {
                    setResetConfirm(true);
                    return;
                  }
                  const next = createInitialState();
                  stateRef.current = next;
                  setGame(next);
                  setName(next.playerName);
                  close();
                  go("wood");
                  notify("Fresh snow. Fresh start.");
                }}
              >
                {resetConfirm ? "YES, RESET MY DOCK" : "START OVER"}
              </button>
              {resetConfirm && (
                <button
                  className="cancel-reset"
                  onClick={() => setResetConfirm(false)}
                >
                  Keep my dock
                </button>
              )}
            </div>
          </div>
        </Sheet>
      )}
      {menu === "help" && (
        <Sheet title="GET TO WORK, CAPTAIN!" onClose={close}>
          <div className="sheet-scroll help-content">
            {[
              {
                icon: <Axe size={30} />,
                title: "CHOP & COLLECT",
                text: "Tap a pine or choose Pines. Your captain swings the axe, fells the tree, then collects the fallen logs.",
              },
              {
                icon: <Fish size={31} />,
                title: "LAND A WHOLE TUNA",
                text: "Choose Fish or tap the river. Watch the cast, bite and catch. Whole fish stack on your back.",
              },
              {
                icon: <ResourceArt type="steak" size={34} />,
                title: "CUT IT INTO STEAKS",
                text: "Bring a tuna to the cutting bench. The cleaver slices it into steaks. Build the yellow powered cutter to speed things up.",
              },
              {
                icon: <Store size={30} />,
                title: "SERVE YOUR CUSTOMERS",
                text: "Choose Market. Carry your goods to the counter, watch the sale and collect your cash.",
              },
              {
                icon: <Hammer size={31} />,
                title: "BUILD UP THIS DOCK",
                text: "Twelve upgrades, all in the starting area. New sawmills, smokehouses, nets, dockhands and better gear. Buy one and watch it change the world.",
              },
            ].map((step, index) => (
              <div className="help-step" key={step.title}>
                <span>
                  {step.icon}
                  <i>{index + 1}</i>
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
            <p className="help-controls">
              Drag the joystick to move. Tap WORK near a station. On a keyboard:
              WASD or arrow keys to move, E to work.
            </p>
            <button className="large-game-button green" onClick={close}>
              BACK TO THE DOCK <ArrowRight size={23} />
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
function MouseHint() {
  return <span className="tap-hand">☝</span>;
}
