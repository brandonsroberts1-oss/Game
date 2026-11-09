import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createInitialState } from "../src/game/model";

const saveKey = "frost-and-fin:save:v1";
type Saved = {
  version: number;
  coins: number;
  inventory: Record<string, number>;
  upgrades: Record<string, number>;
  harvests: number;
  processed: Record<string, number>;
  workersStored: number;
};
type Frame = {
  phase: string;
  rotation: number;
  x: number;
  y: number;
  z: number;
  time: number;
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
  await expect.poll(async () => (await readSave(page)).version).toBe(2);
}
async function phase(page: Page, value: string) {
  await expect
    .poll(() => page.locator("canvas").getAttribute("data-phase"), {
      timeout: 45_000,
      intervals: [20, 40, 80],
    })
    .toBe(value);
}
async function sceneNumber(page: Page, key: string) {
  return Number(await page.locator("canvas").getAttribute(`data-${key}`));
}
async function watchMotion(page: Page) {
  await page.addInitScript(() => {
    window.__frostQASamples = [];
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
        });
        if (window.__frostQASamples.length > 5000)
          window.__frostQASamples.shift();
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
async function frames(page: Page, phaseName: string): Promise<Frame[]> {
  return page.evaluate(
    (value) => window.__frostQASamples.filter((frame) => frame.phase === value),
    phaseName,
  );
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
async function goto(
  page: Page,
  name: "Pines" | "Fish" | "Cut tuna" | "Market",
) {
  await page.getByRole("button", { name, exact: true }).first().click();
}
async function openBuild(page: Page, group: "Yard" | "Gear" | "Crew" = "Yard") {
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
  const page = await context.newPage();
  const video = page.video();
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await watchMotion(page);
    await boot(page);
    const initial = await readSave(page);
    await test.step("axe swings, tree falls, logs bounce and fly into the stack", async () => {
      await goto(page, "Pines");
      await phase(page, "tree-swing");
      expect((await readSave(page)).inventory.wood).toBe(
        initial.inventory.wood,
      );
      await page.screenshot({ path: "/tmp/frost-tree-swing.png" });
      await phase(page, "tree-fall");
      expect((await readSave(page)).inventory.wood).toBe(
        initial.inventory.wood,
      );
      await expect
        .poll(async () => rotationTravel(await frames(page, "tree-fall")), {
          timeout: 10_000,
          intervals: [40, 80],
        })
        .toBeGreaterThan(0.3);
      await page.screenshot({ path: "/tmp/frost-tree-fall.png" });
      await phase(page, "log-pickup");
      await expect
        .poll(async () => (await readSave(page)).inventory.wood, {
          timeout: 20_000,
        })
        .toBeGreaterThan(initial.inventory.wood);
      expect(positionTravel(await frames(page, "log-pickup"))).toBeGreaterThan(
        0.3,
      );
      await page.screenshot({ path: "/tmp/frost-log-stack.png" });
    });
    await test.step("rod casts, a whole tuna flies out of water, and lands in cargo", async () => {
      const before = await readSave(page);
      await goto(page, "Fish");
      await phase(page, "cast");
      expect((await readSave(page)).inventory.fish).toBe(before.inventory.fish);
      await phase(page, "fish-flight");
      expect((await readSave(page)).inventory.fish).toBe(before.inventory.fish);
      await expect
        .poll(async () => positionTravel(await frames(page, "fish-flight")), {
          timeout: 10_000,
          intervals: [40, 80],
        })
        .toBeGreaterThan(0.5);
      await page.screenshot({ path: "/tmp/frost-tuna-flight.png" });
      await phase(page, "fish-land");
      await expect
        .poll(async () => (await readSave(page)).inventory.fish, {
          timeout: 20_000,
        })
        .toBeGreaterThan(before.inventory.fish);
    });
    await test.step("cleaver cuts the whole tuna and steaks travel on the conveyor", async () => {
      const before = await readSave(page);
      await goto(page, "Cut tuna");
      await phase(page, "cut");
      expect((await readSave(page)).inventory.steak).toBe(
        before.inventory.steak,
      );
      await expect
        .poll(async () => rotationTravel(await frames(page, "cut")), {
          timeout: 10_000,
          intervals: [40, 80],
        })
        .toBeGreaterThan(0.1);
      await page.screenshot({ path: "/tmp/frost-tuna-cut.png" });
      await phase(page, "steak-conveyor");
      expect((await readSave(page)).inventory.steak).toBe(
        before.inventory.steak,
      );
      await expect
        .poll(
          async () => positionTravel(await frames(page, "steak-conveyor")),
          { timeout: 10_000, intervals: [40, 80] },
        )
        .toBeGreaterThan(0.3);
      await page.screenshot({ path: "/tmp/frost-steak-conveyor.png" });
      await phase(page, "steak-pickup");
      await expect
        .poll(async () => (await readSave(page)).inventory.steak, {
          timeout: 20_000,
        })
        .toBeGreaterThan(before.inventory.steak);
      const after = await readSave(page);
      expect(after.inventory.fish).toBeLessThan(before.inventory.fish);
      await page.screenshot({ path: "/tmp/frost-work-cycle-result.png" });
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
    if (video) await video.saveAs("/tmp/frost-phone-work-cycle.webm");
  }
});

test("twelve distinct upgrades are available and early purchases change the rendered harbor", async ({
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
    for (const group of ["Yard", "Gear", "Crew"]) {
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
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    expect(new Set(names).size).toBe(12);
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
      await openBuild(page, id === "axe" ? "Gear" : "Yard");
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

test("save export contains the current version-two harbor", async ({
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
  expect(data.version).toBe(2);
  expect(Object.keys(data.upgrades)).toHaveLength(12);
  expect(data.coins).toBe((await readSave(page)).coins);
});

test("a returning captain collects crew earnings at the market with an empty pack", async ({
  page,
}) => {
  const returningCaptain = createInitialState();
  returningCaptain.upgrades.crew = 1;
  returningCaptain.workersStored = 60;
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
  await goto(page, "Market");
  await phase(page, "sale-cash");
  expect((await readSave(page)).coins).toBe(120);
  await expect
    .poll(async () => (await readSave(page)).coins, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(180);
  await expect.poll(async () => (await readSave(page)).workersStored).toBe(0);
  expect(
    Object.values((await readSave(page)).inventory).every(
      (amount) => amount === 0,
    ),
  ).toBe(true);
});
