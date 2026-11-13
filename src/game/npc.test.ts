import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import * as THREE from "three";
import { createHarborNPCs } from "./npc";
import { createInitialState, reduceGame } from "./model";
import type { PersonRig, World } from "./world";

// Exercise the real actor state machine and reducer without a GPU. The harbor
// has the same tree/depot separation and an L-shaped route around a fence.
function importedDelivery(t: TestContext, alreadyFinished = false) {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const station = (x: number, z: number) => ({
    group: new THREE.Group(),
    position: new THREE.Vector3(x, 0.4, z),
    workPosition: new THREE.Vector3(x, 0.4, z),
  });
  const warehouse = station(10, 14);
  const world = {
    scene: new THREE.Scene(),
    workerTree: {
      position: new THREE.Vector3(-3.5, 0.4, -9.8),
      pivot: new THREE.Group(),
      notch: new THREE.Mesh(),
      stump: new THREE.Group(),
      state: "standing",
      regrowAt: 0,
    },
    stations: {
      fish: station(-6, -5),
      steaks: station(0, 1),
      planks: station(3, 2),
      smoked: station(4, 4),
      crab: station(-6, 13),
      kelp: station(-6, -12),
      ore: station(15, -12),
      ingots: station(15, -5),
      meals: station(14, 6),
      tackle: station(19, 16),
      warehouse,
      market: station(3, 8),
    },
    createPerson(parent: THREE.Object3D): PersonRig {
      const root = new THREE.Group(),
        leftArm = new THREE.Group(),
        rightArm = new THREE.Group(),
        legs = [new THREE.Group(), new THREE.Group()];
      root.add(leftArm, rightArm, ...legs);
      parent.add(root);
      return { root, leftArm, rightArm, legs };
    },
    createItem: () => new THREE.Group(),
    groundHeight: () => 0.4,
    // A thin fence has a gate on the route at x=5.
    isWalkable: (x: number, z: number) => Math.abs(z) > 0.15 || x > 4.5,
    customers: [],
    bounds: { minX: -7, maxX: 27, minZ: -22, maxZ: 25 },
  } as unknown as World;
  let state = createInitialState(now);
  state.workerJobs.forester = {
    startedAt: now - (alreadyFinished ? 10_000 : 0),
    finishAt: now + (alreadyFinished ? -5_000 : 5_000),
    outputs: { wood: 4 },
  };
  let renderedState = state,
    awards = 0,
    firstDelivery = 0;
  const states = new Set<string>();
  const actors = createHarborNPCs({
    world,
    getGame: () => renderedState,
    routeTo: (from, to) =>
      from.distanceTo(to) < 0.13
        ? [to.clone()]
        : [
            new THREE.Vector3(5, 0.4, from.z),
            new THREE.Vector3(5, 0.4, to.z),
            to.clone(),
          ],
    // Only resume the imported reservation; subsequent production would obscure
    // whether this one batch was duplicated after delivery.
    onWorkerStart: () => false,
    onWorkerComplete: (role) => {
      const before = state;
      state = reduceGame(state, { type: "workerComplete", role, now });
      const completed = !!before.workerJobs[role] && !state.workerJobs[role];
      if (completed) {
        awards++;
        firstDelivery ||= (now - 1_000_000) / 1000;
        const worker = actors.diagnostics().workers[0];
        assert.ok(
          Math.hypot(
            worker.x - warehouse.workPosition.x,
            worker.z - warehouse.workPosition.z,
          ) < 0.16,
          "goods are credited at the physical warehouse, not at the work site",
        );
      }
      return completed;
    },
    onSellStock: () => 0,
  });
  t.after(() => actors.dispose());
  function frame(elapsed: number) {
    now += elapsed * 1000;
    actors.update(elapsed);
    // React publishes callback changes after a frame, not between substeps.
    renderedState = state;
    for (const worker of actors.diagnostics().workers) states.add(worker.state);
  }
  return {
    actors,
    frame,
    states,
    get state() {
      return state;
    },
    get awards() {
      return awards;
    },
    get firstDelivery() {
      return firstDelivery;
    },
  };
}

for (const fps of [60, 5, 2]) {
  test(`an imported worker reservation reaches the warehouse once at ${fps} FPS`, (t) => {
    const delivery = importedDelivery(t);
    for (let frame = 0; frame < 30 * fps; frame++) delivery.frame(1 / fps);
    assert.equal(delivery.state.stock.wood, 4);
    assert.equal(delivery.awards, 1);
    assert.equal(delivery.state.workerJobs.forester, undefined);
    assert.equal(delivery.state.inventory.wood, 0);
    assert.equal(delivery.state.coins, 120);
    assert.ok(
      delivery.firstDelivery > 12,
      "the long carrying route must actually be walked",
    );
    assert.ok(
      delivery.firstDelivery < 20,
      "low frame rates must not slow a reserved delivery",
    );
    assert.ok(delivery.states.has("working"));
    assert.ok(delivery.states.has("carrying-to-store"));
    assert.ok(delivery.states.has("unloading"));
  });
}

test("returning from a suspended tab catches up only one second before continuing the physical delivery", (t) => {
  const delivery = importedDelivery(t, true);
  delivery.frame(120);
  const worker = delivery.actors.diagnostics().workers[0];
  assert.equal(delivery.state.stock.wood, 0);
  assert.equal(delivery.awards, 0);
  assert.equal(worker.state, "carrying-to-store");
  assert.equal(worker.carrying, true);
  assert.ok(
    Math.hypot(worker.x + 2.6, worker.z + 9.3) < 3,
    "a long suspension cannot teleport the worker to storage",
  );
  assert.ok(Math.abs(delivery.actors.diagnostics().time - 1) < 1e-6);
  for (let frame = 0; frame < 40; frame++) delivery.frame(0.5);
  assert.equal(delivery.state.stock.wood, 4);
  assert.equal(delivery.awards, 1);
});
