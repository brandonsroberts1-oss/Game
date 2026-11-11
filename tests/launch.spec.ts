import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const distRoot = resolve(repository, "dist");
const saveKey = "frost-and-fin:save:v1";
let server: Server;
let serverOrigin: string;

test.beforeAll(async () => {
  const contentTypes: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    // A root-relative /assets or /favicon request must fail, as it would for a Pages project.
    if (!pathname.startsWith("/Game/")) {
      response.writeHead(404).end();
      return;
    }
    let target: string;
    try {
      target = resolve(
        distRoot,
        decodeURIComponent(pathname.slice("/Game/".length)) || "index.html",
      );
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (!target.startsWith(distRoot + sep)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(target);
      response.writeHead(200, {
        "Content-Type":
          contentTypes[extname(target)] || "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Production fixture did not start");
  serverOrigin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server)
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
});

async function assertWorldReady(page: Page) {
  await expect(page.locator(".game-screen")).toBeVisible();
  await expect(page.locator(".world-layer canvas")).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(() => page.locator("canvas").getAttribute("data-phase"))
    .not.toBeNull();
  await expect.poll(async () => (await readSave(page)).version).toBe(3);
  await expect
    .poll(
      () => page.locator("canvas").getAttribute("data-generated-materials"),
      { timeout: 60_000 },
    )
    .toBe("true");
  await expect(page.locator(".game-loading")).toHaveCount(0, {
    timeout: 60_000,
  });
  await page.evaluate(() => document.fonts.ready);
}

async function assertBuildingArtReady(page: Page) {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("tab", { name: "Industry", exact: true }).click();
  const art = page.locator(".generated-building-art").first();
  await expect(art).toBeVisible();
  const dimensions = await art.evaluate(async (element) => {
    const background = getComputedStyle(element).backgroundImage;
    if (!background.startsWith("url("))
      throw new Error("Generated building art has no image URL");
    const image = new Image();
    image.src = background.slice(4, -1).replace(/^["']|["']$/g, "");
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(dimensions.width).toBeGreaterThan(1000);
  expect(dimensions.height).toBeGreaterThan(1000);
  await page.getByRole("button", { name: "Close menu", exact: true }).click();
}
async function readSave(page: Page): Promise<{
  version: number;
  coins: number;
  inventory: Record<string, number>;
  upgrades: Record<string, number>;
}> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "{}"),
    saveKey,
  );
}
async function travel(
  page: Page,
  name: "Pines" | "Fish" | "Cut tuna" | "Market",
) {
  await page.getByRole("button", { name, exact: true }).first().click();
}
async function buyAxe(page: Page) {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByRole("tab", { name: "Gear", exact: true }).click();
  await page.locator('.upgrade-buy[data-upgrade="axe"]').click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(async () => (await readSave(page)).upgrades.axe).toBe(1);
}

function observeLaunch(page: Page) {
  const errors: string[] = [],
    failures: string[] = [],
    badResponses: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /THREE\.WebGLProgram|shader error/i.test(message.text())
    )
      errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  page.on("requestfailed", (request) =>
    failures.push(`${request.url()} ${request.failure()?.errorText}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      badResponses.push(`${response.status()} ${response.url()}`);
  });
  return { errors, failures, badResponses, requests };
}

test("production build under /Game/ gathers, physically sells, and builds with all assets present", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const observed = observeLaunch(page);
  await page.goto(`${serverOrigin}/Game/`);
  await assertWorldReady(page);
  const initial = await readSave(page);
  await travel(page, "Pines");
  await expect
    .poll(async () => (await readSave(page)).inventory.wood, {
      timeout: 60_000,
    })
    .toBeGreaterThan(initial.inventory.wood);
  await travel(page, "Market");
  await expect
    .poll(async () => (await readSave(page)).coins, { timeout: 60_000 })
    .toBeGreaterThan(initial.coins);
  await buyAxe(page);
  await assertBuildingArtReady(page);
  expect(
    observed.requests.filter(
      (url) =>
        url.startsWith(serverOrigin) &&
        !url.startsWith(`${serverOrigin}/Game/`),
    ),
  ).toEqual([]);
  expect(observed.errors).toEqual([]);
  expect(observed.failures).toEqual([]);
  expect(observed.badResponses).toEqual([]);
});

async function exerciseOfflineGame(
  page: Page,
  observed: ReturnType<typeof observeLaunch>,
  entry: string,
) {
  await assertWorldReady(page);
  const initial = await readSave(page);
  await travel(page, "Fish");
  await expect
    .poll(async () => (await readSave(page)).inventory.fish, {
      timeout: 60_000,
    })
    .toBeGreaterThan(initial.inventory.fish);
  await travel(page, "Cut tuna");
  await expect
    .poll(async () => (await readSave(page)).inventory.steak, {
      timeout: 60_000,
    })
    .toBeGreaterThan(initial.inventory.steak);
  await travel(page, "Market");
  await expect
    .poll(async () => (await readSave(page)).coins, { timeout: 60_000 })
    .toBeGreaterThan(initial.coins);
  await buyAxe(page);
  const saved = await readSave(page);
  await page.reload();
  await assertWorldReady(page);
  expect((await readSave(page)).coins).toBe(saved.coins);
  expect((await readSave(page)).upgrades.axe).toBe(1);
  await assertBuildingArtReady(page);
  expect(
    observed.requests.filter((url) => /^https?:/.test(url) && url !== entry),
  ).toEqual([]);
  expect(
    observed.requests.filter((url) => url.startsWith("file:") && url !== entry),
  ).toEqual([]);
  expect(observed.errors).toEqual([]);
  expect(observed.failures).toEqual([]);
  expect(observed.badResponses).toEqual([]);
}

test("standalone HTML opens directly from an isolated file and plays offline", async ({
  browser,
}) => {
  const directory = await mkdtemp(join(tmpdir(), "frost-and-fin-launch-"));
  const standalone = join(directory, "Play-Frost-and-Fin.html");
  // Copying into an otherwise empty folder proves this file does not rely on neighboring dist assets.
  await copyFile(join(repository, "Play-Frost-and-Fin.html"), standalone);
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    const observed = observeLaunch(page);
    const entry = pathToFileURL(standalone).href;
    try {
      await page.goto(entry);
    } catch (error) {
      if (!String(error).includes("ERR_BLOCKED_BY_ADMINISTRATOR")) throw error;
      // This is a browser administrator restriction, not an application result.
      // Keep it explicitly skipped; the separate intercepted-document test below
      // verifies the artifact bytes without claiming file-origin support.
      test.skip(
        true,
        "Managed Chromium enterprise policy blocks file:// navigation (ERR_BLOCKED_BY_ADMINISTRATOR). Opening the file itself and file-origin storage are unverified here.",
      );
    }
    await exerciseOfflineGame(page, observed, entry);
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("standalone artifact plays and saves offline using one intercepted document and no asset requests", async ({
  browser,
}) => {
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const entry = "https://standalone.invalid/Play-Frost-and-Fin.html";
    const html = await readFile(
      join(repository, "Play-Frost-and-Fin.html"),
      "utf8",
    );
    // The exact built artifact is the sole response. Every other URL is rejected,
    // so fonts, JavaScript, styles, and art must all be embedded in this document.
    await context.route("**/*", (route) =>
      route.request().url() === entry
        ? route.fulfill({ status: 200, contentType: "text/html", body: html })
        : route.abort(),
    );
    const page = await context.newPage();
    const observed = observeLaunch(page);
    await page.goto(entry);
    await exerciseOfflineGame(page, observed, entry);
  } finally {
    await context.close();
  }
});
