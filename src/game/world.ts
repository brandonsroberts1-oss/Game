import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { UpgradeId, Resource, GameState, ActivityId } from "./model";
import { createGeneratedMaterials } from "./artAssets";

export interface TreeNode {
  group: THREE.Group;
  pivot: THREE.Group;
  trunk: THREE.Mesh;
  notch: THREE.Mesh;
  stump: THREE.Group;
  position: THREE.Vector3;
  state: "standing" | "fallen" | "growing";
  regrowAt: number;
  originalScale: number;
}
export interface PersonRig {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  legs: THREE.Group[];
  cargo?: THREE.Group;
}
export interface Station {
  group: THREE.Group;
  position: THREE.Vector3;
  workPosition: THREE.Vector3;
}
export interface World {
  scene: THREE.Scene;
  player: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  legs: THREE.Group[];
  cargo: THREE.Group;
  axe: THREE.Group;
  rod: THREE.Group;
  bobber: THREE.Mesh;
  fishingLine: THREE.Line;
  trees: TreeNode[];
  fish: THREE.Group[];
  customers: THREE.Group[];
  stations: Record<Exclude<ActivityId, "wood">, Station>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  workerTree: TreeNode;
  createPerson: (parent: THREE.Object3D, coat: string) => PersonRig;
  activityProps: Record<string, THREE.Object3D>;
  ready: Promise<boolean>;
  cutter: {
    cleaver: THREE.Group;
    blade: THREE.Group;
    secondBlade: THREE.Group;
    piston: THREE.Group;
    conveyor: THREE.Group;
    fish: THREE.Group;
    steaks: THREE.Group[];
    setCutProgress: (progress: number, amount: number) => void;
    reset: () => void;
  };
  upgradeGroups: Record<UpgradeId, THREE.Group[]>;
  smokePuffs: THREE.Mesh[];
  water: THREE.Mesh;
  isWalkable: (x: number, z: number) => boolean;
  groundHeight: (x: number, z: number) => number;
  applyUpgrades: (levels: GameState["upgrades"]) => THREE.Group[];
  createItem: (resource: Resource) => THREE.Group;
  dispose: () => void;
}

