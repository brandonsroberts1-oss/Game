import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createWorld, type ResourceNode, type Resource } from "./world";

interface IslandSceneProps {
  onHarvest: (resource: Resource) => boolean;
  onOpenMarket: () => void;
  onOpenUpgrade: () => void;
  onOpenMap?: () => void;
  onReady?: () => void;
  onNotice?: (message: string) => void;
  unlockedRegions: string[];
  toolLevel: number;
  sound: boolean;
  zoom: number;
  focusToken: number;
  carriedCount?: number;
  paused?: boolean;
  buildingLevels?: { market: number; workshop: number; crew: number };
  harvestAmount?: (resource: Resource) => number;
  saleToken?: number;
  lastSaleValue?: number;
}

type Target = {
  position: THREE.Vector3;
  node?: ResourceNode;
  kind?: "market" | "cottage" | "region";
  route?: THREE.Vector3[];
};
type Floating = {
  sprite: THREE.Sprite;
  age: number;
  lifetime: number;
  origin: THREE.Vector3;
};

const RESOURCE_LABEL: Record<Resource, string> = {
  wood: "Gather timber",
  fish: "Cast your line · catch tuna",
  salmon: "Cast your line · catch salmon",
};
const UP = new THREE.Vector3(0, 1, 0);

function floatingLabel(text: string, color = "#ffffff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 46px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(29,65,45,.7)";
  ctx.strokeText(text, 256, 64);
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.6, 0.9, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export default function IslandScene(props: IslandSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const targetRef = useRef<Target | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState("");
  callbacks.current = props;

  useEffect(() => {
    const camera = cameraRef.current;
    if (camera) {
      camera.zoom = props.zoom;
      camera.updateProjectionMatrix();
    }
  }, [props.zoom]);

  useEffect(() => {
    targetRef.current = null;
  }, [props.focusToken]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      callbacks.current.onReady?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const canvas = renderer.domElement;
    canvas.setAttribute(
      "aria-label",
      "Interactive fishing harbor. Click swimming fish to catch them, trees to gather timber, or use WASD and E.",
    );
    canvas.setAttribute("tabindex", "0");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.outline = "none";
    canvas.style.touchAction = "none";
    container.appendChild(canvas);

    const world = createWorld();
    const { scene, player } = world;
    const camera = new THREE.OrthographicCamera(-15, 15, 10, -10, 0.1, 180);
    camera.position.set(24, 28, 32);
    camera.lookAt(0, 0, 1.3);
    camera.zoom = callbacks.current.zoom;
    cameraRef.current = camera;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const movement = new THREE.Vector3();
    const keys = new Set<string>();
    const clock = new THREE.Clock();
    const floating: Floating[] = [];
    let disposed = false;
    let frameId = 0;
    let elapsed = 0;
    let harvestCooldown = 0;
    let isReady = false;
    let audioContext: AudioContext | undefined;
    let hoverNode: ResourceNode | undefined;
    let lastHover = "";
    let noticeAt = -10;
    let shakeNode: ResourceNode | undefined;
    let shakeTime = 0;
    let walkPhase = 0;
    let screenFocus = callbacks.current.focusToken;
    let casting = 0;
    let carriedCount = callbacks.current.carriedCount;
    let saleToken = callbacks.current.saleToken || 0;
    const billGeometry = new THREE.BoxGeometry(0.3, 0.06, 0.18);
    const billMaterial = new THREE.MeshStandardMaterial({
      color: 0x6fb67a,
      roughness: 0.65,
    });
    const coinGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12);
    const coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4c565,
      roughness: 0.4,
      metalness: 0.25,
    });
    const moneyParticles: {
      mesh: THREE.Mesh;
      velocity: THREE.Vector3;
      age: number;
    }[] = [];
    let shadowTimer = 0;
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let reducedMotion = motionPreference.matches;
    const updateMotion = () => {
      reducedMotion = motionPreference.matches;
    };
    motionPreference.addEventListener("change", updateMotion);
    player.traverse((object) => {
      object.castShadow = false;
    });
    world.fishes.forEach((fish) =>
      fish.traverse((object) => {
        object.castShadow = false;
      }),
    );
    const groundHeight = (x: number, z: number) =>
      x >= -3.88 && x <= 5.3 && z >= -0.98 && z <= 5.5 ? 0.78 : 0.67;
    function walkable(x: number, z: number) {
      if (!world.isWalkable(x, z)) return false;
      return !world.obstacles.some(
        (obstacle) =>
          Math.abs(x - obstacle.x) < obstacle.width / 2 + 0.18 &&
          Math.abs(z - obstacle.z) < obstacle.depth / 2 + 0.18,
      );
    }
    function routeTo(destination: THREE.Vector3): THREE.Vector3[] {
      const step = 0.45;
      const nx = 44,
        nz = 33;
      const position = (id: number) =>
        new THREE.Vector3(
          (id % nx) * step - 9.675,
          0.7,
          Math.floor(id / nx) * step - 7.2,
        );
      const available = new Set<number>();
      let start = -1,
        goal = -1,
        startDistance = Infinity,
        goalDistance = Infinity;
      for (let id = 0; id < nx * nz; id++) {
        const point = position(id);
        if (!walkable(point.x, point.z)) continue;
        available.add(id);
        const sd = point.distanceToSquared(player.position);
        const gd = point.distanceToSquared(destination);
        if (sd < startDistance) {
          startDistance = sd;
          start = id;
        }
        if (gd < goalDistance) {
          goalDistance = gd;
          goal = id;
        }
      }
      if (start < 0 || goal < 0) return [];
      const open = new Set([start]);
      const cameFrom = new Map<number, number>();
      const cost = new Map<number, number>([[start, 0]]);
      const estimate = (id: number) =>
        Math.hypot(
          (id % nx) - (goal % nx),
          Math.floor(id / nx) - Math.floor(goal / nx),
        );
      const offsets = [-nx - 1, -nx, -nx + 1, -1, 1, nx - 1, nx, nx + 1];
      while (open.size) {
        let current = -1,
          score = Infinity;
        for (const id of open) {
          const value = (cost.get(id) || 0) + estimate(id);
          if (value < score) {
            score = value;
            current = id;
          }
        }
        if (current === goal) {
          const route: THREE.Vector3[] = [];
          let id = goal;
          while (id !== start) {
            route.unshift(position(id));
            id = cameFrom.get(id)!;
          }
          if (walkable(destination.x, destination.z))
            route.push(destination.clone());
          return route;
        }
        open.delete(current);
        for (const offset of offsets) {
          const neighbor = current + offset;
          if (
            !available.has(neighbor) ||
            Math.abs((current % nx) - (neighbor % nx)) > 1
          )
            continue;
          const diagonal =
            offset !== -nx && offset !== nx && offset !== -1 && offset !== 1;
          const dx = (neighbor % nx) - (current % nx);
          const dz = Math.floor(neighbor / nx) - Math.floor(current / nx);
          if (
            diagonal &&
            (!available.has(current + dx) || !available.has(current + dz * nx))
          )
            continue;
          const nextCost =
            (cost.get(current) || 0) + (diagonal ? Math.SQRT2 : 1);
          if (nextCost < (cost.get(neighbor) ?? Infinity)) {
            cameFrom.set(neighbor, current);
            cost.set(neighbor, nextCost);
            open.add(neighbor);
          }
        }
      }
      return [];
    }
    const cargo = new THREE.Group();
    cargo.position.set(0, 0.5, -0.22);
    player.add(cargo);
    const rod = new THREE.Group();
    const rodMaterial = new THREE.MeshStandardMaterial({
      color: 0x784f37,
      roughness: 0.7,
    });
    const rodShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.045, 2.3, 6),
      rodMaterial,
    );
    rodShaft.position.set(0.38, 1.7, 0.9);
    rodShaft.rotation.x = 0.55;
    rod.add(rodShaft);
    const fishingLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.38, 2.7, 1.5),
      new THREE.Vector3(0.38, 0.15, 2.5),
    ]);
    const fishingLine = new THREE.Line(
      fishingLineGeometry,
      new THREE.LineBasicMaterial({
        color: 0xfaf3dc,
        transparent: true,
        opacity: 0.85,
      }),
    );
    rod.add(fishingLine);
    const bobber = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xf47647 }),
    );
    bobber.position.set(0.38, 0.15, 2.5);
    rod.add(bobber);
    rod.visible = false;
    player.add(rod);
    const snowGeometry = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      snowPositions[i * 3] = Math.random() * 34 - 17;
      snowPositions[i * 3 + 1] = Math.random() * 16;
      snowPositions[i * 3 + 2] = Math.random() * 28 - 14;
    }
    snowGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(snowPositions, 3),
    );
    const snowfall = new THREE.Points(
      snowGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.055,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    scene.add(snowfall);

    function stackCargo(resource: Resource) {
      if (cargo.children.length >= 9) {
        const first = cargo.children[0];
        first.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            (object.material as THREE.Material).dispose();
          }
        });
        cargo.remove(first);
        cargo.children.forEach((item, i) => {
          item.position.y = i * 0.17;
        });
      }
      const item = new THREE.Group();
      const material = new THREE.MeshStandardMaterial({
        color:
          resource === "wood"
            ? 0xa56b3d
            : resource === "salmon"
              ? 0xef8e6f
              : 0x75a7bd,
        roughness: 0.55,
      });
      const mesh = new THREE.Mesh(
        resource === "wood"
          ? new THREE.CylinderGeometry(0.09, 0.09, 0.6, 8)
          : new THREE.SphereGeometry(0.16, 10, 7),
        material,
      );
      if (resource === "wood") mesh.rotation.z = Math.PI / 2;
      else mesh.scale.set(2.2, 0.65, 0.7);
      item.add(mesh);
      item.position.set(0, cargo.children.length * 0.17, -0.12);
      cargo.add(item);
    }
    function clearCargo() {
      for (const item of [...cargo.children]) {
        item.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            (object.material as THREE.Material).dispose();
          }
        });
        cargo.remove(item);
      }
    }

    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffedb3,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.39, 40),
      markerMaterial,
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.65;
    scene.add(marker);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffee9c,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.69, 48),
      haloMaterial,
    );
    halo.rotation.x = -Math.PI / 2;
    halo.visible = false;
    scene.add(halo);

    function resize() {
      if (!container) return;
      const w = container.clientWidth || 900;
      const h = container.clientHeight || 580;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      const halfHeight = Math.max(10, 14 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    function sound() {
      if (!callbacks.current.sound) return;
      try {
        audioContext ||= new AudioContext();
        if (audioContext.state === "suspended") void audioContext.resume();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
          460 + Math.random() * 100,
          audioContext.currentTime,
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          820,
          audioContext.currentTime + 0.1,
        );
        gain.gain.setValueAtTime(0.035, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + 0.18,
        );
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
      } catch {
        /* The visual interaction remains available if audio is unavailable. */
      }
    }

    function showLabel(text: string, position: THREE.Vector3, color?: string) {
      const sprite = floatingLabel(text, color);
      const origin = position.clone().add(new THREE.Vector3(0, 3, 0));
      sprite.position.copy(origin);
      scene.add(sprite);
      floating.push({ sprite, age: 0, lifetime: 1.5, origin });
    }

    function harvest(node: ResourceNode) {
      if (
        callbacks.current.paused ||
        node.depletedUntil > elapsed ||
        harvestCooldown > 0
      )
        return;
      if (!callbacks.current.unlockedRegions.includes(node.region)) {
        if (elapsed - noticeAt > 2)
          callbacks.current.onNotice?.(
            "Unlock this region on your harbor map.",
          );
        noticeAt = elapsed;
        targetRef.current = null;
        return;
      }
      const units = callbacks.current.harvestAmount?.(node.resource);
      if (!callbacks.current.onHarvest(node.resource)) {
        showLabel("Backpack full", player.position, "#ffe5a0");
        callbacks.current.onNotice?.(
          "Your backpack is full. Visit the market to sell your goods.",
        );
        harvestCooldown = 1;
        targetRef.current = null;
        return;
      }
      sound();
      if (node.resource !== "wood") casting = 0.7;
      stackCargo(node.resource);
      harvestCooldown = Math.max(
        0.32,
        0.82 - callbacks.current.toolLevel * 0.055,
      );
      shakeNode = node;
      shakeTime = 0.4;
      node.hits += 1;
      const amount =
        node.resource === "wood"
          ? "Timber"
          : node.resource === "fish"
            ? "Tuna"
            : "Salmon";
      showLabel(
        `+${units ? `${units} ` : " "}${amount}`,
        node.position,
        "#fff7cc",
      );
      if (node.hits >= 3) {
        node.depletedUntil = elapsed + (node.resource === "wood" ? 18 : 13);
        node.hits = 0;
        targetRef.current = null;
      }
    }

    function worldHit(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const ground = raycaster.ray.intersectPlane(
        new THREE.Plane(UP, -0.78),
        new THREE.Vector3(),
      );
      // Fishing circles are deliberately hollow: the whole marked area is clickable.
      if (ground) {
        const spot = world.nodes.find(
          (node) =>
            node.resource !== "wood" &&
            node.depletedUntil <= elapsed &&
            callbacks.current.unlockedRegions.includes(node.region) &&
            Math.hypot(node.position.x - ground.x, node.position.z - ground.z) <
              0.75,
        );
        if (spot)
          return { position: spot.position.clone(), node: spot } as Target;
      }
      const objects: THREE.Object3D[] = [world.cottage, world.market];
      objects.push(...world.fishes);
      objects.push(
        ...world.decorations.filter(
          (group) => group.visible && !!group.userData.lockedRegion,
        ),
      );
      for (const node of world.nodes) {
        if (
          node.depletedUntil <= elapsed &&
          callbacks.current.unlockedRegions.includes(node.region)
        )
          objects.push(node.group);
      }
      const hits = raycaster.intersectObjects(objects, true);
      if (hits.length) {
        let object: THREE.Object3D | null = hits[0].object;
        while (object) {
          const node = world.nodes.find((n) => n.group === object);
          if (node) return { position: node.position.clone(), node } as Target;
          const fish = world.fishes.find((group) => group === object);
          if (fish) {
            const resource: Resource =
              fish.userData.resource === "salmon" ? "salmon" : "fish";
            const available = world.nodes.filter(
              (n) =>
                n.resource === resource &&
                callbacks.current.unlockedRegions.includes(n.region),
            );
            available.sort(
              (a, b) =>
                Number(a.depletedUntil > elapsed) -
                  Number(b.depletedUntil > elapsed) ||
                a.position.distanceToSquared(fish.position) -
                  b.position.distanceToSquared(fish.position),
            );
            if (available[0])
              return {
                position: available[0].position.clone(),
                node: available[0],
              } as Target;
          }
          if (object.userData.lockedRegion)
            return {
              position: object.position.clone(),
              kind: "region",
            } as Target;
          if (object === world.market)
            return {
              position: new THREE.Vector3(4, 0.78, 3.15),
              kind: "market",
            } as Target;
          if (object === world.cottage)
            return {
              position: new THREE.Vector3(-2, 0.6, 1.5),
              kind: "cottage",
            } as Target;
          object = object.parent;
        }
      }
      const plane = new THREE.Plane(UP, -0.6);
      const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (hit && walkable(hit.x, hit.z)) return { position: hit } as Target;
      return null;
    }

    function pointerMove(event: PointerEvent) {
      if (callbacks.current.paused) return;
      const hit = worldHit(event);
      hoverNode = hit?.node;
      const label = hit?.node
        ? RESOURCE_LABEL[hit.node.resource]
        : hit?.kind === "market"
          ? "Fish market · sell your catch"
          : hit?.kind === "cottage"
            ? "Smokehouse · harbor upgrades"
            : hit?.kind === "region"
              ? "Discover a new fishing region"
              : "";
      if (label !== lastHover) {
        setHover(label);
        lastHover = label;
      }
      canvas.style.cursor =
        hit?.node || hit?.kind ? "pointer" : hit ? "crosshair" : "default";
    }

    function pointerLeave() {
      hoverNode = undefined;
      lastHover = "";
      setHover("");
    }
    function pointerDown(event: PointerEvent) {
      if (event.button !== 0 || callbacks.current.paused) return;
      canvas.focus({ preventScroll: true });
      const hit = worldHit(event);
      if (!hit) return;
      if (hit.kind === "region") {
        callbacks.current.onOpenMap?.();
        return;
      }
      if (hit.node && hit.node.depletedUntil > elapsed) {
        callbacks.current.onNotice?.(
          "This spot is resting. Try another fishing spot while the fish return.",
        );
        return;
      }
      const destination = hit.position.clone();
      if (hit.node) {
        const towardPlayer = player.position.clone().sub(destination);
        towardPlayer.y = 0;
        if (towardPlayer.length() > 1.15)
          destination.add(towardPlayer.normalize().multiplyScalar(1.15));
      }
      hit.route = routeTo(destination);
      targetRef.current = hit;
      marker.position.set(
        hit.position.x,
        groundHeight(hit.position.x, hit.position.z) + 0.025,
        hit.position.z,
      );
      markerMaterial.opacity = 0.95;
      sound();
    }

    function interact() {
      if (callbacks.current.paused) return;
      if (player.position.distanceTo(new THREE.Vector3(4, 0.78, 3.15)) < 2.5) {
        clearCargo();
        callbacks.current.onOpenMarket();
        return;
      }
      if (player.position.distanceTo(new THREE.Vector3(-2, 0.6, 1.5)) < 2.3) {
        callbacks.current.onOpenUpgrade();
        return;
      }
      const nearest = world.nodes
        .filter(
          (n) =>
            n.depletedUntil <= elapsed &&
            callbacks.current.unlockedRegions.includes(n.region),
        )
        .sort(
          (a, b) =>
            a.position.distanceToSquared(player.position) -
            b.position.distanceToSquared(player.position),
        )[0];
      if (nearest && nearest.position.distanceTo(player.position) < 3.5)
        harvest(nearest);
      else
        callbacks.current.onNotice?.(
          "Click a snowy tree or a glowing fishing spot to start gathering.",
        );
    }

    function keyDown(event: KeyboardEvent) {
      if (
        callbacks.current.paused ||
        (event.target as HTMLElement).tagName !== "CANVAS"
      )
        return;
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
        if (!event.repeat && (key === "e" || key === " ")) interact();
        keys.add(key);
      }
    }
    function keyUp(event: KeyboardEvent) {
      keys.delete(event.key.toLowerCase());
    }
    function blur() {
      keys.clear();
    }
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerleave", pointerLeave);
    canvas.addEventListener("pointerdown", pointerDown);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);

    function animate() {
      if (disposed) return;
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.12);
      elapsed += dt;
      shadowTimer += dt;
      if (shadowTimer >= 1.3) {
        renderer.shadowMap.needsUpdate = true;
        shadowTimer = 0;
      }
      harvestCooldown = Math.max(0, harvestCooldown - dt);
      if (callbacks.current.carriedCount === 0 && carriedCount !== 0)
        clearCargo();
      carriedCount = callbacks.current.carriedCount;
      const nextSaleToken = callbacks.current.saleToken || 0;
      if (nextSaleToken > saleToken) {
        showLabel(
          `+${(callbacks.current.lastSaleValue || 0).toLocaleString()} coins`,
          new THREE.Vector3(4.2, 1.25, 2),
          "#ffe7a2",
        );
        sound();
        if (!reducedMotion) {
          for (let i = 0; i < 12; i++) {
            const mesh = new THREE.Mesh(
              i % 3 ? billGeometry : coinGeometry,
              i % 3 ? billMaterial : coinMaterial,
            );
            mesh.position.set(4.2, 2.2, 2);
            mesh.rotation.set(Math.random(), Math.random(), Math.random());
            scene.add(mesh);
            moneyParticles.push({
              mesh,
              velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 2.4,
                2.5 + Math.random() * 2,
                (Math.random() - 0.5) * 2.4,
              ),
              age: 0,
            });
          }
        }
      }
      saleToken = nextSaleToken;
      if (callbacks.current.paused) {
        keys.clear();
        targetRef.current = null;
        casting = 0;
        if (lastHover) pointerLeave();
      }
      if (screenFocus !== callbacks.current.focusToken) {
        screenFocus = callbacks.current.focusToken;
        targetRef.current = null;
        camera.lookAt(0, 0, 1.3);
      }

      const target = targetRef.current;
      movement.set(0, 0, 0);
      let distanceLeft = Infinity;
      const horizontal =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft"));
      const vertical =
        Number(keys.has("w") || keys.has("arrowup")) -
        Number(keys.has("s") || keys.has("arrowdown"));
      if (horizontal || vertical) {
        movement
          .set(
            horizontal * 0.8 - vertical * 0.6,
            0,
            -horizontal * 0.6 - vertical * 0.8,
          )
          .normalize();
        targetRef.current = null;
      } else if (target) {
        const waypoint = target.route?.[0];
        movement.subVectors(waypoint || target.position, player.position);
        movement.y = 0;
        const threshold = waypoint
          ? 0.14
          : target.node
            ? 1.35
            : target.kind
              ? 0.35
              : 0.1;
        if (movement.length() > threshold) {
          distanceLeft = movement.length();
          movement.normalize();
        } else {
          movement.set(0, 0, 0);
          if (waypoint) target.route?.shift();
          else if (target.node) harvest(target.node);
          else {
            targetRef.current = null;
            if (target.kind === "market") {
              clearCargo();
              callbacks.current.onOpenMarket();
            }
            if (target.kind === "cottage") callbacks.current.onOpenUpgrade();
          }
        }
      }

      const walking = movement.lengthSq() > 0.01;
      if (walking) {
        const next = player.position
          .clone()
          .addScaledVector(movement, Math.min(dt * 3.6, distanceLeft));
        if (walkable(next.x, next.z)) {
          player.position.x = next.x;
          player.position.z = next.z;
        } else {
          if (walkable(next.x, player.position.z)) player.position.x = next.x;
          else if (walkable(player.position.x, next.z))
            player.position.z = next.z;
          else targetRef.current = null;
        }
        const angle = Math.atan2(movement.x, movement.z);
        const diff = Math.atan2(
          Math.sin(angle - player.rotation.y),
          Math.cos(angle - player.rotation.y),
        );
        player.rotation.y += diff * Math.min(1, dt * 13);
        walkPhase += dt * 13;
      }
      player.position.y =
        groundHeight(player.position.x, player.position.z) +
        (reducedMotion
          ? 0
          : walking
            ? Math.abs(Math.sin(walkPhase)) * 0.065
            : Math.sin(elapsed * 2) * 0.012);
      world.limbs.forEach((limb, i) => {
        limb.rotation.x = walking
          ? Math.sin(walkPhase + (i % 2) * Math.PI) * 0.45
          : Math.sin(elapsed * 2 + i) * 0.025;
      });
      casting = Math.max(0, casting - dt);
      rod.visible =
        casting > 0 ||
        !!(
          targetRef.current?.node &&
          targetRef.current.node.resource !== "wood" &&
          !walking
        );
      rod.rotation.x = Math.sin(elapsed * 4) * 0.04;
      bobber.position.y = 0.15 + Math.sin(elapsed * 7) * 0.06;
      for (let i = 0; i < (reducedMotion ? 0 : 160); i++) {
        snowPositions[i * 3] += Math.sin(elapsed * 0.3 + i) * dt * 0.1;
        snowPositions[i * 3 + 1] -= dt * (0.38 + (i % 3) * 0.08);
        if (snowPositions[i * 3 + 1] < -0.5) snowPositions[i * 3 + 1] = 15;
      }
      snowGeometry.attributes.position.needsUpdate = true;

      for (const node of world.nodes) {
        const unlocked = callbacks.current.unlockedRegions.includes(
          node.region,
        );
        node.group.visible = unlocked;
        if (!unlocked) continue;
        const remaining = node.depletedUntil - elapsed;
        const desiredScale = remaining > 0 ? 0.06 : node.baseScale;
        const scale = THREE.MathUtils.lerp(
          node.group.scale.x,
          desiredScale,
          Math.min(1, dt * 7),
        );
        node.group.scale.setScalar(scale);
        node.group.rotation.z = reducedMotion
          ? 0
          : Math.sin(elapsed * 1.5 + node.sway) * 0.012;
      }
      if (shakeNode && shakeTime > 0) {
        shakeTime -= dt;
        shakeNode.group.rotation.z +=
          Math.sin(shakeTime * 55) * shakeTime * 0.4;
      }
      halo.visible = !!hoverNode && hoverNode.depletedUntil <= elapsed;
      if (hoverNode) {
        halo.position.set(
          hoverNode.position.x,
          groundHeight(hoverNode.position.x, hoverNode.position.z) + 0.03,
          hoverNode.position.z,
        );
        halo.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.04);
      }
      markerMaterial.opacity = Math.max(0, markerMaterial.opacity - dt * 0.55);
      marker.scale.setScalar(1 + (1 - markerMaterial.opacity) * 1.2);

      const environmentTime = reducedMotion ? 0 : elapsed;
      world.boat.position.y = -0.15 + Math.sin(environmentTime * 1.2) * 0.09;
      world.boat.rotation.z = Math.sin(environmentTime * 1.1) * 0.025;
      world.boat.rotation.x = Math.cos(environmentTime * 1.4) * 0.015;
      world.birds.forEach((bird, i) => {
        bird.position.x = Math.sin(environmentTime * 0.12 + i * 2.1) * 14;
        bird.position.z = Math.cos(environmentTime * 0.12 + i * 2.1) * 10;
        bird.position.y = 8 + i * 0.35 + Math.sin(environmentTime + i) * 0.14;
        bird.rotation.y = -environmentTime * 0.12 - i * 2.1;
        bird.children.forEach((wing, j) => {
          wing.rotation.z =
            Math.sin(environmentTime * 5 + i) * 0.25 * (j ? 1 : -1);
        });
      });
      world.clouds.forEach((cloud, i) => {
        cloud.position.x += reducedMotion ? 0 : dt * 0.1;
        if (cloud.position.x > 24) cloud.position.x = -24;
        cloud.position.y += Math.sin(environmentTime * 0.5 + i) * 0.0005;
      });
      world.decorations.forEach((decoration) => {
        if (typeof decoration.userData.region === "string")
          decoration.visible = callbacks.current.unlockedRegions.includes(
            decoration.userData.region,
          );
        if (typeof decoration.userData.lockedRegion === "string")
          decoration.visible = !callbacks.current.unlockedRegions.includes(
            decoration.userData.lockedRegion,
          );
      });
      if (world.upgradeDecorations) {
        for (const kind of ["market", "workshop", "crew"] as const) {
          world.upgradeDecorations[kind].forEach((group, i) => {
            group.visible = i < (callbacks.current.buildingLevels?.[kind] || 0);
          });
        }
      }
      if (world.sparkles) {
        const sparkleMat = world.sparkles.material as THREE.Material & {
          opacity: number;
        };
        sparkleMat.opacity = 0.32 + Math.sin(environmentTime * 1.3) * 0.12;
      }
      const fishes = (world as typeof world & { fishes?: THREE.Group[] })
        .fishes;
      fishes?.forEach((fish, i) => {
        const base = fish.userData.basePosition as THREE.Vector3 | undefined;
        if (base) {
          fish.position.x =
            base.x + Math.sin(environmentTime * 0.28 + i * 1.5) * 0.7;
          fish.position.z = base.z + Math.sin(environmentTime * 0.4 + i) * 2;
        }
        fish.position.y = -0.28 + Math.sin(environmentTime * 1.5 + i) * 0.05;
        fish.rotation.y = Math.sin(environmentTime * 0.4 + i) * 0.18;
        const tail = fish.getObjectByName("tail");
        if (tail) tail.rotation.y = Math.sin(environmentTime * 5 + i) * 0.3;
      });
      const customers = (world as typeof world & { customers?: THREE.Group[] })
        .customers;
      customers?.forEach((customer, i) => {
        customer.position.y =
          0.67 + Math.abs(Math.sin(environmentTime * 2 + i)) * 0.015;
      });
      for (let i = moneyParticles.length - 1; i >= 0; i--) {
        const particle = moneyParticles[i];
        particle.age += dt;
        particle.velocity.y -= dt * 3;
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.mesh.rotation.x += dt * 2;
        particle.mesh.rotation.y += dt * 2.8;
        particle.mesh.scale.setScalar(
          Math.max(0, 1 - Math.max(0, particle.age - 1)),
        );
        if (particle.age >= 2) {
          scene.remove(particle.mesh);
          moneyParticles.splice(i, 1);
        }
      }
      for (let i = floating.length - 1; i >= 0; i--) {
        const item = floating[i];
        item.age += dt;
        item.sprite.position.y =
          item.origin.y + (reducedMotion ? 0 : item.age * 0.85);
        (item.sprite.material as THREE.SpriteMaterial).opacity = Math.min(
          1,
          (item.lifetime - item.age) * 2,
        );
        if (item.age >= item.lifetime) {
          scene.remove(item.sprite);
          item.sprite.material.map?.dispose();
          item.sprite.material.dispose();
          floating.splice(i, 1);
        }
      }
      renderer.render(scene, camera);
      if (!isReady) {
        isReady = true;
        callbacks.current.onReady?.();
      }
    }
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      motionPreference.removeEventListener("change", updateMotion);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      void audioContext?.close();
      for (const item of floating) {
        item.sprite.material.map?.dispose();
        item.sprite.material.dispose();
      }
      marker.geometry.dispose();
      markerMaterial.dispose();
      halo.geometry.dispose();
      haloMaterial.dispose();
      billGeometry.dispose();
      billMaterial.dispose();
      coinGeometry.dispose();
      coinMaterial.dispose();
      world.dispose();
      renderer.dispose();
      canvas.remove();
      cameraRef.current = null;
    };
  }, []);

  return (
    <div
      ref={host}
      className="island-scene"
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {hover && (
        <div
          className="world-tooltip"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            padding: "9px 15px",
            color: "#fffef5",
            background: "rgba(23,58,76,.9)",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 2,
          }}
        >
          {hover}
        </div>
      )}
      {failed && (
        <div
          role="status"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeContent: "center",
            textAlign: "center",
            padding: 32,
            color: "#294453",
            background: "#d4e7ed",
          }}
        >
          <strong>Your harbor is waiting</strong>
          <p>
            Enable hardware acceleration or try a browser with WebGL to explore
            the 3D world.
            <br />
            Your market, upgrades, and saved progress are still available.
          </p>
        </div>
      )}
    </div>
  );
}
