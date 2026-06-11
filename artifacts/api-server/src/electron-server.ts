/**
 * Combined Express server for Electron desktop.
 * Uses console logging instead of pino so esbuild-plugin-pino isn't needed.
 * Serves both the API (/api/*) and the React renderer (static files + SPA fallback).
 */
import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import path from "node:path";
import net from "node:net";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") return reject(new Error("No address"));
      srv.close(() => resolve((addr as net.AddressInfo).port));
    });
    srv.on("error", reject);
  });
}

async function start() {
  const portArg = process.env["PORT"];
  const port = portArg ? Number(portArg) : await getFreePort();
  const rendererDir = process.env["RENDERER_DIR"];

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${portArg}"`);
  }

  const app: Express = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", router);

  if (rendererDir) {
    app.use(express.static(rendererDir));
    app.use((_req, res) => {
      res.sendFile(path.join(rendererDir, "index.html"));
    });
  }

  app.listen(port, "127.0.0.1", () => {
    console.log(`[SAT Tutor] Server ready on http://127.0.0.1:${port}`);
    if (process.send) {
      process.send({ type: "ready", port });
    }
  });
}

start().catch((err) => {
  console.error("[SAT Tutor] Server failed to start:", err);
  process.exit(1);
});
