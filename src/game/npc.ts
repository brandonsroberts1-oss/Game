import * as THREE from "three";
import {
  WORKERS,
  workerJobSpec,
  type GameState,
  type Resource,
  type WorkerRole,
} from "./model";
import type { World, PersonRig } from "./world";

type NPCOptions = {
  world: World;
  getGame: () => GameState;
  routeTo: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
  onWorkerStart: (role: WorkerRole) => boolean;
  onWorkerComplete: (role: WorkerRole) => boolean;
  onSellStock: (resource: Resource, quantity: number) => number;
  onNotice?: (message: string) => void;
  isOnScreen?: (position: THREE.Vector3) => boolean;
};
type WorkerState =
  | "off-duty"
  | "walking-to-work"
  | "working"
  | "carrying-to-store"
  | "unloading"
  | "waiting-supplies"
  | "warehouse-full"
  | "bringing-order"
  | "serving-customer"
  | "returning";
type Worker = {
  role: WorkerRole;
  rig: PersonRig;
  state: WorkerState;
  time: number;
  workTime: number;
  route: THREE.Vector3[];
  cargo: THREE.Group;
  tool: THREE.Group;
  props: THREE.Group;
  item: THREE.Group;
  effects: THREE.Group;
  line?: THREE.Line;
  phase: number;
  outputs: Partial<Record<Resource, number>>;
  delivered: number;
  enabled: boolean;
  order?: { resource: Resource; quantity: number };
  lastRetry: number;
};
type CustomerState =
  | "approaching-harbor"
  | "queueing"
  | "waiting"
  | "approaching-counter"
  | "inspecting"
  | "paying"
  | "leaving"
  | "outside";
type Customer = {
  id: number;
  ticket: number;
  rig: PersonRig;
  state: CustomerState;
  time: number;
  route: THREE.Vector3[];
  cargo: THREE.Group;
  wallet: THREE.Group;
  delay: number;
  entered: number;
  purchases: number;
  hasOrder: boolean;
};
type Sale = {
  mode: "player" | "porter";
  buyer: Customer;
  porter?: Worker;
  time: number;
  paid: boolean;
  order?: { resource: Resource; quantity: number };
};
const clamp = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const resources: Resource[] = [
  "meal",
  "tackle",
  "smoked",
  "steak",
  "ingot",
  "plank",
  "crab",
  "salmon",
  "fish",
  "kelp",
  "ore",
  "wood",
];
const zero = new THREE.Vector3();

