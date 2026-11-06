import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { viteSingleFile } from "vite-plugin-singlefile";

const favicon = encodeURIComponent(
  readFileSync(new URL("./public/favicon.svg", import.meta.url), "utf8"),
);

export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";
  return {
    // Relative URLs work at both / and a GitHub Pages project path such as /Game/.
    base: "./",
    plugins: [
      react(),
      {
        name: "inline-game-favicon",
        transformIndexHtml: {
          order: "pre",
          handler(html) {
            return html.replace(
              /href=["'](?:\.\/|\/)favicon\.svg["']/,
              `href="data:image/svg+xml,${favicon}"`,
            );
          },
        },
      },
      ...(standalone
        ? [
            viteSingleFile({
              removeViteModuleLoader: true,
              outputFileName: "Play-Frost-and-Fin.html",
            }),
          ]
        : []),
    ],
    build: standalone
      ? { outDir: "standalone", copyPublicDir: false }
      : { outDir: "dist" },
  };
});
