import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import {
  createInitialState,
  resourceSaleValue,
  type GameState,
} from "../src/game/model";

const saveKey = "frost-and-fin:save:v1";
type Saved = {
  version: number;
  coins: number;
  inventory: Record<string, number>;
  upgrades: Record<string, number>;
  harvests: number;
  processed: Record<string, number>;
  workersStored: number;
  stock: Record<string, number>;
  workerJobs: Record<string, unknown>;
};
type ActorSample = {
  id: string;
  role?: string;
  state: string;
  x: number;
  z: number;
  visible?: boolean;
  carrying?: boolean | number;
  queueIndex?: number;
  armRotation?: number;
  taskRotation?: number;
};
type Frame = {
  phase: string;
  rotation: number;
  x: number;
  y: number;
  z: number;
  time: number;
  pack: number;
  cash: number;
  inventory: Record<string, number>;
  stock: Record<string, number>;
  cutSlices: number;
  cutContacts: number;
  cutKnifeX: number;
  workers: ActorSample[];
  customers: ActorSample[];
};
declare global {
  interface Window {
    __frostQASamples: Frame[];
  }
}

async function readSave(page: Page): Promise<Saved> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "{}"),
    saveKey,
  );
}
async function boot(page: Page) {
  await page.goto("/");
  await expect(page.locator(".game-screen")).toBeVisible();
  await expect(page.locator(".world-layer canvas")).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(() => page.locator("canvas").getAttribute("data-phase"), {
      timeout: 30_000,
    })
    .not.toBeNull();
  await expect.poll(async () => (await readSave(page)).version).toBe(3);
  await expect(page.locator(".game-loading")).toHaveCount(0, {
    timeout: 60_000,
  });
}
async function sceneNumber(page: Page, key: string) {
  return Number(await page.locator("canvas").getAttribute(`data-${key}`));
}
async function watchMotion(page: Page) {
  await page.addInitScript(() => {
    window.__frostQASamples = [];
    const parseActors = (raw: string | undefined) => {
      try {
        const list = JSON.parse(raw || "[]");
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    };
    const sample = () => {
      const data = document.querySelector("canvas")?.dataset;
      if (data?.phase) {
        window.__frostQASamples.push({
          phase: data.phase,
          rotation: Number(data.actionRotation),
          x: Number(data.actionX),
          y: Number(data.actionY),
          z: Number(data.actionZ),
          time: performance.now(),
          pack: parseInt(
            document.querySelector(".pack-count")?.textContent || "",
            10,
          ),
          cash: Number(
            document
              .querySelector(".money-value")
              ?.textContent?.replaceAll(",", "") || "0",
          ),
          inventory:
            JSON.parse(localStorage.getItem("frost-and-fin:save:v1") || "{}")
              .inventory || {},
          stock:
            JSON.parse(localStorage.getItem("frost-and-fin:save:v1") || "{}")
              .stock || {},
          cutSlices: Number(data.cutSlices),
          cutContacts: Number(data.cutContacts),
          cutKnifeX: Number(data.cutKnifeX),
          workers: parseActors(data.workers),
          customers: parseActors(data.customers),
        });
        if (window.__frostQASamples.length > 5000)
          window.__frostQASamples.shift();
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
async function motionSince(page: Page, since: number): Promise<Frame[]> {
  return page.evaluate(
    (start) => window.__frostQASamples.filter((frame) => frame.time >= start),
    since,
  );
}
function firstCycle(samples: Frame[], expected: string[]): Frame[] {
  const start = samples.findIndex((frame) => frame.phase === expected[0]);
  expect(start, `first ${expected[0]} frame`).toBeGreaterThanOrEqual(0);
  const last = samples.findIndex(
    (frame, index) => index >= start && frame.phase === expected.at(-1),
  );
  expect(last, `first ${expected.at(-1)} frame`).toBeGreaterThanOrEqual(start);
  const terminal = samples.findIndex(
    (frame, index) => index > last && frame.phase !== expected.at(-1),
  );
  const cycle = samples.slice(start, terminal < 0 ? undefined : terminal);
  for (const name of expected)
    expect(
      cycle.some((frame) => frame.phase === name),
      `observed ${name}`,
    ).toBe(true);
  const baseline = cycle[0].pack;
  expect(Number.isFinite(baseline), "visible cargo baseline").toBe(true);
  // Phase, rendered-object transform, and visible cargo count are sampled in the
  // same animation frame. Slow screenshots/IPC cannot turn a completed cycle
  // into a false early-payment failure or make a transient phase disappear.
  for (const frame of cycle)
    expect(frame.pack, `cargo during ${frame.phase}`).toBe(baseline);
  return cycle;
}
function rotationTravel(samples: Frame[]) {
  const values = samples.map((frame) => frame.rotation).filter(Number.isFinite);
  return Math.max(...values) - Math.min(...values);
}
function positionTravel(samples: Frame[]) {
  if (!samples.length) return 0;
  const first = samples[0];
  return Math.max(
    ...samples.map((frame) =>
      Math.hypot(frame.x - first.x, frame.y - first.y, frame.z - first.z),
    ),
  );
}
function actorSamples(
  samples: Frame[],
  kind: "workers" | "customers",
  id: string,
) {
  return samples.flatMap((frame) =>
    frame[kind]
      .filter((actor) => String(actor.id) === id)
      .map((actor) => ({ ...actor, time: frame.time })),
  );
}
function actorTravel(samples: Pick<ActorSample, "x" | "z">[]) {
  if (!samples.length) return 0;
  return Math.max(
    ...samples.map((point) =>
      Math.hypot(point.x - samples[0].x, point.z - samples[0].z),
    ),
  );
}
function customerQueueAdvances(samples: Frame[]) {
  const ids = new Set(
    samples.flatMap((frame) =>
      frame.customers.map((customer) => String(customer.id)),
    ),
  );
  return [...ids].some(
    (id) =>
      actorTravel(
        actorSamples(samples, "customers", id).filter((customer) =>
          /queue|waiting|advanc/i.test(customer.state),
        ),
      ) > 0.35,
  );
}
function assertContinuousCustomers(samples: Frame[]) {
  const previous = new Map<string, ActorSample>();
  let transitions = 0;
  for (const frame of samples)
    for (const customer of frame.customers) {
      const id = String(customer.id),
        before = previous.get(id);
      if (before && before.visible !== false && customer.visible !== false) {
        expect(
          Math.hypot(customer.x - before.x, customer.z - before.z),
          `continuous customer ${id}`,
        ).toBeLessThan(1.2);
        transitions++;
      }
      previous.set(id, customer);
    }
  expect(transitions, "sampled customer movement").toBeGreaterThan(10);
}
async function goWorkplace(page: Page, name: string) {
  await page.getByRole("button", { name: "Workplaces", exact: true }).click();
  await page.getByRole("button", { name: `Go ${name}`, exact: true }).click();
}

async function seedHarbor(page: Page, state: GameState) {
  await page.addInitScript(
    ({ key, harbor }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(harbor));
    },
    { key: saveKey, harbor: state },
  );
}

async function goto(
  page: Page,
  name: "Pines" | "Fish" | "Cut tuna" | "Market",
) {
  await page.getByRole("button", { name, exact: true }).first().click();
}
async function openBuild(
  page: Page,
  group: "Yard" | "Industry" | "Gear" | "Crew" = "Yard",
) {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("tab", { name: group, exact: true }).click();
}

for (const size of [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
]) {
  test(`phone ${size.width}×${size.height} keeps the world full screen with readable, tappable HUD`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await boot(page);
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(size.width);
    expect(dimensions.scrollHeight).toBeLessThanOrEqual(size.height + 1);
    const world = await page.locator(".world-layer").boundingBox();
    expect(world?.width).toBeGreaterThanOrEqual(size.width - 1);
    expect(world?.height).toBeGreaterThanOrEqual(size.height - 1);
    for (const name of [
      "Pines",
      "Fish",
      "Cut tuna",
      "Market",
      "Build",
      "Cargo",
      "Goals",
    ]) {
      const button = page.getByRole("button", { name, exact: true }).first();
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.width, `${name} tap width`).toBeGreaterThanOrEqual(43.5);
      expect(box?.height, `${name} tap height`).toBeGreaterThanOrEqual(43.5);
      const fontSize = await button.evaluate((element) => {
        const label =
          [...element.querySelectorAll<HTMLElement>("span")].find(
            (child) =>
              child.textContent?.trim() === element.textContent?.trim(),
          ) || element;
        return parseFloat(getComputedStyle(label).fontSize);
      });
      expect(fontSize, `${name} label font size`).toBeGreaterThanOrEqual(14);
    }
    await expect(
      page.getByText("Explore your harbor", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".work-readout")).toHaveCount(0);
    const objective = await page.locator(".objective-board").boundingBox();
    expect(objective?.y).toBeLessThan(size.height * 0.3);
    await expect(
      page.getByRole("button", { name: "Workplaces", exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        () => page.locator("canvas").getAttribute("data-generated-materials"),
        { timeout: 60_000 },
      )
      .toBe("true");
    await page.screenshot({ path: `/tmp/frost-phone-${size.width}.png` });
  });
}

test("visible tree, fishing, and steak work cycles award cargo only after real mesh animation", async ({
  browser,
}) => {
  test.setTimeout(210_000);
  const errors: string[] = [];
  const record = process.env.FROST_RECORD_VIDEO === "1";
  const context = await browser.newContext({
    baseURL: "http://localhost:5173",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    ...(record
      ? {
          recordVideo: {
            dir: "/tmp/frost-qa-video",
            size: { width: 390, height: 844 },
          },
        }
      : {}),
  });
  const page = await context.newPage(),
    video = page.video();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /THREE\.WebGLProgram|shader error/i.test(message.text())
    )
      errors.push(message.text());
  });
  try {
    await watchMotion(page);
    await boot(page);
    const initial = await readSave(page);
    await test.step("axe swings, tree falls, logs bounce and fly into the stack", async () => {
      const started = await page.evaluate(() => performance.now());
      await goto(page, "Pines");
      await expect
        .poll(async () => (await readSave(page)).inventory.wood, {
          timeout: 60_000,
        })
        .toBeGreaterThan(initial.inventory.wood);
      const cycle = firstCycle(await motionSince(page, started), [
        "tree-swing",
        "tree-fall",
        "log-bounce",
        "log-pickup",
      ]);
      expect(
        rotationTravel(cycle.filter((frame) => frame.phase === "tree-fall")),
      ).toBeGreaterThan(0.3);
      expect(
        positionTravel(cycle.filter((frame) => frame.phase === "log-pickup")),
      ).toBeGreaterThan(0.3);
    });
    await test.step("rod casts, a whole tuna flies out of water, and lands in cargo", async () => {
      const before = await readSave(page),
        started = await page.evaluate(() => performance.now());
      await goto(page, "Fish");
      await expect
        .poll(async () => (await readSave(page)).inventory.fish, {
          timeout: 60_000,
        })
        .toBeGreaterThan(before.inventory.fish);
      const cycle = firstCycle(await motionSince(page, started), [
        "cast",
        "bobber-wait",
        "fish-flight",
        "fish-land",
      ]);
      expect(
        positionTravel(cycle.filter((frame) => frame.phase === "fish-flight")),
      ).toBeGreaterThan(0.5);
    });
    await test.step("cleaver cuts the whole tuna and steaks travel on the conveyor", async () => {
      const before = await readSave(page),
        started = await page.evaluate(() => performance.now());
      await goto(page, "Cut tuna");
      await expect
        .poll(async () => (await readSave(page)).inventory.steak, {
          timeout: 60_000,
        })
        .toBeGreaterThan(before.inventory.steak);
      const samples = await motionSince(page, started);
      const cycle = firstCycle(samples, [
        "process-unload",
        "cut",
        "steak-conveyor",
        "steak-pickup",
      ]);
      const cuts = cycle.filter((frame) => frame.phase === "cut");
      expect(
        positionTravel(cuts),
        "cleaver rises and moves along the tuna",
      ).toBeGreaterThan(0.5);
      for (const frame of cuts)
        expect(
          frame.cutSlices,
          "a steak separates after the blade contacts its boundary",
        ).toBeLessThanOrEqual(Math.max(0, frame.cutContacts - 1));
      expect(
        Math.max(...cuts.map((frame) => frame.cutSlices)),
        "four physical steaks are cut from the tuna",
      ).toBe(4);
      expect(
        Math.max(...cuts.map((frame) => frame.cutContacts)),
        "head cut plus four steak cuts",
      ).toBe(5);
      const knifePositions = cuts.map((frame) => frame.cutKnifeX);
      expect(
        Math.max(...knifePositions) - Math.min(...knifePositions),
        "cleaver advances along successive tuna boundaries",
      ).toBeGreaterThan(1);
      expect(
        positionTravel(
          cycle.filter((frame) => frame.phase === "steak-conveyor"),
        ),
      ).toBeGreaterThan(0.3);
      // Compare the first persisted completed batch to its stable cutting-stage
      // inputs. Auto-work may begin another batch; it must not change this proof.
      const input = cycle.find((frame) => frame.phase === "cut")!.inventory;
      const completed =
        samples.find(
          (frame) =>
            frame.time > cycle.at(-1)!.time &&
            frame.inventory.steak > input.steak,
        )?.inventory || (await readSave(page)).inventory;
      expect(completed.fish).toBe(input.fish - 1);
      expect(completed.steak).toBe(input.steak + 4);
      await page.screenshot({ path: "/tmp/frost-work-cycle-result.png" });
    });
    await test.step("customers arrive, accept real goods, pay, and walk away as the queue advances", async () => {
      const before = await readSave(page),
        started = await page.evaluate(() => performance.now());
      await goto(page, "Market");
      await expect
        .poll(async () => (await readSave(page)).coins, { timeout: 90_000 })
        .toBeGreaterThan(before.coins);
      const sale = firstCycle(await motionSince(page, started), [
        "sale-goods",
        "sale-customer",
        "sale-cash",
      ]);
      for (const frame of sale.filter((frame) => frame.phase === "sale-cash"))
        expect(frame.cash).toBe(before.coins);
      await expect
        .poll(async () => customerQueueAdvances(await motionSince(page, 0)), {
          timeout: 15_000,
        })
        .toBe(true);
      const samples = await motionSince(page, 0),
        customers = samples.flatMap((frame) => frame.customers);
      expect(
        customers.some((customer) =>
          /arriv|enter|approaching-harbor/i.test(customer.state),
        ),
        "customers walk in",
      ).toBe(true);
      expect(
        customers.some((customer) => /serv|pay|buy/i.test(customer.state)),
        "customer service animation",
      ).toBe(true);
      expect(
        customers.some(
          (customer) =>
            /leav|exit/i.test(customer.state) && !!customer.carrying,
        ),
        "customers carry purchases away",
      ).toBe(true);
      assertContinuousCustomers(samples);
    });
    await test.step("the free forester works and delivers real goods into the warehouse", async () => {
      await expect
        .poll(async () => (await readSave(page)).stock.wood, {
          timeout: 45_000,
        })
        .toBeGreaterThan(0);
      const samples = await motionSince(page, 0);
      const forester = samples
        .flatMap((frame) => frame.workers)
        .find((worker) =>
          /forester/i.test(`${worker.role || ""} ${worker.id}`),
        );
      expect(forester, "initial working forester").toBeTruthy();
      const activity = actorSamples(samples, "workers", String(forester!.id));
      expect(
        actorTravel(activity),
        "worker walks to a job and warehouse",
      ).toBeGreaterThan(4);
      expect(
        new Set(activity.map((worker) => worker.state)).size,
        "worker changes job stages",
      ).toBeGreaterThanOrEqual(3);
      expect(
        activity.some((worker) => !!worker.carrying),
        "worker carries the actual delivery",
      ).toBe(true);
      const rotations = activity
        .map((worker) => worker.armRotation)
        .filter((value): value is number => typeof value === "number");
      expect(
        rotations.length,
        "sampled articulated worker arm",
      ).toBeGreaterThan(1);
      expect(
        Math.max(...rotations) - Math.min(...rotations),
        "worker swings the tool",
      ).toBeGreaterThan(0.3);
      await page.screenshot({ path: "/tmp/frost-v3-workers-and-market.png" });
    });
    expect(errors).toEqual([]);
    await writeFile(
      "/tmp/frost-work-cycle-transforms.json",
      JSON.stringify(
        await page.evaluate(() => window.__frostQASamples),
        null,
        2,
      ),
    );
  } finally {
    await context.close();
    if (video) await video.saveAs("/tmp/frost-v3-phone-work-cycle.webm");
  }
});

test("nineteen distinct upgrades are available and early purchases change the rendered harbor", async ({
  browser,
}) => {
  test.setTimeout(210_000);
  const catalog = await browser.newContext({
    baseURL: "http://localhost:5173",
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await catalog.newPage();
    await boot(page);
    const ids: string[] = [],
      names: string[] = [];
    await openBuild(page);
    for (const group of ["Yard", "Industry", "Gear", "Crew"]) {
      await page.getByRole("tab", { name: group, exact: true }).click();
      ids.push(
        ...(await page
          .locator(".upgrade-card")
          .evaluateAll((cards) =>
            cards.map((card) => card.getAttribute("data-upgrade") || ""),
          )),
      );
      names.push(...(await page.locator(".upgrade-card h3").allTextContents()));
    }
    expect(ids).toHaveLength(19);
    expect(new Set(ids).size).toBe(19);
    expect(new Set(names).size).toBe(19);
    await page.getByRole("button", { name: "Close menu" }).click();
    await page.screenshot({ path: "/tmp/frost-before-building.png" });
  } finally {
    await catalog.close();
  }
  // Each purchase starts a real new harbor. No save seeding or artificial money:
  // the sawmill's additional30coins are earned through actual gathering and sale.
  for (const id of ["axe", "cutter", "sawmill", "market"]) {
    const context = await browser.newContext({
      baseURL: "http://localhost:5173",
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      await boot(page);
      if (id === "sawmill") {
        await goto(page, "Pines");
        await expect
          .poll(async () => (await readSave(page)).inventory.wood, {
            timeout: 60_000,
          })
          .toBeGreaterThan(0);
        await goto(page, "Fish");
        await expect
          .poll(async () => (await readSave(page)).inventory.fish, {
            timeout: 60_000,
          })
          .toBeGreaterThan(0);
        await goto(page, "Market");
        await expect
          .poll(async () => (await readSave(page)).coins, { timeout: 60_000 })
          .toBeGreaterThanOrEqual(150);
      }
      const before = await readSave(page);
      const machinesBefore = await sceneNumber(page, "machine-count");
      await openBuild(
        page,
        id === "axe" ? "Gear" : id === "market" ? "Yard" : "Industry",
      );
      const buy = page.locator(`.upgrade-buy[data-upgrade="${id}"]`);
      await expect(buy).toBeEnabled();
      await buy.click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect
        .poll(async () => (await readSave(page)).upgrades[id])
        .toBe(before.upgrades[id] + 1);
      expect((await readSave(page)).coins).toBeLessThan(before.coins);
      await expect
        .poll(
          async () =>
            JSON.parse(
              (await page
                .locator("canvas")
                .getAttribute("data-upgrade-visuals")) || "{}",
            )[id],
        )
        .toBe(1);
      if (id !== "axe")
        await expect
          .poll(() => sceneNumber(page, "machine-count"))
          .toBeGreaterThan(machinesBefore);
      await page.screenshot({ path: `/tmp/frost-built-${id}.png` });
    } finally {
      await context.close();
    }
  }
});

test("touch joystick moves the captain through the world and the camera follows", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:5173",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await boot(page);
    const before = {
      x: await sceneNumber(page, "player-x"),
      z: await sceneNumber(page, "player-z"),
      cameraX: await sceneNumber(page, "camera-x"),
      cameraZ: await sceneNumber(page, "camera-z"),
    };
    const joystick = page.getByLabel("Move captain");
    const box = await joystick.boundingBox();
    if (!box) throw new Error("Joystick is missing");
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...center, radiusX: 6, radiusY: 6 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: center.x + 36, y: center.y, radiusX: 6, radiusY: 6 }],
    });
    await expect
      .poll(async () =>
        Math.hypot(
          (await sceneNumber(page, "player-x")) - before.x,
          (await sceneNumber(page, "player-z")) - before.z,
        ),
      )
      .toBeGreaterThan(0.75);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () =>
        Math.hypot(
          (await sceneNumber(page, "camera-x")) - before.cameraX,
          (await sceneNumber(page, "camera-z")) - before.cameraZ,
        ),
      )
      .toBeGreaterThan(0.35);
    await page.screenshot({ path: "/tmp/frost-joystick-camera.png" });
  } finally {
    await context.close();
  }
});