/** The entire playable yard is assembled here; no downloads or texture services. */
export function createWorld(): World {
  const generated = createGeneratedMaterials();
  const bounds = { minX: -7.05, maxX: 27, minZ: -22, maxZ: 25 };
  const activityProps: Record<string, THREE.Object3D> = {};
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c7deea");
  scene.fog = new THREE.Fog("#c7deea", 50, 115);
  let seed = 7919;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string, metalness = 0) => {
    const key = color + metalness;
    if (!mats.has(key))
      mats.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: metalness ? 0.44 : 0.9,
          metalness,
        }),
      );
    return mats.get(key)!;
  };
  const cube = new THREE.BoxGeometry(1, 1, 1),
    sphere = new THREE.SphereGeometry(1, 12, 9),
    cone = new THREE.ConeGeometry(1, 1, 10),
    cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  function shape(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    color: string,
    pos: number[],
    scale: number[],
    metalness = 0,
  ) {
    const m = new THREE.Mesh(geo, material(color, metalness));
    m.position.set(pos[0], pos[1], pos[2]);
    m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (p: THREE.Object3D, c: string, pos: number[], s: number[]) =>
    shape(p, cube, c, pos, s);
  const ball = (p: THREE.Object3D, c: string, pos: number[], s: number[]) =>
    shape(p, sphere, c, pos, s);
  const cylinder = (
    p: THREE.Object3D,
    c: string,
    pos: number[],
    s: number[],
    metal = 0,
  ) => shape(p, cyl, c, pos, s, metal);
  const group = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  // Batch stationary details by material while preserving all articulated groups.
  const unusedGeometries = new Set<THREE.BufferGeometry>();
  function batchDetails(root: THREE.Group) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...root.children])
      if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
        const list = batches.get(child.material) || [];
        list.push(child);
        batches.set(child.material, list);
      }
    batches.forEach((meshes, mat) => {
      if (meshes.length < 2) return;
      const parts = meshes.map((m) => {
        m.updateMatrix();
        return m.geometry.clone().applyMatrix4(m.matrix);
      });
      const geometry = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      if (!geometry) return;
      const merged = new THREE.Mesh(geometry, mat);
      merged.castShadow = true;
      merged.receiveShadow = true;
      meshes.forEach((m) => {
        unusedGeometries.add(m.geometry);
        root.remove(m);
      });
      root.add(merged);
    });
  }
  const silver = "#cbdbe4",
    yellow = "#edbc42",
    timber = "#bf8050",
    darkWood = "#805634",
    snow = "#edf4f8",
    teal = "#24a3b6";
  const ambient = new THREE.HemisphereLight("#f6fbff", "#789ab8", 1.8);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff2d8", 2.8);
  sun.position.set(-9, 24, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 65;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#c6e3fa", 0.4);
  fill.position.set(15, 10, -20);
  scene.add(fill);
  // Square snowbanks and an uninterrupted river continue beyond the camera.
  box(scene, "#c5dae6", [15, -0.4, 0], [44, 1.5, 160]);
  box(scene, snow, [15, 0.21, 0], [44, 0.28, 160]);
  box(scene, "#c5dae6", [-31, -0.4, 0], [36, 1.5, 160]);
  box(scene, snow, [-31, 0.21, 0], [36, 0.28, 160]);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(6.1, 220, 1, 1),
    new THREE.MeshStandardMaterial({
      color: "#0876c0",
      roughness: 0.35,
      metalness: 0.23,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-10.05, -0.25, 0);
  water.receiveShadow = true;
  scene.add(water);
  // A translucent turquoise strip follows each icy bank.
  for (const x of [-7.16, -12.93]) {
    const shore = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 200),
      new THREE.MeshBasicMaterial({
        color: "#63d7e5",
        transparent: true,
        opacity: 0.42,
      }),
    );
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(x, -0.24, 0);
    scene.add(shore);
  }
  const floorMaterial = generated.wood;
  box(scene, "#a37153", [1.05, 0.13, 2.65], [12.9, 0.5, 11.7]);
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(12.9, 0.055, 11.7),
    floorMaterial,
  );
  floor.position.set(1.05, 0.3725, 2.65);
  floor.receiveShadow = true;
  scene.add(floor);
  for (const x of [-5.42, 7.52])
    box(scene, "#d59b63", [x, 0.42, 2.65], [0.12, 0.13, 11.85]);
  box(scene, "#d59b63", [1.05, 0.42, 8.55], [12.98, 0.13, 0.12]);
  // Palisades are instanced, leaving a generous open entrance at the front.
  const fencePositions: { x: number; z: number }[] = [];
  for (let x = -5.25; x < 7.5; x += 0.23)
    if (x < -3.8 || (x > 0.9 && x < 1.5) || x > 4.5)
      fencePositions.push({ x, z: -3.28 });
  for (let z = -3.1; z < 8.6; z += 0.23)
    if (z < 0.05 || z > 2.1) fencePositions.push({ x: -5.55, z });
  for (let z = -3.1; z < 8.6; z += 0.23)
    if (z < 3.9 || z > 6.7) fencePositions.push({ x: 7.65, z });
  for (let x = -5.25; x < 7.5; x += 0.23)
    if (x < -2.9 || x > 4.9) fencePositions.push({ x, z: 8.72 });
  const fenceLogs = new THREE.InstancedMesh(
      cyl,
      material("#cd8a52"),
      fencePositions.length,
    ),
    fenceTips = new THREE.InstancedMesh(
      cone,
      material("#e3ac70"),
      fencePositions.length,
    );
  const dummy = new THREE.Object3D();
  fencePositions.forEach((p, i) => {
    dummy.position.set(p.x, 1.04, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.115, 1.3, 0.115);
    dummy.updateMatrix();
    fenceLogs.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 1.79;
    dummy.scale.set(0.115, 0.2, 0.115);
    dummy.updateMatrix();
    fenceTips.setMatrixAt(i, dummy.matrix);
  });
  fenceLogs.castShadow = true;
  fenceLogs.receiveShadow = true;
  fenceTips.castShadow = true;
  scene.add(fenceLogs, fenceTips);
  let dockLevel = 0;
  const onDock = (x: number, z: number) =>
    x >= -6.48 - dockLevel * 0.43 &&
    x <= -4.7 &&
    Math.abs(z - 1) <= 0.84 + dockLevel * 0.06;
  const deckFootprints = [
    { x: 12, z: 6, w: 9, d: 7 },
    { x: 11, z: 12, w: 9, d: 5 },
    { x: 19, z: 16, w: 9, d: 7 },
    { x: 15, z: -5, w: 7, d: 6 },
    { x: 9, z: 5, w: 5, d: 2.4 },
    { x: 13, z: 9.6, w: 2.4, d: 6 },
    { x: 16.8, z: 13.8, w: 8.5, d: 2.4 },
    { x: 13, z: -8.8, w: 3, d: 6 },
    { x: 5, z: -6.5, w: 14, d: 2.1 },
  ];
  const groundHeight = (x: number, z: number) =>
    deckFootprints.some(
      (d) => Math.abs(x - d.x) <= d.w / 2 && Math.abs(z - d.z) <= d.d / 2,
    )
      ? 0.438
      : onDock(x, z) || (x >= -5.55 && x <= 7.65 && z >= -3.3 && z <= 8.75)
        ? 0.4
        : 0.35;
  // All reusable cargo items have true volume and distinct silhouettes.
  function bodyRadius(z: number) {
    const t = THREE.MathUtils.clamp((z + 1.4) / 2.95, 0, 1);
    return (
      0.035 + Math.pow(Math.sin(t * Math.PI), 0.72) * 0.43 * (0.85 + 0.15 * t)
    );
  }
  function fishBodyGeometry(from = -1.4, to = 1.55) {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 28; i++) {
      const z = from + ((to - from) * i) / 28;
      points.push(new THREE.Vector2(bodyRadius(z), z));
    }
    const geometry = new THREE.LatheGeometry(points, 36);
    geometry.rotateX(Math.PI / 2);
    geometry.scale(1, 0.77, 1);
    const uv = geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++)
      uv.setY(i, (from + 1.4 + (to - from) * uv.getY(i)) / 2.95);
    return geometry;
  }
  function fin(
    parent: THREE.Object3D,
    points: THREE.Vector2[],
    color: string,
    position: THREE.Vector3,
    rotation: THREE.Euler,
  ) {
    const shape = new THREE.Shape(points);
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.025,
        bevelEnabled: true,
        bevelSize: 0.012,
        bevelThickness: 0.012,
        bevelSegments: 1,
        steps: 1,
      }),
      material(color, 0.15),
    );
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function makeFish(smoked = false) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      fishBodyGeometry(),
      smoked ? material("#a97443") : generated.tunaSkin,
    );
    body.name = "fish-body";
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const belly = ball(
      g,
      smoked ? "#c9a66e" : "#d6e3df",
      [0, -0.245, 0.1],
      [0.31, 0.09, 1.09],
    );
    belly.name = "fish-belly";
    const navy = smoked ? "#6d4729" : "#19374d";
    for (const sign of [-1, 1]) {
      const eye = ball(
        g,
        "#27231e",
        [sign * 0.253, 0.07, 1.05],
        [0.041, 0.041, 0.025],
      );
      eye.name = "fish-eye";
      ball(g, "#c7d8d4", [sign * 0.267, 0.086, 1.061], [0.01, 0.012, 0.009]);
      const gill = new THREE.Mesh(
        new THREE.TorusGeometry(0.19, 0.009, 5, 18, Math.PI * 0.83),
        material(smoked ? "#9b6939" : "#427184", 0.2),
      );
      gill.rotation.set(0, (sign * Math.PI) / 2, -0.6);
      gill.position.set(sign * 0.34, -0.03, 0.71);
      gill.name = "fish-gill";
      g.add(gill);
      fin(
        g,
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(sign * 0.62, -0.18),
          new THREE.Vector2(sign * 0.19, 0.16),
        ],
        navy,
        new THREE.Vector3(sign * 0.26, -0.05, 0.45),
        new THREE.Euler(Math.PI / 2, 0, sign * 0.12),
      );
      for (let i = 0; i < 5; i++)
        shape(
          g,
          cone,
          "#d8be59",
          [sign * 0.1, 0.11, -0.64 - i * 0.11],
          [0.025, 0.085, 0.035],
        );
    }
    fin(
      g,
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.58, 0),
        new THREE.Vector2(0.15, 0.56),
      ],
      navy,
      new THREE.Vector3(0, 0.22, -0.25),
      new THREE.Euler(0, Math.PI / 2, 0),
    );
    const tail = group(g, 0, 0, -1.26);
    tail.name = "tail";
    fin(
      tail,
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(-0.61, -0.63),
        new THREE.Vector2(-0.22, -0.35),
        new THREE.Vector2(0, -0.48),
        new THREE.Vector2(0.22, -0.35),
        new THREE.Vector2(0.61, -0.63),
      ],
      navy,
      new THREE.Vector3(),
      new THREE.Euler(Math.PI / 2, 0, 0),
    );
    const mouth = box(g, "#43545d", [0, -0.025, 1.5], [0.13, 0.018, 0.035]);
    mouth.name = "fish-mouth";
    return g;
  }
  const fishTemplate = makeFish(),
    smokedTemplate = makeFish(true);
  const itemTemplates = new Map<Resource, THREE.Group>();
  function buildItem(resource: Resource): THREE.Group {
    const g = new THREE.Group();
    g.userData.resource = resource;
    if (resource === "fish" || resource === "salmon" || resource === "smoked") {
      const fishBody = (
        resource === "smoked" ? smokedTemplate : fishTemplate
      ).clone(true);
      fishBody.scale.setScalar(0.38);
      fishBody.rotation.y = Math.PI / 2;
      g.add(fishBody);
      if (resource === "salmon") {
        const stripe = ball(
          g,
          "#cf9696",
          [0, 0.015, 0.045],
          [0.47, 0.035, 0.12],
        );
        stripe.rotation.z = 0.03;
      }
    } else if (resource === "wood") {
      const log = cylinder(g, "#95613b", [0, 0, 0], [0.15, 1.08, 0.15]);
      log.rotation.z = Math.PI / 2;
      for (const x of [-0.55, 0.55]) {
        const end = cylinder(g, "#dfb87c", [x, 0, 0], [0.137, 0.025, 0.137]);
        end.rotation.z = Math.PI / 2;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.073, 0.083, 16),
          material("#b18751"),
        );
        ring.rotation.y = Math.PI / 2;
        ring.position.set(x + Math.sign(x) * 0.014, 0, 0);
        g.add(ring);
      }
      for (let i = 0; i < 3; i++)
        box(g, "#805333", [-0.2 + i * 0.25, 0.14, 0], [0.02, 0.013, 0.13]);
    } else if (resource === "steak") {
      const side = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.22, 36, 1, true),
        generated.tunaSkin,
      );
      side.castShadow = true;
      g.add(side);
      for (const sign of [-1, 1]) {
        const face = new THREE.Mesh(
          new THREE.CircleGeometry(0.315, 40),
          generated.steakFace,
        );
        face.rotation.x = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
        face.position.y = sign * 0.113;
        face.receiveShadow = true;
        g.add(face);
      }
    } else if (resource === "crab") {
      ball(g, "#9f5739", [0, 0.08, 0], [0.29, 0.14, 0.22]);
      for (const sign of [-1, 1]) {
        for (let j = 0; j < 3; j++) {
          const leg = box(
            g,
            "#ba6845",
            [sign * 0.29, -0.01, -0.15 + j * 0.13],
            [0.26, 0.045, 0.045],
          );
          leg.rotation.y = sign * (0.5 - j * 0.4);
        }
        const claw = group(g, sign * 0.27, 0.07, 0.24);
        claw.name = "crab-claw";
        ball(claw, "#bd6847", [0, 0, 0], [0.14, 0.08, 0.12]);
        box(claw, "#e0a068", [sign * 0.06, 0, 0.12], [0.05, 0.06, 0.18]);
      }
      for (const x of [-0.1, 0.1])
        ball(g, "#221e1b", [x, 0.2, 0.13], [0.025, 0.025, 0.025]);
    } else if (resource === "kelp") {
      for (let i = 0; i < 7; i++) {
        const leaf = box(
          g,
          i % 2 ? "#3b6d48" : "#658a47",
          [((i % 3) - 0.8) * 0.13, 0.08 + i * 0.025, 0],
          [0.12, 0.06, 0.8 - i * 0.04],
        );
        leaf.rotation.y = i * 0.45;
        leaf.rotation.z = (i - 3) * 0.08;
      }
      box(g, "#b2a174", [0, 0.19, 0], [0.09, 0.28, 0.25]);
    } else if (resource === "ore") {
      shape(
        g,
        new THREE.DodecahedronGeometry(0.3, 1),
        "#627580",
        [0, 0.05, 0],
        [1.1, 0.8, 0.9],
      );
      for (let i = 0; i < 4; i++)
        ball(
          g,
          "#adc7c9",
          [-0.15 + i * 0.1, 0.25, Math.sin(i) * 0.1],
          [0.065, 0.035, 0.05],
        );
    } else if (resource === "ingot") {
      const bar = box(g, "#a5bbc4", [0, 0.07, 0], [0.65, 0.24, 0.29]);
      bar.material = generated.metal;
      box(g, "#e0c883", [0, 0.195, 0], [0.23, 0.015, 0.19]);
    } else if (resource === "meal") {
      cylinder(g, "#e6ddd0", [0, 0.05, 0], [0.3, 0.18, 0.3]);
      cylinder(g, "#966c3a", [0, 0.15, 0], [0.25, 0.025, 0.25]);
      for (let i = 0; i < 5; i++) {
        ball(
          g,
          i % 2 ? "#bf7661" : "#83a751",
          [Math.cos(i * 1.25) * 0.13, 0.18, Math.sin(i * 1.25) * 0.13],
          [0.08, 0.05, 0.07],
        );
      }
    } else if (resource === "tackle") {
      box(g, "#416a7c", [0, 0.09, 0], [0.63, 0.33, 0.4]);
      box(g, "#829e9c", [0, 0.27, 0], [0.67, 0.07, 0.44]);
      box(g, "#d9b66b", [0, 0.16, 0.22], [0.1, 0.1, 0.03]);
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.022, 6, 16, Math.PI),
        material("#d3b374"),
      );
      handle.position.set(0, 0.31, 0);
      g.add(handle);
    } else {
      for (let i = 0; i < 2; i++) {
        const plank = box(
          g,
          i ? "#d5a773" : "#bd8c59",
          [0, i * 0.1, 0],
          [0.97, 0.09, 0.24],
        );
        plank.material = generated.wood;
      }
      box(g, "#ebc594", [0, 0.205, 0], [0.11, 0.02, 0.245]);
    }
    batchDetails(g);
    return g;
  }
  // Cargo, flight props, and conveyor goods share immutable geometry/materials.
  // Removing an old stack therefore never leaves newly allocated GPU buffers behind.
  function createItem(resource: Resource): THREE.Group {
    let template = itemTemplates.get(resource);
    if (!template) {
      template = buildItem(resource);
      itemTemplates.set(resource, template);
    }
    return template.clone(true);
  }
  function crate(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    size = 0.7,
  ) {
    const g = group(parent, x, y, z);
    box(g, "#9c7045", [0, size / 2, 0], [size, size, size]);
    for (const yy of [0.09, size - 0.09]) {
      box(g, "#ce9c65", [0, yy, size / 2 + 0.015], [size + 0.04, 0.09, 0.06]);
      box(g, "#ce9c65", [size / 2 + 0.015, yy, 0], [0.06, 0.09, size + 0.04]);
    }
    box(g, "#d8ac72", [0, size / 2, size / 2 + 0.05], [0.065, size, 0.04]);
    batchDetails(g);
    return g;
  }
  function winterPerson(parent: THREE.Object3D, coat: string) {
    const root = group(parent),
      legs: THREE.Group[] = [];
    const contact = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 20),
      new THREE.MeshBasicMaterial({
        color: "#173c51",
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
    );
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.012;
    root.add(contact);
    for (const x of [-0.15, 0.15]) {
      const leg = group(root, x, 0.55, 0);
      cylinder(leg, "#365365", [0, -0.23, 0], [0.115, 0.46, 0.115]);
      ball(leg, "#344653", [0, -0.46, 0.075], [0.145, 0.09, 0.215]);
      legs.push(leg);
    }
    cylinder(root, coat, [0, 0.88, 0], [0.3, 0.68, 0.255]);
    ball(root, coat, [0, 1.19, 0], [0.3, 0.17, 0.255]);
    box(root, "#dce6df", [0, 0.64, 0.03], [0.59, 0.07, 0.49]);
    box(root, "#335c6d", [0, 0.89, 0.261], [0.025, 0.55, 0.02]);
    const arms: THREE.Group[] = [];
    for (const x of [-0.38, 0.38]) {
      const arm = group(root, x, 1.15, 0);
      cylinder(arm, coat, [0, -0.2, 0], [0.115, 0.4, 0.115]);
      ball(arm, "#365464", [0, -0.46, 0.025], [0.12, 0.13, 0.115]);
      arms.push(arm);
    }
    ball(root, "#e8c7ab", [0, 1.46, 0], [0.255, 0.275, 0.24]);
    ball(root, "#745943", [0, 1.57, -0.08], [0.26, 0.2, 0.2]);
    ball(root, "#e8c7ab", [0, 1.45, 0.045], [0.245, 0.24, 0.235]);
    for (const x of [-0.085, 0.085])
      ball(root, "#314452", [x, 1.49, 0.265], [0.027, 0.036, 0.014]);
    cylinder(root, "#f1f1df", [0, 1.7, 0], [0.285, 0.22, 0.27]);
    cylinder(root, "#d7e1de", [0, 1.6, 0], [0.297, 0.075, 0.28]);
    ball(root, "#fbf9e9", [0, 1.86, 0], [0.09, 0.09, 0.09]);
    box(root, "#efaa75", [0, 1.24, 0.04], [0.53, 0.1, 0.44]);
    batchDetails(root);
    root.userData.arms = arms;
    root.userData.legs = legs;
    return { root, legs, leftArm: arms[0], rightArm: arms[1] };
  }
  const person = winterPerson(scene, teal),
    player = person.root;
  player.position.set(0, 0.4, 4);
  const { rightArm, leftArm, legs } = person;
  const cargo = group(player, 0, 0.95, -0.38);
  const axe = group(rightArm, 0, -0.47, 0.04);
  axe.visible = false;
  cylinder(axe, "#a87640", [0, -0.03, 0], [0.04, 0.75, 0.04]);
  const axeHead = box(axe, "#c9dee8", [0.15, 0.27, 0], [0.43, 0.28, 0.1]);
  axeHead.rotation.z = -0.16;
  box(axe, "#f0f6f7", [0.36, 0.24, 0], [0.035, 0.29, 0.115]);
  const rod = group(rightArm, 0, -0.43, 0.04);
  rod.visible = false;
  const rodShaft = cylinder(
    rod,
    "#365e7d",
    [0, 0.52, 0.15],
    [0.024, 1.65, 0.024],
  );
  rodShaft.rotation.x = 0.5;
  cylinder(rod, "#c39662", [0, -0.15, -0.15], [0.055, 0.4, 0.055]).rotation.x =
    0.5;
  const reel = cylinder(
    rod,
    "#cedce2",
    [0.08, -0.08, -0.12],
    [0.1, 0.09, 0.1],
    0.3,
  );
  reel.rotation.z = Math.PI / 2;
  const fishingLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]),
    new THREE.LineBasicMaterial({
      color: "#eef8ff",
      transparent: true,
      opacity: 0.8,
    }),
  );
  fishingLine.visible = false;
  scene.add(fishingLine);
  const bobber = ball(scene, "#eb8b60", [-9, -0.15, 1], [0.09, 0.14, 0.09]);
  bobber.visible = false;
  const trees: TreeNode[] = [];
  function tree(x: number, z: number, size = 1) {
    const root = group(scene, x, 0.35, z),
      pivot = group(root);
    root.scale.setScalar(size);
    const trunk = cylinder(pivot, "#a36b3f", [0, 1, 0], [0.24, 2, 0.24]);
    for (let i = 0; i < 3; i++) {
      shape(
        pivot,
        cone,
        "#638494",
        [0, 1.55 + i * 0.78, 0],
        [1.32 - i * 0.27, 1.8, 1.22 - i * 0.24],
      );
      shape(
        pivot,
        cone,
        i === 2 ? "#f5f9fa" : "#d9e9f1",
        [0, 1.78 + i * 0.78, 0],
        [1.19 - i * 0.246, 1.57, 1.1 - i * 0.22],
      );
    }
    // Uneven branch tips and snow pillows break the stacked-cone silhouette.
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399,
        r = 0.78 - (i % 3) * 0.14,
        y = 1.25 + Math.floor(i / 3) * 0.72;
      const branch = shape(
        pivot,
        cone,
        i % 2 ? "#486f71" : "#52787b",
        [Math.sin(a) * r, y, Math.cos(a) * r],
        [0.42, 0.9, 0.39],
      );
      branch.rotation.z = Math.sin(a) * 0.27;
      branch.rotation.x = Math.cos(a) * 0.23;
      ball(
        pivot,
        "#edf4f4",
        [Math.sin(a) * r, y + 0.3, Math.cos(a) * r],
        [0.38, 0.15, 0.34],
      );
    }
    batchDetails(pivot);
    const notch = box(pivot, "#d99445", [0, 0.66, 0.235], [0.39, 0.18, 0.07]);
    notch.visible = false;
    const stump = group(root);
    cylinder(stump, "#986237", [0, 0.2, 0], [0.25, 0.4, 0.25]);
    cylinder(stump, "#dcb17a", [0, 0.412, 0], [0.235, 0.025, 0.235]);
    stump.visible = false;
    root.userData.kind = "tree";
    const node: TreeNode = {
      group: root,
      pivot,
      trunk,
      notch,
      stump,
      position: root.position.clone(),
      state: "standing",
      regrowAt: 0,
      originalScale: size,
    };
    trees.push(node);
    return node;
  }
  [
    [-3.1, -4.9, 1],
    [-3.2, -6.5, 0.93],
    [-5.8, -8, 0.95],
    [-1.3, -8.7, 1.12],
    [-4.1, -10.5, 1.15],
    [1, -10.1, 0.93],
    [3.6, -9.5, 1.08],
    [6.2, -8.3, 0.95],
    [8, -6.2, 0.96],
    [8.6, -10.4, 1.12],
    [-6.2, -11, 1],
    [4.2, -11.5, 0.95],
    [0.5, -6.5, 0.83],
  ].forEach(([x, z, s]) => tree(x, z, s));
  const workerTree = tree(-3.5, -9.8, 1);
  trees.pop();
  workerTree.group.userData.kind = "worker-tree";
  // Distant snow forest uses three instanced layers, rather than hundreds of meshes.
  const distantCount = 62,
    farTrunks = new THREE.InstancedMesh(cyl, material("#7d654e"), distantCount),
    farLeaves = new THREE.InstancedMesh(
      cone,
      material("#698898"),
      distantCount * 3,
    ),
    farSnow = new THREE.InstancedMesh(
      cone,
      material("#dfeef5"),
      distantCount * 3,
    );
  for (let i = 0; i < distantCount; i++) {
    const x = i < 40 ? -15 - random() * 10 : -6 + random() * 18,
      z = i < 40 ? -26 + random() * 56 : -25 - random() * 12,
      s = 0.8 + random() * 0.65;
    dummy.position.set(x, 1.1, z);
    dummy.scale.set(0.2 * s, 1.5 * s, 0.2 * s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    farTrunks.setMatrixAt(i, dummy.matrix);
    for (let j = 0; j < 3; j++) {
      dummy.position.set(x, 0.35 + (1.5 + j * 0.7) * s, z);
      dummy.scale.set((1.3 - j * 0.27) * s, 1.8 * s, (1.22 - j * 0.24) * s);
      dummy.updateMatrix();
      farLeaves.setMatrixAt(i * 3 + j, dummy.matrix);
      dummy.position.y += 0.23 * s;
      dummy.scale.set((1.17 - j * 0.245) * s, 1.57 * s, (1.1 - j * 0.22) * s);
      dummy.updateMatrix();
      farSnow.setMatrixAt(i * 3 + j, dummy.matrix);
    }
  }
  farTrunks.castShadow = farLeaves.castShadow = farSnow.castShadow = true;
  scene.add(farTrunks, farLeaves, farSnow);
  const fish: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const tuna = fishTemplate.clone(true);
    tuna.scale.setScalar(1.52 + (i % 2) * 0.16);
    tuna.position.set(-10, 0.01, -10 + i * 7.7);
    tuna.userData.basePosition = tuna.position.clone();
    fish.push(tuna);
    scene.add(tuna);
  }

  const station = (x: number, z: number, wx: number, wz: number): Station => {
    const root = group(scene, x, groundHeight(x, z), z);
    return {
      group: root,
      position: new THREE.Vector3(x, groundHeight(x, z), z),
      workPosition: new THREE.Vector3(wx, groundHeight(wx, wz), wz),
    };
  };
  const stations: World["stations"] = {
    fish: station(-6.2, 1, -5.95, 1.1),
    steaks: station(-2, 0, -2, 1.5),
    planks: station(3, -4, 3, -2.35),
    smoked: station(5, 1, 5, 2.5),
    market: station(4, 5, 4, 3.8),
    crab: station(-6, 13, -5.7, 13),
    kelp: station(-6, -12, -5.7, -12),
    ore: station(15, -12, 15, -10),
    ingots: station(15, -5, 15, -2.5),
    meals: station(14, 6, 14, 8.6),
    tackle: station(19, 16, 19, 19.1),
    warehouse: station(10, 12, 10, 14),
  };
  // Short dock is directly connected to the yard. Upgrades extend it over the fish.
  for (let i = 0; i < 8; i++)
    box(
      stations.fish.group,
      i % 2 ? "#c58a50" : "#d29a60",
      [-0.12 + i * 0.18, -0.09, 0],
      [0.17, 0.18, 1.65],
    );
  for (const z of [-0.7, 0.7]) {
    cylinder(
      stations.fish.group,
      "#9b6b41",
      [-0.12, -0.2, z],
      [0.1, 0.85, 0.1],
    );
    cylinder(
      stations.fish.group,
      "#d9b88a",
      [-0.12, 0.27, z],
      [0.12, 0.1, 0.12],
    );
  }
  // Whole tuna lies along the board's X axis. Individual body sections expose
  // image-textured flesh only when a blade has passed through that position.
  const bench = stations.steaks.group;
  for (const x of [-1.5, 1.5])
    for (const z of [-0.55, 0.55])
      box(bench, darkWood, [x, 0.4, z], [0.14, 0.8, 0.14]);
  const benchTop = box(bench, "#b58250", [0, 0.84, 0], [3.65, 0.18, 1.65]);
  benchTop.material = generated.wood;
  box(bench, "#e0ca9e", [0, 0.96, 0], [3.45, 0.07, 1.48]);
  box(bench, "#b28454", [2.2, 1.01, 0.15], [1.25, 0.13, 0.75]);
  const cutterFish = group(bench, 0, 1.22, 0);
  cutterFish.rotation.y = Math.PI / 2;
  cutterFish.scale.setScalar(1.1);
  // Each yield tier has matching physical slices. A cut reveals two flesh
  // surfaces only once the knife reaches the board; no steaks appear early.
  const cutConfigurations = new Map<
    number,
    {
      root: THREE.Group;
      sections: THREE.Group[];
      caps: THREE.Mesh[][];
      edges: number[];
    }
  >();
  for (let count = 4; count <= 6; count++) {
    const root = group(cutterFish),
      edges = [
        -1.4,
        ...Array.from(
          { length: count + 1 },
          (_, i) => -0.78 + (1.68 * i) / count,
        ),
        1.55,
      ];
    const sections: THREE.Group[] = [],
      caps: THREE.Mesh[][] = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const section = group(root),
        skin = new THREE.Mesh(
          fishBodyGeometry(edges[i], edges[i + 1]),
          generated.tunaSkin,
        );
      skin.castShadow = true;
      section.add(skin);
      const faces: THREE.Mesh[] = [];
      for (const end of [0, 1]) {
        const z = edges[i + end],
          cap = new THREE.Mesh(
            new THREE.CircleGeometry(bodyRadius(z), 36),
            generated.steakFace,
          );
        cap.scale.y = 0.77;
        cap.position.z = z + (end ? 0.002 : -0.002);
        if (!end) cap.rotation.y = Math.PI;
        cap.visible = false;
        section.add(cap);
        faces.push(cap);
      }
      section.name = `cut-section-${i}`;
      sections.push(section);
      caps.push(faces);
    }
    for (const part of fishTemplate.children) {
      if (["fish-body", "fish-belly"].includes(part.name)) continue;
      const z = part.name === "tail" ? -1.3 : part.position.z;
      const index = Math.min(
        sections.length - 1,
        Math.max(0, edges.findIndex((edge) => edge > z) - 1),
      );
      sections[index].add(part.clone(true));
    }
    root.visible = count === 4;
    cutConfigurations.set(count, { root, sections, caps, edges });
  }
  const cleaver = group(bench, 0.95, 1.9, 0);
  box(cleaver, "#7d5034", [0, 0.22, 0], [0.11, 0.48, 0.1]);
  const knife = box(cleaver, "#d5e2e7", [0, -0.14, 0], [0.065, 0.43, 0.94]);
  knife.material = generated.metal;
  box(cleaver, "#f4faf8", [0, -0.36, 0], [0.025, 0.025, 0.95]);
  const offcutBin = group(bench, 2.65, 0.35, -0.85);
  cylinder(offcutBin, "#6d8794", [0, 0.14, 0], [0.45, 0.5, 0.45]);
  cylinder(offcutBin, "#304e5b", [0, 0.4, 0], [0.38, 0.03, 0.38]);
  const offcut = ball(offcutBin, "#647d86", [0, 0.43, 0], [0.25, 0.13, 0.28]);
  offcut.material = generated.tunaSkin;
  offcut.visible = false;
  function sawBlade(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r = 0.63,
  ) {
    const g = group(parent, x, y, z);
    const disc = cylinder(g, "#d9e4e8", [0, 0, 0], [r, 0.075, r], 0.35);
    disc.rotation.x = Math.PI / 2;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const tooth = box(
        g,
        "#9ab3c1",
        [Math.sin(a) * r, Math.cos(a) * r, 0],
        [0.13, 0.15, 0.09],
      );
      tooth.rotation.z = -a;
    }
    const hub = cylinder(g, yellow, [0, 0, 0.07], [0.15, 0.12, 0.15]);
    hub.rotation.x = Math.PI / 2;
    batchDetails(g);
    return g;
  }
  const blade = sawBlade(bench, 0, 1.5, -0.32);
  blade.visible = false;
  blade.rotation.y = Math.PI / 2;
  const secondBlade = sawBlade(bench, 0.78, 1.5, -0.32);
  secondBlade.visible = false;
  secondBlade.rotation.y = Math.PI / 2;
  const piston = group(bench, -1.15, 1.15, -0.4);
  piston.visible = false;
  cylinder(piston, silver, [0, 0.3, 0], [0.08, 0.6, 0.08], 0.3);
  box(piston, yellow, [0, 0.65, 0], [0.29, 0.25, 0.3]);
  const conveyor = group(bench, 1.8, 0.76, 0);
  conveyor.visible = false;
  box(conveyor, "#4c6a79", [0, 0, 0], [1.35, 0.16, 1.1]);
  for (let i = 0; i < 7; i++)
    box(conveyor, "#76909b", [-0.55 + i * 0.18, 0.1, 0], [0.1, 0.055, 1.06]);
  const steaks: THREE.Group[] = [];
  for (let i = 0; i < 7; i++) {
    const piece = createItem("steak");
    piece.scale.setScalar(1.32);
    piece.visible = false;
    bench.add(piece);
    steaks.push(piece);
  }
  function resetCut() {
    cutConfigurations.forEach(({ root, sections, caps }, count) => {
      root.visible = count === 4;
      for (const section of sections) {
        section.visible = true;
        section.position.set(0, 0, 0);
        section.rotation.set(0, 0, 0);
      }
      caps.forEach((faces) =>
        faces.forEach((cap) => {
          cap.visible = false;
        }),
      );
    });
    steaks.forEach((piece) => {
      piece.visible = false;
    });
    offcut.visible = false;
    cutterFish.userData.cutContacts = 0;
    cleaver.position.set(0.96, 1.9, 0);
    cleaver.rotation.z = 0;
    cutterFish.visible = false;
  }
  function setCutProgress(progress: number, amount: number) {
    const t = THREE.MathUtils.clamp(progress, 0, 1),
      count = Math.min(6, Math.max(4, Math.floor(amount))),
      cuts = count + 1;
    const configuration = cutConfigurations.get(count)!;
    cutConfigurations.forEach(({ root }, size) => {
      root.visible = size === count;
    });
    const { sections, caps, edges } = configuration;
    cutterFish.visible = true;
    // Blade contact occurs halfway through each down/up stroke. First remove
    // the head, then separate each steak along its actual geometric boundary.
    const contacts = Math.min(cuts, Math.floor(t * cuts + 0.5));
    cutterFish.userData.cutContacts = contacts;
    const headT = THREE.MathUtils.clamp((t - 0.5 / cuts) * cuts * 1.5, 0, 1),
      head = sections[count + 1];
    head.position.set(headT * 0.7, -headT * headT * 0.8, headT * 0.85);
    head.rotation.x = headT * 0.45;
    head.visible = headT < 1;
    caps[count + 1][0].visible = contacts > 0;
    const detached = Math.max(0, contacts - 1);
    for (let i = 1; i <= count; i++) {
      const order = count - i;
      sections[i].visible = detached <= order;
      caps[i][1].visible = contacts > order;
      caps[i][0].visible = contacts > order + 1;
    }
    sections[0].visible = t < 0.995;
    caps[0][1].visible = contacts === cuts;
    offcut.visible = headT >= 1;
    for (let i = 0; i < steaks.length; i++) {
      const at = (i + 1.5) / cuts,
        move = THREE.MathUtils.clamp((t - at) * cuts, 0, 1);
      steaks[i].visible = i < count && t >= at;
      const from = edges[count - i] + 0.84 / count,
        to = 1.7 + (i % 4) * 0.27;
      steaks[i].position.set(
        THREE.MathUtils.lerp(from * 1.1, to, move),
        1.17 + Math.sin(move * Math.PI) * 0.12,
        0.08 + Math.floor(i / 4) * 0.43,
      );
      steaks[i].rotation.set(0, 0.1 * i, ((1 - move) * Math.PI) / 2);
    }
    const stroke = Math.min(cuts - 1, Math.floor(t * cuts)),
      local = (t * cuts) % 1;
    const cutX = edges[count + 1 - stroke] * 1.1;
    cleaver.position.x = cutX;
    cleaver.position.y = 1.95 - Math.pow(Math.sin(local * Math.PI), 4) * 0.66;
    cleaver.rotation.z = Math.sin(local * Math.PI) * 0.05;
    blade.position.x = cutX;
    secondBlade.position.x = cutX + 0.43;
  }
  const cutter = {
    cleaver,
    blade,
    secondBlade,
    piston,
    conveyor,
    fish: cutterFish,
    steaks,
    setCutProgress,
    reset: resetCut,
  };
  resetCut();
  // Sawmill and smoker begin as honest, unbuilt foundations.
  box(stations.planks.group, "#d5e0e4", [0, 0.025, 0], [2.6, 0.05, 1.9]);
  box(stations.smoked.group, "#ccd9de", [0, 0.025, 0], [1.9, 0.05, 1.8]);
  // A low market counter faces a real queue, and remains reachable from the yard.
  const market = stations.market.group;
  box(market, "#956842", [0, 0.47, 0], [3.4, 0.94, 0.95]);
  box(market, "#d7a269", [0, 0.98, 0], [3.65, 0.13, 1.2]);
  for (let i = 0; i < 9; i++)
    box(
      market,
      i % 2 ? "#ba8957" : "#c89660",
      [-1.45 + i * 0.36, 0.5, 0.495],
      [0.34, 0.83, 0.045],
    );
  const marketGoods = group(market, 0, 1.1, 0);
  for (let i = 0; i < 3; i++) {
    const item = createItem("fish");
    item.position.set(-1 + i, 0.05, 0);
    marketGoods.add(item);
  }
  const customers: THREE.Group[] = [];
  for (const x of [2.05, 5.95]) {
    for (let i = 0; i < 7; i++) {
      cylinder(
        scene,
        "#a67c51",
        [x, 0.63, 6.5 + i * 0.9],
        [0.045, 0.55, 0.045],
      );
      ball(scene, "#eef5f7", [x, 0.92, 6.5 + i * 0.9], [0.09, 0.07, 0.09]);
    }
    box(scene, "#bd986c", [x, 0.66, 9.1], [0.05, 0.06, 5.8]);
  }
  // A footbridge reaches the opposite forestbank; its deck is physically walkable.
  const bridge = group(scene, -10, 0.32, -8.5);
  for (let i = 0; i < 23; i++) {
    const x = -3 + i * 0.27,
      arch = Math.sin((i / 22) * Math.PI) * 0.5;
    box(bridge, i % 2 ? "#b97d46" : "#cb9558", [x, arch, 0], [0.25, 0.14, 1.7]);
  }
  for (const z of [-0.83, 0.83])
    for (let i = 0; i < 7; i++) {
      const x = -3 + i;
      cylinder(
        bridge,
        "#9d6d42",
        [x, 0.5 + Math.sin((i / 6) * Math.PI) * 0.5, z],
        [0.09, 1, 0.09],
      );
      ball(
        bridge,
        "#e7dfca",
        [x, 1.03 + Math.sin((i / 6) * Math.PI) * 0.5, z],
        [0.115, 0.065, 0.115],
      );
    }
  // Hand-placed harbor details leave clear working lanes through the yard.
  const yardDetails = group(scene);
  for (const [x, z] of [
    [-4.85, 7.25],
    [6.9, 7.8],
  ] as const) {
    const barrel = group(yardDetails, x, 0.4, z);
    cylinder(barrel, "#a87b4c", [0, 0.43, 0], [0.36, 0.86, 0.36]);
    for (const y of [0.13, 0.7])
      cylinder(barrel, "#637b83", [0, y, 0], [0.375, 0.06, 0.375]);
    cylinder(barrel, "#7e5b38", [0, 0.875, 0], [0.32, 0.035, 0.32]);
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.036, 5, 22),
      material("#c9aa71"),
    );
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0, 0.93, 0);
    barrel.add(coil);
    batchDetails(barrel);
  }
  const logRack = group(yardDetails, -4.78, 0.43, 5.75);
  for (const x of [-0.42, 0.42])
    box(logRack, "#7e623e", [x, 0.28, 0], [0.1, 0.55, 1.2]);
  for (let i = 0; i < 5; i++) {
    const log = createItem("wood");
    log.scale.setScalar(0.65);
    log.position.set(0, 0.24 + Math.floor(i / 2) * 0.18, (i % 2) * 0.23 - 0.13);
    logRack.add(log);
  }
  for (const [x, z] of [
    [-5.25, 2.65],
    [7.2, 3.3],
  ] as const) {
    const lamp = group(yardDetails, x, 0.4, z);
    cylinder(lamp, "#746849", [0, 1.4, 0], [0.055, 2.8, 0.055]);
    box(lamp, "#746849", [0.22, 2.74, 0], [0.5, 0.07, 0.07]);
    box(lamp, "#526775", [0.43, 2.3, 0], [0.28, 0.43, 0.28]);
    const glass = box(lamp, "#f6d48c", [0.43, 2.3, 0.02], [0.21, 0.29, 0.25]);
    (glass.material as THREE.MeshStandardMaterial).emissive.set("#97702c");
    box(lamp, "#e4ecea", [0.43, 2.57, 0], [0.37, 0.08, 0.36]);
    batchDetails(lamp);
  }
  for (let i = 0; i < 16; i++) {
    const drift = ball(
      yardDetails,
      i % 2 ? "#e9f3f6" : "#dbeaf0",
      [-6.85 + (i % 2) * 0.18, 0.25, -19 + i * 2.75],
      [0.5 + (i % 3) * 0.15, 0.24, 0.85],
    );
    drift.rotation.y = i * 0.5;
  }
  // Every equipment level has a retained, independently visible world component.
  const keys: UpgradeId[] = [
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
    "crabpots",
    "kelpfarm",
    "quarry",
    "forge",
    "kitchen",
    "boatyard",
    "warehouse",
  ];
  const upgradeGroups = Object.fromEntries(
    keys.map((key) => [key, []]),
  ) as unknown as Record<UpgradeId, THREE.Group[]>;
  const smokePuffs: THREE.Mesh[] = [];
  const stage = (
    id: UpgradeId,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const g = group(parent, x, y, z);
    g.visible = false;
    g.userData.upgrade = id;
    g.userData.stage = upgradeGroups[id].length + 1;
    upgradeGroups[id].push(g);
    return g;
  };
  for (let level = 1; level <= 5; level++) {
    const axeStage = stage("axe", axe);
    const stripe = box(
      axeStage,
      ["#d6ab55", "#8caec2", "#e8c063", "#85bec9", "#d8e9ed"][level - 1],
      [0, -0.2 + level * 0.085, 0],
      [0.095, 0.055, 0.095],
    );
    stripe.rotation.y = level * 0.2;
    const rodStage = stage("rod", rod);
    const guide = cylinder(
      rodStage,
      level > 3 ? "#e7c969" : "#c3d8e2",
      [0, 0.15 + level * 0.2, 0.02],
      [0.045, 0.05, 0.045],
      0.3,
    );
    guide.rotation.x = 0.5;
    const pack = stage("backpack", player, 0, 0.77, -0.36);
    box(
      pack,
      level % 2 ? "#ae7b48" : "#bf945c",
      [0, level * 0.11, 0],
      [0.55 + level * 0.055, 0.095, 0.3 + level * 0.028],
    );
    box(
      pack,
      "#e6bf7c",
      [0, level * 0.11, 0.17 + level * 0.014],
      [0.07, 0.1, 0.025],
    );
    const cut = stage("cutter", bench);
    if (level === 1) {
      for (const x of [-1.15, 1.1])
        box(cut, yellow, [x, 1.27, -0.4], [0.16, 1.1, 0.21]);
      box(cut, yellow, [0, 1.86, -0.4], [2.45, 0.18, 0.24]);
      box(cut, "#426777", [-1.23, 0.96, -0.4], [0.45, 0.5, 0.44]);
    } else if (level === 2) {
      box(cut, yellow, [0.9, 1.99, -0.4], [1.05, 0.17, 0.24]);
      box(cut, "#4c6c7c", [0.9, 1.15, -0.58], [0.48, 0.46, 0.25]);
    } else {
      box(cut, yellow, [-1.23, 0.6 + level * 0.21, -0.4], [0.24, 0.12, 0.37]);
      cylinder(
        cut,
        "#c4d7df",
        [1.15, 0.72 + level * 0.14, -0.4],
        [0.09, 0.06, 0.09],
        0.4,
      ).rotation.x = Math.PI / 2;
    }
    const mill = stage("sawmill", stations.planks.group);
    if (level === 1) {
      box(mill, "#6c8996", [0, 0.51, 0], [2.15, 0.95, 1.2]);
      box(mill, "#d3a366", [0, 1.03, 0], [2.45, 0.13, 1.35]);
      const millBlade = sawBlade(mill, 0, 1.12, -0.03, 0.49);
      millBlade.name = "sawmill-blade";
      millBlade.userData.spinAxis = "z";
      millBlade.userData.spinSpeed = 8;
      box(mill, yellow, [-0.85, 0.9, -0.15], [0.28, 0.55, 0.28]);
    } else {
      const log = createItem("wood");
      log.position.set(-0.75 + (level - 2) * 0.38, 1.18, 0.35);
      mill.add(log);
      box(
        mill,
        yellow,
        [-1.07, 0.35 + level * 0.18, -0.42],
        [0.13, 0.11, 0.31],
      );
    }
    const shop = stage("market", market);
    if (level === 1) {
      for (const x of [-1.7, 1.7])
        box(shop, timber, [x, 1.55, -0.47], [0.09, 2.9, 0.09]);
      box(shop, "#e7cf9d", [0, 2.88, -0.47], [3.6, 0.14, 0.18]);
    } else if (level === 2) {
      for (let i = 0; i < 10; i++) {
        const canopy = box(
          shop,
          i % 2 ? "#e8ede4" : "#4e97b2",
          [-1.62 + i * 0.36, 2.75, 0.1],
          [0.36, 0.1, 1.65],
        );
        canopy.rotation.x = 0.12;
      }
    } else if (level === 3) {
      box(shop, "#6f8795", [0, 3, -0.05], [3.85, 0.15, 1.85]);
      box(shop, "#ecf4f5", [0, 3.11, -0.05], [3.95, 0.1, 1.95]);
    } else if (level === 4) {
      box(shop, "#ba8957", [2.5, 0.48, 0], [1.45, 0.94, 0.95]);
      box(shop, "#d6a168", [2.5, 0.99, 0], [1.6, 0.12, 1.2]);
    } else {
      crate(shop, -2.35, 0, 0, 0.75);
      for (let i = 0; i < 4; i++)
        box(shop, "#6ba27a", [1.1, 1.15 + i * 0.06, 0.13], [0.42, 0.045, 0.26]);
    }
    const dockStage = stage("dock", stations.fish.group);
    for (let i = 0; i < 3; i++)
      box(
        dockStage,
        i % 2 ? "#c98e51" : "#ddaa6d",
        [-0.4 - (level - 1) * 0.43 - i * 0.14, -0.09, 0],
        [0.13, 0.18, 1.65 + level * 0.12],
      );
    for (const z of [-0.8 - level * 0.06, 0.8 + level * 0.06])
      cylinder(
        dockStage,
        "#ae7846",
        [-0.55 - (level - 1) * 0.43, -0.2, z],
        [0.08, 0.85, 0.08],
      );
    const workerStage = stage(
      "crew",
      scene,
      12 + (level % 3) * 0.8,
      0.35,
      10 + Math.floor((level - 1) / 3) * 1.1,
    );
    crate(workerStage, 0, 0, 0, 0.65);
    const pennant = box(
      workerStage,
      level % 2 ? "#c59b52" : "#629baa",
      [0, 1.1, 0.32],
      [0.7, 0.5, 0.045],
    );
    cylinder(workerStage, "#775b3f", [-0.37, 0.7, 0.32], [0.035, 1.4, 0.035]);
    const smoker = stage("smokehouse", stations.smoked.group);
    if (level === 1) {
      box(smoker, "#6e7f89", [0, 0.75, 0], [1.5, 1.5, 1.25]);
      box(smoker, "#47616e", [0, 0.75, 0.65], [1.12, 1.2, 0.06]);
      box(smoker, "#d3b577", [0.35, 0.75, 0.71], [0.06, 0.25, 0.07]);
      box(smoker, "#c7d8df", [0, 1.56, 0], [1.68, 0.12, 1.43]);
      cylinder(smoker, "#879da8", [-0.4, 1.95, -0.3], [0.1, 0.8, 0.1]);
    } else {
      const piece = createItem("smoked");
      piece.position.set(-0.5 + (level - 2) * 0.34, 1.72, 0.08);
      piece.rotation.y = Math.PI / 2;
      smoker.add(piece);
      box(smoker, yellow, [-0.75, 0.2 + level * 0.18, 0], [0.045, 0.09, 0.22]);
    }
    const cold = stage("freezer", scene, 7, 0.35, -1);
    if (level === 1) {
      crate(cold, 0, 0, 0, 0.85);
      box(cold, "#cae7ed", [0, 0.9, 0], [0.8, 0.2, 0.78]);
    } else if (level === 2) {
      box(cold, "#9fb7c5", [0, 0.8, 0], [1.2, 1.6, 1.2]);
      box(cold, "#d2e4eb", [0, 1.66, 0], [1.3, 0.13, 1.3]);
    } else if (level === 3) {
      box(cold, "#7e9bac", [0, 1.05, -0.04], [1.7, 2.1, 1.7]);
      box(cold, "#e9f3f6", [0, 2.18, -0.04], [1.85, 0.15, 1.85]);
      box(cold, "#d0e0e8", [0, 1.04, 0.84], [1.4, 1.8, 0.05]);
    } else {
      box(
        cold,
        "#7bc2d5",
        [-0.6 + (level - 4) * 0.5, 1.1, 0.89],
        [0.26, 0.36, 0.04],
      );
      box(
        cold,
        "#e9f5f6",
        [-0.6 + (level - 4) * 0.5, 1.1, 0.92],
        [0.04, 0.24, 0.035],
      );
    }
    const boot = stage("boots", player);
    for (const x of [-0.15, 0.15])
      box(
        boot,
        ["#d8ac62", "#7da4b7", "#e4c67b", "#b3d5de", "#ebd693"][level - 1],
        [x, 0.025 + level * 0.018, 0.09],
        [0.3, 0.025, 0.35],
      );
    const net = stage("nets", scene, -6.65, 0.4, -1.35 - (level - 1) * 0.18);
    cylinder(net, "#c2935c", [0, 0.55, 0], [0.045, 1.1, 0.045]);
    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.025, 5, 20),
      material("#c5a26c"),
    );
    frame.position.set(-0.3, 0.9, 0);
    frame.rotation.y = -0.6;
    net.add(frame);
    for (let j = -2; j <= 2; j++)
      box(
        net,
        "#b5d1cf",
        [-0.3 + j * 0.12, 0.9, 0],
        [0.012, 0.7 - Math.abs(j) * 0.08, 0.012],
      );
  }
  for (let i = 0; i < 5; i++) {
    const puff = ball(
      scene,
      "#dde7ea",
      [4.6, 2.8 + i * 0.24, 0.7],
      [0.15 + i * 0.035, 0.15 + i * 0.035, 0.15 + i * 0.035],
    );
    puff.visible = false;
    puff.castShadow = false;
    const puffMat = new THREE.MeshStandardMaterial({
      color: "#e8edf0",
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    puff.material = puffMat;
    smokePuffs.push(puff);
  }

  for (let level = 6; level <= 8; level++) {
    const lodging = stage("crew", scene, 12 + (level - 6) * 1.1, 0.35, 13.1);
    box(lodging, "#6b8790", [0, 0.6, 0], [0.9, 1.2, 0.9]);
    box(lodging, "#e6edf0", [0, 1.25, 0], [1.1, 0.16, 1.1]);
    box(lodging, "#d5ad66", [0, 0.7, 0.47], [0.35, 0.45, 0.03]);
  }
  // New harbor districts are connected by timber lanes, never teleport portals.
  function deck(x: number, z: number, width: number, depth: number) {
    const base = box(scene, "#92694b", [x, 0.17, z], [width, 0.42, depth]);
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.065, depth),
      generated.wood,
    );
    surface.position.set(x, 0.405, z);
    surface.receiveShadow = true;
    scene.add(surface);
    return base;
  }
  for (const d of deckFootprints) deck(d.x, d.z, d.w, d.d);
  // Coastal jetties are reachable from the snowy bank and host real hoists/beds.
  for (const id of ["crab", "kelp"] as const) {
    const root = stations[id].group;
    for (let i = 0; i < 12; i++)
      box(
        root,
        i % 2 ? "#c28b54" : "#d0a06b",
        [-0.6 + i * 0.16, -0.01, 0],
        [0.15, 0.16, 2.25],
      );
    for (const z of [-1, 1])
      cylinder(root, "#8f6846", [-0.6, -0.08, z], [0.09, 0.9, 0.09]);
  }
  const crabPot = group(stations.crab.group, -0.55, -0.3, 0);
  crabPot.name = "crab-pot";
  activityProps["crab-pot"] = crabPot;
  for (const y of [0, 0.55])
    for (const z of [-0.45, 0.45])
      box(crabPot, "#555b48", [0, y, z], [0.9, 0.045, 0.045]);
  for (const x of [-0.45, 0.45])
    for (const z of [-0.45, 0.45])
      box(crabPot, "#657464", [x, 0.28, z], [0.04, 0.59, 0.04]);
  for (let i = -3; i <= 3; i++)
    box(crabPot, "#7f8d7d", [i * 0.12, 0.28, 0.45], [0.014, 0.55, 0.014]);
  const potCrab = createItem("crab");
  potCrab.position.y = 0.12;
  crabPot.add(potCrab);
  cylinder(
    stations.crab.group,
    "#b3a87c",
    [-0.55, 0.75, 0],
    [0.018, 2.1, 0.018],
  );
  const kelpStems = group(stations.kelp.group, -0.75, -0.2, 0);
  kelpStems.name = "kelp-stems";
  activityProps["kelp-stems"] = kelpStems;
  for (let i = 0; i < 9; i++) {
    const leaf = box(
      kelpStems,
      i % 2 ? "#3a7859" : "#6e9b56",
      [
        (i % 3) * 0.32 - 0.4,
        0.4 + Math.floor(i / 3) * 0.12,
        (Math.floor(i / 3) - 1) * 0.38,
      ],
      [0.13, 0.85, 0.05],
    );
    leaf.rotation.z = ((i % 3) - 1) * 0.15;
  }
  const oreRock = group(stations.ore.group, 0, 0.4, 0);
  oreRock.name = "ore-rock";
  activityProps["ore-rock"] = oreRock;
  for (let i = 0; i < 7; i++) {
    const rock = shape(
      oreRock,
      new THREE.DodecahedronGeometry(1, 1),
      i % 2 ? "#667c85" : "#84949b",
      [((i % 3) - 1) * 0.8, Math.floor(i / 3) * 0.55, ((i % 2) - 0.5) * 0.7],
      [0.65, 0.6, 0.65],
    );
    rock.rotation.set(random() * 0.5, random() * 2, 0);
    for (let j = 0; j < 2; j++)
      ball(
        oreRock,
        "#adcac7",
        [((i % 3) - 1) * 0.8, 0.8 + Math.floor(i / 3) * 0.5, j * 0.2 - 0.1],
        [0.12, 0.1, 0.11],
      );
  }
  function buildingShell(
    parent: THREE.Group,
    width: number,
    depth: number,
    color: string,
    roofColor: string,
    height = 2.5,
  ) {
    box(parent, color, [0, height / 2, 0], [width, height, depth]);
    // Narrow weatherboards, corner timbers and a stone footing give every
    // workshop a finished facade from the camera's front and right-hand sides.
    box(parent, "#89918a", [0, 0.13, 0], [width + 0.15, 0.26, depth + 0.15]);
    for (let row = 1; row < 9; row++) {
      const y = 0.25 + (row * (height - 0.25)) / 9;
      for (const sign of [-1, 1]) {
        box(
          parent,
          "#a8aaa0",
          [sign * (width / 2 + 0.012), y, 0],
          [0.025, 0.016, depth],
        );
        box(
          parent,
          "#a8aaa0",
          [0, y, sign * (depth / 2 + 0.012)],
          [width, 0.016, 0.025],
        );
      }
    }
    for (const x of [-width / 2, width / 2])
      for (const z of [-depth / 2, depth / 2]) {
        const beam = box(
          parent,
          "#8c704e",
          [x, height / 2, z],
          [0.12, height, 0.12],
        );
        beam.material = generated.wood;
      }
    for (const sign of [-1, 1]) {
      box(
        parent,
        "#7e684d",
        [sign * (width / 2 + 0.025), height - 0.08, 0],
        [0.13, 0.14, depth + 0.13],
      );
      box(
        parent,
        "#806a4d",
        [0, height - 0.08, sign * (depth / 2 + 0.025)],
        [width + 0.13, 0.14, 0.13],
      );
    }
    function windowFrame(
      side: boolean,
      along: number,
      y: number,
      w: number,
      h: number,
    ) {
      const x = side ? width / 2 + 0.045 : along,
        z = side ? along : depth / 2 + 0.045;
      box(
        parent,
        "#514d3c",
        [x, y, z],
        side ? [0.07, h + 0.18, w + 0.18] : [w + 0.18, h + 0.18, 0.07],
      );
      const glass = box(
        parent,
        "#d9b978",
        [x + (side ? 0.043 : 0), y, z + (side ? 0 : 0.043)],
        side ? [0.025, h, w] : [w, h, 0.025],
      );
      // A small warm emission reads as an inhabited workshop in the snow.
      const glassMaterial = material("#d9b978");
      glassMaterial.emissive.set("#55421c");
      glass.material = glassMaterial;
      box(
        parent,
        "#e8d5aa",
        [x + (side ? 0.065 : 0), y, z + (side ? 0 : 0.065)],
        side ? [0.035, h + 0.04, 0.045] : [0.045, h + 0.04, 0.035],
      );
      box(
        parent,
        "#e8d5aa",
        [x + (side ? 0.067 : 0), y, z + (side ? 0 : 0.067)],
        side ? [0.035, 0.045, w + 0.04] : [w + 0.04, 0.045, 0.035],
      );
      box(
        parent,
        "#eee6cf",
        [x, y - h / 2 - 0.11, z],
        side ? [0.2, 0.1, w + 0.27] : [w + 0.27, 0.1, 0.2],
      );
    }
    for (const x of [-width * 0.33, width * 0.33])
      windowFrame(false, x, height * 0.61, width * 0.2, height * 0.29);
    for (const z of depth > 2 ? [-depth * 0.25, depth * 0.25] : [0])
      windowFrame(true, z, height * 0.59, depth * 0.24, height * 0.32);
    const door = box(
      parent,
      "#715c42",
      [0, height * 0.35, depth / 2 + 0.045],
      [width * 0.22, height * 0.7, 0.08],
    );
    door.material = generated.wood;
    for (const x of [-width * 0.115, width * 0.115])
      box(
        parent,
        "#b59b6e",
        [x, height * 0.36, depth / 2 + 0.1],
        [0.065, height * 0.75, 0.08],
      );
    box(
      parent,
      "#b59b6e",
      [0, height * 0.735, depth / 2 + 0.1],
      [width * 0.25, 0.07, 0.08],
    );
    ball(
      parent,
      "#d9bb72",
      [width * 0.07, height * 0.36, depth / 2 + 0.115],
      [0.045, 0.045, 0.03],
    );
    const slope = Math.atan2(0.85, width / 2 + 0.2),
      roofWidth = Math.hypot(width / 2 + 0.2, 0.85);
    for (const sign of [-1, 1]) {
      const roof = group(parent, sign * (width / 4 + 0.1), height + 0.46, 0);
      roof.rotation.z = -sign * slope;
      const sheet = box(
        roof,
        roofColor,
        [0, 0, 0],
        [roofWidth, 0.13, depth + 0.45],
      );
      sheet.material = generated.metal;
      for (let i = 0; i < 7; i++)
        box(
          roof,
          roofColor,
          [0, 0.085, -depth / 2 - 0.15 + (i * (depth + 0.3)) / 6],
          [roofWidth, 0.045, 0.035],
        );
      // Broken snow caps leave the underlying ribbed roof visible.
      box(
        roof,
        "#edf4f3",
        [-sign * roofWidth * 0.15, 0.125, -depth * 0.21],
        [roofWidth * 0.56, 0.13, depth * 0.55],
      );
      box(
        roof,
        "#e4eff0",
        [sign * roofWidth * 0.32, 0.115, depth * 0.27],
        [roofWidth * 0.25, 0.11, depth * 0.43],
      );
      box(
        roof,
        roofColor,
        [(sign * roofWidth) / 2, -0.025, 0],
        [0.09, 0.2, depth + 0.55],
      );
    }
    const gable = new THREE.Shape([
      new THREE.Vector2(-width / 2, 0),
      new THREE.Vector2(width / 2, 0),
      new THREE.Vector2(0, 0.85),
    ]);
    for (const sign of [-1, 1]) {
      const face = new THREE.Mesh(
        new THREE.ShapeGeometry(gable),
        material(color),
      );
      face.position.set(0, height, sign * (depth / 2 + 0.005));
      face.material.side = THREE.DoubleSide;
      parent.add(face);
      for (const direction of [-1, 1]) {
        const trim = box(
          parent,
          "#806a4c",
          [direction * width * 0.25, height + 0.43, sign * (depth / 2 + 0.055)],
          [roofWidth, 0.09, 0.09],
        );
        trim.rotation.z = -direction * slope;
      }
    }
    box(parent, "#edf5f4", [0, height + 0.94, 0], [0.19, 0.12, depth + 0.58]);
    // Porch lamp and a small timber sign distinguish the entrance from a wall.
    const lamp = group(parent, width * 0.19, height * 0.72, depth / 2 + 0.2);
    box(lamp, "#526773", [0, 0, 0], [0.18, 0.29, 0.18]);
    box(lamp, "#f2cf82", [0, -0.01, 0.102], [0.12, 0.18, 0.025]);
    box(lamp, "#e7ede8", [0, 0.18, 0], [0.25, 0.06, 0.24]);
    box(
      parent,
      "#ac8755",
      [0, height * 0.86, depth / 2 + 0.11],
      [width * 0.37, 0.23, 0.075],
    );
  }
  // Equipment sits on solid work surfaces; later tiers enclose and extend them.
  box(stations.ingots.group, "#7c7466", [0, 0.48, 1.6], [1.55, 0.96, 0.7]);
  const anvil = box(
    stations.ingots.group,
    "#80949e",
    [0, 1.03, 1.6],
    [1.7, 0.18, 0.8],
  );
  anvil.material = generated.metal;
  box(stations.meals.group, "#a08768", [0, 0.6, 1.7], [1.7, 1.2, 0.85]);
  const cookingPot = cylinder(
    stations.meals.group,
    "#708d99",
    [0, 1.3, 1.7],
    [0.43, 0.4, 0.43],
    0.2,
  );
  cookingPot.material = generated.metal;
  cylinder(stations.meals.group, "#b28049", [0, 1.51, 1.7], [0.36, 0.02, 0.36]);
  box(stations.tackle.group, "#a47b4d", [0, 0.58, 2.2], [2.9, 1.16, 0.8]);
  const toolSurface = box(
    stations.tackle.group,
    "#d2ad73",
    [0, 1.2, 2.2],
    [3.15, 0.12, 1],
  );
  toolSurface.material = generated.wood;
  const forgeHammer = group(stations.ingots.group, -0.6, 1.2, 1.7);
  forgeHammer.name = "forge-hammer";
  activityProps["forge-hammer"] = forgeHammer;
  box(forgeHammer, "#906642", [0, 0.1, 0], [0.09, 0.7, 0.09]);
  const hammerHead = box(
    forgeHammer,
    "#879ba5",
    [0, 0.43, 0],
    [0.47, 0.23, 0.24],
  );
  hammerHead.material = generated.metal;
  const forgeGlow = ball(
    stations.ingots.group,
    "#dd8a43",
    [-1.05, 0.78, 1.69],
    [0.21, 0.16, 0.025],
  );
  forgeGlow.name = "forge-glow";
  forgeGlow.userData.baseScale = forgeGlow.scale.clone();
  (forgeGlow.material as THREE.MeshStandardMaterial).emissive.set("#bb501b");
  activityProps["forge-glow"] = forgeGlow;
  const spoon = group(stations.meals.group, 0.1, 1.75, 1.7);
  spoon.name = "cooking-spoon";
  activityProps["cooking-spoon"] = spoon;
  box(spoon, "#ab7f4a", [0, 0.05, 0], [0.045, 0.8, 0.045]);
  ball(spoon, "#d2aa6f", [0, -0.37, 0], [0.12, 0.06, 0.09]);
  const boatHammer = group(stations.tackle.group, 0.4, 1.55, 2.2);
  boatHammer.name = "boatyard-hammer";
  activityProps["boatyard-hammer"] = boatHammer;
  box(boatHammer, "#8f633d", [0, 0, 0], [0.08, 0.65, 0.08]);
  box(boatHammer, "#8ca2af", [0, 0.34, 0], [0.4, 0.18, 0.2]);
  const stockCrates = group(stations.warehouse.group, 1.1, 0, 0.1);
  stockCrates.name = "stock-crates";
  activityProps["stock-crates"] = stockCrates;
  for (let i = 0; i < 9; i++) {
    const c = crate(
      stockCrates,
      (i % 3) * 0.7,
      Math.floor(i / 3) * 0.65,
      0,
      0.62,
    );
    c.visible = i < 2;
  }
  for (let level = 1; level <= 5; level++) {
    const pots = stage("crabpots", stations.crab.group);
    if (level === 1) {
      cylinder(pots, "#866347", [0.7, 1.2, -0.55], [0.09, 2.4, 0.09]);
      box(pots, "#c49a5e", [0.1, 2.2, -0.55], [1.3, 0.12, 0.12]);
      const wheel = cylinder(
        pots,
        "#738993",
        [0.6, 1.75, -0.55],
        [0.25, 0.1, 0.25],
        0.4,
      );
      wheel.rotation.z = Math.PI / 2;
    } else if (level === 2) {
      for (let i = 0; i < 3; i++) crate(pots, 0.5 + i * 0.48, 0, 0.55, 0.42);
    } else if (level === 3) {
      box(pots, "#74979d", [0.8, 0.5, 0], [0.75, 0.65, 0.7]);
      const drum = cylinder(
        pots,
        "#9db6be",
        [0.8, 0.95, 0],
        [0.28, 0.45, 0.28],
        0.4,
      );
      drum.material = generated.metal;
    } else if (level === 4) {
      for (const z of [-1, 1]) {
        cylinder(pots, "#b2986a", [1.5, 1.15, z], [0.065, 2.3, 0.065]);
        box(pots, "#d4aa67", [1.5, 2.2, 0], [0.12, 0.12, 2.3]);
      }
      box(pots, "#578897", [1, 2.3, 0], [1.4, 0.12, 2.4]);
    } else {
      cylinder(pots, "#d8ba72", [0.7, 2.55, -0.55], [0.09, 2.7, 0.09]);
      box(pots, "#e0bd6e", [-0.1, 3.75, -0.55], [1.9, 0.18, 0.18]);
      box(pots, "#6d9ba3", [1.55, 0.8, 0.2], [0.6, 1.2, 0.7]);
    }
    const garden = stage("kelpfarm", stations.kelp.group);
    const row = level - 1;
    box(garden, "#6d775a", [0.55 + row * 0.34, 0.15, 0], [0.3, 0.24, 1.8]);
    for (let k = 0; k < 4; k++)
      ball(
        garden,
        k % 2 ? "#4c8c63" : "#619b68",
        [0.55 + row * 0.34, 0.5, -0.63 + k * 0.43],
        [0.14, 0.43, 0.13],
      );
    if (level === 2) {
      for (const z of [-0.9, 0.9])
        box(garden, "#99794d", [1.2, 0.35, z], [1.8, 0.16, 0.13]);
    }
    if (level === 3) {
      for (const x of [0.35, 2.15])
        for (const z of [-1.02, 1.02])
          box(garden, "#9fbbba", [x, 1.05, z], [0.065, 2.1, 0.065]);
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(1.95, 0.075, 2.15),
        new THREE.MeshStandardMaterial({
          color: "#a6d2d3",
          transparent: true,
          opacity: 0.32,
          roughness: 0.2,
          depthWrite: false,
        }),
      );
      glass.position.set(1.25, 2.1, 0);
      garden.add(glass);
    }
    if (level === 4) {
      box(garden, "#8caeaa", [2.25, 0.6, 0.7], [0.35, 1.1, 0.4]);
      cylinder(garden, "#b8c9c0", [2.25, 1.35, 0.7], [0.04, 0.8, 0.04]);
    }
    if (level === 5) {
      box(garden, "#c9a965", [1.25, 2.3, 1.05], [1.7, 0.28, 0.08]);
      crate(garden, 2.4, 0, -0.65, 0.5);
    }
    const quarry = stage("quarry", stations.ore.group);
    if (level === 1) {
      for (let i = 0; i < 3; i++)
        box(quarry, "#8b7050", [-1.2 + i * 0.7, 0.1, 1.3], [0.65, 0.2, 0.85]);
    } else if (level === 2) {
      box(quarry, "#e0bb58", [1.6, 0.65, 0], [0.6, 1.2, 0.8]);
      const drill = cylinder(
        quarry,
        "#7d949d",
        [1.6, 0.7, 0.75],
        [0.1, 1.1, 0.1],
        0.4,
      );
      drill.rotation.x = Math.PI / 2;
    } else if (level === 3) {
      buildingShell(quarry, 1.6, 1.6, "#b7a184", "#7c929b", 1.8);
      quarry.position.set(2.2, 0, -1.2);
    } else if (level === 4) {
      crate(quarry, -1.7, 0, 0.8, 0.85);
      crate(quarry, -1.7, 0.85, 0.8, 0.65);
    } else {
      cylinder(quarry, "#ab8550", [2, 1.8, 0], [0.1, 3.6, 0.1]);
      box(quarry, "#ddba61", [1, 3.3, 0], [2.3, 0.15, 0.15]);
    }
    const forge = stage("forge", stations.ingots.group);
    if (level === 1) {
      buildingShell(forge, 3.1, 2.6, "#8e8d81", "#566c77");
      box(forge, "#56717e", [0, 0.5, 1.6], [1.6, 0.95, 0.7]);
      box(forge, "#9cb2b7", [0, 1.05, 1.6], [1.8, 0.2, 0.8]);
      const hearth = group(forge, -1.05, 0, 1.25);
      box(hearth, "#805e4e", [0, 0.72, 0], [0.92, 1.44, 0.82]);
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 3; col++) {
          const x = -0.32 + col * 0.32 + (row % 2) * 0.08;
          if (x > 0.41) continue;
          box(
            hearth,
            row % 2 ? "#ac8570" : "#a07865",
            [x, 0.14 + row * 0.23, 0.422],
            [0.29, 0.205, 0.035],
          );
        }
      box(hearth, "#302f2b", [0, 0.78, 0.448], [0.52, 0.51, 0.055]);
      for (const x of [-0.32, 0.32])
        box(hearth, "#bf9d7e", [x, 0.78, 0.48], [0.12, 0.64, 0.12]);
      box(hearth, "#bf9d7e", [0, 1.1, 0.48], [0.76, 0.15, 0.12]);
      box(hearth, "#677b80", [0, 1.48, 0], [1.02, 0.15, 0.92]);
      box(forge, "#9d826b", [-1.05, 2.58, 0.86], [0.4, 2.2, 0.43]);
      for (let row = 0; row < 8; row++)
        box(
          forge,
          "#735f51",
          [-1.05, 1.62 + row * 0.26, 1.084],
          [0.41, 0.022, 0.015],
        );
      box(forge, "#657980", [-1.05, 3.72, 0.86], [0.57, 0.13, 0.58]);
      box(forge, "#354a52", [-1.05, 3.8, 0.86], [0.35, 0.03, 0.36]);
      const horn = shape(
        forge,
        new THREE.ConeGeometry(0.19, 0.5, 12),
        "#81969e",
        [0.95, 1.07, 1.6],
        [1, 1, 1],
      );
      horn.rotation.z = -Math.PI / 2;
    } else if (level === 2) {
      const furnace = box(forge, "#667783", [-1.8, 0.7, 0.2], [0.8, 1.4, 1.1]);
      furnace.material = generated.metal;
      box(forge, "#eaa24b", [-1.8, 0.7, 0.77], [0.45, 0.5, 0.03]);
    } else if (level === 3) {
      cylinder(forge, "#9eaaa8", [1, 2.7, -0.7], [0.2, 2, 0.2]);
    } else if (level === 4) {
      box(forge, "#8b9e9f", [1.95, 0.6, 0], [1, 1.2, 1.8]);
    } else {
      box(forge, "#dbbb68", [0, 2.7, 1.37], [1.7, 0.36, 0.09]);
      crate(forge, 1.9, 0, 1.3, 0.7);
    }
    const kitchen = stage("kitchen", stations.meals.group);
    if (level === 1) {
      buildingShell(kitchen, 3.4, 2.8, "#e8dbb6", "#ac6753");
      const stove = box(kitchen, "#6a828d", [0, 0.6, 1.7], [2.5, 1.2, 0.85]);
      stove.material = generated.metal;
      cylinder(kitchen, "#b8c7c8", [0, 1.26, 1.7], [0.43, 0.32, 0.43], 0.3);
    } else if (level === 2) {
      for (let i = 0; i < 8; i++)
        box(
          kitchen,
          i % 2 ? "#f0e5c8" : "#be7661",
          [-1.8 + i * 0.45, 2.4, 1.8],
          [0.45, 0.12, 1.3],
        );
    } else if (level === 3) {
      cylinder(kitchen, "#8fa3aa", [1, 3.1, -0.7], [0.18, 1.7, 0.18]);
    } else if (level === 4) {
      box(kitchen, "#b39b72", [-2.4, 0.5, 0.8], [1.3, 1, 1.8]);
    } else {
      box(kitchen, "#d6ba77", [0, 2.72, 1.44], [2, 0.38, 0.07]);
      crate(kitchen, 2.2, 0, 1, 0.7);
    }
    const boat = stage("boatyard", stations.tackle.group);
    if (level === 1) {
      buildingShell(boat, 4.2, 3.4, "#7e9a9a", "#557587", 2.8);
      box(boat, "#916946", [0, 0.6, 2.2], [3, 1.2, 0.8]);
      box(boat, "#d1a970", [0, 1.25, 2.2], [3.3, 0.12, 1]);
    } else if (level === 2) {
      const hull = ball(boat, "#a27349", [-3, 0.35, 0.4], [0.95, 0.38, 2.3]);
      hull.material = generated.wood;
      ball(boat, "#c6a777", [-3, 0.5, 0.4], [0.74, 0.16, 1.9]);
      for (let i = 0; i < 4; i++)
        box(boat, "#926b46", [-3, 0.65, -0.8 + i * 0.7], [1.5, 0.08, 0.16]);
    } else if (level === 3) {
      cylinder(boat, "#c4a05c", [2.5, 2, 1.8], [0.1, 4, 0.1]);
      box(boat, "#e0b858", [1.9, 3.7, 1.8], [1.7, 0.15, 0.15]);
    } else if (level === 4) {
      crate(boat, -2.5, 0, 2.8, 0.8);
      crate(boat, -1.6, 0, 2.8, 0.8);
    } else {
      box(boat, "#e2c077", [0, 3, 1.77], [2.4, 0.42, 0.09]);
      box(boat, "#5a8698", [2.7, 1, 0.1], [1, 2, 2.2]);
    }
    const store = stage("warehouse", stations.warehouse.group);
    if (level === 1) {
      for (const x of [-2, 2])
        box(store, "#8d6b45", [x, 1.45, -0.4], [0.15, 2.9, 0.15]);
      box(store, "#b49364", [0, 2.9, -0.4], [4.2, 0.2, 0.2]);
      box(store, "#a28255", [0, 1.3, -1.3], [4.2, 2.6, 0.12]);
    } else if (level === 2) {
      const roof = box(store, "#648894", [0, 3, 0], [4.6, 0.25, 3.2]);
      roof.material = generated.metal;
    } else if (level === 3) {
      box(store, "#aa8354", [-2.1, 1.3, 0], [0.14, 2.6, 2.8]);
      box(store, "#aa8354", [2.1, 1.3, 0], [0.14, 2.6, 2.8]);
    } else if (level === 4) {
      cylinder(store, "#ad854a", [2.8, 2.3, 0.6], [0.12, 4.6, 0.12]);
      box(store, "#e0b655", [1.6, 4.4, 0.6], [2.8, 0.18, 0.18]);
    } else {
      box(store, "#d9b76c", [0, 3.3, 1.5], [2.2, 0.42, 0.1]);
      crate(store, -2.8, 0, 0.8, 0.8);
      crate(store, -2.8, 0.8, 0.8, 0.7);
    }
  }
  // More harvestable pines and quarry-side trees make the wider area useful.
  for (const [x, z, h] of [
    [1, -18, 1.1],
    [4, -20, 1.2],
    [8, -18, 0.95],
    [19, -18, 1.05],
    [24, -13, 1.2],
    [25, -6, 1],
    [25, 3, 1.15],
    [24, 21, 1.05],
    [5, 21, 1.1],
  ])
    tree(x, z, h);
  for (const id of keys) upgradeGroups[id].forEach((g) => batchDetails(g));
  batchDetails(market);
  function applyUpgrades(levels: GameState["upgrades"]) {
    const changed: THREE.Group[] = [];
    for (const id of keys) {
      const level = levels[id] || 0;
      upgradeGroups[id].forEach((g, index) => {
        const wanted = index < level;
        if (wanted && !g.visible) changed.push(g);
        g.visible = wanted;
      });
    }
    forgeGlow.visible = (levels.forge || 0) > 0;
    dockLevel = levels.dock || 0;
    const cutterLevel = levels.cutter || 0;
    blade.visible = cutterLevel >= 1;
    secondBlade.visible = cutterLevel >= 2;
    piston.visible = cutterLevel >= 1;
    conveyor.visible = cutterLevel >= 1;
    cleaver.visible = cutterLevel === 0;
    blade.scale.setScalar(1 + Math.max(0, cutterLevel - 2) * 0.06);
    secondBlade.scale.copy(blade.scale);
    axeHead.scale.x = 0.43 * (1 + (levels.axe || 0) * 0.09);
    axeHead.material = material(
      (levels.axe || 0) > 3 ? "#e1c372" : "#c9dee8",
      0.25,
    );
    rodShaft.scale.y = 1.65 * (1 + (levels.rod || 0) * 0.07);
    smokePuffs.forEach((puff) => {
      puff.visible = (levels.smokehouse || 0) > 0;
    });
    return changed;
  }
  const obstacles = [
    { x: -2, z: 0, w: 3.65, d: 1.65 },
    { x: 3, z: -4, w: 2.65, d: 1.9 },
    { x: 5, z: 1, w: 1.9, d: 1.7 },
    { x: 4, z: 5, w: 3.8, d: 1.3 },
    { x: 7, z: -1, w: 1.85, d: 1.85 },
    { x: 15, z: -12, w: 2.4, d: 2.3 },
    { x: 15, z: -5, w: 3.6, d: 3 },
    { x: 15, z: -3.4, w: 1.8, d: 0.8 },
    { x: 14, z: 6, w: 3.8, d: 3.2 },
    { x: 14, z: 7.7, w: 2.5, d: 0.85 },
    { x: 19, z: 16, w: 4.8, d: 3.8 },
    { x: 19, z: 18.2, w: 3.15, d: 1 },
    { x: 10, z: 11.5, w: 4.5, d: 3 },
  ];
  const isWalkable = (x: number, z: number) => {
    if (
      (x < bounds.minX && !onDock(x, z)) ||
      x > bounds.maxX ||
      z < bounds.minZ ||
      z > bounds.maxZ
    )
      return false;
    if (
      obstacles.some(
        (o) =>
          Math.abs(x - o.x) < o.w / 2 + 0.12 &&
          Math.abs(z - o.z) < o.d / 2 + 0.12,
      )
    )
      return false;
    if (
      trees.some(
        (tree) =>
          tree.state === "standing" &&
          Math.hypot(x - tree.position.x, z - tree.position.z) <
            0.3 * tree.originalScale,
      ) ||
      (workerTree.state === "standing" &&
        Math.hypot(x - workerTree.position.x, z - workerTree.position.z) < 0.3)
    )
      return false;
    // Timber fence openings and the wide front entrance are real passageways.
    if (
      Math.abs(x + 5.55) < 0.16 &&
      z > -3.3 &&
      z < 8.7 &&
      (z < 0.02 || z > 2.2)
    )
      return false;
    if (
      Math.abs(x - 7.65) < 0.16 &&
      z > -3.3 &&
      z < 8.7 &&
      (z < 3.9 || z > 6.8)
    )
      return false;
    if (
      Math.abs(z + 3.28) < 0.16 &&
      x > -5.5 &&
      x < 7.65 &&
      (x < -3.8 || (x > 0.9 && x < 1.5) || x > 4.5)
    )
      return false;
    if (
      Math.abs(z - 8.72) < 0.16 &&
      x > -5.5 &&
      x < 7.65 &&
      (x < -2.9 || x > 4.9)
    )
      return false;
    return true;
  };
  // Fine, instanced snow detail stays outside paths and never floats over water.
  const pebbles = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.16, 0),
      material("#c5d9e4"),
      100,
    ),
    snowDots = new THREE.InstancedMesh(sphere, material("#f9fcfd"), 90);
  for (let i = 0; i < 100; i++) {
    let x = -6.7 + random() * 33,
      z = -22 + random() * 46;
    if (x > -5.7 && x < 8 && z > -3.6 && z < 9) {
      x = 8.3 + random() * 3;
      z -= 6;
    }
    dummy.position.set(x, 0.36, z);
    dummy.rotation.set(random(), random() * 6, random());
    dummy.scale.set(1 + random(), 0.3 + random() * 0.4, 0.6 + random());
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
    if (i < 90) {
      dummy.position.y = 0.35;
      dummy.scale.set(0.12 + random() * 0.12, 0.025, 0.12 + random() * 0.15);
      dummy.updateMatrix();
      snowDots.setMatrixAt(i, dummy.matrix);
    }
  }
  scene.add(pebbles, snowDots);
  const ripples = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.025, 0.7),
    new THREE.MeshBasicMaterial({
      color: "#8adaed",
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    70,
  );
  for (let i = 0; i < 70; i++) {
    dummy.position.set(-12.5 + random() * 5, -0.235, -26 + random() * 60);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.setScalar(0.5 + random());
    dummy.updateMatrix();
    ripples.setMatrixAt(i, dummy.matrix);
  }
  scene.add(ripples);
  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>(unusedGeometries),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    scene.traverse((o) => {
      const object = o as THREE.Mesh;
      if (object.geometry) geometries.add(object.geometry);
      const items = object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : [];
      items.forEach((m) => {
        materials.add(m);
        Object.values(m).forEach((v) => {
          if (v instanceof THREE.Texture) textures.add(v);
        });
      });
    });
    for (const template of [
      fishTemplate,
      smokedTemplate,
      ...itemTemplates.values(),
    ])
      template.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) geometries.add(m.geometry);
        if (m.material)
          for (const mat of Array.isArray(m.material)
            ? m.material
            : [m.material])
            materials.add(mat);
      });
    for (const m of [
      generated.tunaSkin,
      generated.steakFace,
      generated.wood,
      generated.metal,
    ]) {
      materials.delete(m);
      if (m.map) textures.delete(m.map);
    }
    generated.dispose();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    sun.shadow.map?.dispose();
    itemTemplates.clear();
  }
  return {
    scene,
    player,
    rightArm,
    leftArm,
    legs,
    cargo,
    axe,
    rod,
    bobber,
    fishingLine,
    trees,
    fish,
    customers,
    stations,
    bounds,
    workerTree,
    createPerson: winterPerson,
    activityProps,
    ready: generated.ready,
    cutter,
    upgradeGroups,
    smokePuffs,
    water,
    isWalkable,
    groundHeight,
    applyUpgrades,
    createItem,
    dispose,
  };
}
