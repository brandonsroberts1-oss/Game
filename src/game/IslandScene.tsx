import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createWorld, type TreeNode } from "./world";
import {
  capacity,
  inventoryCount,
  canProcess,
  processBlockReason,
  recipeDuration,
  recipeYield,
  gatherYield,
  type GameState,
  type ActivityId,
  type UpgradeId,
  type Resource,
  type RecipeId,
} from "./model";

interface SceneProps {
  game: GameState;
  paused: boolean;
  command: { id: number; target: ActivityId } | null;
  joystick: { x: number; y: number };
  interactToken: number;
  onHarvest: (resource: Resource) => number;
  onProcess: (recipe: RecipeId) => boolean;
  onSell: () => number;
  onReady: () => void;
  onActivity: (info: {
    id: ActivityId | null;
    label: string;
    progress: number;
    busy: boolean;
  }) => void;
  onNotice: (text: string) => void;
  onOpenBuild: (id?: UpgradeId) => void;
}

type Destination = {
  id: ActivityId | null;
  position: THREE.Vector3;
  tree?: TreeNode;
  route: THREE.Vector3[];
};
type Work = {
  id: ActivityId;
  time: number;
  total: number;
  phase: string;
  tree?: TreeNode;
  items: THREE.Group[];
  source: THREE.Vector3[];
  actor?: THREE.Group;
  cuts: number;
  amount: number;
  committed: boolean;
};
type Particle = {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
  spin: number;
};
type Label = { sprite: THREE.Sprite; time: number; origin: THREE.Vector3 };
type Hit =
  | { kind: "activity"; id: ActivityId; tree?: TreeNode }
  | { kind: "ground"; position: THREE.Vector3 };
const LABELS: Record<ActivityId, string> = {
  wood: "Chop timber",
  fish: "Catch tuna",
  steaks: "Slice tuna",
  planks: "Saw planks",
  smoked: "Smoke fish",
  market: "Sell your cargo",
};
const PHASE_LABELS: Record<string, string> = {
  "tree-swing": "Swinging the axe",
  "tree-fall": "Timber!",
  "log-bounce": "Gathering fallen timber",
  "log-pickup": "Picking up logs",
  cast: "Casting the line",
  "bobber-wait": "Waiting for a bite",
  "fish-flight": "Reeling it in!",
  "fish-land": "Landing your catch",
  "process-unload": "Loading the workbench",
  cut: "Cutting tuna steaks",
  "saw-cut": "Sawing timber",
  smoking: "Smoking fish",
  "steak-conveyor": "Moving steaks down the belt",
  "goods-conveyor": "Moving goods down the belt",
  "steak-pickup": "Packing fresh steaks",
  "goods-pickup": "Packing your goods",
  "sale-goods": "Unloading your cargo",
  "sale-customer": "Serving customers",
  "sale-cash": "Collecting cash",
};
const WALK_LABELS: Record<ActivityId, string> = {
  wood: "Walking to the pines",
  fish: "Walking to the fishing dock",
  steaks: "Walking to the cutting bench",
  planks: "Walking to the sawmill",
  smoked: "Walking to the smokehouse",
  market: "Walking to the market",
};
const RESOURCE_NAME: Record<Resource, string> = {
  wood: "timber",
  fish: "tuna",
  salmon: "salmon",
  steak: "steaks",
  plank: "planks",
  smoked: "smoked fish",
};
const UPGRADE_IDS: UpgradeId[] = [
  "axe",
  "rod",
  "backpack",
  "cutter",
  "sawmill",
  "market",
  "dock",
  "crew",
  "smokehouse",
  "freezer",
  "boots",
  "nets",
];
const smooth = (n: number) => {
  const t = THREE.MathUtils.clamp(n, 0, 1);
  return t * t * (3 - 2 * t);
};
const clamp = (n: number) => THREE.MathUtils.clamp(n, 0, 1);
const TAU = Math.PI * 2;

