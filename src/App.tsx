import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Anchor,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Backpack,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Compass,
  Fish,
  Flag,
  Hammer,
  LockKeyhole,
  Map,
  Maximize2,
  Minus,
  MousePointer2,
  Music2,
  Plus,
  Settings2,
  Ship,
  ShoppingBasket,
  Snowflake,
  Sparkles,
  Store,
  Sunrise,
  TrendingUp,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
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
  reduceGame,
  REGIONS,
  RESOURCE_PRICES,
  sellValue,
  serializeGame,
  UPGRADES,
  upgradeCost,
  xpProgress,
} from "./game/model";
import type { GameAction, GameState, Resource, UpgradeId } from "./game/model";
import { BackpackArt, IslandArt, ResourceArt } from "./Art";

type Panel =
  | "market"
  | "upgrades"
  | "map"
  | "inventory"
  | "journal"
  | "settings"
  | "help"
  | null;
const SAVE_KEY = "frost-and-fin:save:v1";
const resourceNames: Record<Resource, string> = {
  wood: "Pine timber",
  fish: "Fresh tuna",
  salmon: "Wild salmon",
};
const resources: Resource[] = ["wood", "fish", "salmon"];
const upgradeIcons = {
  rod: Fish,
  backpack: Backpack,
  market: Store,
  workshop: Hammer,
  crew: Users,
};
const number = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);

function readSave() {
  try {
    return loadGame(localStorage.getItem(SAVE_KEY));
  } catch {
    return createInitialState();
  }
}
function playChime() {
  try {
    const Audio =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const context = new Audio();
    [523.25, 659.25, 783.99].forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, context.currentTime + i * 0.07);
      gain.gain.linearRampToValueAtTime(
        0.055,
        context.currentTime + i * 0.07 + 0.01,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + i * 0.07 + 0.23,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + i * 0.07);
      oscillator.stop(context.currentTime + i * 0.07 + 0.24);
    });
    setTimeout(() => void context.close(), 600);
  } catch {
    /* Audio is optional on browsers that do not support it. */
  }
}