test("a completed work cycle, sale, and upgrade persist after reload", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await boot(page);
  const before = await readSave(page);
  await goto(page, "Pines");
  await expect
    .poll(async () => (await readSave(page)).inventory.wood, {
      timeout: 60_000,
    })
    .toBeGreaterThan(before.inventory.wood);
  const loaded = await readSave(page);
  await page.reload();
  await expect(page.locator(".game-screen")).toBeVisible();
  await expect
    .poll(async () => (await readSave(page)).inventory.wood)
    .toBe(loaded.inventory.wood);
  await goto(page, "Market");
  await expect
    .poll(async () => (await readSave(page)).coins, { timeout: 60_000 })
    .toBeGreaterThan(loaded.coins);
  const sold = await readSave(page);
  expect(sold.inventory.wood).toBe(0);
  await openBuild(page, "Gear");
  await page.locator('.upgrade-buy[data-upgrade="axe"]').click();
  await expect.poll(async () => (await readSave(page)).upgrades.axe).toBe(1);
  const upgraded = await readSave(page);
  await page.reload();
  await expect
    .poll(async () => (await readSave(page)).coins)
    .toBe(upgraded.coins);
  expect((await readSave(page)).upgrades.axe).toBe(1);
});

test("save export contains the current version-three harbor", async ({
  page,
}) => {
  await boot(page);
  await page
    .getByRole("button", { name: "Game settings", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export save", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Save backup was not downloaded");
  const data = JSON.parse(await readFile(path, "utf8"));
  expect(data.version).toBe(3);
  expect(Object.keys(data.upgrades)).toHaveLength(19);
  expect(data.coins).toBe((await readSave(page)).coins);
});

test("importing a harbor during an active worker job replaces the actors and resumes the imported delivery", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await boot(page);
  await expect
    .poll(async () => !!(await readSave(page)).workerJobs.forester, {
      timeout: 30_000,
    })
    .toBe(true);
  const previousCanvas = await page.locator("canvas").elementHandle();
  if (!previousCanvas) throw new Error("Original harbor canvas is missing");
  await page
    .getByRole("button", { name: "Game settings", exact: true })
    .click();
  const imported = createInitialState();
  imported.coins = 777;
  imported.inventory.crab = 2;
  imported.stock.tackle = 3;
  imported.upgrades.crew = 2;
  imported.workerJobs.forester = {
    startedAt: Date.now(),
    finishAt: Date.now() + 5000,
    outputs: { wood: 4 },
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: "returning-harbor.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect
    .poll(() => previousCanvas.evaluate((canvas) => canvas.isConnected))
    .toBe(false);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".game-loading")).toHaveCount(0, {
    timeout: 60_000,
  });
  await expect.poll(async () => (await readSave(page)).coins).toBe(777);
  const restored = await readSave(page);
  expect(restored.inventory.crab).toBe(2);
  expect(restored.stock.tackle).toBe(3);
  expect(restored.upgrades.crew).toBe(2);
  await expect
    .poll(async () => (await readSave(page)).stock.wood, { timeout: 60_000 })
    .toBeGreaterThanOrEqual(4);
  await expect
    .poll(async () =>
      JSON.parse(
        (await page.locator("canvas").getAttribute("data-workers")) || "[]",
      ).some(
        (worker: { role: string; delivered: number }) =>
          worker.role === "forester" && worker.delivered > 0,
      ),
    )
    .toBe(true);
  expect(
    (await readSave(page)).coins,
    "delivery creates goods, not phantom wages",
  ).toBe(777);
  expect((await readSave(page)).inventory.crab).toBe(2);
});

