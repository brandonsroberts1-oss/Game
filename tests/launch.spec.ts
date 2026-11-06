import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OrthographicCamera, Vector3 } from "three";

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
  await expect(
    page.getByRole("heading", { name: "Frosthaven Harbor", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".world-loading")).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.locator("canvas")).toBeVisible();
  // Waiting on the actual bundled fonts catches font files accidentally left outside the HTML.
  await page.evaluate(() => document.fonts.ready);
}

function observeLaunch(page: Page) {
  const errors: string[] = [],
    failures: string[] = [],
    badResponses: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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

async function buyBackpack(page: Page) {
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
  await expect(page.locator(".pack-label")).toContainText("0 / 60");
  await page.getByRole("button", { name: "Close menu" }).click();
}

async function tapFishingSpot(page: Page) {
  const canvas = page.locator("canvas");
  const rect = await canvas.boundingBox();
  if (!rect) throw new Error("World canvas is missing");
  const aspect = rect.width / rect.height,
    half = Math.max(10, 14 / aspect);
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
  const point = new Vector3(-3.45, 0.78, 2.7).project(camera);
  await canvas.click({
    position: {
      x: ((point.x + 1) * rect.width) / 2,
      y: ((1 - point.y) * rect.height) / 2,
    },
  });
}

test("production build runs under /Game/ with all assets and a complete trade and upgrade", async ({
  page,
}) => {
  const observed = observeLaunch(page);
  await page.goto(`${serverOrigin}/Game/`);
  await assertWorldReady(page);
  await page
    .getByRole("button", { name: "Sell your catch", exact: true })
    .click();
  await expect(page.locator(".market-total")).toContainText("126");
  await page
    .getByRole("button", { name: "Sell everything in your pack" })
    .click();
  await expect(
    page.getByRole("button", { name: "366 coins. Open market" }),
  ).toBeVisible();
  await buyBackpack(page);
  await expect(
    page.getByRole("button", { name: "246 coins. Open market" }),
  ).toBeVisible();
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
  await tapFishingSpot(page);
  await expect
    .poll(
      async () =>
        Number(
          await page
            .locator('.resource-summary button[title="Fresh tuna"] strong')
            .innerText(),
        ),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(4);
  await page
    .getByRole("button", { name: "Sell your catch", exact: true })
    .click();
  const value = Number(
    (await page.locator(".market-total strong").innerText()).replaceAll(
      ",",
      "",
    ),
  );
  expect(value).toBeGreaterThan(126);
  await page
    .getByRole("button", { name: "Sell everything in your pack" })
    .click();
  await expect(
    page.getByRole("button", { name: `${240 + value} coins. Open market` }),
  ).toBeVisible();
  await buyBackpack(page);
  const expectedCoins = 240 + value - 120;
  await expect(
    page.getByRole("button", { name: `${expectedCoins} coins. Open market` }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) || "{}").upgrades?.backpack,
        saveKey,
      ),
    )
    .toBe(1);
  await page.reload();
  await assertWorldReady(page);
  await expect(
    page.getByRole("button", { name: `${expectedCoins} coins. Open market` }),
  ).toBeVisible();
  await expect(page.locator(".pack-label")).toContainText("0 / 60");
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
    viewport: { width: 1440, height: 1050 },
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
    viewport: { width: 1440, height: 1050 },
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
