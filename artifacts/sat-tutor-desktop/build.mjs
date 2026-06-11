/**
 * Build script for SAT Tutor Desktop (Electron)
 *
 * Steps:
 *   1. Build the Electron main + preload processes (CJS, for Electron)
 *   2. Build the combined Express server (ESM, runs as a child process)
 *   3. Build the React renderer (Vite, static files)
 *
 * Run: node build.mjs
 * Then package: pnpm run package:win  /  package:mac  /  package:linux
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm, mkdir } from "node:fs/promises";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";

globalThis.require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const workspaceRoot = path.resolve(root, "../..");
const distDir = path.resolve(root, "dist");

const EXTERNAL_NATIVE = [
  "*.node",
  "sharp",
  "better-sqlite3",
  "sqlite3",
  "canvas",
  "bcrypt",
  "argon2",
  "fsevents",
  "bufferutil",
  "utf-8-validate",
  "pg-native",
];

async function buildMain() {
  console.log("▶  Building Electron main process…");
  await esbuild({
    entryPoints: [path.resolve(root, "src/main.ts")],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "cjs",
    outfile: path.resolve(distDir, "main.js"),
    external: ["electron", ...EXTERNAL_NATIVE],
    sourcemap: "linked",
    logLevel: "info",
  });
}

async function buildPreload() {
  console.log("▶  Building Electron preload…");
  await esbuild({
    entryPoints: [path.resolve(root, "src/preload.ts")],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "cjs",
    outfile: path.resolve(distDir, "preload.js"),
    external: ["electron", ...EXTERNAL_NATIVE],
    sourcemap: "linked",
    logLevel: "info",
  });
}

async function buildServer() {
  console.log("▶  Building Express server for Electron…");

  const apiServerRoot = path.resolve(workspaceRoot, "artifacts/api-server");
  const libApiZod = path.resolve(workspaceRoot, "lib/api-zod/src/index.ts");
  const libDb = path.resolve(workspaceRoot, "lib/db/src/index.ts");

  await esbuild({
    entryPoints: [path.resolve(apiServerRoot, "src/electron-server.ts")],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "esm",
    outfile: path.resolve(distDir, "electron-server.mjs"),
    outExtension: { ".js": ".mjs" },
    external: ["electron", ...EXTERNAL_NATIVE],
    sourcemap: "linked",
    logLevel: "info",
    alias: {
      "@workspace/api-zod": libApiZod,
      "@workspace/db": libDb,
    },
  });
}

async function buildRenderer() {
  console.log("▶  Building React renderer…");
  await viteBuild({
    configFile: path.resolve(root, "vite.renderer.config.ts"),
    logLevel: "info",
  });
}

async function main() {
  console.log("🔨 SAT Tutor Desktop — build starting\n");

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await Promise.all([buildMain(), buildPreload(), buildServer()]);
  await buildRenderer();

  console.log("\n✅ Build complete — run `pnpm run package:<platform>` to create an installer.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