test("the expanded coast offers animated crab, kelp, and ore gathering before any buildings are purchased", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const harbor = createInitialState();
  // Faster walking keeps this distant-coast tour focused on the new work cycles.
  harbor.upgrades.boots = 5;
  await seedHarbor(page, harbor);
  await watchMotion(page);
  await boot(page);
  const bounds = JSON.parse(
    (await page.locator("canvas").getAttribute("data-world-bounds")) || "{}",
  );
  expect(bounds.maxX - bounds.minX, "harbor width").toBeGreaterThan(30);
  expect(bounds.maxZ - bounds.minZ, "harbor length").toBeGreaterThan(40);
  for (const activity of [
    {
      name: "Crab pots",
      resource: "crab",
      phases: ["pot-lower", "pot-haul", "gather-pickup"],
    },
    {
      name: "Kelp beds",
      resource: "kelp",
      phases: ["kelp-cut", "gather-pickup"],
    },
    {
      name: "Quarry",
      resource: "ore",
      phases: ["ore-strike", "gather-pickup"],
    },
  ] as const) {
    const before = await readSave(page),
      started = await page.evaluate(() => performance.now());
    await goWorkplace(page, activity.name);
    await expect
      .poll(async () => (await readSave(page)).inventory[activity.resource], {
        timeout: 60_000,
      })
      .toBeGreaterThan(before.inventory[activity.resource]);
    const cycle = firstCycle(await motionSince(page, started), [
      ...activity.phases,
    ]);
    expect(
      positionTravel(cycle.filter((frame) => frame.phase === "gather-pickup")),
      `${activity.resource} carried into pack`,
    ).toBeGreaterThan(0.25);
  }
  const saved = await readSave(page);
  for (const id of ["crabpots", "kelpfarm", "quarry"])
    expect(saved.upgrades[id]).toBe(0);
  expect(saved.coins, "gathering does not generate unearned money").toBe(
    harbor.coins,
  );
  await page.screenshot({ path: "/tmp/frost-v3-expanded-coast.png" });
});

