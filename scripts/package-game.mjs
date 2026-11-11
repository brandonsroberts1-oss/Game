import { readFile, writeFile } from "node:fs/promises";

const source = new URL(
  "../standalone/Play-Frost-and-Fin.html",
  import.meta.url,
);
const destination = new URL("../Play-Frost-and-Fin.html", import.meta.url);
const html = await readFile(source, "utf8");

// Fail the build if a future dependency accidentally makes the download need a server.
if (
  /<script\b[^>]*\bsrc\s*=/i.test(html) ||
  /<link\b[^>]*\brel=["'](?:stylesheet|modulepreload)["']/i.test(html)
) {
  throw new Error(
    "The downloadable game still contains external JavaScript or stylesheets.",
  );
}
for (const link of html.matchAll(/<link\b[^>]*>/gi)) {
  const href = /\bhref=["']([^"']+)/i.exec(link[0]);
  if (href && !href[1].startsWith("data:")) {
    throw new Error(
      `The downloadable game contains a non-embedded link: ${href[1]}`,
    );
  }
}
// Inspect emitted CSS, not JavaScript template expressions that construct data
// URLs at runtime. The offline browser test also rejects runtime asset requests.
for (const style of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
  for (const match of style[1].matchAll(/url\(\s*["']?([^\s"')]+)/g)) {
    if (!match[1].startsWith("data:") && !match[1].startsWith("#")) {
      throw new Error(
        `The downloadable game contains a non-embedded asset: ${match[1]}`,
      );
    }
  }
}

await writeFile(destination, html);
console.log(
  "Ready to play: Play-Frost-and-Fin.html — open it directly in your browser.",
);
