import { app, BrowserWindow, shell, Menu, dialog } from "electron";
import path from "node:path";
import net from "node:net";
import fs from "node:fs";
import { fork } from "node:child_process";

const isDev = !app.isPackaged;

// ─── Paths ────────────────────────────────────────────────────────────────────

function getResourcePath(...segments: string[]): string {
  if (isDev) {
    return path.join(__dirname, ...segments);
  }
  return path.join(process.resourcesPath, ...segments);
}

const SERVER_PATH = getResourcePath("electron-server.mjs");
const RENDERER_DIR = getResourcePath("renderer");
const DEFAULT_DB = getResourcePath("data", "sat_database.json");

// ─── Free port ────────────────────────────────────────────────────────────────

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") return reject(new Error("No address"));
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

// ─── Server readiness poll ────────────────────────────────────────────────────

async function waitForServer(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/healthz`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

// ─── Data directory setup ─────────────────────────────────────────────────────

function ensureUserData(): string {
  const dataDir = path.join(app.getPath("userData"), "sat-data");
  fs.mkdirSync(dataDir, { recursive: true });

  const dbDest = path.join(dataDir, "sat_database.json");
  if (!fs.existsSync(dbDest) && fs.existsSync(DEFAULT_DB)) {
    fs.copyFileSync(DEFAULT_DB, dbDest);
  }

  return dataDir;
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    title: "SAT Tutor",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── Application menu ─────────────────────────────────────────────────────────

function buildMenu(dataDir: string) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "SAT Tutor",
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Open Data Folder…",
          click: () => shell.openPath(dataDir),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    const dataDir = ensureUserData();
    const port = await getFreePort();

    // Spawn the combined Express server as a child process
    const serverProc = fork(SERVER_PATH, [], {
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: dataDir,
        RENDERER_DIR: RENDERER_DIR,
        NODE_ENV: "production",
      },
      execArgv: [],
      stdio: "inherit",
    });

    serverProc.on("error", (err) => {
      dialog.showErrorBox("Server Error", `Failed to start server: ${err.message}`);
      app.quit();
    });

    await waitForServer(port);

    buildMenu(dataDir);
    createWindow(port);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow(port);
      }
    });

    app.on("will-quit", () => {
      serverProc.kill();
    });
  } catch (err) {
    dialog.showErrorBox(
      "Startup Error",
      err instanceof Error ? err.message : String(err)
    );
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