test("the forge, kitchen, and boatyard animate complete recipes and consume their real ingredients", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const harbor = createInitialState();
  Object.assign(harbor.upgrades, {
    boots: 5,
    backpack: 2,
    forge: 1,
    kitchen: 1,
    boatyard: 1,
  });
  Object.assign(harbor.inventory, {
    ore: 3,
    wood: 1,
    steak: 1,
    kelp: 1,
    plank: 2,
    ingot: 1,
  });
  await seedHarbor(page, harbor);
  await watchMotion(page);
  await boot(page);
  for (const recipe of [
    {
      name: "Forge",
      product: "ingot",
      phase: "forge-work",
      inputs: { ore: 3, wood: 1 },
    },
    {
      name: "Kitchen",
      product: "meal",
      phase: "kitchen-work",
      inputs: { steak: 1, kelp: 1 },
    },
    {
      name: "Boatyard",
      product: "tackle",
      phase: "tackle-work",
      inputs: { plank: 2, ingot: 1 },
    },
  ] as const) {
    const before = await readSave(page),
      started = await page.evaluate(() => performance.now());
    await goWorkplace(page, recipe.name);
    await expect
      .poll(async () => (await readSave(page)).inventory[recipe.product], {
        timeout: 60_000,
      })
      .toBe(before.inventory[recipe.product] + 2);
    const cycle = firstCycle(await motionSince(page, started), [
      "process-unload",
      recipe.phase,
      "goods-conveyor",
      "goods-pickup",
    ]);
    expect(
      positionTravel(cycle.filter((frame) => frame.phase === "goods-conveyor")),
      `${recipe.product} moves on the conveyor`,
    ).toBeGreaterThan(0.25);
    const after = await readSave(page);
    for (const [resource, quantity] of Object.entries(recipe.inputs))
      expect(after.inventory[resource]).toBe(
        before.inventory[resource] - quantity,
      );
    await page.screenshot({
      path: `/tmp/frost-v3-${recipe.name.toLowerCase()}.png`,
    });
  }
});