function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,a[href],[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-top">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            className="icon-button close-button"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [game, setGame] = useState<GameState>(readSave);
  const gameRef = useRef(game);
  const [panel, setPanel] = useState<Panel>(null);
  const [zoom, setZoom] = useState(1.15);
  const [focusToken, setFocusToken] = useState(0);
  const [ready, setReady] = useState(false);
  const [notices, setNotices] = useState<{ id: number; text: string }[]>([]);
  const [saved, setSaved] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [resetStep, setResetStep] = useState(false);
  const [name, setName] = useState(game.playerName);
  const [lastSaleValue, setLastSaleValue] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const noticeId = useRef(0);
  const notify = useCallback((text: string) => {
    const id = ++noticeId.current;
    setNotices((items) => [...items.slice(-2), { id, text }]);
    setTimeout(
      () => setNotices((items) => items.filter((n) => n.id !== id)),
      4200,
    );
  }, []);
  const act = useCallback((action: GameAction) => {
    const next = reduceGame(gameRef.current, action);
    gameRef.current = next;
    setGame(next);
    return next;
  }, []);
  const close = useCallback(() => {
    setPanel(null);
    setResetStep(false);
  }, []);
  const open = useCallback((value: Panel) => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    setPanel(value);
    setResetStep(false);
  }, []);

  useEffect(() => {
    setSaved(false);
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, serializeGame(game));
        setSaved(true);
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [game]);
  useEffect(() => {
    const timer = setInterval(
      () => act({ type: "tick", now: Date.now() }),
      10000,
    );
    return () => clearInterval(timer);
  }, [act]);
  useEffect(() => {
    const handle = () => {
      try {
        localStorage.setItem(
          SAVE_KEY,
          serializeGame(
            reduceGame(gameRef.current, { type: "tick", now: Date.now() }),
          ),
        );
      } catch {
        /* Settings offers a downloadable backup. */
      }
    };
    window.addEventListener("pagehide", handle);
    return () => window.removeEventListener("pagehide", handle);
  }, []);

  const count = inventoryCount(game),
    limit = capacity(game),
    playerLevel = level(game),
    xp = xpProgress(game);
  const activeQuests = QUESTS.filter(
    (quest) => !game.questsClaimed.includes(quest.id),
  );
  const dailyComplete =
    game.daily.harvests >= DAILY_GOAL.harvests &&
    game.daily.earned >= DAILY_GOAL.earned;
  const allUpgrades = Object.values(game.upgrades).reduce((a, b) => a + b, 0);
  const harvest = useCallback(
    (resource: Resource) => {
      const before = gameRef.current;
      if (inventoryCount(before) >= capacity(before)) {
        notify("Your pack is full. Visit the fish market to sell your catch.");
        return false;
      }
      const next = act({ type: "harvest", resource });
      if (level(next) > level(before))
        notify(`Level ${level(next)}! New waters are waiting.`);
      return next.harvests > before.harvests;
    },
    [act, notify],
  );
  const sell = () => {
    const value = sellValue(gameRef.current);
    if (!value) return;
    setLastSaleValue(value);
    act({ type: "sell" });
    close();
    notify(`Catch sold! +${number(value)} coins. A good day at the harbor.`);
    if (gameRef.current.sound) playChime();
  };
  const buy = (id: UpgradeId) => {
    const before = gameRef.current;
    const next = act({ type: "upgrade", id });
    if (next.upgrades[id] > before.upgrades[id]) {
      notify(
        `${UPGRADES.find((u) => u.id === id)?.name} upgraded to level ${next.upgrades[id]}!`,
      );
      if (next.sound) playChime();
    }
  };
  const claimQuest = (id: string) => {
    const before = gameRef.current;
    const next = act({ type: "claimQuest", id });
    if (next !== before) {
      notify("Task complete. Your reward is in!");
      if (next.sound) playChime();
    }
  };
  const exportSave = () => {
    const url = URL.createObjectURL(
      new Blob([serializeGame(gameRef.current)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "frost-and-fin-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Your harbor has been packed into a save file.");
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch {
      notify("Full screen is unavailable in this browser.");
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            close();
          }}
          aria-label="Frost and Fin home"
        >
          <span className="brand-mark">
            <Fish size={30} strokeWidth={1.65} />
            <span className="brand-spark">✦</span>
          </span>
          <span>
            frost <i>&</i> fin
            <span className="brand-caption">
              A LITTLE HARBOR. A BIG ADVENTURE.
            </span>
          </span>
        </a>
        <nav className="header-nav" aria-label="Main navigation">
          <button className={!panel ? "active" : ""} onClick={close}>
            <Anchor size={16} />
            My harbor
          </button>
          <button
            className={panel === "map" ? "active" : ""}
            onClick={() => open("map")}
          >
            <Compass size={16} />
            Explore
          </button>
          <button
            className={panel === "journal" ? "active" : ""}
            onClick={() => open("journal")}
          >
            <BookOpen size={16} />
            Journal
            {activeQuests.some((q) => questProgress(q, game) >= q.target) && (
              <span className="nav-dot" />
            )}
          </button>
        </nav>
        <div className="header-account">
          <span
            className="save-status"
            title={
              saveError
                ? "Browser storage unavailable. Export a backup in settings."
                : "Progress is saved on this device"
            }
          >
            {saveError ? <CircleHelp size={14} /> : <CheckCheck size={14} />}
            <span>
              {saveError
                ? "Export a backup"
                : saved
                  ? "All progress saved"
                  : "Saving…"}
            </span>
          </span>
          <button
            className="avatar"
            aria-label="Open profile and settings"
            onClick={() => open("settings")}
          >
            <span>{game.playerName.charAt(0).toUpperCase()}</span>
            <i>{playerLevel}</i>
          </button>
        </div>
      </header>

      <main>
        <section className="page-heading">
          <div>
            <div className="eyebrow heading-eyebrow">
              <span className="live-dot" /> YOUR OWN CORNER OF THE COAST
            </div>
            <h1>
              Frosthaven Harbor
              <span className="heading-snow">
                <Snowflake size={25} strokeWidth={1.3} />
              </span>
            </h1>
            <p>Small beginnings. Fresh catches. Endless possibilities.</p>
          </div>
          <div className="balances">
            <button
              className="currency coins"
              onClick={() => open("market")}
              aria-label={`${number(game.coins)} coins. Open market`}
            >
              <ResourceArt type="coin" size={30} />
              <div>
                <span>YOUR COINS</span>
                <strong>{number(game.coins)}</strong>
              </div>
              <span className="currency-plus">
                <Plus size={14} />
              </span>
            </button>
            <button
              className="currency gems"
              onClick={() => {
                open("journal");
                notify("Earn pearls by completing harbor milestones.");
              }}
              aria-label={`${game.gems} pearls. View milestones`}
            >
              <ResourceArt type="gem" size={28} />
              <div>
                <span>PEARLS</span>
                <strong>{number(game.gems)}</strong>
              </div>
            </button>
          </div>
        </section>

        <div className="game-layout">
          <div className="world-column">
            <div className="world-frame" ref={frame}>
              <IslandScene
                onHarvest={harvest}
                onOpenMarket={() => open("market")}
                onOpenUpgrade={() => open("upgrades")}
                onOpenMap={() => open("map")}
                onReady={() => setReady(true)}
                onNotice={notify}
                unlockedRegions={game.unlockedRegions}
                toolLevel={game.upgrades.rod}
                sound={game.sound}
                zoom={zoom}
                focusToken={focusToken}
                carriedCount={count}
                paused={!!panel}
                buildingLevels={{
                  market: game.upgrades.market,
                  workshop: game.upgrades.workshop,
                  crew: game.upgrades.crew,
                }}
                saleToken={game.trades}
                lastSaleValue={lastSaleValue}
                harvestAmount={(resource) => {
                  const state = gameRef.current;
                  return Math.min(
                    capacity(state) - inventoryCount(state),
                    { wood: 3, fish: 2, salmon: 1 }[resource] +
                      state.upgrades.rod +
                      REGIONS.filter(
                        (region) =>
                          region.id !== "harbor" &&
                          region.resource === resource &&
                          state.unlockedRegions.includes(region.id),
                      ).length *
                        2,
                  );
                }}
              />
              {!ready && (
                <div className="world-loading">
                  <Snowflake size={36} />
                  <span>A little harbor is waking up…</span>
                </div>
              )}
              <div className="world-top">
                <div className="region-chip">
                  <span className="region-symbol">
                    <Anchor size={21} />
                  </span>
                  <div>
                    <strong>Frosthaven</strong>
                    <span>THE NORTHERN COAST</span>
                  </div>
                  <span className="region-level">LV. {playerLevel}</span>
                </div>
                <div className="weather-chip">
                  <Sunrise size={19} />
                  <span>A crisp new day</span>
                  <span className="weather-temp">−2°</span>
                </div>
              </div>
              <div className="world-tools">
                <button
                  className="map-icon-button"
                  title={game.sound ? "Mute sound" : "Enable sound"}
                  aria-label={game.sound ? "Mute sound" : "Enable sound"}
                  onClick={() => act({ type: "toggleSound" })}
                >
                  {game.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button
                  className="map-icon-button"
                  title="Game settings"
                  aria-label="Game settings"
                  onClick={() => open("settings")}
                >
                  <Settings2 size={18} />
                </button>
                <button
                  className="map-icon-button"
                  title="Full screen"
                  aria-label="Full screen"
                  onClick={() => void fullscreen()}
                >
                  <Maximize2 size={18} />
                </button>
              </div>
              <div className="world-caption">
                <span className="world-status-dot" />
                <span>
                  {game.upgrades.crew
                    ? "Your crew is keeping the harbor busy"
                    : "A fresh catch is just a cast away"}
                </span>
              </div>
              <div className="world-bottom">
                <button
                  className="location-button"
                  aria-label="Recenter harbor"
                  onClick={() => {
                    setZoom(1.15);
                    setFocusToken((n) => n + 1);
                  }}
                >
                  <Compass size={22} />
                </button>
                <div className="movement-hint">
                  <MousePointer2 size={15} />
                  <span>
                    Click to move <i>·</i> Click fish to gather
                  </span>
                </div>
                <div className="zoom-controls">
                  <button
                    aria-label="Zoom out"
                    disabled={zoom <= 0.76}
                    onClick={() => setZoom((z) => Math.max(0.75, z - 0.1))}
                  >
                    <Minus size={17} />
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    aria-label="Zoom in"
                    disabled={zoom >= 1.34}
                    onClick={() => setZoom((z) => Math.min(1.35, z + 0.1))}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
              <div className="scene-badge">
                <Waves size={12} /> LIVE WORLD
              </div>
            </div>

            <div className="harbor-toolbar">
              <div className="backpack-summary">
                <span className="toolbar-icon">
                  <Backpack size={23} />
                </span>
                <div>
                  <div className="pack-label">
                    Your backpack{" "}
                    <span>
                      {count}
                      <i> / {limit}</i>
                    </span>
                  </div>
                  <div
                    className={`progress-track ${count >= limit ? "full" : ""}`}
                  >
                    <span
                      style={{
                        width: `${Math.min(100, (count / limit) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="resource-summary">
                {resources.map((resource) => (
                  <button
                    key={resource}
                    onClick={() => open("inventory")}
                    title={resourceNames[resource]}
                  >
                    <ResourceArt type={resource} size={30} />
                    <strong>{game.inventory[resource]}</strong>
                  </button>
                ))}
              </div>
              <button
                className="button button-gold sell-button"
                onClick={() => open("market")}
              >
                <ShoppingBasket size={18} />
                <span>Sell your catch</span>
                <ArrowUpRight size={17} />
              </button>
            </div>

            <nav className="game-nav" aria-label="Harbor menus">
              {(
                [
                  {
                    panel: "upgrades",
                    icon: Hammer,
                    label: "Build & upgrade",
                    hint: allUpgrades ? "Keep growing" : "Make it yours",
                  },
                  {
                    panel: "map",
                    icon: Map,
                    label: "World map",
                    hint: `${game.unlockedRegions.length} of ${REGIONS.length} regions`,
                  },
                  {
                    panel: "inventory",
                    icon: Backpack,
                    label: "Backpack",
                    hint: `${count} items collected`,
                  },
                  {
                    panel: "journal",
                    icon: BookOpen,
                    label: "Harbor journal",
                    hint: `${game.questsClaimed.length} tasks complete`,
                  },
                ] as const
              ).map((item) => (
                <button key={item.panel} onClick={() => open(item.panel)}>
                  <span className="game-nav-icon">
                    <item.icon size={21} strokeWidth={1.65} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                  <ChevronRight size={15} className="nav-chevron" />
                </button>
              ))}
            </nav>
          </div>

          <aside className="sidebar">
            <section className="level-card">
              <div className="level-rosette">
                <Anchor size={24} />
                <span>{playerLevel}</span>
              </div>
              <div>
                <div className="level-title">
                  {playerLevel < 5
                    ? "Harbor newcomer"
                    : playerLevel < 12
                      ? "Coastal merchant"
                      : "Harbor master"}
                  <Sparkles size={14} />
                </div>
                <div className="level-caption">Every little step counts.</div>
                <div className="xp-line">
                  <div className="progress-track">
                    <span
                      style={{ width: `${(xp.current / xp.needed) * 100}%` }}
                    />
                  </div>
                  <span>
                    {xp.current} / {xp.needed} XP
                  </span>
                </div>
              </div>
            </section>

            <section className="tasks-card">
              <div className="card-heading">
                <span className="card-icon">
                  <Flag size={17} />
                </span>
                <h2>A good day’s work</h2>
                <span className="tiny-tag">DAILY</span>
              </div>
              <p className="card-description">
                A little effort. A lovely reward.
              </p>
              <div className="daily-task">
                <span
                  className={`task-circle ${game.daily.harvests >= 30 ? "complete" : ""}`}
                >
                  {game.daily.harvests >= 30 ? (
                    <Check size={14} />
                  ) : (
                    <Fish size={15} />
                  )}
                </span>
                <div>
                  <strong>Bring in a fresh catch</strong>
                  <span>Gather {DAILY_GOAL.harvests} resources</span>
                </div>
                <small>{Math.min(game.daily.harvests, 30)}/30</small>
              </div>
              <div className="task-progress progress-track">
                <span
                  style={{
                    width: `${Math.min(100, (game.daily.harvests / 30) * 100)}%`,
                  }}
                />
              </div>
              <div className="daily-task">
                <span
                  className={`task-circle ${game.daily.earned >= 500 ? "complete" : ""}`}
                >
                  {game.daily.earned >= 500 ? (
                    <Check size={14} />
                  ) : (
                    <Store size={15} />
                  )}
                </span>
                <div>
                  <strong>Keep the harbor buzzing</strong>
                  <span>Earn {DAILY_GOAL.earned} coins from trading</span>
                </div>
                <small>{Math.min(game.daily.earned, 500)}/500</small>
              </div>
              <div className="task-progress progress-track">
                <span
                  style={{
                    width: `${Math.min(100, (game.daily.earned / 500) * 100)}%`,
                  }}
                />
              </div>
              <div className="daily-reward">
                <div>
                  <span className="gift-icon">
                    <Trophy size={16} />
                  </span>
                  <span>
                    {game.daily.claimed
                      ? "Nicely done, captain!"
                      : "Today’s reward"}
                  </span>
                  <ResourceArt type="coin" size={20} />
                  <strong>180</strong>
                </div>
                <button
                  aria-label="Claim daily reward"
                  disabled={!dailyComplete || game.daily.claimed}
                  onClick={() => {
                    act({ type: "claimDaily" });
                    notify("Daily goals complete! +180 coins.");
                  }}
                >
                  {game.daily.claimed ? (
                    <Check size={17} />
                  ) : (
                    <ChevronRight size={17} />
                  )}
                </button>
              </div>
            </section>

            <section className="next-upgrade-card">
              <div className="eyebrow">
                <span /> A LITTLE ROOM TO GROW
              </div>
              <BackpackArt className="backpack-art" />
              <div className="upgrade-card-copy">
                <span className="tiny-label">YOUR NEXT UPGRADE</span>
                <h2>A bigger catch.</h2>
                <p>
                  More room in your pack.
                  <br />
                  More possibilities on the horizon.
                </p>
                <button
                  className="button button-navy"
                  onClick={() => open("upgrades")}
                >
                  <span>Upgrade backpack</span>
                  <span className="button-price">
                    <ResourceArt type="coin" size={19} />
                    {number(upgradeCost("backpack", game))}
                  </span>
                </button>
              </div>
            </section>

            <button
              className="journal-teaser"
              onClick={() =>
                open(
                  game.upgrades.crew && game.workersStored
                    ? "market"
                    : "journal",
                )
              }
            >
              <span className="journal-icon">
                {game.upgrades.crew ? (
                  <Users size={20} />
                ) : (
                  <BookOpen size={20} />
                )}
              </span>
              <span>
                <strong>
                  {game.workersStored
                    ? `${number(game.workersStored)} crew earnings ready`
                    : "Your story is just beginning"}
                </strong>
                <small>
                  {game.workersStored
                    ? "Collect your share at the market"
                    : "Open your harbor journal"}
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
          </aside>
        </div>

        <footer className="page-footer">
          <span>
            <Snowflake size={13} /> Made for slow mornings & big dreams.
          </span>
          <div>
            <span className="keyboard-tip">
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> to move <i>·</i>
              <kbd>E</kbd> to interact
            </span>
            <button onClick={() => open("help")}>
              <CircleHelp size={15} /> How to play
            </button>
          </div>
        </footer>
      </main>

      <div className="toasts" role="status" aria-live="polite">
        {notices.map((notice) => (
          <div className="toast" key={notice.id}>
            <span>
              <Sparkles size={17} />
            </span>
            {notice.text}
            <button
              aria-label="Dismiss notification"
              onClick={() =>
                setNotices((items) => items.filter((n) => n.id !== notice.id))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {panel === "market" && (
        <Modal
          title="Fresh catch. Fair trade."
          eyebrow="THE FROSTHAVEN FISH MARKET"
          onClose={close}
        >
          <div className="market-intro">
            <span className="large-menu-icon">
              <Store size={32} />
            </span>
            <p>
              The boats are in, the counter is open, and your neighbors are
              hungry. Turn today’s haul into tomorrow’s possibilities.
            </p>
          </div>
          <div className="market-list">
            {resources.map((resource) => (
              <div className="market-row" key={resource}>
                <span className="resource-art-holder">
                  <ResourceArt type={resource} size={39} />
                </span>
                <div>
                  <strong>{resourceNames[resource]}</strong>
                  <small>
                    {RESOURCE_PRICES[resource]} coins each ·{" "}
                    {game.inventory[resource]} in your pack
                  </small>
                </div>
                <span>
                  {number(game.inventory[resource] * RESOURCE_PRICES[resource])}
                  <ResourceArt type="coin" size={21} />
                </span>
              </div>
            ))}
          </div>
          {(game.upgrades.market > 0 || game.upgrades.workshop > 0) && (
            <div className="trade-bonus">
              <TrendingUp size={16} /> Market bonus +{game.upgrades.market * 12}
              % · Smokehouse bonus +{game.upgrades.workshop * 20}%
            </div>
          )}
          <div className="market-total">
            <span>Your haul is worth</span>
            <strong>
              <ResourceArt type="coin" size={30} />
              {number(sellValue(game))}
            </strong>
          </div>
          <button
            className="button button-navy full-width"
            disabled={!count}
            onClick={sell}
          >
            <ShoppingBasket size={19} />
            {count
              ? "Sell everything in your pack"
              : "The counter is clear. Time to fish!"}
            <ArrowRight size={18} />
          </button>
          {game.upgrades.crew > 0 && (
            <div className="worker-collect">
              <div>
                <Users size={20} />
                <span>
                  <strong>Your dock crew</strong>
                  <small>Earns while you’re away · up to 8 hours</small>
                </span>
              </div>
              <button
                className="button button-small"
                disabled={game.workersStored < 1}
                onClick={() => {
                  const value = game.workersStored;
                  act({ type: "collectWorkers" });
                  notify(
                    `Collected ${number(value)} coins from your dock crew.`,
                  );
                }}
              >
                Collect {number(game.workersStored)}{" "}
                <ResourceArt type="coin" size={18} />
              </button>
            </div>
          )}
          <p className="menu-footnote">
            <Anchor size={13} /> No fees. No fuss. Just honest harbor trading.
          </p>
        </Modal>
      )}

      {panel === "upgrades" && (
        <Modal
          title="Great things start small."
          eyebrow="BUILD YOUR HARBOR"
          onClose={close}
          wide
        >
          <p className="modal-description">
            Better tools. Busier docks. A little more to call your own.
          </p>
          <div className="upgrade-grid">
            {UPGRADES.map((upgrade) => {
              const Icon = upgradeIcons[upgrade.id];
              const current = game.upgrades[upgrade.id];
              const cost = upgradeCost(upgrade.id, game);
              const max = current >= upgrade.maxLevel;
              return (
                <div className="upgrade-option" key={upgrade.id}>
                  <div className="upgrade-option-top">
                    <span>
                      <Icon size={27} />
                    </span>
                    <small>
                      LEVEL {current} / {upgrade.maxLevel}
                    </small>
                  </div>
                  <h3>{upgrade.name}</h3>
                  <p>{upgrade.description}</p>
                  <div className="upgrade-pips">
                    {Array.from(
                      { length: Math.min(8, upgrade.maxLevel) },
                      (_, i) => (
                        <i key={i} className={i < current ? "filled" : ""} />
                      ),
                    )}
                  </div>
                  <button
                    className="button button-navy"
                    disabled={max || game.coins < cost}
                    onClick={() => buy(upgrade.id)}
                  >
                    <span>
                      {max
                        ? "Fully upgraded"
                        : game.coins < cost
                          ? "Keep trading"
                          : "Upgrade"}
                    </span>
                    <span className="button-price">
                      <ResourceArt type="coin" size={19} />
                      {max ? <Check size={16} /> : number(cost)}
                    </span>
                  </button>
                </div>
              );
            })}
            <div className="upgrade-endnote">
              <Anchor size={32} />
              <h3>A harbor worth coming back to.</h3>
              <p>
                Every upgrade stays with you. Your crew keeps earning even when
                you close the game.
              </p>
              <button className="text-link" onClick={() => open("map")}>
                Explore the coast <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div className="modal-balance">
            Available to invest{" "}
            <span>
              <ResourceArt type="coin" size={23} />
              {number(game.coins)} coins
            </span>
          </div>
        </Modal>
      )}

      {panel === "map" && (
        <Modal
          title="There’s more beyond the bay."
          eyebrow="THE NORTHERN COAST"
          onClose={close}
          wide
        >
          <p className="modal-description">
            Six corners of the coast. A world of possibilities. Grow your
            reputation to discover them all.
          </p>
          <div className="region-grid">
            {REGIONS.map((region, index) => {
              const unlocked = game.unlockedRegions.includes(region.id),
                eligible =
                  playerLevel >= region.level && game.coins >= region.cost;
              return (
                <div
                  className={`region-card ${unlocked ? "unlocked" : ""}`}
                  key={region.id}
                >
                  <div className="region-art">
                    <IslandArt color={region.color} />
                    <span className="region-number">0{index + 1}</span>
                    <span className="region-tag">
                      {unlocked ? (
                        <>
                          <Check size={12} /> DISCOVERED
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={11} /> LEVEL {region.level}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="region-copy">
                    <h3>{region.name}</h3>
                    <p>{region.description}</p>
                    <button
                      className={`button ${unlocked ? "button-soft" : "button-navy"}`}
                      disabled={!unlocked && !eligible}
                      onClick={() => {
                        if (unlocked) {
                          close();
                          setFocusToken((n) => n + 1);
                          notify(
                            `Exploring ${region.name}. Look for new gathering spots around the harbor.`,
                          );
                        } else {
                          const before = gameRef.current;
                          const next = act({ type: "unlock", id: region.id });
                          if (next !== before) {
                            notify(
                              `${region.name} discovered! New gathering spots are now open.`,
                            );
                            if (next.sound) playChime();
                          }
                        }
                      }}
                    >
                      {unlocked
                        ? "Return to harbor"
                        : playerLevel < region.level
                          ? `Reach level ${region.level}`
                          : "Discover region"}
                      {unlocked ? (
                        <ArrowUpRight size={16} />
                      ) : (
                        <span className="button-price">
                          <ResourceArt type="coin" size={18} />
                          {number(region.cost)}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {panel === "inventory" && (
        <Modal
          title="A pack full of possibility."
          eyebrow="YOUR BACKPACK"
          onClose={close}
        >
          <div className="inventory-capacity">
            <BackpackArt />
            <div>
              <strong>
                {count}
                <span> / {limit}</span>
              </strong>
              <p>items in your pack</p>
              <div className="progress-track">
                <span style={{ width: `${(count / limit) * 100}%` }} />
              </div>
            </div>
          </div>
          <div className="market-list">
            {resources.map((resource) => (
              <div className="market-row" key={resource}>
                <span className="resource-art-holder">
                  <ResourceArt type={resource} size={40} />
                </span>
                <div>
                  <strong>{resourceNames[resource]}</strong>
                  <small>
                    {resource === "wood"
                      ? "From the snowy pines"
                      : resource === "fish"
                        ? "Fresh from the harbor"
                        : "A prized northern catch"}
                  </small>
                </div>
                <strong className="inventory-count">
                  {game.inventory[resource]}
                </strong>
              </div>
            ))}
          </div>
          <div className="inventory-actions">
            <button
              className="button button-soft"
              onClick={() => open("upgrades")}
            >
              <Plus size={17} /> More space
            </button>
            <button
              className="button button-navy"
              onClick={() => open("market")}
            >
              <Store size={17} /> Take to market <ArrowRight size={17} />
            </button>
          </div>
          <p className="menu-footnote">
            A full pack? That’s a good problem to have.
          </p>
        </Modal>
      )}

      {panel === "journal" && (
        <Modal
          title="Every captain has a story."
          eyebrow="YOUR HARBOR JOURNAL"
          onClose={close}
          wide
        >
          <div className="journal-stats">
            <div>
              <Fish size={22} />
              <strong>{number(game.harvests)}</strong>
              <span>resources gathered</span>
            </div>
            <div>
              <Store size={22} />
              <strong>{number(game.trades)}</strong>
              <span>trades made</span>
            </div>
            <div>
              <Compass size={22} />
              <strong>{game.unlockedRegions.length} / 6</strong>
              <span>regions discovered</span>
            </div>
          </div>
          <div className="quest-list">
            {QUESTS.map((quest) => {
              const progress = questProgress(quest, game),
                claimed = game.questsClaimed.includes(quest.id),
                complete = progress >= quest.target;
              return (
                <div
                  className={`quest-row ${claimed ? "quest-claimed" : ""}`}
                  key={quest.id}
                >
                  <span className="quest-icon">
                    {claimed ? (
                      <Check size={21} />
                    ) : quest.type === "harvest" ? (
                      <Fish size={21} />
                    ) : quest.type === "upgrade" ? (
                      <Hammer size={21} />
                    ) : quest.type === "region" ? (
                      <Compass size={21} />
                    ) : (
                      <Flag size={21} />
                    )}
                  </span>
                  <div className="quest-copy">
                    <h3>{quest.title}</h3>
                    <p>{quest.description}</p>
                    <div className="quest-progress">
                      <div className="progress-track">
                        <span
                          style={{
                            width: `${Math.min(100, (progress / quest.target) * 100)}%`,
                          }}
                        />
                      </div>
                      <span>
                        {number(progress)} / {number(quest.target)}
                      </span>
                    </div>
                  </div>
                  <button
                    className={`button button-small ${complete && !claimed ? "button-gold" : "button-soft"}`}
                    disabled={!complete || claimed}
                    onClick={() => claimQuest(quest.id)}
                  >
                    {claimed ? (
                      <>
                        <Check size={15} /> Claimed
                      </>
                    ) : (
                      <>
                        {complete ? "Claim" : "Reward"}
                        <ResourceArt type="coin" size={19} />
                        {number(quest.reward)}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {panel === "help" && (
        <Modal
          title="Welcome to the waterfront."
          eyebrow="A CAPTAIN’S FIELD GUIDE"
          onClose={close}
        >
          <div className="help-steps">
            {[
              {
                icon: MousePointer2,
                title: "Find your feet",
                text: "Click anywhere on the ground to walk. Or click the world and use WASD or the arrow keys. On a phone, tap where you want to go.",
              },
              {
                icon: Fish,
                title: "Cast, catch, collect",
                text: "Click a fishing spot or snowy pine. Your captain walks over and starts gathering. Press E near a spot to interact. Spots replenish after a short rest.",
              },
              {
                icon: Store,
                title: "Make a little living",
                text: "Bring your catch to the fish market, or choose “Sell your catch” below the world. A bigger pack means a bigger payday.",
              },
              {
                icon: Hammer,
                title: "Build something that lasts",
                text: "Upgrade your rod, pack, market, smokehouse, and crew. Earn XP to unlock more of the coast. Complete journal tasks for extra coins.",
              },
              {
                icon: Users,
                title: "Make yourself at home",
                text: "Your progress saves in this browser. Hire a crew to earn while you’re away, up to eight hours. Download a save backup from settings to keep it safe.",
              },
            ].map((step, i) => (
              <div className="help-step" key={step.title}>
                <span>
                  <step.icon size={23} />
                  <i>{i + 1}</i>
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="button button-navy full-width" onClick={close}>
            Let’s make a little harbor <ArrowRight size={17} />
          </button>
        </Modal>
      )}

      {panel === "settings" && (
        <Modal
          title="Make yourself at home."
          eyebrow="HARBOR SETTINGS"
          onClose={close}
        >
          <div className="settings-profile">
            <div className="avatar settings-avatar">
              <span>{game.playerName.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <label htmlFor="captain-name">Your captain’s name</label>
              <div className="name-input">
                <input
                  id="captain-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 28))}
                  maxLength={28}
                />
                <button
                  aria-label="Save captain name"
                  onClick={() => {
                    act({ type: "rename", name });
                    notify("A fine name for a harbor captain.");
                  }}
                >
                  <Check size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="setting-row">
            <span className="setting-icon">
              <Music2 size={20} />
            </span>
            <div>
              <strong>Harbor sounds</strong>
              <small>Gentle feedback for little victories</small>
            </div>
            <button
              className={`toggle ${game.sound ? "on" : ""}`}
              role="switch"
              aria-checked={game.sound}
              aria-label="Harbor sounds"
              onClick={() => act({ type: "toggleSound" })}
            >
              <span />
            </button>
          </div>
          <div className="setting-row">
            <span className="setting-icon">
              <ArrowDownToLine size={20} />
            </span>
            <div>
              <strong>Keep your harbor safe</strong>
              <small>Progress saves on this device. Export a backup.</small>
            </div>
          </div>
          <div className="settings-save-buttons">
            <button className="button button-soft" onClick={exportSave}>
              <ArrowDownToLine size={17} /> Export save
            </button>
            <button
              className="button button-soft"
              onClick={() => importRef.current?.click()}
            >
              <Ship size={17} /> Import save
            </button>
            <input
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              ref={importRef}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 100000) throw new Error();
                  const text = await file.text();
                  const parsed = JSON.parse(text);
                  if (
                    parsed.version !== 1 ||
                    !parsed.inventory ||
                    !parsed.upgrades
                  )
                    throw new Error();
                  const loaded = loadGame(text);
                  gameRef.current = loaded;
                  setGame(loaded);
                  setName(loaded.playerName);
                  notify("Your harbor is right where you left it.");
                } catch {
                  notify(
                    "That save file could not be loaded. Your current harbor is safe.",
                  );
                }
                e.target.value = "";
              }}
            />
          </div>
          <div className="reset-zone">
            <div>
              <strong>A completely fresh start</strong>
              <p>
                {resetStep
                  ? "This clears your harbor, coins, and upgrades on this device. Export a backup first if you want to return."
                  : "Begin again with a new harbor. Your current progress will be cleared."}
              </p>
            </div>
            <button
              className="reset-button"
              onClick={() => {
                if (resetStep) {
                  const fresh = createInitialState();
                  gameRef.current = fresh;
                  setGame(fresh);
                  setName(fresh.playerName);
                  setResetStep(false);
                  notify("A new day. A new harbor. Welcome back.");
                  close();
                } else setResetStep(true);
              }}
            >
              {resetStep ? "Yes, start over" : "Start over"}
            </button>
            {resetStep && (
              <button className="text-link" onClick={() => setResetStep(false)}>
                Keep my harbor
              </button>
            )}
          </div>
          <p className="menu-footnote">
            <Snowflake size={13} /> Frost & Fin · Made for the long, lovely
            journey.
          </p>
        </Modal>
      )}
    </div>
  );
}