/** Actor simulation owns actual walking, hands, carried goods and cash handoffs. */
export function createHarborNPCs(options: NPCOptions) {
  const { world } = options;
  let disposed = false,
    worldTime = 0,
    ticket = 0,
    activeSale: Sale | null = null;
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  ownedGeometries.add(cube);
  const sphere = new THREE.SphereGeometry(1, 10, 8);
  ownedGeometries.add(sphere);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  ownedGeometries.add(cylinder);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string) {
    if (!materials.has(color)) {
      const result = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
      materials.set(color, result);
      ownedMaterials.add(result);
    }
    return materials.get(color)!;
  }
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    color: string,
    position: number[],
    scale: number[],
  ) {
    const result = new THREE.Mesh(geometry, material(color));
    result.position.set(position[0], position[1], position[2]);
    result.scale.set(scale[0], scale[1], scale[2]);
    result.castShadow = false;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }
  const box = (
    parent: THREE.Object3D,
    color: string,
    position: number[],
    scale: number[],
  ) => mesh(parent, cube, color, position, scale);
  const ball = (
    parent: THREE.Object3D,
    color: string,
    position: number[],
    scale: number[],
  ) => mesh(parent, sphere, color, position, scale);
  const pole = (
    parent: THREE.Object3D,
    color: string,
    position: number[],
    scale: number[],
  ) => mesh(parent, cylinder, color, position, scale);
  function group(parent: THREE.Object3D) {
    const result = new THREE.Group();
    parent.add(result);
    return result;
  }
  function clear(parent: THREE.Group) {
    for (const child of [...parent.children]) parent.remove(child);
  }
  function cargoItems(
    parent: THREE.Group,
    goods: Partial<Record<Resource, number>>,
    limit = 7,
  ) {
    clear(parent);
    let count = 0;
    for (const resource of resources)
      for (
        let index = 0;
        index < Math.min(goods[resource] || 0, limit - count);
        index++
      ) {
        const item = world.createItem(resource);
        item.scale.setScalar(
          resource === "fish" || resource === "salmon" ? 0.27 : 0.48,
        );
        item.position.set((count % 2 ? 1 : -1) * 0.06, count * 0.15, 0);
        item.rotation.y =
          resource === "fish" || resource === "salmon"
            ? Math.PI / 2
            : ((count % 2) * Math.PI) / 2;
        parent.add(item);
        count++;
      }
    parent.visible = count > 0;
  }
  function cashParcel(parent: THREE.Group) {
    for (let i = 0; i < 3; i++) {
      box(parent, "#59bf58", [0, i * 0.065, 0], [0.35, 0.055, 0.22]);
      box(parent, "#e6e3b3", [0, i * 0.065, 0.01], [0.09, 0.06, 0.24]);
    }
  }
  function setFacing(rig: PersonRig, direction: THREE.Vector3, dt: number) {
    if (direction.lengthSq() < 0.001) return;
    const wanted = Math.atan2(direction.x, direction.z),
      diff = Math.atan2(
        Math.sin(wanted - rig.root.rotation.y),
        Math.cos(wanted - rig.root.rotation.y),
      );
    rig.root.rotation.y += diff * Math.min(1, dt * 10);
  }
  function limbs(
    rig: PersonRig,
    walking: boolean,
    time: number,
    carrying: boolean,
  ) {
    rig.legs.forEach((leg, index) => {
      leg.rotation.x = walking
        ? Math.sin(time * 11 + index * Math.PI) * 0.58
        : 0;
    });
    rig.leftArm.rotation.x = carrying
      ? -0.85
      : walking
        ? Math.sin(time * 11) * 0.35
        : -0.05;
    rig.rightArm.rotation.x = carrying
      ? -0.85
      : walking
        ? Math.sin(time * 11 + Math.PI) * 0.35
        : -0.05;
  }
  function walkRoute(
    rig: PersonRig,
    route: THREE.Vector3[],
    speed: number,
    dt: number,
    time: number,
    carrying: boolean,
    checkGround = true,
  ) {
    while (
      route.length &&
      rig.root.position.distanceTo(
        new THREE.Vector3(route[0].x, rig.root.position.y, route[0].z),
      ) < 0.13
    )
      route.shift();
    if (!route.length) {
      limbs(rig, false, time, carrying);
      return true;
    }
    const target = route[0],
      direction = new THREE.Vector3(
        target.x - rig.root.position.x,
        0,
        target.z - rig.root.position.z,
      ),
      distance = direction.length();
    direction.normalize();
    const next = rig.root.position
      .clone()
      .addScaledVector(direction, Math.min(distance, speed * dt));
    if (!checkGround || world.isWalkable(next.x, next.z)) {
      rig.root.position.x = next.x;
      rig.root.position.z = next.z;
    } else {
      // A route may graze the corner of a newly built foundation. Slide instead of freezing.
      if (world.isWalkable(next.x, rig.root.position.z))
        rig.root.position.x = next.x;
      else if (world.isWalkable(rig.root.position.x, next.z))
        rig.root.position.z = next.z;
      else {
        const replacement = options.routeTo(rig.root.position, target);
        if (replacement.length) route.splice(0, route.length, ...replacement);
      }
    }
    rig.root.position.y =
      world.groundHeight(rig.root.position.x, rig.root.position.z) +
      Math.abs(Math.sin(time * 11)) * 0.045;
    setFacing(rig, direction, dt);
    limbs(rig, true, time, carrying);
    return false;
  }
  function routeWorker(worker: Worker, to: THREE.Vector3, state: WorkerState) {
    worker.route = options.routeTo(worker.rig.root.position, to);
    if (!worker.route.length && world.isWalkable(to.x, to.z))
      worker.route = [to.clone()];
    worker.state = state;
    worker.time = 0;
  }
  const depot = () => world.stations.warehouse.workPosition.clone();
  function workPosition(role: WorkerRole) {
    if (role === "forester")
      return world.workerTree.position
        .clone()
        .add(new THREE.Vector3(0.9, 0, 0.5));
    const station =
      world.stations[
        WORKERS.find((def) => def.id === role)!
          .activity as keyof World["stations"]
      ];
    return (station?.workPosition || depot())
      .clone()
      .add(
        new THREE.Vector3(
          role === "cutter" ? 1.25 : role === "cook" ? -0.7 : 0,
          0,
          0,
        ),
      );
  }
  function makeTool(worker: Worker) {
    const tool = worker.tool;
    tool.position.set(0, -0.43, 0.04);
    if (worker.role === "forester" || worker.role === "miner") {
      pole(tool, "#9c713f", [0, 0.02, 0], [0.035, 0.8, 0.035]);
      const head = box(
        tool,
        worker.role === "miner" ? "#a2b6c2" : "#d8e4e5",
        [0.17, 0.35, 0],
        worker.role === "miner" ? [0.66, 0.105, 0.1] : [0.44, 0.29, 0.09],
      );
      head.rotation.z = -0.12;
    } else if (worker.role === "fisher") {
      const rod = pole(tool, "#37667c", [0, 0.55, 0.18], [0.025, 1.8, 0.025]);
      rod.rotation.x = 0.42;
      pole(tool, "#bb8e53", [0, -0.18, -0.1], [0.05, 0.36, 0.05]);
      const geo = new THREE.BufferGeometry().setFromPoints([
        zero.clone(),
        zero.clone(),
      ]);
      ownedGeometries.add(geo);
      const lineMaterial = new THREE.LineBasicMaterial({ color: "#eff7e9" });
      ownedMaterials.add(lineMaterial);
      worker.line = new THREE.Line(geo, lineMaterial);
      world.scene.add(worker.line);
      worker.line.visible = false;
    } else if (worker.role === "gardener") {
      pole(tool, "#b08851", [0, 0.05, 0], [0.045, 0.5, 0.045]);
      const blade = box(tool, "#b7d0d9", [0.17, 0.3, 0], [0.4, 0.08, 0.07]);
      blade.rotation.z = 0.5;
    } else if (worker.role === "cook") {
      pole(tool, "#9b6c42", [0, 0.2, 0], [0.025, 0.65, 0.025]);
      ball(tool, "#a7794b", [0, 0.57, 0], [0.09, 0.035, 0.12]);
    } else if (worker.role === "cutter") {
      box(tool, "#aa7b49", [0, 0.04, 0], [0.08, 0.38, 0.08]);
      box(tool, "#d8e2e5", [0.14, 0.3, 0], [0.36, 0.25, 0.05]);
    } else if (worker.role === "crabber") {
      pole(tool, "#a7834e", [0, 0.35, 0], [0.02, 0.8, 0.02]);
    }
    tool.visible = false;
  }
  const workers: Worker[] = WORKERS.map((definition, index) => {
    const rig = world.createPerson(
      world.scene,
      [
        "#238d9f",
        "#398bb8",
        "#b06e46",
        "#d5a84c",
        "#7578a3",
        "#709451",
        "#a26863",
        "#eee4bd",
      ][index],
    );
    rig.root.name = `worker-${definition.id}`;
    rig.root.userData.workerRole = definition.id;
    rig.root.position.copy(
      index === 0
        ? world.workerTree.position.clone().add(new THREE.Vector3(0.9, 0, 0.5))
        : depot().add(
            new THREE.Vector3(
              (index % 4) * 0.6 - 1,
              index * 0.005,
              Math.floor(index / 4) * 0.8,
            ),
          ),
    );
    rig.root.position.y = world.groundHeight(
      rig.root.position.x,
      rig.root.position.z,
    );
    const cargo = group(rig.root);
    cargo.position.set(0, 0.95, -0.38);
    cargo.visible = false;
    const tool = group(rig.rightArm),
      props = group(world.scene),
      effects = group(world.scene),
      item = world.createItem("fish");
    props.add(item);
    item.visible = false;
    const result: Worker = {
      role: definition.id,
      rig,
      state: "off-duty",
      time: 0,
      workTime: 0,
      route: [],
      cargo,
      tool,
      props,
      item,
      effects,
      phase: 0,
      outputs: {},
      delivered: 0,
      enabled: false,
      lastRetry: -10,
    };
    rig.root.visible = false;
    props.visible = false;
    effects.visible = false;
    makeTool(result);
    return result;
  });
  // Props stay separate from the player's machines, so two people can work without
  // overwriting each other's knife, bobber, or cargo meshes.
  for (const worker of workers) {
    const pos = workPosition(worker.role);
    worker.props.position.copy(pos);
    worker.props.position.y = world.groundHeight(pos.x, pos.z);
    if (worker.role === "fisher") {
      const float = ball(
        worker.effects,
        "#f59b6c",
        [0, 0, 0],
        [0.08, 0.13, 0.08],
      );
      float.name = "float";
    }
    if (worker.role === "miner") {
      const rock = mesh(
        worker.props,
        new THREE.IcosahedronGeometry(0.65, 1),
        "#84989f",
        [0.25, 0.4, 0.3],
        [1, 0.9, 0.8],
      );
      ownedGeometries.add(rock.geometry);
      rock.name = "ore-rock";
    }
    if (worker.role === "gardener")
      for (let i = 0; i < 4; i++) {
        const stem = pole(
          worker.props,
          "#648b55",
          [-0.3 + i * 0.17, 0.45, 0.3],
          [0.035, 0.9, 0.035],
        );
        stem.rotation.z = (i - 1.5) * 0.12;
        stem.name = "kelp-stem";
      }
    if (worker.role === "crabber") {
      const basket = group(worker.props);
      basket.name = "crab-basket";
      for (const x of [-0.35, 0.35])
        for (const z of [-0.28, 0.28])
          pole(basket, "#b49b6f", [x, 0.4, z], [0.025, 0.8, 0.025]);
      for (const y of [0, 0.25, 0.55, 0.8]) {
        box(basket, "#b49b6f", [0, y, -0.28], [0.75, 0.025, 0.025]);
        box(basket, "#b49b6f", [0, y, 0.28], [0.75, 0.025, 0.025]);
        box(basket, "#b49b6f", [-0.35, y, 0], [0.025, 0.025, 0.58]);
        box(basket, "#b49b6f", [0.35, y, 0], [0.025, 0.025, 0.58]);
      }
      const crab = world.createItem("crab");
      crab.scale.setScalar(0.45);
      crab.position.y = 0.2;
      basket.add(crab);
    }
    if (worker.role === "cutter") {
      box(worker.props, "#b58955", [0, 0.9, 0.2], [1.1, 0.12, 0.7]);
      for (const x of [-0.4, 0.4])
        box(worker.props, "#85603f", [x, 0.43, 0.2], [0.09, 0.86, 0.09]);
    }
    if (worker.role === "cook") {
      const pot = pole(
        worker.props,
        "#778a90",
        [0, 0.8, 0.3],
        [0.34, 0.4, 0.34],
      );
      pot.name = "cook-pot";
      for (let i = 0; i < 3; i++) {
        const steam = ball(
          worker.effects,
          "#e5eff1",
          [0, 0, 0],
          [0.13, 0.13, 0.13],
        );
        steam.name = `steam-${i}`;
      }
    }
  }
  const customerColors = [
    "#d8a14c",
    "#b76c4a",
    "#5e94a6",
    "#9388b4",
    "#699875",
    "#c18d9f",
    "#e4ce92",
  ];
  const customers: Customer[] = Array.from({ length: 7 }, (_, index) => {
    const rig = world.createPerson(world.scene, customerColors[index]);
    rig.root.name = `customer-${index + 1}`;
    rig.root.userData.customer = true;
    const entry = new THREE.Vector3(12 + index * 1.7, 0.35, 17 + index * 1.5);
    rig.root.position.copy(entry);
    rig.root.visible = false;
    const cargo = group(rig.root);
    cargo.position.set(0, 1.05, 0.45);
    cargo.visible = false;
    const wallet = group(rig.leftArm);
    wallet.position.set(0, -0.47, 0.05);
    cashParcel(wallet);
    wallet.visible = false;
    world.customers.push(rig.root);
    return {
      id: index + 1,
      ticket: ticket++,
      rig,
      state: "outside",
      time: 0,
      route: [],
      cargo,
      wallet,
      delay: index * 1.8,
      entered: 0,
      purchases: 0,
      hasOrder: false,
    };
  });
  function queue() {
    return customers
      .filter(
        (customer) =>
          customer.state === "approaching-harbor" ||
          customer.state === "queueing" ||
          customer.state === "waiting",
      )
      .sort((a, b) => a.ticket - b.ticket);
  }
  const counter = () =>
    world.stations.market.position.clone().add(new THREE.Vector3(0, 0, 1.23));
  function queuePoint(index: number) {
    return world.stations.market.position
      .clone()
      .add(new THREE.Vector3((index % 2) * 0.12, 0, 1.85 + index * 1.03));
  }
  function readyCustomer() {
    return queue().find(
      (customer, index) =>
        index === 0 &&
        customer.state === "waiting" &&
        customer.rig.root.position.distanceTo(queuePoint(0)) < 0.24,
    );
  }
  function enterCustomer(customer: Customer, initial = false) {
    let entry = initial
      ? new THREE.Vector3(
          12 + (customer.id - 1) * 1.7,
          0.35,
          17 + (customer.id - 1) * 1.5,
        )
      : new THREE.Vector3(29, 0.35, 31);
    if (options.isOnScreen?.(entry)) entry.set(55, 0.35, 55);
    customer.rig.root.position.copy(entry);
    customer.rig.root.visible = true;
    customer.state = "approaching-harbor";
    customer.time = 0;
    customer.entered++;
    customer.route = [
      new THREE.Vector3(12, 0.35, 17),
      new THREE.Vector3(6, 0.35, 16),
      new THREE.Vector3(6, 0.35, 11),
      new THREE.Vector3(4, 0.35, 11.5),
    ];
    if (initial)
      while (
        customer.route.length &&
        customer.rig.root.position.distanceTo(customer.route[0]) < 0.15
      )
        customer.route.shift();
    customer.cargo.visible = false;
    customer.wallet.visible = false;
    customer.hasOrder = false;
  }
  function startSale(mode: "player" | "porter", porter?: Worker) {
    if (activeSale) return false;
    const buyer = readyCustomer();
    if (!buyer) return false;
    buyer.state = "approaching-counter";
    buyer.time = 0;
    buyer.route = [counter()];
    activeSale = {
      mode,
      buyer,
      porter,
      time: 0,
      paid: false,
      order: porter?.order,
    };
    return true;
  }
  function depart(
    customer: Customer,
    goods?: Partial<Record<Resource, number>>,
    purchased = true,
  ) {
    if (goods) cargoItems(customer.cargo, goods, 3);
    customer.wallet.visible = false;
    customer.state = "leaving";
    customer.time = 0;
    if (purchased) customer.purchases++;
    customer.route = [
      world.stations.market.position
        .clone()
        .add(new THREE.Vector3(2.7, 0, 1.23)),
      new THREE.Vector3(8.6, 0.35, 6.2),
      new THREE.Vector3(10.5, 0.35, 6.3),
      new THREE.Vector3(12.9, 0.35, 10.5),
      new THREE.Vector3(14, 0.35, 16.5),
      new THREE.Vector3(24, 0.35, 26),
      new THREE.Vector3(45, 0.35, 47),
    ];
  }
  function cancelSale() {
    if (!activeSale) return;
    const customer = activeSale.buyer;
    customer.state = "queueing";
    customer.time = 0;
    customer.wallet.visible = false;
    customer.hasOrder = false;
    activeSale = null;
  }
  function resetWorkerPose(worker: Worker) {
    worker.tool.visible = false;
    worker.item.visible = false;
    worker.props.visible = false;
    worker.effects.visible = false;
    if (worker.line) worker.line.visible = false;
    for (const child of [...worker.props.children])
      if (child.userData.npcTransient) worker.props.remove(child);
    worker.rig.root.rotation.z = 0;
    worker.rig.rightArm.rotation.z = 0;
    worker.rig.leftArm.rotation.z = 0;
  }
  function workerCargo(
    worker: Worker,
    goods: Partial<Record<Resource, number>>,
  ) {
    cargoItems(worker.cargo, goods);
    worker.outputs = { ...goods };
  }
  function beginWorker(worker: Worker) {
    const game = options.getGame(),
      pending = game.workerJobs[worker.role],
      spec = workerJobSpec(game, worker.role);
    // A scene can remount between reserving supplies and rendering the new save.
    // Resume that reservation instead of trying to spend the same supplies again.
    if (pending && Date.now() >= pending.finishAt) {
      resetWorkerPose(worker);
      workerCargo(worker, pending.outputs);
      routeWorker(worker, depot(), "carrying-to-store");
      return;
    }
    if (
      !pending &&
      worker.role === "forester" &&
      world.workerTree.state !== "standing"
    ) {
      worker.state = "waiting-supplies";
      worker.time = 0;
      return;
    }
    if (!pending && (!spec || !options.onWorkerStart(worker.role))) {
      worker.state = "waiting-supplies";
      worker.time = 0;
      return;
    }
    worker.state = "working";
    worker.workTime = pending
      ? Math.max(0.1, (pending.finishAt - pending.startedAt) / 1000)
      : spec!.seconds;
    worker.time = pending
      ? Math.max(
          0,
          Math.min(worker.workTime, (Date.now() - pending.startedAt) / 1000),
        )
      : 0;
    worker.outputs = { ...(pending?.outputs || spec!.outputs) };
    worker.props.visible = true;
    worker.effects.visible = true;
    worker.tool.visible = true;
    worker.cargo.visible = false;
    worker.phase = 0;
    worker.item.visible = false;
    worker.props.children
      .filter((child) => child.name === "kelp-stem")
      .forEach((child) => {
        child.scale.y = 0.9;
      });
    if (worker.role === "forester") {
      world.workerTree.state = "standing";
      world.workerTree.pivot.visible = true;
      world.workerTree.notch.visible = false;
      world.workerTree.pivot.rotation.set(0, 0, 0);
      world.workerTree.pivot.scale.setScalar(1);
      world.workerTree.stump.visible = false;
    }
    if (worker.role === "cutter") {
      worker.item.position.set(0, 1.08, 0.2);
      worker.item.scale.setScalar(0.42);
      worker.item.rotation.y = Math.PI / 2;
      worker.item.visible = true;
    }
  }
  function updateWorkerAction(worker: Worker, dt: number) {
    const p = clamp(worker.time / worker.workTime),
      time = worker.time;
    worker.rig.root.rotation.y =
      worker.role === "forester"
        ? Math.atan2(
            world.workerTree.position.x - worker.rig.root.position.x,
            world.workerTree.position.z - worker.rig.root.position.z,
          )
        : Math.PI;
    limbs(worker.rig, false, worldTime, false);
    if (worker.role === "forester") {
      if (p < 0.44) {
        const swing = (time % 0.6) / 0.6;
        worker.rig.rightArm.rotation.x =
          -1.45 + Math.sin(swing * Math.PI) * 2.3;
        worker.rig.leftArm.rotation.x = -0.3;
        world.workerTree.pivot.rotation.z = Math.sin(time * 13) * 0.018;
        world.workerTree.notch.visible = p > 0.13;
        world.workerTree.notch.scale.setScalar(0.5 + p);
      } else if (p < 0.65) {
        world.workerTree.pivot.rotation.z =
          -smooth((p - 0.44) / 0.21) * Math.PI * 0.48;
        world.workerTree.stump.visible = true;
        worker.rig.rightArm.rotation.x = -0.3;
      } else {
        if (worker.phase === 0) {
          worker.phase = 1;
          world.workerTree.pivot.visible = false;
          world.workerTree.state = "fallen";
          world.workerTree.regrowAt = worldTime + 8;
          clear(worker.effects);
          for (let i = 0; i < 4; i++) {
            const log = world.createItem("wood");
            log.scale.setScalar(0.6);
            log.position
              .copy(world.workerTree.position)
              .add(
                new THREE.Vector3(-0.8 + i * 0.5, 0.25, 0.3 + (i % 2) * 0.3),
              );
            log.userData.from = log.position.clone();
            worker.effects.add(log);
          }
        }
        worker.rig.root.updateMatrixWorld();
        const back = worker.cargo.getWorldPosition(new THREE.Vector3());
        worker.effects.children.forEach((item, index) => {
          const from = item.userData.from as THREE.Vector3,
            t = clamp((p - 0.65) / 0.35 - index * 0.05);
          item.position.lerpVectors(from, back, smooth(t));
          item.position.y += Math.sin(t * Math.PI) * 0.8;
          item.rotation.y += dt * 3;
        });
      }
    } else if (worker.role === "fisher") {
      const water = new THREE.Vector3(
          -8.2,
          -0.1,
          world.stations.fish.position.z,
        ),
        hand = worker.rig.rightArm.getWorldPosition(new THREE.Vector3());
      worker.rig.root.rotation.y = -Math.PI / 2;
      worker.rig.rightArm.rotation.x =
        p < 0.18 ? -1.5 + Math.sin((p / 0.18) * Math.PI) * 2 : -0.8;
      worker.rig.leftArm.rotation.x = -0.7;
      const float = worker.effects.getObjectByName("float");
      if (float) {
        float.position.copy(water);
        float.position.y += Math.sin(time * 17) * 0.06;
        float.visible = p < 0.58;
      }
      const end = water.clone();
      if (p > 0.55) {
        worker.item.visible = true;
        worker.item.scale.setScalar(0.6);
        const t = clamp((p - 0.55) / 0.45),
          back = worker.cargo.getWorldPosition(new THREE.Vector3());
        const flight = water.clone().lerp(back, t);
        flight.y += Math.sin(t * Math.PI) * 2.8;
        worker.props.updateWorldMatrix(true, false);
        worker.item.position.copy(worker.props.worldToLocal(flight));
        worker.item.rotation.z = Math.sin(t * 18) * 0.25;
        end.copy(worker.item.getWorldPosition(new THREE.Vector3()));
      }
      if (worker.line) {
        const points = worker.line.geometry.attributes
          .position as THREE.BufferAttribute;
        points.setXYZ(0, hand.x, hand.y + 1.3, hand.z);
        points.setXYZ(1, end.x, end.y, end.z);
        points.needsUpdate = true;
        worker.line.visible = true;
        worker.line.geometry.computeBoundingSphere();
      }
    } else if (worker.role === "cutter") {
      worker.rig.rightArm.rotation.x = -0.9 + Math.sin(time * 9) * 0.65;
      worker.rig.rightArm.rotation.z = Math.sin(time * 9) * 0.12;
      worker.item.scale.z = 0.42 * (1 - clamp((p - 0.15) / 0.7) * 0.7);
      worker.item.visible = p < 0.88;
      if (p > 0.22 && worker.phase < Math.floor(p * 4)) {
        worker.phase = Math.floor(p * 4);
        const steak = world.createItem("steak");
        steak.scale.setScalar(0.52);
        steak.position.set(-0.3 + worker.phase * 0.22, 1.06, 0.25);
        steak.userData.npcTransient = true;
        worker.props.add(steak);
      }
    } else if (worker.role === "miner") {
      worker.rig.rightArm.rotation.x = -1.7 + Math.sin(time * 7) * 1.3;
      worker.rig.leftArm.rotation.x = -0.25;
      const rock = worker.props.getObjectByName("ore-rock");
      if (rock) rock.rotation.z = Math.sin(time * 15) * 0.025;
    } else if (worker.role === "gardener") {
      worker.rig.rightArm.rotation.x = -0.7 + Math.sin(time * 7) * 0.65;
      worker.rig.rightArm.rotation.z = Math.sin(time * 5) * 0.25;
      worker.props.children
        .filter((item) => item.name === "kelp-stem")
        .forEach((stem, index) => {
          stem.scale.y = 0.9 * (1 - clamp((p - index * 0.13) / 0.5) * 0.8);
          stem.rotation.z = Math.sin(time * 5 + index) * 0.2;
        });
    } else if (worker.role === "crabber") {
      worker.rig.rightArm.rotation.x = -1.05 + Math.sin(time * 9) * 0.2;
      worker.rig.leftArm.rotation.x = -1;
      const basket = worker.props.getObjectByName("crab-basket");
      if (basket) {
        basket.position.set(-0.8, 0.1 + smooth(p) * 1.1, 0);
        basket.rotation.z = Math.sin(time * 7) * 0.05;
      }
    } else if (worker.role === "cook") {
      worker.rig.rightArm.rotation.x = -0.8 + Math.sin(time * 6) * 0.18;
      worker.rig.rightArm.rotation.z = Math.cos(time * 6) * 0.25;
      worker.effects.position.copy(worker.props.position);
      worker.effects.children.forEach((steam, index) => {
        steam.position.set(
          Math.sin(time * 2 + index) * 0.12,
          1.15 + ((time * 0.4 + index * 0.3) % 1) * 0.6,
          0.3,
        );
        steam.scale.setScalar(0.1 + ((time * 0.4 + index * 0.3) % 1) * 0.15);
      });
    }
    worker.rig.root.rotation.z = Math.sin(time * 6) * 0.018;
  }
  function chooseOrder(game: GameState) {
    for (const resource of resources) {
      const quantity = Math.min(3, game.stock[resource]);
      if (quantity > 0) return { resource, quantity };
    }
    return null;
  }
  function updatePorter(worker: Worker, dt: number) {
    if (
      worker.state === "walking-to-work" ||
      worker.state === "waiting-supplies"
    ) {
      if (
        worker.state === "walking-to-work" &&
        !walkRoute(worker.rig, worker.route, 3.05, dt, worldTime, false)
      )
        return;
      const order = chooseOrder(options.getGame());
      if (!order) {
        worker.state = "waiting-supplies";
        limbs(worker.rig, false, worldTime, false);
        return;
      }
      worker.order = order;
      workerCargo(worker, { [order.resource]: order.quantity });
      routeWorker(
        worker,
        world.stations.market.workPosition
          .clone()
          .add(new THREE.Vector3(-1.05, 0, 0)),
        "bringing-order",
      );
    } else if (worker.state === "bringing-order") {
      if (!walkRoute(worker.rig, worker.route, 2.85, dt, worldTime, true))
        return;
      worker.state = "serving-customer";
      worker.time = 0;
    } else if (worker.state === "serving-customer") {
      limbs(worker.rig, false, worldTime, true);
      worker.rig.root.rotation.y = 0;
      if (!activeSale && worker.order && readyCustomer())
        startSale("porter", worker);
    } else if (worker.state === "returning") {
      if (walkRoute(worker.rig, worker.route, 3.05, dt, worldTime, true)) {
        worker.cargo.visible = false;
        worker.outputs = {};
        worker.order = undefined;
        worker.state = "waiting-supplies";
        worker.time = 0;
      }
    }
  }
  function updateWorkers(dt: number) {
    const game = options.getGame();
    for (const worker of workers) {
      const definition = WORKERS.find((entry) => entry.id === worker.role)!,
        enabled = game.upgrades.crew >= definition.requiredCrew;
      if (!enabled) {
        worker.rig.root.visible = false;
        worker.props.visible = false;
        worker.effects.visible = false;
        worker.enabled = false;
        continue;
      }
      if (!worker.enabled) {
        worker.enabled = true;
        worker.rig.root.visible = true;
        worker.state = "walking-to-work";
        worker.time = 0;
        const pending = game.workerJobs[worker.role];
        if (pending && Date.now() >= pending.finishAt) {
          workerCargo(worker, pending.outputs);
          routeWorker(worker, depot(), "carrying-to-store");
        } else
          routeWorker(
            worker,
            worker.role === "porter" ? depot() : workPosition(worker.role),
            "walking-to-work",
          );
      }
      worker.time += dt;
      if (worker.role === "porter") {
        updatePorter(worker, dt);
        continue;
      }
      if (worker.state === "walking-to-work") {
        if (walkRoute(worker.rig, worker.route, 3.2, dt, worldTime, false))
          beginWorker(worker);
      } else if (worker.state === "working") {
        updateWorkerAction(worker, dt);
        if (worker.time >= worker.workTime) {
          resetWorkerPose(worker);
          workerCargo(worker, worker.outputs);
          routeWorker(worker, depot(), "carrying-to-store");
        }
      } else if (worker.state === "carrying-to-store") {
        if (walkRoute(worker.rig, worker.route, 2.9, dt, worldTime, true)) {
          worker.state = "unloading";
          worker.time = 0;
        }
      } else if (worker.state === "unloading") {
        limbs(worker.rig, false, worldTime, true);
        worker.rig.rightArm.rotation.x = -1.1 - Math.sin(worker.time * 6) * 0.3;
        if (worker.time > 0.65) {
          if (options.onWorkerComplete(worker.role)) {
            worker.delivered++;
            worker.cargo.visible = false;
            worker.outputs = {};
            routeWorker(worker, workPosition(worker.role), "walking-to-work");
          } else {
            worker.state = "warehouse-full";
            worker.time = 0;
          }
        }
      } else if (worker.state === "warehouse-full") {
        limbs(worker.rig, false, worldTime, true);
        if (worker.time > 1.5) {
          worker.time = 0;
          if (options.onWorkerComplete(worker.role)) {
            worker.delivered++;
            worker.cargo.visible = false;
            worker.outputs = {};
            routeWorker(worker, workPosition(worker.role), "walking-to-work");
          }
        }
      } else if (worker.state === "waiting-supplies") {
        limbs(worker.rig, false, worldTime, false);
        worker.rig.root.rotation.y += Math.sin(worldTime * 0.8) * dt * 0.14;
        if (worker.time > 2) {
          worker.time = 0;
          beginWorker(worker);
        }
      }
    }
    const tree = world.workerTree;
    if (tree.state === "fallen" && worldTime >= tree.regrowAt) {
      tree.state = "growing";
      tree.pivot.visible = true;
      tree.pivot.rotation.set(0, 0, 0);
      tree.notch.visible = false;
      tree.pivot.scale.setScalar(0.05);
    }
    if (tree.state === "growing") {
      const growth = clamp((worldTime - tree.regrowAt) / 5);
      tree.pivot.scale.setScalar(0.05 + growth * 0.95);
      if (growth >= 1) {
        tree.state = "standing";
        tree.stump.visible = false;
        tree.pivot.scale.setScalar(1);
      }
    }
  }
  function updateCustomers(dt: number) {
    for (const customer of customers) {
      customer.time += dt;
      if (customer.state === "outside") {
        if (worldTime >= customer.delay) {
          customer.ticket = ticket++;
          enterCustomer(customer, customer.entered === 0);
        }
      } else if (customer.state === "approaching-harbor") {
        if (
          walkRoute(
            customer.rig,
            customer.route,
            3.2,
            dt,
            worldTime,
            false,
            false,
          )
        ) {
          customer.state = "queueing";
          customer.time = 0;
        }
      } else if (
        customer.state === "queueing" ||
        customer.state === "waiting"
      ) {
        const index = queue().indexOf(customer),
          target = queuePoint(Math.max(0, index));
        const distance = customer.rig.root.position.distanceTo(
          new THREE.Vector3(target.x, customer.rig.root.position.y, target.z),
        );
        if (distance > 0.13) {
          customer.state = "queueing";
          walkRoute(
            customer.rig,
            [target],
            2.35,
            dt,
            worldTime,
            customer.hasOrder,
            false,
          );
        } else {
          customer.state = "waiting";
          const glance = Math.sin(worldTime * 0.55 + customer.id * 1.7);
          customer.rig.root.rotation.y =
            Math.PI + (Math.abs(glance) > 0.88 ? glance * 0.2 : glance * 0.045);
          limbs(customer.rig, false, worldTime, false);
          customer.rig.root.position.y =
            world.groundHeight(
              customer.rig.root.position.x,
              customer.rig.root.position.z,
            ) +
            Math.sin(worldTime * 1.6 + customer.id) * 0.012;
          customer.rig.leftArm.rotation.x =
            -0.15 + Math.sin(worldTime * 1.2 + customer.id) * 0.1;
          // Customers eventually continue their walk if the counter has no goods.
          // This keeps an unattended market alive without awarding a sale.
          if (customer.time > 45 + customer.id * 4)
            depart(customer, undefined, false);
        }
      } else if (customer.state === "approaching-counter") {
        if (
          walkRoute(
            customer.rig,
            customer.route,
            2.5,
            dt,
            worldTime,
            false,
            false,
          )
        ) {
          customer.state = "inspecting";
          customer.time = 0;
        }
      } else if (
        customer.state === "inspecting" ||
        customer.state === "paying"
      ) {
        customer.rig.root.rotation.y = Math.PI;
        limbs(customer.rig, false, worldTime, customer.state === "paying");
        customer.rig.rightArm.rotation.x =
          -0.55 + Math.sin(customer.time * 4) * 0.13;
        if (customer.time > 0.8) {
          customer.state = "paying";
          customer.wallet.visible = true;
          customer.rig.leftArm.rotation.x = -1.15;
        }
      } else if (customer.state === "leaving") {
        walkRoute(
          customer.rig,
          customer.route,
          3,
          dt,
          worldTime,
          customer.cargo.visible,
          false,
        );
        const far =
          customer.rig.root.position.x > world.bounds.maxX + 1 ||
          customer.rig.root.position.z > world.bounds.maxZ + 1;
        const visible =
          options.isOnScreen?.(customer.rig.root.position) || false;
        if ((!customer.route.length || far) && !visible) {
          customer.rig.root.visible = false;
          customer.state = "outside";
          customer.delay = worldTime + 14 + customer.id * 1.8;
          customer.time = 0;
          customer.cargo.visible = false;
        }
      }
    }
    if (activeSale) {
      const sale = activeSale;
      sale.time += dt;
      if (
        sale.mode === "porter" &&
        sale.buyer.state === "paying" &&
        sale.buyer.time > 1.2 &&
        !sale.paid
      ) {
        sale.paid = true;
        const order = sale.order,
          earned = order
            ? options.onSellStock(order.resource, order.quantity)
            : 0;
        if (earned > 0 && order) {
          depart(sale.buyer, { [order.resource]: order.quantity });
          if (sale.porter) {
            clear(sale.porter.cargo);
            cashParcel(sale.porter.cargo);
            sale.porter.cargo.visible = true;
            routeWorker(sale.porter, depot(), "returning");
          }
          activeSale = null;
        } else {
          const porter = sale.porter;
          cancelSale();
          if (porter) {
            porter.cargo.visible = false;
            porter.order = undefined;
            routeWorker(porter, depot(), "returning");
          }
        }
      }
    }
  }
  return {
    update(elapsed: number) {
      if (disposed || !Number.isFinite(elapsed) || elapsed <= 0) return;
      // Keep work and walking on elapsed time rather than on the number of
      // rendered frames. Short simulation steps retain fence/waypoint checks;
      // bounded catch-up avoids fast-forwarding the harbor after a tab sleeps.
      let remaining = Math.min(elapsed, 1);
      while (remaining > 1e-8) {
        const dt = Math.min(remaining, 0.05);
        worldTime += dt;
        updateWorkers(dt);
        updateCustomers(dt);
        remaining -= dt;
      }
    },
    hasCustomer() {
      return !activeSale && !!readyCustomer();
    },
    beginPlayerSale() {
      return startSale("player");
    },
    finishPlayerSale(items?: Partial<Record<Resource, number>>) {
      if (activeSale?.mode !== "player") return;
      depart(activeSale.buyer, items);
      activeSale = null;
    },
    cancelPlayerSale() {
      if (activeSale?.mode === "player") cancelSale();
    },
    diagnostics() {
      return {
        time: worldTime,
        workers: workers
          .filter((worker) => worker.enabled)
          .map((worker) => ({
            id: worker.role,
            role: worker.role,
            state: worker.state,
            visible: worker.rig.root.visible,
            task:
              worker.role === "porter"
                ? worker.order
                  ? `Delivering ${worker.order.resource}`
                  : "Checking warehouse"
                : worker.state === "waiting-supplies"
                  ? "Waiting for supplies or building"
                  : worker.state === "warehouse-full"
                    ? "Warehouse full"
                    : WORKERS.find((entry) => entry.id === worker.role)!.name,
            x: Number(worker.rig.root.position.x.toFixed(3)),
            y: Number(worker.rig.root.position.y.toFixed(3)),
            z: Number(worker.rig.root.position.z.toFixed(3)),
            arm: Number(worker.rig.rightArm.rotation.x.toFixed(3)),
            armRotation: Number(worker.rig.rightArm.rotation.x.toFixed(3)),
            taskObjectRotation: Number(
              (worker.role === "forester"
                ? world.workerTree.pivot.rotation.z
                : worker.item.visible
                  ? worker.item.rotation.z
                  : worker.rig.rightArm.rotation.x
              ).toFixed(3),
            ),
            leg: Number(worker.rig.legs[0]?.rotation.x.toFixed(3)),
            carrying: worker.cargo.visible && worker.cargo.children.length > 0,
            delivered: worker.delivered,
          })),
        customers: customers.map((customer) => ({
          id: customer.id,
          state: customer.state,
          queueIndex: queue().indexOf(customer),
          x: Number(customer.rig.root.position.x.toFixed(3)),
          z: Number(customer.rig.root.position.z.toFixed(3)),
          visible: customer.rig.root.visible,
          carrying:
            customer.cargo.visible && customer.cargo.children.length > 0,
          arm: Number(customer.rig.rightArm.rotation.x.toFixed(3)),
          armRotation: Number(customer.rig.rightArm.rotation.x.toFixed(3)),
          leg: Number(customer.rig.legs[0]?.rotation.x.toFixed(3)),
          entered: customer.entered,
          purchases: customer.purchases,
        })),
        sale: activeSale
          ? {
              mode: activeSale.mode,
              customer: activeSale.buyer.id,
              state: activeSale.buyer.state,
            }
          : null,
      };
    },
    dispose() {
      disposed = true;
      for (const worker of workers) {
        worker.rig.root.visible = false;
        worker.props.visible = false;
        worker.effects.visible = false;
        if (worker.line) worker.line.visible = false;
      }
      for (const customer of customers) customer.rig.root.visible = false;
      ownedGeometries.forEach((geometry) => geometry.dispose());
      ownedMaterials.forEach((value) => value.dispose());
    },
  };
}