test("warehouse transfers happen after carrying animation and deposit never reverses into automatic collection", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const harbor = createInitialState();
  harbor.upgrades.boots = 5;
  Object.assign(harbor.inventory, { ore: 3, wood: 2 });
  harbor.stock.tackle = 4;
  await seedHarbor(page, harbor);
  await watchMotion(page);
  await boot(page);
  const started = await page.evaluate(() => performance.now());
  await page
    .getByRole("button", { name: "Open warehouse", exact: true })
    .click();
  await expect(
    page.locator('[data-stock-resource="tackle"] strong'),
  ).toHaveText("4");
  await page
    .getByRole("button", { name: "Deposit supplies", exact: true })
    .click();
  await expect
    .poll(async () => (await readSave(page)).stock.ore, { timeout: 60_000 })
    .toBe(3);
  firstCycle(await motionSince(page, started), [
    "stock-unload",
    "stock-transfer",
  ]);
  expect((await readSave(page)).inventory.ore).toBe(0);
  await expect
    .poll(() => page.locator("canvas").getAttribute("data-phase"))
    .toBe("idle");
  // Allow more than another transfer's duration: the deposited load must stay stored.
  await page.waitForTimeout(2600);
  expect((await readSave(page)).inventory.ore).toBe(0);
  expect((await readSave(page)).stock.ore).toBe(3);
  await page
    .getByRole("button", { name: "Open warehouse", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collect goods", exact: true })
    .click();
  await expect
    .poll(async () => (await readSave(page)).inventory.tackle, {
      timeout: 30_000,
    })
    .toBe(4);
  const collected = await readSave(page);
  expect(collected.inventory.ore).toBe(3);
  expect(collected.stock.tackle).toBe(0);
  expect(collected.stock.ore).toBe(0);
});

test("the porter carries warehouse goods to a walking customer and earns money only at payment", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const harbor = createInitialState();
  harbor.upgrades.crew = 5;
  harbor.stock.tackle = 4;
  await seedHarbor(page, harbor);
  await watchMotion(page);
  await boot(page);
  await expect
    .poll(async () => (await readSave(page)).coins, { timeout: 90_000 })
    .toBeGreaterThan(harbor.coins);
  const samples = await motionSince(page, 0),
    paidIndex = samples.findIndex((frame) => frame.cash > harbor.coins);
  expect(
    paidIndex,
    "payment appears in the recorded scene frames",
  ).toBeGreaterThan(0);
  const beforePayment = samples.slice(0, paidIndex),
    payment = samples[paidIndex];
  expect(
    beforePayment.every((frame) => frame.stock.tackle === 4),
    "warehouse goods stay reserved until customer pays",
  ).toBe(true);
  const porter = actorSamples(beforePayment, "workers", "porter");
  expect(
    porter.some(
      (worker) => worker.state === "bringing-order" && !!worker.carrying,
    ),
    "porter carries the order",
  ).toBe(true);
  expect(
    actorTravel(porter),
    "porter walks from storage to market",
  ).toBeGreaterThan(3);
  expect(
    beforePayment.some((frame) =>
      frame.customers.some((customer) => customer.state === "paying"),
    ),
    "customer shows payment before coins change",
  ).toBe(true);
  expect(payment.stock.tackle).toBe(1);
  expect(payment.cash).toBe(
    harbor.coins + resourceSaleValue(harbor, "tackle", 3),
  );
  expect(
    samples.some((frame) =>
      frame.customers.some(
        (customer) => customer.state === "leaving" && !!customer.carrying,
      ),
    ),
  ).toBe(true);
  assertContinuousCustomers(samples);
  await page.screenshot({ path: "/tmp/frost-v3-porter-sale.png" });
});

test("a returning captain collects crew earnings at the market with an empty pack", async ({
  page,
}) => {
  const returningCaptain = createInitialState();
  returningCaptain.upgrades.crew = 1;
  returningCaptain.workersStored = 60;
  await watchMotion(page);
  await page.addInitScript(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
    },
    { key: saveKey, state: returningCaptain },
  );
  await boot(page);
  expect(
    Object.values((await readSave(page)).inventory).every(
      (amount) => amount === 0,
    ),
  ).toBe(true);
  const started = await page.evaluate(() => performance.now());
  await goto(page, "Market");
  await expect
    .poll(async () => (await readSave(page)).coins, { timeout: 45_000 })
    .toBeGreaterThanOrEqual(180);
  const cycle = firstCycle(await motionSince(page, started), [
    "sale-goods",
    "sale-customer",
    "sale-cash",
  ]);
  for (const frame of cycle.filter((frame) => frame.phase === "sale-cash"))
    expect(frame.cash).toBe(120);
  // Migrated wages are paid once; V3 workers deliver goods rather than wages.
  expect((await readSave(page)).workersStored).toBe(0);
  expect(
    Object.values((await readSave(page)).inventory).every(
      (amount) => amount === 0,
    ),
  ).toBe(true);
});
