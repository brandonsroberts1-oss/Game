import { expect, test, type Page } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";

const saveKey = "frost-and-fin:save:v1";

async function boot(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Frosthaven Harbor" }),
  ).toBeVisible();
  await expect(page.locator(".world-loading")).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator("canvas")).toBeVisible();
}

async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "{}"),
    saveKey,
  );
}

async function clickWorld(
  page: Page,
  position: [number, number, number],
  touch = false,
) {
  const canvas = page.locator("canvas");
  const rect = await canvas.boundingBox();
  if (!rect) throw new Error("Game canvas is missing");
  const aspect = rect.width / rect.height;
  const half = Math.max(10, 14 / aspect);
  const camera = new OrthographicCamera(
    -half * aspect,
    half * aspect,
    half,
    -half,
    0.1,
    180,
  );
  camera.position.set(24, 28, 32);
  camera.lookAt(0, 0, 1.3);
  camera.zoom = 1.15;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const projected = new Vector3(...position).project(camera);
  const point = {
    position: {
      x: ((projected.x + 1) * rect.width) / 2,
      y: ((1 - projected.y) * rect.height) / 2,
    },
  };
  if (touch) await canvas.tap(point);
  else await canvas.click(point);
}

test("renders a running winter harbor without browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await boot(page);
  await expect(
    page.getByRole("button", { name: "240 coins. Open market" }),
  ).toBeVisible();
  await expect(page.locator(".resource-summary")).toContainText("8");
  await expect(page.locator(".resource-summary")).toContainText("4");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/frost-full.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("selling clears inventory once and persists the exact coins after reload", async ({
  page,
}) => {
  await boot(page);
  await page
    .getByRole("button", { name: "Sell your catch", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("126");
  await dialog
    .getByRole("button", { name: "Sell everything in your pack" })
    .click();
  await expect(
    page.getByRole("button", { name: "366 coins. Open market" }),
  ).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Sell your catch", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "The counter is clear. Time to fish!" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect.poll(async () => (await stored(page)).coins).toBe(366);
  const data = await stored(page);
  expect(data.inventory).toEqual({ wood: 0, fish: 0, salmon: 0 });
  expect(data.trades).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "366 coins. Open market" }),
  ).toBeVisible();
  await expect(page.locator(".pack-label")).toContainText("0 / 40");
});

test("buying a backpack spends coins, increases capacity, and persists", async ({
  page,
}) => {
  await boot(page);
  await page
    .getByRole("button", { name: "Build & upgrade", exact: false })
    .click();
  const option = page
    .locator(".upgrade-option")
    .filter({
      has: page.getByRole("heading", { name: "Bigger backpack", exact: true }),
    });
  await option.getByRole("button", { name: "Upgrade 120" }).click();
  await expect(option).toContainText("LEVEL 1 / 25");
  await expect(
    page.getByRole("button", { name: "120 coins. Open market" }),
  ).toBeVisible();
  await expect(page.locator(".pack-label")).toContainText("15 / 60");
  await expect(
    option.getByRole("button", { name: "Keep trading 186" }),
  ).toBeDisabled();
  await expect
    .poll(async () => (await stored(page)).upgrades?.backpack)
    .toBe(1);
  await page.reload();
  await expect(page.locator(".pack-label")).toContainText("15 / 60");
});

test("modal keyboard focus is trapped and Escape returns focus to its trigger", async ({
  page,
}) => {
  await boot(page);
  const trigger = page.getByRole("button", {
    name: "Sell your catch",
    exact: true,
  });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Sell everything in your pack" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("clicking the fishing ring moves the captain and gathers real fish", async ({
  page,
}) => {
  await boot(page);
  await clickWorld(page, [-3.45, 0.78, 2.7]);
  await expect
    .poll(async () => (await stored(page)).inventory?.fish, { timeout: 30_000 })
    .toBeGreaterThan(4);
  const data = await stored(page);
  expect(data.harvests).toBeGreaterThan(0);
  expect(data.xp).toBeGreaterThan(0);
  expect(
    data.inventory.wood + data.inventory.fish + data.inventory.salmon,
  ).toBeGreaterThan(15);
});

test("mobile layout fits the screen and menus remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: "/tmp/frost-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "World map", exact: false }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page
      .getByRole("heading", { name: "Frosthaven Harbor", exact: true })
      .last(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reach level 3" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close menu" }).click();
  await page
    .getByRole("button", { name: "Sell your catch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sell everything in your pack" })
    .click();
  await expect(
    page.getByRole("button", { name: "366 coins. Open market" }),
  ).toBeVisible();
});

test("backup download contains current progress and accepts its own save file", async ({
  page,
}) => {
  await boot(page);
  await page
    .getByRole("button", { name: "Game settings", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export save", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("frost-and-fin-save.json");
  const path = await download.path();
  if (!path) throw new Error("Save download unavailable");
  const data = JSON.parse(
    await (await import("node:fs/promises")).readFile(path, "utf8"),
  );
  expect(data.coins).toBe(240);
  expect(data.inventory).toEqual({ wood: 8, fish: 4, salmon: 3 });
  await page.locator('input[type="file"]').setInputFiles(path);
  await expect(page.getByRole("status")).toContainText(
    "Your harbor is right where you left it.",
  );
});

test("touchscreen tapping a fishing spot gathers fish on a phone-sized viewport", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "http://localhost:5173",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await boot(page);
  await clickWorld(page, [-3.45, 0.78, 2.7], true);
  await expect
    .poll(async () => (await stored(page)).inventory?.fish, { timeout: 30_000 })
    .toBeGreaterThan(4);
  await expect
    .poll(async () =>
      Number(
        await page
          .locator('.resource-summary button[title="Fresh tuna"] strong')
          .innerText(),
      ),
    )
    .toBeGreaterThan(4);
  await context.close();
});