function makeLabel(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 54px system-ui";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#16384b";
  ctx.strokeText(text, 384, 80);
  ctx.fillStyle = color;
  ctx.fillText(text, 384, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(3.8, 0.8, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export default function IslandScene(props: SceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [failure, setFailure] = useState("");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFailure(
        "This browser could not start the 3D harbor. Enable hardware acceleration or open the game in Chrome, Safari, or Edge.",
      );
      latest.current.onReady();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Interactive fishing yard. Tap trees to chop, fish to cast, or machines to work. Use WASD or the joystick to walk.",
    );
    Object.assign(canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
      touchAction: "none",
      outline: "none",
    });
    host.appendChild(canvas);
    const world = createWorld();
    const { scene, player } = world;
    const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.1, 150);
    const cameraOffset = new THREE.Vector3(19, 25, 28);
    const cameraTarget = player.position
      .clone()
      .add(new THREE.Vector3(0, 1, -0.7));
    camera.position.copy(cameraTarget).add(cameraOffset);
    camera.lookAt(cameraTarget);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const keys = new Set<string>();
    const clock = new THREE.Clock();
    const particles: Particle[] = [];
    const labels: Label[] = [];
    const construction: {
      group: THREE.Group;
      base: THREE.Vector3;
      time: number;
    }[] = [];
    const customerWalks: {
      group: THREE.Group;
      start: THREE.Vector3;
      end: THREE.Vector3;
      home: THREE.Vector3;
      time: number;
    }[] = [];
    const customerHomes = world.customers.map((customer) =>
      customer.position.clone(),
    );
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = media.matches;
    const motionChanged = () => {
      reducedMotion = media.matches;
    };
    media.addEventListener("change", motionChanged);
    let frame = 0,
      disposed = false,
      worldTime = 0,
      reportTimer = 0,
      shadowTimer = 0;
    let destination: Destination | null = null;
    let work: Work | null = null;
    let automatic: ActivityId | null = null;
    let pending: { id: ActivityId; tree?: TreeNode } | null = null;
    let nextWorkAt = 0;
    let lastCommand = latest.current.command?.id ?? -1;
    let lastInteract = latest.current.interactToken;
    let lastInventory = "";
    let lastUpgrades = JSON.stringify(latest.current.game.upgrades);
    let ready = false,
      walkPhase = 0,
      customerIndex = 0;
    let equipped: "axe" | "rod" | null = "axe";
    let buildFocus: {
      position: THREE.Vector3;
      remaining: number;
      tool: boolean;
    } | null = null;
    let audio: AudioContext | undefined;
    let activeObject: THREE.Object3D = player;
    let lastHit = -1;
    let lastNotice = "";
    let hover = "";
    const initialCutterFishScale = world.cutter.fish.scale.clone();
    const cleaverBase = world.cutter.cleaver.position.clone();
    const pistonBase = world.cutter.piston.position.clone();
    const rightArmRest = world.rightArm.rotation.clone();
    const leftArmRest = world.leftArm.rotation.clone();
    world.applyUpgrades(latest.current.game.upgrades);
    player.traverse((o) => {
      o.castShadow = false;
    });
    world.fish.forEach((fish) =>
      fish.traverse((o) => {
        o.castShadow = false;
      }),
    );
    world.axe.visible = true;
    world.rod.visible = false;
    world.bobber.visible = false;
    world.fishingLine.visible = false;
    world.cutter.fish.visible = false;
    world.cutter.steaks.forEach((steak) => {
      steak.visible = false;
    });

    const chipGeometry = new THREE.BoxGeometry(0.1, 0.07, 0.15);
    const snowGeometry = new THREE.IcosahedronGeometry(0.12, 0);
    const ringGeometry = new THREE.RingGeometry(0.23, 0.28, 36);
    const chipMaterial = new THREE.MeshStandardMaterial({
      color: "#d79b55",
      roughness: 0.8,
    });
    const snowMaterial = new THREE.MeshStandardMaterial({
      color: "#f3fbff",
      roughness: 0.75,
    });
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: "#a3eafa",
      transparent: true,
      opacity: 0.8,
    });
    const cashMaterial = new THREE.MeshStandardMaterial({
      color: "#64ee51",
      roughness: 0.6,
    });
    const cashGeometry = new THREE.BoxGeometry(0.52, 0.15, 0.25);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: "#fff8c9",
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const marker = new THREE.Mesh(ringGeometry, markerMaterial);
    marker.rotation.x = -Math.PI / 2;
    scene.add(marker);
    const spinObjects: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (object.userData.spinAxis) spinObjects.push(object);
    });

    function resize() {
      const width = host!.clientWidth || 390,
        height = host!.clientHeight || 800;
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const halfHeight = aspect < 0.8 ? 10.5 : aspect < 1.3 ? 9.2 : 8.7;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.updateProjectionMatrix();
      canvas.dataset.cameraScale = String(halfHeight * 2);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    function notice(message: string) {
      if (message !== lastNotice) latest.current.onNotice(message);
      lastNotice = message;
    }
    function processMessage(game: GameState, id: RecipeId) {
      const reason = processBlockReason(game, id);
      if (reason === "locked")
        return id === "planks"
          ? "Build the sawmill to turn timber into planks."
          : "Build a smokehouse to smoke your fish.";
      if (reason === "capacity")
        return "Make room in your backpack before processing more goods.";
      return id === "steaks"
        ? "Catch a whole tuna first, then bring it to the cutting bench."
        : id === "planks"
          ? "Bring at least 3 timber to the sawmill."
          : "Smoking needs 2 steaks and 1 timber.";
    }
    function sound(kind: "chop" | "catch" | "coin" | "cut") {
      if (!latest.current.game.sound) return;
      try {
        audio ||= new AudioContext();
        if (audio.state === "suspended") void audio.resume();
        const oscillator = audio.createOscillator(),
          gain = audio.createGain();
        const now = audio.currentTime;
        oscillator.type =
          kind === "chop" || kind === "cut" ? "triangle" : "sine";
        const frequency =
          kind === "chop"
            ? 150
            : kind === "cut"
              ? 240
              : kind === "catch"
                ? 580
                : 850;
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(
          kind === "coin" ? 1200 : frequency * 0.6,
          now + 0.12,
        );
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start();
        oscillator.stop(now + 0.18);
      } catch {
        /* Work remains playable without device audio. */
      }
    }
    function label(text: string, position: THREE.Vector3, color = "#fff4bf") {
      const sprite = makeLabel(text, color);
      sprite.position.copy(position);
      scene.add(sprite);
      labels.push({ sprite, time: 0, origin: position.clone() });
    }
    function burst(
      position: THREE.Vector3,
      kind: "chips" | "snow" | "water" | "cash",
      count: number,
    ) {
      if (reducedMotion && kind !== "chips") count = Math.min(4, count);
      for (let i = 0; i < count; i++) {
        const object = new THREE.Mesh(
          kind === "cash"
            ? cashGeometry
            : kind === "chips"
              ? chipGeometry
              : snowGeometry,
          kind === "cash"
            ? cashMaterial
            : kind === "chips"
              ? chipMaterial
              : kind === "water"
                ? waterMaterial
                : snowMaterial,
        );
        object.position.copy(position);
        object.scale.setScalar(kind === "snow" ? 0.6 + Math.random() : 1);
        object.rotation.set(
          Math.random() * TAU,
          Math.random() * TAU,
          Math.random() * TAU,
        );
        scene.add(object);
        particles.push({
          object,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            1.5 + Math.random() * 3,
            (Math.random() - 0.5) * 3,
          ),
          age: 0,
          lifetime: kind === "cash" ? 1.6 : 1.2,
          spin: Math.random() * 6 - 3,
        });
      }
    }
    function removeItems(items: THREE.Group[]) {
      for (const item of items) scene.remove(item);
      items.length = 0;
    }
    function emptyCargo() {
      for (const child of [...world.cargo.children]) world.cargo.remove(child);
    }
    function rebuildCargo(force = false) {
      const inventory = latest.current.game.inventory;
      const signature = JSON.stringify(inventory);
      if (!force && signature === lastInventory) return;
      lastInventory = signature;
      emptyCargo();
      const resources: Resource[] = [
        "wood",
        "fish",
        "salmon",
        "steak",
        "plank",
        "smoked",
      ];
      let index = 0;
      for (const resource of resources) {
        const amount = Math.min(inventory[resource], Math.max(0, 38 - index));
        for (let i = 0; i < amount; i++) {
          const item = world.createItem(resource);
          item.scale.setScalar(
            resource === "fish" || resource === "salmon"
              ? 0.68
              : resource === "wood"
                ? 0.65
                : 0.58,
          );
          item.rotation.set(
            0,
            resource === "fish" || resource === "salmon"
              ? Math.PI / 2
              : ((index % 2) * Math.PI) / 2,
            0,
          );
          const tier = index;
          item.position.set(
            index % 2 ? 0.08 : -0.08,
            tier * (resource === "steak" ? 0.12 : 0.18),
            -0.05,
          );
          item.userData.resource = resource;
          world.cargo.add(item);
          index++;
        }
      }
      world.cargo.visible = true;
    }
    rebuildCargo(true);

    function routeTo(destinationPosition: THREE.Vector3) {
      const step = 0.48,
        nx = 42,
        nz = 54;
      const position = (id: number) =>
        new THREE.Vector3(
          (id % nx) * step - 9,
          0.4,
          Math.floor(id / nx) * step - 13,
        );
      const available = new Set<number>();
      let start = -1,
        goal = -1,
        sd = Infinity,
        gd = Infinity;
      for (let id = 0; id < nx * nz; id++) {
        const point = position(id);
        if (!world.isWalkable(point.x, point.z)) continue;
        available.add(id);
        const a = point.distanceToSquared(player.position),
          b = point.distanceToSquared(destinationPosition);
        if (a < sd) {
          sd = a;
          start = id;
        }
        if (b < gd) {
          gd = b;
          goal = id;
        }
      }
      if (start < 0 || goal < 0) return [];
      const open = new Set([start]),
        previous = new Map<number, number>(),
        costs = new Map<number, number>([[start, 0]]);
      const heuristic = (id: number) =>
        Math.hypot(
          (id % nx) - (goal % nx),
          Math.floor(id / nx) - Math.floor(goal / nx),
        );
      const offsets = [-nx - 1, -nx, -nx + 1, -1, 1, nx - 1, nx, nx + 1];
      while (open.size) {
        let current = -1,
          score = Infinity;
        for (const id of open) {
          const value = costs.get(id)! + heuristic(id);
          if (value < score) {
            score = value;
            current = id;
          }
        }
        if (current === goal) {
          const route: THREE.Vector3[] = [];
          for (let id = goal; id !== start; id = previous.get(id)!)
            route.unshift(position(id));
          if (world.isWalkable(destinationPosition.x, destinationPosition.z))
            route.push(destinationPosition.clone());
          return route;
        }
        open.delete(current);
        for (const offset of offsets) {
          const neighbor = current + offset;
          const dx = (neighbor % nx) - (current % nx),
            dz = Math.floor(neighbor / nx) - Math.floor(current / nx);
          if (!available.has(neighbor) || Math.abs(dx) > 1) continue;
          if (
            dx &&
            dz &&
            (!available.has(current + dx) || !available.has(current + dz * nx))
          )
            continue;
          const next = costs.get(current)! + (dx && dz ? Math.SQRT2 : 1);
          if (next < (costs.get(neighbor) ?? Infinity)) {
            previous.set(neighbor, current);
            costs.set(neighbor, next);
            open.add(neighbor);
          }
        }
      }
      return [];
    }
    function face(position: THREE.Vector3) {
      player.rotation.y = Math.atan2(
        position.x - player.position.x,
        position.z - player.position.z,
      );
    }
    function workPosition(id: ActivityId, tree?: TreeNode) {
      if (id !== "wood") return world.stations[id].workPosition.clone();
      const pos = tree!.position.clone();
      const toward = player.position.clone().sub(pos);
      toward.y = 0;
      if (toward.lengthSq() < 0.01) toward.set(0, 0, 1);
      pos.add(toward.normalize().multiplyScalar(1.25));
      if (!world.isWalkable(pos.x, pos.z))
        pos.copy(tree!.position).add(new THREE.Vector3(1.25, 0, 0));
      return pos;
    }
    function stopWork() {
      if (work?.tree && work.time < 1.8) {
        work.tree.notch.visible = false;
        work.tree.pivot.rotation.set(0, 0, 0);
      }
      if (work) {
        removeItems(work.items);
        if (work.actor) scene.remove(work.actor);
      }
      work = null;
      automatic = null;
      destination = null;
      world.axe.visible = equipped === "axe";
      world.rod.visible = equipped === "rod";
      world.bobber.visible = false;
      world.fishingLine.visible = false;
      world.cutter.fish.visible = false;
      world.cutter.steaks.forEach((steak) => {
        steak.visible = false;
      });
      world.cutter.fish.scale.copy(initialCutterFishScale);
      world.cutter.cleaver.position.copy(cleaverBase);
      world.rightArm.rotation.copy(rightArmRest);
      world.leftArm.rotation.copy(leftArmRest);
      rebuildCargo(true);
    }
    function go(id: ActivityId, requestedTree?: TreeNode) {
      lastNotice = "";
      if (work) {
        if (work.id === "wood" && work.time >= 1.8) {
          pending = { id, tree: requestedTree };
          return;
        }
        stopWork();
      }
      const game = latest.current.game;
      if (
        (id === "wood" || id === "fish") &&
        inventoryCount(game) >= capacity(game)
      ) {
        notice("Backpack full. Take your cargo to the market.");
        automatic = null;
        return;
      }
      if (id === "market" && !inventoryCount(game) && game.workersStored <= 0) {
        notice("Catch a tuna or chop some timber first.");
        automatic = null;
        return;
      }
      if (id === "steaks" || id === "planks" || id === "smoked") {
        if (!canProcess(game, id)) {
          notice(processMessage(game, id));
          if (id === "planks" && game.upgrades.sawmill < 1)
            latest.current.onOpenBuild("sawmill");
          if (id === "smoked" && game.upgrades.smokehouse < 1)
            latest.current.onOpenBuild("smokehouse");
          automatic = null;
          return;
        }
      }
      const tree =
        id === "wood"
          ? requestedTree?.state === "standing"
            ? requestedTree
            : [...world.trees]
                .filter((node) => node.state === "standing")
                .sort(
                  (a, b) =>
                    a.position.distanceToSquared(player.position) -
                    b.position.distanceToSquared(player.position),
                )[0]
          : undefined;
      if (id === "wood" && !tree) {
        notice("The grove is growing back. Try fishing while you wait.");
        automatic = null;
        return;
      }
      const position = workPosition(id, tree);
      destination = { id, position, tree, route: routeTo(position) };
      automatic = id;
      marker.position.set(
        position.x,
        world.groundHeight(position.x, position.z) + 0.03,
        position.z,
      );
      markerMaterial.opacity = 0.9;
    }
    function begin(target: Destination) {
      if (!target.id) return;
      const id = target.id,
        game = latest.current.game;
      if (
        (id === "wood" || id === "fish") &&
        inventoryCount(game) >= capacity(game)
      ) {
        automatic = null;
        notice("Backpack full. Sell your cargo at the market.");
        return;
      }
      if (
        (id === "steaks" || id === "planks" || id === "smoked") &&
        !canProcess(game, id)
      ) {
        automatic = null;
        notice(processMessage(game, id));
        return;
      }
      if (id === "market" && !inventoryCount(game) && game.workersStored <= 0) {
        automatic = null;
        return;
      }
      const total =
        id === "wood"
          ? 4.25
          : id === "fish"
            ? 3.8 / (1 + game.upgrades.rod * 0.1 + game.upgrades.nets * 0.08)
            : id === "market"
              ? 3.4
              : recipeDuration(game, id);
      work = {
        id,
        time: 0,
        total,
        phase: "",
        tree: target.tree,
        items: [],
        source: [],
        cuts: 0,
        amount:
          id === "wood" || id === "fish"
            ? gatherYield(game, id)
            : id === "market"
              ? 0
              : recipeYield(game, id),
        committed: false,
      };
      lastHit = -1;
      if (id === "wood") {
        equipped = "axe";
        face(target.tree!.position);
        world.axe.visible = true;
        world.rod.visible = false;
      } else if (id === "fish") {
        equipped = "rod";
        face(new THREE.Vector3(-10, 0, world.stations.fish.position.z));
        world.axe.visible = false;
        world.rod.visible = true;
        world.bobber.visible = true;
        world.fishingLine.visible = true;
      } else {
        face(world.stations[id].position);
        world.axe.visible = false;
        world.rod.visible = false;
      }
      if (id === "market") {
        world.cargo.visible = false;
      }
    }
    function phaseOf(action: Work) {
      const p = action.time / action.total;
      if (action.id === "wood")
        return action.time < 1.8
          ? "tree-swing"
          : action.time < 2.65
            ? "tree-fall"
            : action.time < 3.25
              ? "log-bounce"
              : "log-pickup";
      if (action.id === "fish")
        return p * 3.8 < 0.6
          ? "cast"
          : p * 3.8 < 1.55
            ? "bobber-wait"
            : p * 3.8 < 2.85
              ? "fish-flight"
              : "fish-land";
      if (action.id === "market")
        return p < 0.3
          ? "sale-goods"
          : p < 0.55
            ? "sale-customer"
            : "sale-cash";
      if (p < 0.12) return "process-unload";
      if (p < 0.68)
        return action.id === "steaks"
          ? "cut"
          : action.id === "planks"
            ? "saw-cut"
            : "smoking";
      return p < 0.88
        ? action.id === "steaks"
          ? "steak-conveyor"
          : "goods-conveyor"
        : action.id === "steaks"
          ? "steak-pickup"
          : "goods-pickup";
    }
    function addItem(
      action: Work,
      resource: Resource,
      position: THREE.Vector3,
      scale = 1,
    ) {
      const item = world.createItem(resource);
      item.position.copy(position);
      item.scale.setScalar(scale);
      scene.add(item);
      action.items.push(item);
      action.source.push(position.clone());
      return item;
    }
    function handPosition() {
      return world.rightArm
        .getWorldPosition(new THREE.Vector3())
        .add(new THREE.Vector3(0, -0.25, 0.15));
    }
    function backPosition() {
      return world.cargo
        .getWorldPosition(new THREE.Vector3())
        .add(
          new THREE.Vector3(
            0,
            Math.min(5, world.cargo.children.length * 0.15),
            0,
          ),
        );
    }
    function enterPhase(action: Work, phase: string) {
      action.phase = phase;
      if (phase === "tree-fall") {
        action.tree!.state = "fallen";
        burst(
          action.tree!.position.clone().add(new THREE.Vector3(0, 2.7, 0)),
          "snow",
          17,
        );
        sound("chop");
      }
      if (phase === "log-bounce") {
        const tree = action.tree!;
        tree.pivot.visible = false;
        tree.stump.visible = true;
        tree.regrowAt = worldTime + 38;
        for (let i = 0; i < Math.min(8, action.amount); i++) {
          const item = addItem(
            action,
            "wood",
            tree.position
              .clone()
              .add(
                new THREE.Vector3(
                  Math.cos(i * 1.7) * 0.8,
                  0.4 + i * 0.05,
                  Math.sin(i * 1.7) * 0.65,
                ),
              ),
            0.85,
          );
          item.rotation.y = i * 0.7;
        }
        renderer.shadowMap.needsUpdate = true;
      }
      if (
        phase === "log-pickup" ||
        phase === "fish-land" ||
        phase === "steak-pickup" ||
        phase === "goods-pickup"
      )
        action.source = action.items.map((item) => item.position.clone());
      if (phase === "fish-flight") {
        const start = new THREE.Vector3(
          -9,
          -0.05,
          world.stations.fish.position.z,
        );
        const item = addItem(action, "fish", start, 1.45);
        item.rotation.x = -0.25;
        burst(start, "water", 17);
        sound("catch");
        world.bobber.visible = false;
      }
      if (phase === "process-unload") {
        const resource: Resource =
          action.id === "steaks"
            ? "fish"
            : action.id === "planks"
              ? "wood"
              : "steak";
        const item = addItem(
          action,
          resource,
          backPosition(),
          action.id === "steaks" ? 0.85 : 1,
        );
        action.actor = item;
        const carried = world.cargo.children.find(
          (object) => object.userData.resource === resource,
        );
        if (carried) carried.visible = false;
      }
      if (phase === "cut") {
        if (action.actor) {
          scene.remove(action.actor);
          action.items = [];
          action.source = [];
          action.actor = undefined;
        }
        world.cutter.fish.visible = true;
      }
      if (phase === "steak-conveyor" || phase === "goods-conveyor") {
        if (action.actor) {
          scene.remove(action.actor);
          action.actor = undefined;
        }
        removeItems(action.items);
        action.source = [];
        world.cutter.fish.visible = false;
        world.cutter.steaks.forEach((item) => {
          item.visible = false;
        });
        const station = world.stations[action.id as RecipeId].position;
        const resource: Resource =
          action.id === "steaks"
            ? "steak"
            : action.id === "planks"
              ? "plank"
              : "smoked";
        for (let i = 0; i < Math.min(7, action.amount); i++)
          addItem(
            action,
            resource,
            station.clone().add(new THREE.Vector3(0.1 + i * 0.22, 1.1, 0)),
            0.75,
          );
      }
      if (phase === "sale-goods") {
        const game = latest.current.game;
        let itemCount = 0;
        for (const resource of Object.keys(game.inventory) as Resource[]) {
          for (let i = 0; i < Math.min(3, game.inventory[resource]); i++) {
            if (itemCount >= 10) break;
            const item = addItem(
              action,
              resource,
              backPosition().add(new THREE.Vector3(0, itemCount * 0.12, 0)),
              0.6,
            );
            item.userData.index = itemCount++;
          }
        }
      }
      if (phase === "sale-customer") {
        const customer =
          world.customers[customerIndex % world.customers.length];
        if (customer) {
          const home = customerHomes[customerIndex % world.customers.length];
          customerIndex++;
          customerWalks.push({
            group: customer,
            start: customer.position.clone(),
            end: world.stations.market.position
              .clone()
              .add(new THREE.Vector3(2, 0, 1)),
            home: home.clone(),
            time: 0,
          });
        }
      }
      if (phase === "sale-cash") {
        removeItems(action.items);
        action.source = [];
        const pos = world.stations.market.position;
        for (let i = 0; i < 10; i++) {
          const bill = new THREE.Group();
          bill.add(new THREE.Mesh(cashGeometry, cashMaterial));
          bill.position
            .copy(pos)
            .add(new THREE.Vector3(0.1, 1.25 + i * 0.16, 0.5));
          scene.add(bill);
          action.items.push(bill);
          action.source.push(bill.position.clone());
        }
      }
    }
    function arc(
      item: THREE.Object3D,
      from: THREE.Vector3,
      to: THREE.Vector3,
      t: number,
      height: number,
    ) {
      const p = clamp(t);
      item.position.lerpVectors(from, to, p);
      item.position.y += Math.sin(p * Math.PI) * height;
    }
    function updateWork(action: Work, dt: number) {
      action.time = Math.min(action.total, action.time + dt);
      const phase = phaseOf(action);
      if (phase !== action.phase) enterPhase(action, phase);
      const p = clamp(action.time / action.total);
      activeObject = player;
      if (action.id === "wood") {
        const tree = action.tree!;
        if (phase === "tree-swing") {
          const hit = Math.min(2, Math.floor(action.time / 0.6)),
            local = (action.time % 0.6) / 0.6;
          const swing =
            local < 0.4
              ? THREE.MathUtils.lerp(-1.7, 0.7, smooth(local / 0.4))
              : THREE.MathUtils.lerp(0.7, -1.7, smooth((local - 0.4) / 0.6));
          world.rightArm.rotation.x = swing;
          world.rightArm.rotation.z = -0.18;
          world.leftArm.rotation.x = swing * 0.35;
          player.rotation.z = Math.sin(local * Math.PI) * 0.08;
          if (local >= 0.38 && hit > lastHit) {
            lastHit = hit;
            tree.notch.visible = true;
            tree.notch.scale.setScalar(0.5 + hit * 0.28);
            burst(
              tree.position.clone().add(new THREE.Vector3(0, 0.8, 0.2)),
              "chips",
              9,
            );
            sound("chop");
          }
          tree.pivot.rotation.z = Math.sin(local * TAU) * 0.018;
          activeObject = world.rightArm;
        } else if (phase === "tree-fall") {
          const t = clamp((action.time - 1.8) / 0.85);
          tree.pivot.rotation.z = -smooth(t) * Math.PI * 0.48;
          world.rightArm.rotation.x = -0.4;
          activeObject = tree.pivot;
        } else {
          world.axe.visible = false;
          action.items.forEach((item, i) => {
            if (phase === "log-bounce") {
              const t = clamp((action.time - 2.65) / 0.6);
              item.position.copy(action.source[i]);
              item.position.y =
                world.groundHeight(item.position.x, item.position.z) +
                0.2 +
                Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t) * 0.8;
              item.rotation.z = Math.sin(t * 5 + i) * (1 - t) * 0.45;
            } else {
              const t = clamp(((action.time - 3.25) / 1 - i * 0.045) / 0.72);
              arc(
                item,
                action.source[i],
                backPosition().add(new THREE.Vector3(0, i * 0.12, 0)),
                smooth(t),
                1.2,
              );
              item.rotation.y += dt * 3;
              item.scale.setScalar(0.85 - t * 0.2);
            }
          });
          activeObject = action.items[0] || player;
        }
      } else if (action.id === "fish") {
        const fishTime = p * 3.8;
        const water = new THREE.Vector3(
          -9,
          -0.05,
          world.stations.fish.position.z,
        );
        world.rightArm.rotation.x =
          phase === "cast"
            ? -1.6 + Math.sin(clamp(fishTime / 0.6) * Math.PI) * 2.3
            : -0.9;
        world.leftArm.rotation.x = -0.5;
        const hand = handPosition();
        if (phase === "cast") {
          arc(world.bobber, hand, water, fishTime / 0.6, 1.5);
          activeObject = world.rod;
        } else if (phase === "bobber-wait") {
          world.bobber.position.copy(water);
          world.bobber.position.y += Math.sin(fishTime * 16) * 0.1;
          activeObject = world.bobber;
        } else if (phase === "fish-flight") {
          const item = action.items[0],
            t = clamp((fishTime - 1.55) / 1.3);
          arc(
            item,
            action.source[0],
            backPosition().add(new THREE.Vector3(0, 1, 0)),
            t,
            4.1,
          );
          item.rotation.z = Math.sin(t * TAU * 2) * 0.55;
          item.rotation.y = t * Math.PI;
          item
            .getObjectByName("tail")
            ?.rotateY(Math.sin(action.time * 25) * 0.2);
          activeObject = item;
        } else {
          const item = action.items[0],
            t = clamp((fishTime - 2.85) / 0.95);
          arc(item, action.source[0], backPosition(), smooth(t), 0.45);
          item.scale.setScalar(1.45 - t * 0.77);
          item.rotation.z = Math.sin(t * TAU) * (1 - t) * 0.2;
          activeObject = item;
        }
        const end =
          phase === "fish-flight" || phase === "fish-land"
            ? action.items[0]?.position || water
            : world.bobber.position;
        const attribute = world.fishingLine.geometry.attributes
          .position as THREE.BufferAttribute;
        if (attribute && attribute.count >= 2) {
          attribute.setXYZ(0, hand.x, hand.y + 1.8, hand.z);
          attribute.setXYZ(1, end.x, end.y, end.z);
          attribute.needsUpdate = true;
          world.fishingLine.geometry.computeBoundingSphere();
        }
      } else if (action.id === "market") {
        const market = world.stations.market.position
          .clone()
          .add(new THREE.Vector3(0, 1.1, 0.5));
        if (phase === "sale-goods")
          action.items.forEach((item, i) => {
            const t = clamp((p / 0.3 - i * 0.035) / 0.7);
            arc(
              item,
              action.source[i],
              market
                .clone()
                .add(
                  new THREE.Vector3(
                    (i % 3) * 0.23 - 0.2,
                    Math.floor(i / 3) * 0.15,
                    0,
                  ),
                ),
              smooth(t),
              1.5,
            );
            item.rotation.y += dt * 2;
          });
        if (phase === "sale-cash")
          action.items.forEach((item, i) => {
            const t = clamp(((p - 0.55) / 0.45 - i * 0.035) / 0.68);
            arc(
              item,
              action.source[i],
              player.position.clone().add(new THREE.Vector3(0, 1.3, 0)),
              smooth(t),
              1,
            );
            item.rotation.y += dt * 4;
            item.scale.setScalar(1 - Math.max(0, t - 0.7));
          });
        world.rightArm.rotation.x = -0.65 + Math.sin(action.time * 6) * 0.25;
        activeObject = action.items[0] || world.customers[0] || player;
      } else {
        const station = world.stations[action.id].position;
        if (phase === "process-unload" && action.actor) {
          arc(
            action.actor,
            action.source[0],
            station.clone().add(new THREE.Vector3(0, 1.1, 0)),
            smooth(p / 0.12),
            0.7,
          );
          activeObject = action.actor;
        } else if (phase === "cut") {
          const cutProgress = clamp((p - 0.12) / 0.56),
            hit = Math.min(2, Math.floor(cutProgress * 3)),
            local = (cutProgress * 3) % 1;
          world.cutter.cleaver.visible =
            latest.current.game.upgrades.cutter === 0;
          world.cutter.cleaver.position.y =
            cleaverBase.y + (1 - Math.sin(local * Math.PI)) * 0.75;
          world.cutter.cleaver.rotation.z =
            -0.15 + Math.sin(local * Math.PI) * 0.22;
          world.cutter.piston.position.y =
            pistonBase.y - Math.sin(local * Math.PI) * 0.45;
          world.cutter.blade.rotation.z += dt * 19;
          world.cutter.secondBlade.rotation.z -= dt * 19;
          world.cutter.fish.scale.x =
            initialCutterFishScale.x * (1 - cutProgress * 0.72);
          world.rightArm.rotation.x = -0.4 - Math.sin(local * Math.PI) * 0.9;
          if (local > 0.4 && hit > lastHit) {
            lastHit = hit;
            sound("cut");
            const steak = world.cutter.steaks[hit];
            if (steak) steak.visible = true;
            burst(
              station.clone().add(new THREE.Vector3(0, 1.1, 0)),
              "water",
              3,
            );
          }
          activeObject = latest.current.game.upgrades.cutter
            ? world.cutter.blade
            : world.cutter.cleaver;
        } else if (phase === "saw-cut" || phase === "smoking") {
          if (action.actor) {
            action.actor.position
              .copy(station)
              .add(new THREE.Vector3(0, 1.05, 0));
            action.actor.scale.z = Math.max(0.1, 1 - (p - 0.12) * 0.8);
            activeObject = action.actor;
          }
          world.rightArm.rotation.x = -0.5 + Math.sin(action.time * 9) * 0.2;
          if (phase === "saw-cut" && Math.floor(action.time * 5) > lastHit) {
            lastHit = Math.floor(action.time * 5);
            burst(
              station.clone().add(new THREE.Vector3(0, 1.2, 0)),
              "chips",
              3,
            );
          }
        } else if (phase.endsWith("conveyor")) {
          const t = clamp((p - 0.68) / 0.2);
          action.items.forEach((item, i) => {
            item.position.copy(action.source[i]);
            item.position.x += smooth(t) * 1.5;
            item.position.y += Math.sin(t * Math.PI * 3 + i) * 0.025;
          });
          activeObject = action.items[0] || player;
        } else if (phase.endsWith("pickup")) {
          const t = clamp((p - 0.88) / 0.12);
          action.items.forEach((item, i) => {
            arc(
              item,
              action.source[i],
              backPosition().add(new THREE.Vector3(0, i * 0.12, 0)),
              smooth(t),
              0.85,
            );
            item.rotation.y += dt * 3;
          });
          activeObject = action.items[0] || player;
        }
      }
      if (action.time >= action.total) finish(action);
    }
    function finish(action: Work) {
      if (action.committed) return;
      action.committed = true;
      let amount = 0;
      if (action.id === "wood" || action.id === "fish")
        amount = latest.current.onHarvest(action.id);
      else if (action.id === "market") {
        amount = latest.current.onSell();
        sound("coin");
        burst(
          player.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
          "cash",
          7,
        );
      } else if (latest.current.onProcess(action.id)) amount = action.amount;
      if (amount)
        label(
          action.id === "market"
            ? `+${amount.toLocaleString()} cash`
            : `+${amount} ${RESOURCE_NAME[action.id === "wood" ? "wood" : action.id === "fish" ? "fish" : action.id === "steaks" ? "steak" : action.id === "planks" ? "plank" : "smoked"]}`,
          player.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
          action.id === "market" ? "#aaff91" : "#fff4b9",
        );
      removeItems(action.items);
      world.cutter.fish.visible = false;
      world.cutter.fish.scale.copy(initialCutterFishScale);
      world.cutter.steaks.forEach((steak) => {
        steak.visible = false;
      });
      world.cutter.cleaver.position.copy(cleaverBase);
      world.rightArm.rotation.copy(rightArmRest);
      world.leftArm.rotation.copy(leftArmRest);
      player.rotation.z = 0;
      world.axe.visible = equipped === "axe";
      world.rod.visible = equipped === "rod";
      world.bobber.visible = false;
      world.fishingLine.visible = false;
      world.cargo.visible = true;
      lastInventory = "";
      work = null;
      destination = null;
      nextWorkAt = worldTime + 0.35;
      if (!amount || action.id === "market") automatic = null;
      renderer.shadowMap.needsUpdate = true;
    }

    function closestInteraction() {
      if (work) return;
      let selected: { id: ActivityId; distance: number } | null = null;
      for (const id of [
        "fish",
        "steaks",
        "planks",
        "smoked",
        "market",
      ] as const) {
        const distance = world.stations[id].workPosition.distanceTo(
          player.position,
        );
        if (distance < 2.5 && (!selected || distance < selected.distance))
          selected = { id, distance };
      }
      for (const tree of world.trees)
        if (tree.state === "standing") {
          const distance = tree.position.distanceTo(player.position) - 0.7;
          if (distance < 2.5 && (!selected || distance < selected.distance))
            selected = { id: "wood", distance };
        }
      if (selected) go(selected.id);
      else notice("Walk near a tree, fishing dock, or workbench and tap Work.");
    }
    function hitTest(event: PointerEvent): Hit | null {
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const objects: THREE.Object3D[] = [
        ...world.trees
          .filter((tree) => tree.state === "standing")
          .map((tree) => tree.group),
        ...world.fish,
        ...Object.values(world.stations).map((station) => station.group),
      ];
      const hits = raycaster.intersectObjects(objects, true);
      for (const hit of hits) {
        let object: THREE.Object3D | null = hit.object;
        while (object) {
          const tree = world.trees.find((tree) => tree.group === object);
          if (tree) return { kind: "activity", id: "wood", tree };
          if (world.fish.includes(object as THREE.Group))
            return { kind: "activity", id: "fish" };
          for (const id of [
            "fish",
            "steaks",
            "planks",
            "smoked",
            "market",
          ] as const)
            if (object === world.stations[id].group)
              return { kind: "activity", id };
          object = object.parent;
        }
      }
      const ground = raycaster.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.4),
        new THREE.Vector3(),
      );
      if (ground && world.isWalkable(ground.x, ground.z))
        return { kind: "ground", position: ground };
      return null;
    }
    function onPointerDown(event: PointerEvent) {
      if (latest.current.paused || event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      const hit = hitTest(event);
      if (!hit) return;
      if (hit.kind === "activity") {
        go(hit.id, hit.tree);
        return;
      }
      if (work?.id === "wood" && work.time >= 1.8) return;
      if (work) stopWork();
      automatic = null;
      destination = {
        id: null,
        position: hit.position,
        route: routeTo(hit.position),
      };
      marker.position.copy(hit.position);
      marker.position.y =
        world.groundHeight(hit.position.x, hit.position.z) + 0.03;
      markerMaterial.opacity = 1;
    }
    function onPointerMove(event: PointerEvent) {
      if (latest.current.paused) return;
      const hit = hitTest(event);
      hover = hit?.kind === "activity" ? LABELS[hit.id] : "";
      canvas.style.cursor = hover ? "pointer" : hit ? "crosshair" : "default";
      canvas.title = hover;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (latest.current.paused || event.target !== canvas) return;
      const key = event.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
          "e",
          " ",
        ].includes(key)
      ) {
        event.preventDefault();
        keys.add(key);
        if (!event.repeat && (key === "e" || key === " ")) closestInteraction();
      }
    }
    function onKeyUp(event: KeyboardEvent) {
      keys.delete(event.key.toLowerCase());
    }
    const blur = () => keys.clear();
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", blur);

    function animate() {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.08);
      worldTime += dt;
      reportTimer += dt;
      shadowTimer += dt;
      const current = latest.current,
        game = current.game;
      if (shadowTimer > 1.5) {
        renderer.shadowMap.needsUpdate = true;
        shadowTimer = 0;
      }
      if (
        current.command &&
        current.command.id !== lastCommand &&
        !current.paused
      ) {
        lastCommand = current.command.id;
        go(current.command.target);
      }
      if (current.interactToken !== lastInteract && !current.paused) {
        lastInteract = current.interactToken;
        closestInteraction();
      }
      const upgrades = JSON.stringify(game.upgrades);
      if (upgrades !== lastUpgrades) {
        const oldLevels = JSON.parse(lastUpgrades) as GameState["upgrades"];
        lastUpgrades = upgrades;
        const changed = world.applyUpgrades(game.upgrades);
        const upgradedId = UPGRADE_IDS.find(
          (id) => game.upgrades[id] > oldLevels[id],
        );
        if (upgradedId) {
          const tool = ["axe", "rod", "backpack", "boots"].includes(upgradedId);
          buildFocus = {
            position: tool
              ? player.position.clone().add(new THREE.Vector3(0, 1.15, 0))
              : (
                  changed[0]?.getWorldPosition(new THREE.Vector3()) ||
                  player.position.clone()
                ).add(new THREE.Vector3(0, 1, 0)),
            remaining: 2.6,
            tool,
          };
          if (upgradedId === "axe") {
            equipped = "axe";
            world.axe.visible = true;
            world.rod.visible = false;
          }
          if (upgradedId === "rod") {
            equipped = "rod";
            world.axe.visible = false;
            world.rod.visible = true;
          }
        }
        for (const group of changed) {
          const base = group.scale.clone();
          construction.push({ group, base, time: 0 });
          group.scale.setScalar(0.01);
          burst(
            group
              .getWorldPosition(new THREE.Vector3())
              .add(new THREE.Vector3(0, 0.5, 0)),
            "snow",
            10,
          );
        }
        renderer.shadowMap.needsUpdate = true;
      }
      rebuildCargo();
      if (work?.id === "market") world.cargo.visible = false;
      if (current.paused) keys.clear();
      let moving = false;
      if (!current.paused) {
        const x =
          current.joystick.x +
          Number(keys.has("d") || keys.has("arrowright")) -
          Number(keys.has("a") || keys.has("arrowleft"));
        const y =
          current.joystick.y +
          Number(keys.has("s") || keys.has("arrowdown")) -
          Number(keys.has("w") || keys.has("arrowup"));
        const manual = Math.hypot(x, y) > 0.12;
        if (manual && (!work || work.id !== "wood" || work.time < 1.8)) {
          if (work) stopWork();
          destination = null;
          automatic = null;
        }
        let direction = new THREE.Vector3(),
          remaining = Infinity;
        if (manual && !work)
          direction
            .set(x * 0.827 + y * 0.562, 0, -x * 0.562 + y * 0.827)
            .normalize()
            .multiplyScalar(Math.min(1, Math.hypot(x, y)));
        else if (!work && destination) {
          const waypoint = destination.route[0] || destination.position;
          direction.subVectors(waypoint, player.position);
          direction.y = 0;
          remaining = direction.length();
          if (remaining < 0.15) {
            if (destination.route.length) destination.route.shift();
            else {
              const arrived = destination;
              destination = null;
              if (arrived.id) begin(arrived);
            }
            direction.set(0, 0, 0);
          } else direction.normalize();
        }
        if (!work && direction.lengthSq() > 0.01) {
          const speed = 3.9 * (1 + game.upgrades.boots * 0.12) * dt;
          const next = player.position
            .clone()
            .addScaledVector(direction, Math.min(speed, remaining));
          if (world.isWalkable(next.x, next.z)) {
            player.position.x = next.x;
            player.position.z = next.z;
            moving = true;
          } else if (world.isWalkable(next.x, player.position.z)) {
            player.position.x = next.x;
            moving = true;
          } else if (world.isWalkable(player.position.x, next.z)) {
            player.position.z = next.z;
            moving = true;
          } else if (destination) {
            destination.route = routeTo(destination.position);
            if (!destination.route.length) {
              destination = null;
              automatic = null;
              notice("Walk around the building to reach this work area.");
            }
          }
          const angle = Math.atan2(direction.x, direction.z),
            diff = Math.atan2(
              Math.sin(angle - player.rotation.y),
              Math.cos(angle - player.rotation.y),
            );
          player.rotation.y += diff * Math.min(1, dt * 14);
        }
        if (work) updateWork(work, dt);
        else if (!destination && automatic && worldTime >= nextWorkAt) {
          if (pending) {
            const next = pending;
            pending = null;
            go(next.id, next.tree);
          } else go(automatic);
        } else if (!work && pending) {
          const next = pending;
          pending = null;
          go(next.id, next.tree);
        }
      }
      if (moving) walkPhase += dt * 13;
      player.position.y =
        world.groundHeight(player.position.x, player.position.z) +
        (reducedMotion
          ? 0
          : moving
            ? Math.abs(Math.sin(walkPhase)) * 0.09
            : Math.sin(worldTime * 2) * 0.008);
      world.legs.forEach((leg, i) => {
        leg.rotation.x = moving ? Math.sin(walkPhase + i * Math.PI) * 0.65 : 0;
      });
      if (!work) {
        world.axe.visible = equipped === "axe";
        world.rod.visible = equipped === "rod";
        world.rightArm.rotation.x = moving
          ? Math.sin(walkPhase + Math.PI) * 0.35
          : rightArmRest.x;
        world.leftArm.rotation.x = moving
          ? Math.sin(walkPhase) * 0.35
          : leftArmRest.x;
      }
      for (const tree of world.trees) {
        if (
          tree.state === "fallen" &&
          tree.regrowAt > 0 &&
          worldTime >= tree.regrowAt
        ) {
          tree.state = "growing";
          tree.pivot.visible = true;
          tree.pivot.rotation.set(0, 0, 0);
          tree.notch.visible = false;
        }
        if (tree.state === "growing") {
          const t = clamp((worldTime - tree.regrowAt) / 5);
          tree.pivot.scale.setScalar(0.05 + t * 0.95);
          if (t >= 1) {
            tree.state = "standing";
            tree.stump.visible = false;
            tree.pivot.scale.setScalar(1);
            renderer.shadowMap.needsUpdate = true;
          }
        }
      }
      const ambientTime = reducedMotion ? 0 : worldTime;
      world.fish.forEach((fish, i) => {
        const base = fish.userData.basePosition as THREE.Vector3 | undefined;
        if (base) {
          fish.position.z =
            base.z + Math.sin(ambientTime * 0.22 + i * 1.7) * 2.6;
          fish.position.x = base.x + Math.sin(ambientTime * 0.13 + i) * 0.4;
        }
        fish.position.y = -0.03 + Math.sin(ambientTime * 1.3 + i) * 0.06;
        const tail = fish.getObjectByName("tail");
        if (tail) tail.rotation.y = Math.sin(ambientTime * 5 + i) * 0.4;
      });
      spinObjects.forEach((object) => {
        if (object.visible && object.parent?.visible && !current.paused) {
          const axis = object.userData.spinAxis as "x" | "y" | "z";
          object.rotation[axis] += dt * Number(object.userData.spinSpeed || 7);
        }
      });
      if (world.cutter.blade.visible && work?.id !== "steaks")
        world.cutter.blade.rotation.z += reducedMotion ? 0 : dt * 4;
      if (world.cutter.secondBlade.visible && work?.id !== "steaks")
        world.cutter.secondBlade.rotation.z -= reducedMotion ? 0 : dt * 4;
      world.upgradeGroups.crew.forEach((group, i) => {
        if (!group.visible) return;
        const worker = group.children.find(
          (object) => object.userData.workerPerson,
        ) as THREE.Group | undefined;
        if (!worker) return;
        const destinations = [
          new THREE.Vector3(-4.7, 0.4, 2.7),
          world.stations.steaks.workPosition,
          world.stations.fish.workPosition,
          world.stations.market.workPosition,
          world.stations.smoked.workPosition,
        ];
        const routeEnd = destinations[i].clone().sub(group.position);
        const phase = (ambientTime * 0.12 + i * 0.17) % 1;
        const travel =
          phase < 0.375
            ? smooth(phase / 0.375)
            : phase < 0.5
              ? 1
              : phase < 0.875
                ? 1 - smooth((phase - 0.5) / 0.375)
                : 0;
        worker.position.copy(routeEnd).multiplyScalar(travel);
        const walking = phase < 0.375 || (phase >= 0.5 && phase < 0.875);
        worker.position.y =
          walking && !reducedMotion
            ? Math.abs(Math.sin(ambientTime * 12 + i)) * 0.055
            : 0;
        worker.rotation.y =
          Math.atan2(routeEnd.x, routeEnd.z) + (phase >= 0.5 ? Math.PI : 0);
        (worker.userData.legs as THREE.Group[]).forEach((leg, j) => {
          leg.rotation.x = walking
            ? Math.sin(ambientTime * 12 + i + j * Math.PI) * 0.55
            : 0;
        });
        (worker.userData.arms as THREE.Group[]).forEach((arm, j) => {
          arm.rotation.x = walking
            ? Math.sin(ambientTime * 12 + i + j * Math.PI) * 0.4
            : phase < 0.5
              ? -0.8 + Math.sin(ambientTime * 9) * 0.6
              : -0.4;
        });
        (worker.userData.carrying as THREE.Group).visible =
          phase >= 0.45 && phase < 0.93;
      });
      world.smokePuffs.forEach((puff, i) => {
        const t = (ambientTime * 0.3 + i * 0.19) % 1;
        puff.position.y = 2.6 + t * 2.2;
        puff.scale.setScalar(0.3 + t * 0.8);
        (puff.material as THREE.MeshStandardMaterial).opacity = (1 - t) * 0.5;
      });
      for (let i = construction.length - 1; i >= 0; i--) {
        const build = construction[i];
        if (!current.paused) build.time += dt;
        const t = clamp(build.time / 0.9),
          c = 1.7;
        const scale = 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
        build.group.scale
          .copy(build.base)
          .multiplyScalar(Math.max(0.01, reducedMotion ? t : scale));
        if (t >= 1) {
          build.group.scale.copy(build.base);
          construction.splice(i, 1);
          renderer.shadowMap.needsUpdate = true;
        }
      }
      for (let i = customerWalks.length - 1; i >= 0; i--) {
        const walk = customerWalks[i];
        walk.time += dt;
        if (walk.time < 0.6)
          walk.group.position.lerpVectors(
            walk.start,
            walk.end,
            smooth(walk.time / 0.6),
          );
        else if (walk.time < 3.8) {
          const t = (walk.time - 0.6) / 3.2;
          walk.group.position.lerpVectors(
            walk.end,
            new THREE.Vector3(10.5, 0.4, 9),
            t,
          );
          walk.group.rotation.y = 1;
          walk.group.position.y += Math.abs(Math.sin(walk.time * 12)) * 0.05;
        } else {
          walk.group.position.copy(walk.home);
          walk.group.rotation.y = -Math.PI / 2;
          customerWalks.splice(i, 1);
        }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.age += dt;
        particle.velocity.y -= dt * 5;
        particle.object.position.addScaledVector(particle.velocity, dt);
        particle.object.rotation.z += dt * particle.spin;
        particle.object.scale.multiplyScalar(Math.max(0.85, 1 - dt * 0.6));
        if (particle.age >= particle.lifetime) {
          scene.remove(particle.object);
          particles.splice(i, 1);
        }
      }
      for (let i = labels.length - 1; i >= 0; i--) {
        const item = labels[i];
        item.time += dt;
        item.sprite.position.y =
          item.origin.y + (reducedMotion ? 0 : item.time * 0.7);
        item.sprite.material.opacity = Math.min(1, (1.8 - item.time) * 2);
        if (item.time >= 1.8) {
          scene.remove(item.sprite);
          item.sprite.material.map?.dispose();
          item.sprite.material.dispose();
          labels.splice(i, 1);
        }
      }
      markerMaterial.opacity = Math.max(0, markerMaterial.opacity - dt * 0.7);
      marker.scale.setScalar(1 + (1 - markerMaterial.opacity) * 0.6);
      const desiredTarget = player.position
        .clone()
        .add(new THREE.Vector3(-1.3, 1.05, -1.9));
      if (work?.tree)
        desiredTarget.lerp(
          work.tree.position.clone().add(new THREE.Vector3(0, 1, 0)),
          0.32,
        );
      if (work?.id === "fish")
        desiredTarget.lerp(
          new THREE.Vector3(-8.4, 1.1, world.stations.fish.position.z),
          0.25,
        );
      if (work && work.id !== "wood" && work.id !== "fish")
        desiredTarget.lerp(
          world.stations[work.id].position
            .clone()
            .add(new THREE.Vector3(0, 0.85, 0)),
          0.35,
        );
      if (buildFocus) {
        desiredTarget.copy(buildFocus.position);
        if (!current.paused) buildFocus.remaining -= dt;
        if (buildFocus.tool && !work) world.rightArm.rotation.x = -0.6;
        if (buildFocus.remaining <= 0) buildFocus = null;
      }
      const desiredZoom = buildFocus?.tool ? 1.16 : 1;
      camera.zoom = THREE.MathUtils.lerp(
        camera.zoom,
        desiredZoom,
        1 - Math.exp(-dt * 5),
      );
      camera.updateProjectionMatrix();
      cameraTarget.lerp(desiredTarget, 1 - Math.exp(-dt * 4));
      camera.position.copy(cameraTarget).add(cameraOffset);
      camera.lookAt(cameraTarget);
      canvas.dataset.phase = current.paused
        ? "paused"
        : work?.phase || (destination ? "walking" : "idle");
      canvas.dataset.action = work?.id || destination?.id || "";
      const activePosition = activeObject.getWorldPosition(new THREE.Vector3());
      canvas.dataset.actionRotation = activeObject.rotation.z.toFixed(4);
      canvas.dataset.actionPitch = activeObject.rotation.x.toFixed(4);
      canvas.dataset.actionX = activePosition.x.toFixed(3);
      canvas.dataset.actionY = activePosition.y.toFixed(3);
      canvas.dataset.actionZ = activePosition.z.toFixed(3);
      canvas.dataset.playerX = player.position.x.toFixed(3);
      canvas.dataset.playerZ = player.position.z.toFixed(3);
      canvas.dataset.cameraX = camera.position.x.toFixed(3);
      canvas.dataset.cameraZ = camera.position.z.toFixed(3);
      canvas.dataset.cargoCount = String(
        world.cargo.children.filter((item) => item.visible).length,
      );
      const visualLevels: Record<string, number> = {};
      for (const id of UPGRADE_IDS)
        visualLevels[id] = world.upgradeGroups[id].filter(
          (group) => group.visible,
        ).length;
      canvas.dataset.upgradeVisuals = JSON.stringify(visualLevels);
      canvas.dataset.machineCount = String(
        Object.values(visualLevels).reduce((sum, n) => sum + n, 0),
      );
      canvas.dataset.hit = String(lastHit + 1);
      if (reportTimer >= 0.125) {
        reportTimer = 0;
        const id = work?.id || destination?.id || null;
        latest.current.onActivity({
          id,
          label: current.paused
            ? "Harbor paused"
            : work
              ? PHASE_LABELS[work.phase] || LABELS[work.id]
              : destination?.id
                ? WALK_LABELS[destination.id]
                : "Explore your harbor",
          progress: work ? clamp(work.time / work.total) : 0,
          busy: !!work || !!destination,
        });
      }
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        latest.current.onReady();
      }
    }
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", motionChanged);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", blur);
      void audio?.close();
      for (const item of labels) {
        item.sprite.material.map?.dispose();
        item.sprite.material.dispose();
      }
      chipGeometry.dispose();
      snowGeometry.dispose();
      cashGeometry.dispose();
      ringGeometry.dispose();
      chipMaterial.dispose();
      snowMaterial.dispose();
      waterMaterial.dispose();
      cashMaterial.dispose();
      markerMaterial.dispose();
      world.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="island-scene"
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {failure && (
        <div
          role="alert"
          style={{
            position: "absolute",
            inset: 0,
            background: "#dcebf2",
            color: "#123b50",
            display: "grid",
            placeContent: "center",
            textAlign: "center",
            padding: 32,
          }}
        >
          <strong>Your harbor needs 3D graphics</strong>
          <p>{failure}</p>
        </div>
      )}
    </div>
  );
}
