import * as THREE from "three";

export type Resource = "wood" | "fish" | "salmon";

export interface ResourceNode {
  group: THREE.Group;
  resource: Resource;
  position: THREE.Vector3;
  hits: number;
  depletedUntil: number;
  baseScale: number;
  region: string;
  sway: number;
}

export interface World {
  scene: THREE.Scene;
  terrain: THREE.Object3D;
  nodes: ResourceNode[];
  market: THREE.Group;
  cottage: THREE.Group;
  boat: THREE.Group;
  water: THREE.Mesh;
  sparkles: THREE.InstancedMesh;
  birds: THREE.Group[];
  clouds: THREE.Group[];
  player: THREE.Group;
  limbs: THREE.Object3D[];
  decorations: THREE.Group[];
  fishes: THREE.Group[];
  customers: THREE.Group[];
  obstacles: { x: number; z: number; width: number; depth: number }[];
  isWalkable: (x: number, z: number) => boolean;
  upgradeDecorations: {
    market: THREE.Group[];
    workshop: THREE.Group[];
    crew: THREE.Group[];
  };
  dispose: () => void;
}

/** An entirely original little world. All textures and models are made locally. */
export function createWorld(): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ccdfeb");
  scene.fog = new THREE.Fog("#ccdfeb", 48, 130);
  let seed = 82014;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const palette = {
    grass: "#e2ebf0",
    grassLight: "#f6f9fb",
    grassDark: "#bacfdc",
    sand: "#f1f5f6",
    soil: "#b7ccd9",
    path: "#d7e1e5",
    wood: "#8c6445",
    woodLight: "#be9460",
    leaf: "#7592a0",
    leafLight: "#dbeaf0",
    leafDark: "#486d7d",
    cream: "#f5e6c6",
    roof: "#bd7251",
    roofLight: "#d68d60",
    teal: "#45859c",
    yellow: "#efc665",
  };
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string, roughness = 1) => {
    const key = `${color}-${roughness}`;
    if (!mats.has(key))
      mats.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }),
      );
    return mats.get(key)!;
  };
  const sphereGeometry = new THREE.SphereGeometry(1, 9, 7);
  const smoothSphere = new THREE.SphereGeometry(1, 14, 10);
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);
  const coneGeometry = new THREE.ConeGeometry(1, 1, 9);
  function mesh(
    geometry: THREE.BufferGeometry,
    color: string,
    parent: THREE.Object3D,
    p: number[],
    s: number[],
    smooth = false,
  ) {
    const object = new THREE.Mesh(geometry, mat(color));
    object.position.set(p[0], p[1], p[2]);
    object.scale.set(s[0], s[1], s[2]);
    object.castShadow = true;
    object.receiveShadow = true;
    if (smooth) object.material = mat(color, 0.82);
    parent.add(object);
    return object;
  }
  const box = (p: THREE.Object3D, c: string, pos: number[], scale: number[]) =>
    mesh(boxGeometry, c, p, pos, scale);
  const ball = (
    p: THREE.Object3D,
    c: string,
    pos: number[],
    scale: number[],
    smooth = false,
  ) => mesh(smooth ? smoothSphere : sphereGeometry, c, p, pos, scale, smooth);
  const cylinder = (
    p: THREE.Object3D,
    c: string,
    pos: number[],
    scale: number[],
  ) => mesh(cylinderGeometry, c, p, pos, scale);

  const ambient = new THREE.HemisphereLight("#f0f8ff", "#8ba9c8", 1.85);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight("#fff3df", 2.65);
  sun.position.set(-12, 24, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 65;
  sun.shadow.normalBias = 0.045;
  sun.shadow.bias = -0.0003;
  sun.shadow.radius = 5;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#d2efec", 0.55);
  fill.position.set(16, 9, -14);
  scene.add(fill);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(350, 350),
    new THREE.MeshStandardMaterial({
      color: "#0c82c6",
      roughness: 0.46,
      metalness: 0.12,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.55;
  water.receiveShadow = true;
  scene.add(water);

  function islandShape(rx: number, rz: number) {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 72; i++) {
      const edge = Math.acos(-3.92 / rx);
      const a = -edge + (i / 72) * edge * 2;
      const distortion =
        1 + Math.sin(a * 3 + 0.8) * 0.027 + Math.cos(a * 5) * 0.022;
      const x = Math.cos(a) * rx * distortion;
      const y = Math.sin(a) * rz * distortion;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    return shape;
  }
  const shore = new THREE.Mesh(
    new THREE.ExtrudeGeometry(islandShape(10.9, 8.5), {
      depth: 0.68,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.38,
      bevelThickness: 0.28,
    }),
    [mat(palette.sand), mat("#a9c8d7")],
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = -0.55;
  shore.receiveShadow = true;
  scene.add(shore);
  const grass = new THREE.Mesh(
    new THREE.ExtrudeGeometry(islandShape(9.9, 7.45), {
      depth: 0.26,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.35,
      bevelThickness: 0.22,
    }),
    [mat(palette.grass), mat("#c5d9e4")],
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.16;
  grass.receiveShadow = true;
  scene.add(grass);
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(23, 19),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = 0.67;
  scene.add(terrain);

  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext("2d")!;
  const gradient = shadowContext.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, "rgba(26,58,34,.27)");
  gradient.addColorStop(0.5, "rgba(26,58,34,.14)");
  gradient.addColorStop(1, "rgba(26,58,34,0)");
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const contactMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  function shadow(
    parent: THREE.Object3D,
    radius: number,
    x = 0,
    z = 0,
    y = 0.015,
  ) {
    const shape = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 2, radius * 2),
      contactMaterial,
    );
    shape.raycast = () => {};
    shape.rotation.x = -Math.PI / 2;
    shape.position.set(x, y, z);
    parent.add(shape);
  }

  // Softly curved footpaths avoid the hard rectangular grids of an editor map.
  function path(points: THREE.Vector3[], width: number) {
    const curve = new THREE.CatmullRomCurve3(points);
    const left: THREE.Vector2[] = [],
      right: THREE.Vector2[] = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36,
        point = curve.getPoint(t),
        tangent = curve.getTangent(t);
      left.push(
        new THREE.Vector2(
          point.x - tangent.z * width,
          -point.z - tangent.x * width,
        ),
      );
      right.push(
        new THREE.Vector2(
          point.x + tangent.z * width,
          -point.z + tangent.x * width,
        ),
      );
    }
    const shape = new THREE.Shape([...left, ...right.reverse()]);
    const object = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      mat(palette.path),
    );
    object.rotation.x = -Math.PI / 2;
    object.position.y = 0.672;
    object.receiveShadow = true;
    scene.add(object);
  }
  path(
    [
      new THREE.Vector3(5, 0, 7),
      new THREE.Vector3(2.5, 0, 4.6),
      new THREE.Vector3(0.5, 0, 2.8),
      new THREE.Vector3(-1.8, 0, 0.8),
    ],
    0.58,
  );
  path(
    [
      new THREE.Vector3(1.3, 0, 3.5),
      new THREE.Vector3(3.7, 0, 3),
      new THREE.Vector3(4.3, 0, 1.6),
    ],
    0.48,
  );
  path(
    [
      new THREE.Vector3(-0.4, 0, 2),
      new THREE.Vector3(-3.7, 0, 2.2),
      new THREE.Vector3(-6.8, 0, 2.6),
    ],
    0.34,
  );

  const nodes: ResourceNode[] = [];
  function tree(
    x: number,
    z: number,
    scale: number,
    region = "harbor",
    evergreen = true,
  ) {
    const group = new THREE.Group();
    group.position.set(x, 0.67, z);
    group.scale.setScalar(scale);
    shadow(group, 1.25);
    const trunk = cylinder(
      group,
      palette.wood,
      [0, 0.83, 0],
      [0.22, 1.66, 0.22],
    );
    trunk.rotation.z = 0.06;
    const branch = cylinder(
      group,
      palette.wood,
      [0.22, 1.2, 0],
      [0.09, 0.8, 0.09],
    );
    branch.rotation.z = -0.65;
    if (evergreen) {
      for (let i = 0; i < 3; i++) {
        const cone = mesh(
          coneGeometry,
          [palette.leafDark, palette.leaf, palette.leafLight][i],
          group,
          [0, 1.5 + i * 0.65, 0],
          [1.16 - i * 0.24, 1.65, 1.07 - i * 0.22],
        );
        cone.rotation.y = i * 0.35;
        const cap = mesh(
          coneGeometry,
          i === 2 ? "#f1f7fa" : "#d5e6ef",
          group,
          [0, 1.72 + i * 0.65, 0],
          [1.02 - i * 0.215, 1.45, 0.94 - i * 0.197],
        );
        cap.rotation.y = i * 0.35;
      }
    } else {
      const shade = [palette.leafLight, palette.leaf, "#74a35b"][
        Math.floor(random() * 3)
      ];
      ball(group, palette.leafDark, [0, 1.85, 0.05], [1.02, 0.8, 0.95]);
      ball(group, shade, [-0.55, 2.3, 0.1], [0.89, 0.94, 0.82]);
      ball(group, shade, [0.52, 2.42, 0.1], [0.89, 1.02, 0.88]);
      ball(group, palette.leafLight, [0, 2.94, -0.12], [0.76, 0.86, 0.76]);
      ball(group, shade, [0.05, 2.35, -0.53], [0.82, 0.81, 0.75]);
    }
    group.rotation.y = random() * Math.PI * 2;
    group.visible = region === "harbor";
    scene.add(group);
    nodes.push({
      group,
      resource: "wood",
      position: group.position.clone(),
      hits: 0,
      depletedUntil: 0,
      baseScale: scale,
      region,
      sway: random() * 6,
    });
    return group;
  }
  tree(-1.6, -4.65, 0.93);
  tree(1.1, -5.1, 1.06);
  tree(4.4, -4.6, 0.96);
  tree(7.4, -2.2, 0.92);
  tree(7.7, 0.4, 0.73);
  tree(6.4, 4.7, 0.8);
  tree(1.8, -3.9, 0.8, "pinewood");
  tree(6.2, -4.2, 1.08, "pinewood");
  tree(7.7, -1.3, 0.95, "glacier");
  // Frosty firs on the opposite bank frame the moving tuna below.
  const leftBank = box(scene, "#e2edf2", [-14, -0.22, -1], [11, 1.5, 32]);
  leftBank.receiveShadow = true;
  for (const [x, z, h] of [
    [-10.1, -5, 1.5],
    [-12, -3, 1.3],
    [-11.2, 1, 1.1],
    [-10.4, 5.5, 1.25],
    [-12.6, 6.4, 1.4],
    [-9.8, -8, 1.2],
  ]) {
    const pine = tree(x, z, h);
    pine.visible = true;
    nodes.pop();
  }
  function fishingSpot(
    x: number,
    z: number,
    resource: "fish" | "salmon",
    region = "harbor",
  ) {
    const group = new THREE.Group();
    group.position.set(x, 0.77, z);
    const color = resource === "fish" ? "#f4cb68" : "#f3a89d";
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.065, 7, 32),
      mat(color),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.055;
    group.add(ring);
    const float = ball(
      group,
      color,
      [-0.6, 0.25, -0.07],
      [0.1, 0.16, 0.1],
      true,
    );
    float.userData.float = true;
    const signpost = cylinder(
      group,
      "#b58a57",
      [0.24, 0.4, -0.6],
      [0.045, 0.8, 0.045],
    );
    const emblem = box(
      group,
      "#426d7e",
      [0.24, 0.82, -0.6],
      [0.65, 0.44, 0.09],
    );
    emblem.rotation.y = 0.2;
    const smallFish = ball(
      group,
      "#e8f1e7",
      [0.24, 0.82, -0.535],
      [0.19, 0.08, 0.025],
      true,
    );
    smallFish.rotation.y = 0.2;
    group.visible = region === "harbor";
    scene.add(group);
    nodes.push({
      group,
      resource,
      position: group.position.clone(),
      hits: 0,
      depletedUntil: 0,
      baseScale: 1,
      region,
      sway: random() * 6,
    });
  }
  fishingSpot(-3.45, 2.7, "fish");
  fishingSpot(-3.45, -2.8, "salmon");
  fishingSpot(-3.45, 4.7, "salmon", "salmonrun");
  fishingSpot(-3.45, -4.3, "fish", "frostlake");
  fishingSpot(5.8, 5.2, "salmon", "moonlit");
  fishingSpot(-3.45, -5.5, "fish", "glacier");

  // A timber harbor floor, broad enough to carry fish from the river to the shop.
  const platform = new THREE.Group();
  platform.position.set(0.7, 0.14, 2.25);
  scene.add(platform);
  box(platform, "#957052", [0, 0.28, 0], [9.15, 0.48, 6.4]);
  for (let i = 0; i < 25; i++) {
    const plank = box(
      platform,
      i % 3 === 0 ? "#b58a6e" : i % 3 === 1 ? "#bf9476" : "#c29b80",
      [0, 0.56, -3.08 + i * 0.255],
      [9.12, 0.12, 0.245],
    );
    plank.receiveShadow = true;
  }
  for (const x of [-4.55, 4.55])
    box(platform, "#d0a582", [x, 0.6, 0], [0.1, 0.17, 6.45]);
  for (const x of [-4.3, 4.3])
    for (const z of [-2.8, 2.8])
      cylinder(platform, "#8d694c", [x, -0.08, z], [0.18, 1.25, 0.18]);
  function palisade(x: number, z: number, length: number, alongX: boolean) {
    const fence = new THREE.Group();
    fence.position.set(x, 0.62, z);
    scene.add(fence);
    const count = Math.round(length / 0.23);
    for (let i = 0; i < count; i++) {
      const h = 1.05 + Math.sin(i * 0.8) * 0.04;
      const offset = (i - (count - 1) / 2) * 0.23;
      cylinder(
        fence,
        i % 2 ? "#c48c5a" : "#d39864",
        [alongX ? offset : 0, h / 2, alongX ? 0 : offset],
        [0.115, h, 0.115],
      );
      mesh(
        coneGeometry,
        "#e2b17a",
        fence,
        [alongX ? offset : 0, h + 0.1, alongX ? 0 : offset],
        [0.115, 0.2, 0.115],
      );
    }
    box(
      fence,
      "#997149",
      [0, 0.45, 0],
      alongX ? [length, 0.09, 0.09] : [0.09, 0.09, length],
    );
  }
  palisade(-1.5, 5.55, 4.6, true);
  palisade(4.1, 5.55, 2.2, true);
  palisade(5.4, 4.25, 2.5, false);
  palisade(0.9, -0.97, 3.3, true);
  // Two little bridge boards bring the fishing spots right to the river edge.
  for (const z of [2.7, -2.8]) {
    const pier = new THREE.Group();
    pier.position.set(-3.8, 0.14, z);
    scene.add(pier);
    for (let i = 0; i < 5; i++)
      box(pier, "#bf9161", [-0.12 - i * 0.22, 0.52, 0], [0.21, 0.14, 1.1]);
    for (const dz of [-0.46, 0.46])
      cylinder(pier, "#9e7750", [-1, 0.07, dz], [0.09, 1.1, 0.09]);
  }

  const fishes: THREE.Group[] = [];
  function tuna(x: number, z: number, scale: number, salmon = false) {
    const fish = new THREE.Group();
    fish.position.set(x, -0.28, z);
    fish.scale.setScalar(scale);
    const back = salmon ? "#8b94a4" : "#174d92";
    const side = salmon ? "#d9a7a3" : "#70bed5";
    ball(fish, back, [0, 0, 0], [0.57, 0.36, 1.53], true);
    ball(fish, side, [0, -0.07, 0.11], [0.55, 0.29, 1.35], true);
    ball(fish, "#e5edf0", [0, -0.18, 0.24], [0.46, 0.19, 1.19], true);
    // Thin blue dorsal crest and silvery pectoral fins.
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(-0.08, 0.62);
    dorsalShape.lineTo(0.65, 0);
    const dorsal = new THREE.Mesh(
      new THREE.ShapeGeometry(dorsalShape),
      new THREE.MeshStandardMaterial({ color: back, side: THREE.DoubleSide }),
    );
    dorsal.position.set(0, 0.27, -0.3);
    dorsal.rotation.y = Math.PI / 2;
    fish.add(dorsal);
    for (const sideSign of [-1, 1]) {
      const fin = box(
        fish,
        back,
        [sideSign * 0.58, -0.06, 0.1],
        [0.65, 0.045, 0.25],
      );
      fin.rotation.y = sideSign * 0.5;
      ball(
        fish,
        "#f0f4eb",
        [sideSign * 0.39, 0.08, 1.01],
        [0.135, 0.145, 0.1],
        true,
      );
      ball(
        fish,
        "#182a45",
        [sideSign * 0.43, 0.08, 1.075],
        [0.075, 0.09, 0.04],
        true,
      );
      ball(
        fish,
        "#ffffff",
        [sideSign * 0.45, 0.12, 1.11],
        [0.025, 0.03, 0.02],
        true,
      );
    }
    const tail = new THREE.Group();
    tail.name = "tail";
    tail.position.z = -1.3;
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(-0.75, -0.85);
    tailShape.lineTo(0, -0.57);
    tailShape.lineTo(0.75, -0.85);
    tailShape.closePath();
    const tailMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(tailShape, {
        depth: 0.065,
        bevelEnabled: false,
      }),
      mat(back),
    );
    tailMesh.rotation.x = Math.PI / 2;
    tail.add(tailMesh);
    fish.add(tail);
    fish.userData.basePosition = fish.position.clone();
    fishes.push(fish);
    scene.add(fish);
    fish.userData.resource = salmon ? "salmon" : "fish";
    return fish;
  }
  tuna(-6.35, 2.25, 1.18);
  tuna(-6.5, -3.9, 1.03);
  tuna(-6.2, 8.6, 0.88, true);

  const customers: THREE.Group[] = [];
  function customer(x: number, z: number, index: number) {
    const group = new THREE.Group();
    group.position.set(x, 0.62, z);
    group.rotation.y = Math.PI * 0.8;
    shadow(group, 0.48);
    for (const lx of [-0.12, 0.12]) {
      cylinder(group, "#3d5160", [lx, 0.2, 0], [0.095, 0.4, 0.095]);
      ball(group, "#394c58", [lx, 0.04, 0.06], [0.12, 0.08, 0.15], true);
    }
    cylinder(
      group,
      index % 2 ? "#e8c969" : "#d9b953",
      [0, 0.67, 0],
      [0.245, 0.58, 0.21],
    );
    for (const lx of [-0.29, 0.29])
      cylinder(group, "#eed375", [lx, 0.65, 0], [0.08, 0.4, 0.08]);
    ball(group, "#e9c6aa", [0, 1.06, 0], [0.205, 0.23, 0.2], true);
    cylinder(group, "#f0f0df", [0, 1.23, 0], [0.23, 0.13, 0.22]);
    ball(group, "#fbfbec", [0, 1.34, 0], [0.075, 0.075, 0.075], true);
    box(
      group,
      index % 2 ? "#a8c0c8" : "#e7e9dd",
      [0, 0.88, 0.05],
      [0.43, 0.09, 0.2],
    );
    for (const lx of [-0.07, 0.07])
      ball(group, "#3b4851", [lx, 1.08, 0.19], [0.02, 0.026, 0.01], true);
    customers.push(group);
    scene.add(group);
  }
  customer(5.85, 2.2, 0);
  customer(5.9, 3.35, 1);
  customer(6.1, 4.5, 2);
  const obstacles = [
    { x: -2, z: -0.65, width: 3.45, depth: 2.7 },
    { x: 4.2, z: 1.15, width: 3.15, depth: 2.7 },
  ];
  const isWalkable = (x: number, z: number) =>
    x >= -3.72 && (x * x) / 90 + (z * z) / 49 < 1;

  const cottage = new THREE.Group();
  cottage.position.set(-2, 0.67, -0.65);
  cottage.rotation.y = -0.12;
  cottage.userData.kind = "cottage";
  scene.add(cottage);
  shadow(cottage, 3.2, 0, 0.3);
  box(cottage, "#bca67c", [0, 0.1, 0], [3.9, 0.22, 3.1]);
  box(cottage, palette.cream, [0, 1.15, 0], [3.35, 2.15, 2.6]);
  box(cottage, "#e3d1ac", [0, 0.35, 1.315], [3.4, 0.32, 0.08]);
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-2, 0);
  roofShape.lineTo(0, 1.36);
  roofShape.lineTo(2, 0);
  roofShape.lineTo(-2, 0);
  const roof = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roofShape, {
      depth: 3.35,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.035,
      bevelThickness: 0.04,
    }),
    mat("#dceaf0"),
  );
  roof.position.set(0, 2.18, -1.7);
  roof.castShadow = roof.receiveShadow = true;
  cottage.add(roof);
  // Terracotta ridges and timber fascia give the roof a crafted, toy-like finish.
  for (let i = 0; i < 7; i++) {
    const ridge = cylinder(
      cottage,
      "#f5f8f6",
      [0, 3.53, -1.58 + i * 0.51],
      [0.105, 0.53, 0.105],
    );
    ridge.rotation.x = Math.PI / 2;
  }
  const fasciaL = box(
    cottage,
    "#e5b075",
    [-0.99, 2.86, 1.73],
    [2.45, 0.14, 0.13],
  );
  fasciaL.rotation.z = 0.596;
  const fasciaR = box(
    cottage,
    "#e5b075",
    [0.99, 2.86, 1.73],
    [2.45, 0.14, 0.13],
  );
  fasciaR.rotation.z = -0.596;
  box(cottage, "#b27e54", [0, 2.14, 1.36], [3.5, 0.14, 0.12]);
  for (const x of [-1.6, 1.6])
    box(cottage, "#b49063", [x, 1.12, 1.35], [0.14, 2.1, 0.12]);
  // Sea-green cottage door with brass knob and a shallow front step.
  box(cottage, "#6b8f7c", [0.45, 0.82, 1.345], [0.85, 1.54, 0.12]);
  box(cottage, "#c5ab7b", [0.45, 1.62, 1.42], [1, 0.12, 0.15]);
  ball(cottage, "#e5bc65", [0.72, 0.81, 1.44], [0.06, 0.06, 0.06], true);
  box(cottage, "#d0bb8e", [0.45, 0.14, 1.65], [1.17, 0.24, 0.63]);
  function windowAt(x: number, y: number, z: number) {
    box(cottage, "#aa8058", [x, y, z], [0.91, 0.98, 0.11]);
    box(cottage, "#9bc1b3", [x, y, z + 0.065], [0.7, 0.76, 0.04]);
    box(cottage, palette.cream, [x, y, z + 0.1], [0.06, 0.81, 0.06]);
    box(cottage, palette.cream, [x, y, z + 0.1], [0.75, 0.06, 0.06]);
    box(cottage, "#bd885b", [x, y - 0.54, z + 0.16], [1, 0.17, 0.35]);
    for (let i = 0; i < 3; i++)
      ball(
        cottage,
        "#749756",
        [x - 0.25 + i * 0.25, y - 0.39, z + 0.2],
        [0.2, 0.18, 0.18],
      );
  }
  windowAt(-0.95, 1.25, 1.34);
  const roundWindow = cylinder(
    cottage,
    "#e9ce9a",
    [0, 2.75, 1.7],
    [0.27, 0.1, 0.27],
  );
  roundWindow.rotation.x = Math.PI / 2;
  const glass = cylinder(
    cottage,
    "#81afa4",
    [0, 2.75, 1.77],
    [0.18, 0.1, 0.18],
  );
  glass.rotation.x = Math.PI / 2;
  box(cottage, "#aa8061", [0.9, 3.12, -0.6], [0.48, 1.25, 0.55]);
  box(cottage, "#d7bb91", [0.9, 3.78, -0.6], [0.65, 0.17, 0.7]);
  const smoke = new THREE.Group();
  smoke.position.set(-1.15, 4.55, -1.25);
  for (let i = 0; i < 3; i++) {
    const puff = ball(
      smoke,
      "#e9edd8",
      [i * 0.26, i * 0.37, 0],
      [0.22 + i * 0.09, 0.22 + i * 0.07, 0.22 + i * 0.09],
      true,
    );
    (puff.material as THREE.MeshStandardMaterial).transparent = true;
    (puff.material as THREE.MeshStandardMaterial).opacity = 0.6;
    puff.castShadow = false;
  }
  scene.add(smoke);

  const market = new THREE.Group();
  market.position.set(4.2, 0.67, 1.15);
  market.rotation.y = -0.12;
  market.userData.kind = "market";
  scene.add(market);
  shadow(market, 2.3);
  for (const x of [-1.35, 1.35])
    for (const z of [-0.75, 0.75])
      cylinder(market, palette.wood, [x, 1.18, z], [0.065, 2.36, 0.065]);
  box(market, palette.wood, [0, 0.72, 0.45], [2.9, 0.82, 1.2]);
  for (let i = 0; i < 8; i++)
    box(
      market,
      i % 2 ? "#bd9260" : "#c89e6b",
      [-1.27 + i * 0.36, 0.77, 1.06],
      [0.34, 0.84, 0.045],
    );
  box(market, "#e4bc7d", [0, 1.18, 0.45], [3.1, 0.13, 1.4]);
  // Each awning stripe follows a genuinely curved canopy.
  for (let stripe = 0; stripe < 9; stripe++) {
    const positions: number[] = [],
      indices: number[] = [];
    const x = -1.58 + stripe * 0.35;
    for (let k = 0; k <= 10; k++) {
      const t = k / 10,
        z = -1 + t * 2.5,
        y = 2.48 + Math.sin(t * Math.PI) * 0.26 - t * 0.3;
      positions.push(x, y, z, x + 0.35, y, z);
      if (k < 10) {
        const n = k * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const canopy = new THREE.Mesh(
      geometry,
      mat(stripe % 2 ? palette.cream : "#5791aa"),
    );
    canopy.material.side = THREE.DoubleSide;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    market.add(canopy);
    box(
      market,
      stripe % 2 ? palette.cream : "#5791aa",
      [x + 0.175, 2.1, 1.5],
      [0.35, 0.25, 0.06],
    );
    const scallop = ball(
      market,
      stripe % 2 ? palette.cream : "#5791aa",
      [x + 0.175, 1.99, 1.5],
      [0.175, 0.1, 0.035],
      true,
    );
    scallop.castShadow = false;
  }
  for (const x of [-0.94, 0, 0.94]) {
    box(market, "#866242", [x, 1.33, 0.46], [0.82, 0.22, 0.85]);
    for (let i = 0; i < 5; i++)
      ball(
        market,
        x < -0.2 ? "#7bacc8" : x > 0.2 ? "#b4cedb" : "#c98780",
        [
          x + (i % 2) * 0.23 - 0.1,
          1.55 + Math.floor(i / 3) * 0.12,
          0.22 + Math.floor(i / 2) * 0.2,
        ],
        [0.15, 0.14, 0.15],
        true,
      );
  }
  function crate(parent: THREE.Object3D, x: number, z: number, size = 0.6) {
    box(parent, "#a47d4f", [x, size / 2, z], [size, size, size]);
    for (const y of [0.08, 0.45])
      box(
        parent,
        "#c79d63",
        [x, y, z + size / 2 + 0.01],
        [size + 0.04, 0.07, 0.06],
      );
    box(
      parent,
      "#d8ad71",
      [x, size / 2, z + size / 2 + 0.04],
      [0.06, size, 0.04],
    );
  }
  crate(market, -2.05, 0.6, 0.7);
  crate(market, -1.94, -0.2, 0.56);
  const sign = box(market, "#497765", [0, 2.68, -0.95], [1.2, 0.36, 0.09]);
  sign.userData.sign = true;
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 128;
  const signContext = signCanvas.getContext("2d")!;
  signContext.fillStyle = "#315f73";
  signContext.fillRect(0, 0, 512, 128);
  signContext.strokeStyle = "#d9d9ba";
  signContext.lineWidth = 8;
  signContext.strokeRect(9, 9, 494, 110);
  signContext.fillStyle = "#fff3d3";
  signContext.font = "bold 54px Georgia,serif";
  signContext.textAlign = "center";
  signContext.textBaseline = "middle";
  signContext.fillText("FRESH FISH", 256, 66);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.45),
    new THREE.MeshBasicMaterial({ map: signTexture }),
  );
  signFace.position.set(0, 2.28, 1.56);
  market.add(signFace);

  // Dock, mooring posts, and tiny sailboat make the island feel connected.
  const dock = new THREE.Group();
  dock.position.set(5, -0.05, 8.6);
  scene.add(dock);
  for (let i = 0; i < 12; i++)
    box(
      dock,
      i % 2 ? "#ba9468" : "#c49e70",
      [0, 0.2, -2 + i * 0.37],
      [1.7, 0.14, 0.34],
    );
  for (const x of [-0.75, 0.75])
    for (const z of [-1.7, 0.1, 1.9]) {
      cylinder(dock, "#8e7150", [x, -0.05, z], [0.095, 1.4, 0.095]);
      cylinder(dock, "#ddc59b", [x, 0.65, z], [0.13, 0.11, 0.13]);
    }
  box(dock, "#83664a", [-0.65, -0.05, 0.1], [0.1, 0.15, 4.6]);
  box(dock, "#83664a", [0.65, -0.05, 0.1], [0.1, 0.15, 4.6]);
  const boat = new THREE.Group();
  boat.position.set(-6.4, -0.23, 8.3);
  boat.rotation.y = -0.55;
  scene.add(boat);
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-0.65, -0.95);
  hullShape.quadraticCurveTo(-0.98, 0.15, 0, 1.55);
  hullShape.quadraticCurveTo(0.98, 0.15, 0.65, -0.95);
  hullShape.quadraticCurveTo(0, -1.35, -0.65, -0.95);
  const hull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.38,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelThickness: 0.12,
      bevelSize: 0.12,
    }),
    mat("#487b75"),
  );
  hull.rotation.x = -Math.PI / 2;
  hull.castShadow = true;
  boat.add(hull);
  const deck = new THREE.Mesh(
    new THREE.ShapeGeometry(hullShape),
    mat("#d5b589"),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.51;
  deck.scale.setScalar(0.85);
  boat.add(deck);
  cylinder(boat, "#96744e", [0, 2.1, -0.05], [0.055, 3.3, 0.055]);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0.1, 0.9);
  sailShape.lineTo(0.1, 3.65);
  sailShape.quadraticCurveTo(1.05, 2.4, 1.4, 0.9);
  sailShape.lineTo(0.1, 0.9);
  const sail = new THREE.Mesh(
    new THREE.ShapeGeometry(sailShape),
    new THREE.MeshStandardMaterial({
      color: "#fff1ce",
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  sail.position.z = -0.05;
  sail.rotation.y = -0.25;
  sail.castShadow = true;
  boat.add(sail);
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.61, -0.14);
  flagShape.lineTo(0, -0.32);
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(flagShape),
    new THREE.MeshStandardMaterial({
      color: "#c57a54",
      side: THREE.DoubleSide,
    }),
  );
  flag.position.set(0, 3.85, -0.05);
  boat.add(flag);
  cylinder(boat, "#eddfb8", [0, 0.65, -0.95], [0.19, 0.3, 0.19]);

  // Scattered detail is instanced: a rich ground plane with very few draw calls.
  const blades = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.035, 0.22, 3),
    mat("#f3f7f7"),
    380,
  );
  const blossoms = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.045, 5, 4),
    mat("#f6fafc"),
    110,
  );
  const fieldStones = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.12, 0),
    mat("#bbcfd8"),
    65,
  );
  const dummy = new THREE.Object3D();
  function fieldPoint() {
    let x = 0,
      z = 0;
    for (let attempt = 0; attempt < 50; attempt++) {
      x = (random() - 0.5) * 18.5;
      z = (random() - 0.5) * 13.5;
      const inside = x > -3.65 && (x * x) / 88 + (z * z) / 47 < 1;
      const house = x > -4.3 && x < 0.2 && z > -2.6 && z < 1.9;
      const marketZone = x > 2.4 && x < 6 && z > -0.2 && z < 3.4;
      const pathZone =
        Math.abs(z - 0.8 * x - 2.9) < 0.9 ||
        (Math.abs(z - 2.4) < 0.65 && x < 4.6 && x > -7);
      if (inside && !house && !marketZone && !pathZone) break;
    }
    return [x, z];
  }
  for (let i = 0; i < 380; i++) {
    const [x, z] = fieldPoint();
    dummy.position.set(x, 0.72, z);
    dummy.rotation.set(
      (random() - 0.5) * 0.5,
      random() * 6,
      (random() - 0.5) * 0.5,
    );
    dummy.scale.setScalar(0.6 + random() * 0.8);
    dummy.updateMatrix();
    blades.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 110; i++) {
    const [x, z] = fieldPoint();
    dummy.position.set(x, 0.81, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.7 + random() * 0.7);
    dummy.updateMatrix();
    blossoms.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < 65; i++) {
    const [x, z] = fieldPoint();
    dummy.position.set(x, 0.7, z);
    dummy.rotation.set(random(), random() * 6, random());
    dummy.scale.set(0.5 + random(), 0.2 + random() * 0.6, 0.5 + random());
    dummy.updateMatrix();
    fieldStones.setMatrixAt(i, dummy.matrix);
  }
  blades.receiveShadow =
    blossoms.receiveShadow =
    fieldStones.receiveShadow =
      true;
  scene.add(blades, blossoms, fieldStones);
  // Tiny free-standing ferns around the edge of the wood.
  for (let i = 0; i < 11; i++) {
    const [x, z] = fieldPoint();
    const fern = new THREE.Group();
    fern.position.set(x, 0.67, z);
    for (let k = 0; k < 3; k++) {
      const leaf = ball(
        fern,
        "#c5dce4",
        [Math.sin(k * 2.1) * 0.14, 0.13, Math.cos(k * 2.1) * 0.14],
        [0.13, 0.35, 0.08],
      );
      leaf.rotation.z = Math.sin(k * 2.1) * 0.7;
      leaf.rotation.x = Math.cos(k * 2.1) * 0.7;
    }
    scene.add(fern);
  }
  // Beach pebbles and tide lines.
  for (let i = 0; i < 14; i++) {
    const a = random() * Math.PI * 2;
    const rock = ball(
      scene,
      "#edf5f8",
      [Math.cos(a) * 10.4, 0.12, Math.sin(a) * 8.1],
      [0.11 + random() * 0.16, 0.1, 0.15 + random() * 0.18],
    );
    rock.castShadow = false;
  }
  const tideGeometry = new THREE.RingGeometry(1, 1.015, 100);
  const tideMaterial = new THREE.MeshBasicMaterial({
    color: "#d8f0dd",
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 1; i++) {
    const ripple = new THREE.Mesh(tideGeometry, tideMaterial);
    ripple.rotation.x = -Math.PI / 2;
    ripple.scale.set(11.5 + i * 0.48, 9 + i * 0.35, 1);
    ripple.position.y = -0.53 + i * 0.002;
    scene.add(ripple);
  }
  const sparkles = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.1, 0.48),
    new THREE.MeshBasicMaterial({
      color: "#d7f6e9",
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    75,
  );
  for (let i = 0; i < 75; i++) {
    dummy.position.set(-4.5 - random() * 3.5, -0.5, (random() - 0.5) * 32);
    dummy.rotation.set(-Math.PI / 2, 0, random() * 0.4);
    dummy.scale.set(1, 0.5 + random() * 2, 1);
    dummy.updateMatrix();
    sparkles.setMatrixAt(i, dummy.matrix);
  }
  scene.add(sparkles);

  const player = new THREE.Group();
  player.position.set(0.1, 0.67, 3.7);
  scene.add(player);
  const limbs: THREE.Object3D[] = [];
  shadow(player, 0.5);
  const trouser = "#375365",
    skin = "#eac6a0";
  for (const x of [-0.14, 0.14]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.53, 0);
    player.add(pivot);
    cylinder(pivot, trouser, [0, -0.19, 0], [0.115, 0.38, 0.115]);
    ball(pivot, "#695748", [0, -0.39, 0.07], [0.13, 0.09, 0.2], true);
    limbs.push(pivot);
  }
  cylinder(player, "#358fa8", [0, 0.75, 0], [0.28, 0.54, 0.22]);
  ball(player, "#61a9ba", [0, 1.02, 0], [0.28, 0.16, 0.23], true);
  for (const x of [-0.32, 0.32]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.94, 0);
    player.add(pivot);
    cylinder(pivot, "#358fa8", [0, -0.1, 0], [0.11, 0.24, 0.11]);
    cylinder(pivot, skin, [0, -0.29, 0], [0.075, 0.2, 0.075]);
    ball(pivot, skin, [0, -0.41, 0.02], [0.09, 0.1, 0.085], true);
    limbs.push(pivot);
  }
  ball(player, skin, [0, 1.27, 0], [0.245, 0.27, 0.23], true);
  ball(player, "#6f5540", [0, 1.38, -0.1], [0.25, 0.23, 0.19], true);
  ball(player, skin, [0, 1.25, 0.04], [0.23, 0.23, 0.22], true);
  for (const x of [-0.085, 0.085])
    ball(player, "#4c4d3b", [x, 1.29, 0.246], [0.025, 0.035, 0.015], true);
  cylinder(player, "#f0f0dc", [0, 1.5, 0], [0.27, 0.2, 0.25]);
  ball(player, "#faf8ed", [0, 1.66, 0], [0.1, 0.1, 0.1], true);
  box(player, "#d98b68", [0, 1.04, 0.1], [0.48, 0.1, 0.25]);
  const brim = cylinder(
    player,
    "#e6ebd9",
    [0, 1.45, 0.065],
    [0.34, 0.045, 0.33],
  );
  brim.rotation.x = -0.08;
  box(player, "#af7e4d", [0, 0.78, -0.26], [0.35, 0.44, 0.2]);
  box(player, "#d7ae66", [0, 0.93, -0.38], [0.37, 0.12, 0.06]);
  for (const x of [-0.19, 0.19])
    box(player, "#997443", [x, 0.85, -0.12], [0.04, 0.36, 0.08]);

  const birds: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const bird = new THREE.Group();
    bird.position.set(-7 + i * 1.2, 6.4 + i * 0.4, -1 - i * 0.7);
    for (const side of [-1, 1]) {
      const wing = box(
        bird,
        "#fff3d7",
        [side * 0.19, 0, 0],
        [0.4, 0.035, 0.12],
      );
      wing.rotation.z = side * 0.23;
    }
    ball(bird, "#ece9d7", [0, -0.03, 0.02], [0.12, 0.08, 0.18], true);
    bird.userData.basePosition = bird.position.clone();
    birds.push(bird);
    scene.add(bird);
  }
  const clouds: THREE.Group[] = [smoke];
  for (let i = 0; i < 2; i++) {
    const cloud = new THREE.Group();
    cloud.position.set(i === 0 ? -13 : 12, 8 + i, -9 - i * 3);
    for (let j = 0; j < 4; j++) {
      const puff = ball(
        cloud,
        "#e7f0d9",
        [j * 0.65, Math.sin(j * 2) * 0.15, 0],
        [0.78, 0.38 + (j % 2) * 0.2, 0.5],
        true,
      );
      puff.castShadow = false;
    }
    cloud.userData.basePosition = cloud.position.clone();
    clouds.push(cloud);
    scene.add(cloud);
  }
  const decorations: THREE.Group[] = [];
  // Unlocks add a tiny piece of island life as well as new harvest nodes.
  const orchard = new THREE.Group();
  orchard.position.set(7.3, 0.67, 1.8);
  orchard.userData.region = "salmonrun";
  orchard.visible = false;
  for (let i = 0; i < 3; i++) {
    box(orchard, "#b3cddd", [i * 0.45, 0.03, 0], [0.35, 0.05, 1.25]);
    for (let j = 0; j < 3; j++)
      ball(
        orchard,
        "#789fb7",
        [i * 0.45, 0.15, -0.4 + j * 0.4],
        [0.19, 0.15, 0.18],
      );
  }
  scene.add(orchard);
  decorations.push(orchard);
  const quarryCart = new THREE.Group();
  quarryCart.position.set(7.2, 0.67, 3.8);
  quarryCart.userData.region = "frostlake";
  quarryCart.visible = false;
  box(quarryCart, "#99764b", [0, 0.45, 0], [0.95, 0.5, 1.25]);
  for (const x of [-0.52, 0.52])
    for (const z of [-0.35, 0.35]) {
      const wheel = cylinder(
        quarryCart,
        "#655d49",
        [x, 0.2, z],
        [0.2, 0.1, 0.2],
      );
      wheel.rotation.z = Math.PI / 2;
    }
  ball(quarryCart, "#9fa595", [0, 0.84, 0], [0.42, 0.35, 0.47]);
  scene.add(quarryCart);
  decorations.push(quarryCart);
  const processing = new THREE.Group();
  processing.position.set(4.3, 0.67, -3.1);
  processing.userData.region = "moonlit";
  processing.visible = false;
  box(processing, "#527e92", [0, 0.65, 0], [1.25, 1.25, 1.45]);
  box(processing, "#e5edf0", [0, 1.34, 0], [1.4, 0.16, 1.6]);
  box(processing, "#294f67", [0, 0.85, 0.74], [0.83, 0.45, 0.05]);
  cylinder(processing, "#b9cad5", [-0.35, 1.75, -0.35], [0.12, 0.7, 0.12]);
  ball(processing, "#e2b96a", [0.34, 0.85, 0.81], [0.09, 0.09, 0.04], true);
  scene.add(processing);
  decorations.push(processing);
  const lantern = new THREE.Group();
  lantern.position.set(6.7, 0.67, -1);
  lantern.userData.region = "glacier";
  lantern.visible = false;
  cylinder(lantern, "#9c7c57", [0, 1.25, 0], [0.07, 2.5, 0.07]);
  box(lantern, "#b79962", [0, 2.55, 0], [0.54, 0.12, 0.54]);
  box(lantern, "#f6dd9a", [0, 2.29, 0], [0.33, 0.42, 0.33]);
  const lanternLight = new THREE.PointLight("#ffdaa0", 1.2, 4);
  lanternLight.position.y = 2.25;
  lantern.add(lanternLight);
  scene.add(lantern);
  decorations.push(lantern);

  const upgradeDecorations: World["upgradeDecorations"] = {
    market: [],
    workshop: [],
    crew: [],
  };
  const createUpgrade = (
    kind: keyof World["upgradeDecorations"],
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = scene,
  ) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.visible = false;
    parent.add(group);
    upgradeDecorations[kind].push(group);
    return group;
  };
  const goods = createUpgrade("market", -1.98, 0, -0.7, market);
  crate(goods, 0, 0, 0.65);
  crate(goods, 0.65, 0.1, 0.52);
  for (let i = 0; i < 3; i++)
    ball(
      goods,
      "#8eb6c8",
      [i * 0.18 - 0.15, 0.77, 0.03],
      [0.16, 0.07, 0.07],
      true,
    );
  const cash = createUpgrade("market", 0.86, 1.4, 0.75, market);
  for (let i = 0; i < 4; i++) {
    box(
      cash,
      i % 2 ? "#94b485" : "#779d72",
      [0, i * 0.055, 0],
      [0.42, 0.05, 0.28],
    );
    box(cash, "#e5dfbc", [0, i * 0.055 + 0.03, 0], [0.055, 0.01, 0.29]);
  }
  for (let i = 0; i < 3; i++)
    cylinder(
      cash,
      "#efcb72",
      [-0.32, 0.04 + i * 0.045, 0.05],
      [0.11, 0.04, 0.11],
    );
  const bunting = createUpgrade("market", 0, 2.77, 1.55, market);
  box(bunting, "#edf0df", [0, 0, 0], [3.05, 0.025, 0.025]);
  const bannerGeometry = new THREE.ShapeGeometry(
    new THREE.Shape([
      new THREE.Vector2(-0.12, 0),
      new THREE.Vector2(0.12, 0),
      new THREE.Vector2(0, -0.29),
    ]),
  );
  for (let i = 0; i < 8; i++) {
    const pennant = new THREE.Mesh(
      bannerGeometry,
      new THREE.MeshStandardMaterial({
        color: i % 2 ? "#d9a466" : "#528ca5",
        side: THREE.DoubleSide,
      }),
    );
    pennant.position.set(-1.26 + i * 0.36, -0.02, 0);
    bunting.add(pennant);
  }
  const timber = createUpgrade("workshop", 0.16, 0.67, -1.3);
  for (let i = 0; i < 6; i++) {
    const log = cylinder(
      timber,
      i % 2 ? "#a77e50" : "#bf9767",
      [(i % 3) * 0.26, 0.13 + Math.floor(i / 3) * 0.25, 0],
      [0.13, 1.05, 0.13],
    );
    log.rotation.x = Math.PI / 2;
    const end = cylinder(
      timber,
      "#e0bd82",
      [(i % 3) * 0.26, 0.13 + Math.floor(i / 3) * 0.25, 0.535],
      [0.105, 0.02, 0.105],
    );
    end.rotation.x = Math.PI / 2;
  }
  const smoker = createUpgrade("workshop", 0.75, 0.76, -0.1);
  box(smoker, "#526e7c", [0, 0.5, 0], [0.85, 1, 0.8]);
  box(smoker, "#7f9aa5", [0, 1.04, 0], [0.96, 0.12, 0.92]);
  box(smoker, "#3b4f59", [0, 0.5, 0.42], [0.62, 0.7, 0.035]);
  box(smoker, "#c7b080", [0.18, 0.5, 0.45], [0.05, 0.18, 0.05]);
  cylinder(smoker, "#91a5ae", [-0.2, 1.37, -0.2], [0.09, 0.6, 0.09]);
  const fishRack = createUpgrade("workshop", 0.55, 0.67, -2.3);
  for (const x of [-0.6, 0.6])
    box(fishRack, "#9c7750", [x, 0.65, 0], [0.09, 1.3, 0.09]);
  box(fishRack, "#b28a59", [0, 1.3, 0], [1.42, 0.1, 0.13]);
  for (let i = 0; i < 4; i++) {
    const hanging = ball(
      fishRack,
      i % 2 ? "#bf8e84" : "#9db8c6",
      [-0.45 + i * 0.3, 0.78, 0],
      [0.105, 0.4, 0.06],
      true,
    );
    hanging.rotation.z = 0.1;
  }
  for (let i = 0; i < 3; i++) {
    const shift = createUpgrade("crew", -2.25 + i * 2.8, 0.77, 3.5 - i * 0.38);
    const worker = player.clone(true);
    worker.position.set(0, 0, 0);
    worker.scale.setScalar(0.92);
    worker.rotation.y = -0.7 - i * 0.3;
    shift.add(worker);
    crate(shift, 0.65, 0.25, 0.52);
    for (let j = 0; j < 2; j++)
      box(shift, "#c9d9de", [0.65, 0.58 + j * 0.09, 0.25], [0.38, 0.08, 0.38]);
    shift.userData.worker = true;
  }
  function lockedPad(
    id: string,
    name: string,
    requiredLevel: number,
    x: number,
    z: number,
  ) {
    const group = new THREE.Group();
    group.position.set(x, 0.7, z);
    group.userData.lockedRegion = id;
    group.userData.regionId = id;
    group.userData.kind = "region";
    group.userData.openMap = true;
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.68, 40),
      new THREE.MeshBasicMaterial({
        color: "#e7c477",
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.025;
    group.add(glow);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.67, 0.035, 5, 40),
      mat("#ebc977"),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);
    const coin = cylinder(group, "#e4bd62", [0, 0.23, 0], [0.18, 0.09, 0.18]);
    coin.rotation.x = Math.PI / 2;
    const badgeCanvas = document.createElement("canvas");
    badgeCanvas.width = 512;
    badgeCanvas.height = 128;
    const context = badgeCanvas.getContext("2d")!;
    context.fillStyle = "rgba(35,67,85,.91)";
    context.beginPath();
    context.roundRect(5, 8, 502, 108, 24);
    context.fill();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff3cd";
    context.font = "bold 36px Georgia,serif";
    context.fillText(name, 256, 47);
    context.fillStyle = "#c8dce7";
    context.font = "24px sans-serif";
    context.fillText(`UNLOCK AT LEVEL ${requiredLevel}`, 256, 87);
    const texture = new THREE.CanvasTexture(badgeCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const badge = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false }),
    );
    badge.scale.set(2.1, 0.525, 1);
    badge.position.set(0, 1, 0);
    badge.renderOrder = 5;
    group.add(badge);
    scene.add(group);
    decorations.push(group);
  }
  lockedPad("pinewood", "Pinewood Coast", 3, 3.1, -3.5);
  lockedPad("salmonrun", "Salmon Run", 6, -0.7, 5.85);
  lockedPad("frostlake", "Frost Lake", 10, -3.35, -4.2);
  lockedPad("moonlit", "Moonlight Bay", 16, 5.8, 5.1);
  lockedPad("glacier", "Glacier Reach", 24, 7.5, -1.3);

  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    scene.traverse((object) => {
      const objectMesh = object as THREE.Mesh;
      if (objectMesh.geometry) geometries.add(objectMesh.geometry);
      const array = objectMesh.material
        ? Array.isArray(objectMesh.material)
          ? objectMesh.material
          : [objectMesh.material]
        : [];
      for (const material of array) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    sun.shadow.map?.dispose();
  }
  return {
    scene,
    terrain,
    nodes,
    market,
    cottage,
    boat,
    water,
    sparkles,
    birds,
    clouds,
    player,
    limbs,
    decorations,
    fishes,
    customers,
    obstacles,
    isWalkable,
    upgradeDecorations,
    dispose,
  };
}
