import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { UpgradeId, Resource, GameState } from "./model";

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
  stations: Record<"fish" | "steaks" | "planks" | "smoked" | "market", Station>;
  cutter: {
    cleaver: THREE.Group;
    blade: THREE.Group;
    secondBlade: THREE.Group;
    piston: THREE.Group;
    conveyor: THREE.Group;
    fish: THREE.Group;
    steaks: THREE.Group[];
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
  const woodCanvas = document.createElement("canvas");
  woodCanvas.width = woodCanvas.height = 256;
  const woodCtx = woodCanvas.getContext("2d")!;
  woodCtx.fillStyle = "#bd8b71";
  woodCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) {
    woodCtx.fillStyle =
      i % 3 === 0 ? "#b7846c" : i % 3 === 1 ? "#bd8c73" : "#c4947a";
    woodCtx.fillRect(0, i * 16, 256, 15);
    woodCtx.fillStyle = "rgba(88,52,34,.19)";
    woodCtx.fillRect(0, i * 16, 256, 1);
    for (let j = 0; j < 9; j++) {
      woodCtx.strokeStyle = "rgba(111,71,45,.065)";
      woodCtx.beginPath();
      const yy = i * 16 + random() * 14;
      woodCtx.moveTo(random() * 230, yy);
      woodCtx.lineTo(256, yy + random() * 2);
      woodCtx.stroke();
    }
  }
  const woodTexture = new THREE.CanvasTexture(woodCanvas);
  woodTexture.colorSpace = THREE.SRGBColorSpace;
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(3, 3);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    roughness: 1,
  });
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
  const groundHeight = (x: number, z: number) =>
    onDock(x, z) || (x >= -5.55 && x <= 7.65 && z >= -3.3 && z <= 8.75)
      ? 0.4
      : 0.35;
  // All reusable cargo items have true volume and distinct silhouettes.
  function makeFish(smoked = false) {
    const g = new THREE.Group(),
      navy = smoked ? "#855b34" : "#123e87",
      side = smoked ? "#c59a59" : "#69b8d6";
    ball(g, side, [0, 0.025, 0], [0.48, 0.32, 1.45]);
    ball(g, navy, [0, 0.2, -0.08], [0.33, 0.185, 1.35]);
    ball(g, side, [0, -0.065, 0.12], [0.465, 0.255, 1.29]);
    ball(
      g,
      smoked ? "#d5b782" : "#e3eff1",
      [0, -0.17, 0.17],
      [0.39, 0.15, 1.14],
    );
    for (const sign of [-1, 1]) {
      const eye = cylinder(
        g,
        "#eff1d7",
        [sign * 0.355, 0.09, 1.02],
        [0.125, 0.045, 0.125],
        0.3,
      );
      eye.rotation.z = Math.PI / 2;
      const pupil = cylinder(
        g,
        "#0c243a",
        [sign * 0.383, 0.09, 1.02],
        [0.075, 0.055, 0.075],
      );
      pupil.rotation.z = Math.PI / 2;
      ball(g, "#ffffff", [sign * 0.412, 0.12, 1.045], [0.02, 0.028, 0.028]);
      const fin = box(g, navy, [sign * 0.53, -0.04, 0.05], [0.64, 0.04, 0.2]);
      fin.rotation.y = sign * 0.58;
      const gill = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.018, 4, 12, Math.PI * 0.8),
        material(smoked ? "#986d43" : "#3a829f"),
      );
      gill.rotation.y = (sign * Math.PI) / 2;
      gill.rotation.z = -0.8;
      gill.position.set(sign * 0.44, -0.02, 0.71);
      g.add(gill);
      for (let i = 0; i < 4; i++)
        shape(
          g,
          cone,
          smoked ? "#dcbd73" : "#e7c653",
          [sign * 0.19, 0.18, -0.7 - i * 0.13],
          [0.035, 0.11, 0.035],
        );
    }
    const finShape = new THREE.Shape([
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.7, 0),
      new THREE.Vector2(0.12, 0.56),
    ]);
    const dorsal = new THREE.Mesh(
      new THREE.ShapeGeometry(finShape),
      new THREE.MeshStandardMaterial({ color: navy, side: THREE.DoubleSide }),
    );
    dorsal.rotation.y = Math.PI / 2;
    dorsal.position.set(0, 0.23, -0.35);
    g.add(dorsal);
    const tail = group(g, 0, 0, -1.23);
    tail.name = "tail";
    const tailShape = new THREE.Shape([
      new THREE.Vector2(0, 0),
      new THREE.Vector2(-0.7, -0.82),
      new THREE.Vector2(0, -0.52),
      new THREE.Vector2(0.7, -0.82),
    ]);
    const tailMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(tailShape, {
        depth: 0.055,
        bevelEnabled: false,
      }),
      material(navy),
    );
    tailMesh.rotation.x = Math.PI / 2;
    tail.add(tailMesh);
    batchDetails(g);
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
      cylinder(g, "#f4debe", [0, 0, 0], [0.24, 0.15, 0.24]);
      cylinder(g, "#e2676e", [0, 0.082, 0], [0.211, 0.014, 0.211]);
      cylinder(g, "#fff0ca", [0, 0.096, 0], [0.048, 0.018, 0.048]);
      for (const a of [0.3, 2.4, 4.6]) {
        const grain = box(
          g,
          "#f3b4a1",
          [Math.cos(a) * 0.12, 0.094, Math.sin(a) * 0.12],
          [0.13, 0.009, 0.014],
        );
        grain.rotation.y = -a;
      }
    } else {
      for (let i = 0; i < 2; i++)
        box(g, i ? "#d5a773" : "#bd8c59", [0, i * 0.1, 0], [0.97, 0.09, 0.24]);
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
      z = i < 40 ? -20 + random() * 42 : -15 - random() * 14,
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
  // The cutting table works at level zero: whole fish, cleaver, and individual steaks.
  const bench = stations.steaks.group;
  for (const x of [-0.9, 0.9])
    for (const z of [-0.45, 0.45])
      box(bench, darkWood, [x, 0.38, z], [0.13, 0.76, 0.13]);
  box(bench, "#b58250", [0, 0.8, 0], [2.25, 0.2, 1.4]);
  box(bench, "#e3c694", [0, 0.925, 0], [1.92, 0.06, 1.16]);
  box(bench, "#b28454", [1.65, 1.01, 0], [1.6, 0.13, 0.58]);
  for (const z of [-0.3, 0.3])
    box(bench, "#d4aa72", [1.65, 1.13, z], [1.66, 0.11, 0.06]);
  const cutterFish = createItem("fish");
  cutterFish.scale.setScalar(1.65);
  cutterFish.position.set(0, 1.15, 0);
  bench.add(cutterFish);
  const cleaver = group(bench, 0, 1.8, 0.05);
  box(cleaver, "#bd8b54", [0, 0.12, 0], [0.11, 0.42, 0.1]);
  box(cleaver, "#d5e2e7", [0.19, -0.15, 0], [0.46, 0.34, 0.065]);
  box(cleaver, "#f4faf8", [0.19, -0.325, 0], [0.46, 0.025, 0.075]);
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
  const secondBlade = sawBlade(bench, 0.78, 1.5, -0.32);
  secondBlade.visible = false;
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
  for (let i = 0; i < 4; i++) {
    const item = createItem("steak");
    item.position.set(0.75 + i * 0.34, 1.08, 0.3);
    item.visible = false;
    bench.add(item);
    steaks.push(item);
  }
  crate(bench, 2.3, 0, 0.4, 0.8);
  const cutter = {
    cleaver,
    blade,
    secondBlade,
    piston,
    conveyor,
    fish: cutterFish,
    steaks,
  };
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
  for (let i = 0; i < 5; i++) {
    const customer = winterPerson(scene, i % 2 ? "#e2c15b" : "#f0cf69").root;
    customer.position.set(4 + (i % 2) * 0.25, 0.35, 6.6 + i * 1.35);
    customer.rotation.y = Math.PI;
    customer.userData.basePosition = customer.position.clone();
    customers.push(customer);
  }
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
      -4 + (level - 1) * 1.3,
      0.4,
      3.8 + (level % 2) * 0.8,
    );
    const helper = winterPerson(workerStage, level % 2 ? "#23a0b4" : "#418fa7"),
      worker = helper.root;
    worker.rotation.y = -0.7;
    worker.userData.workerPerson = true;
    worker.userData.arms = [helper.leftArm, helper.rightArm];
    worker.userData.legs = helper.legs;
    worker.traverse((object) => {
      object.castShadow = false;
    });
    const carrying = createItem(level % 2 ? "wood" : "fish");
    carrying.position.set(0, 1, -0.35);
    carrying.scale.setScalar(0.7);
    worker.add(carrying);
    worker.userData.carrying = carrying;
    workerStage.userData.worker = true;
    workerStage.userData.basePosition = workerStage.position.clone();
    crate(workerStage, 0.65, 0, 0.2, 0.45);
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
    { x: -2, z: 0, w: 2.5, d: 1.5 },
    { x: 3, z: -4, w: 2.65, d: 1.9 },
    { x: 5, z: 1, w: 1.9, d: 1.7 },
    { x: 4, z: 5, w: 3.8, d: 1.3 },
    { x: 7, z: -1, w: 1.85, d: 1.85 },
  ];
  const isWalkable = (x: number, z: number) => {
    if ((x < -7.05 && !onDock(x, z)) || x > 9 || z < -12 || z > 12)
      return false;
    if (
      obstacles.some(
        (o) =>
          Math.abs(x - o.x) < o.w / 2 + 0.12 &&
          Math.abs(z - o.z) < o.d / 2 + 0.12,
      )
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
    let x = -6.7 + random() * 16,
      z = -13 + random() * 28;
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
