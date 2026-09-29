const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  utilityProcess,
  Menu,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { mkdir, readFile, writeFile } = require("node:fs/promises");
const { randomBytes } = require("node:crypto");
let bridgeProcess;
let window;
let token;
const port = 43129;
const entry = path.join(__dirname, "../dist/index.html");
const entryUrl = pathToFileURL(entry).href;
const ownedFrame = (event) => {
  if (event.senderFrame?.url.split("#")[0] !== entryUrl)
    throw new Error("Untrusted window");
};
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      const dataDir = path.join(app.getPath("userData"), "local-git");
      await mkdir(dataDir, { recursive: true, mode: 0o700 });
      const tokenPath = path.join(dataDir, "token");
      try {
        token = (await readFile(tokenPath, "utf8")).trim();
      } catch {
        token = randomBytes(32).toString("hex");
        await writeFile(tokenPath, token, { mode: 0o600 });
      }
      bridgeProcess = utilityProcess.fork(
        path.join(__dirname, "../build/bridge.mjs"),
        [],
        {
          env: {
            ...process.env,
            PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ""}:/usr/bin:/bin:/usr/sbin:/sbin`,
            DIFFS_PORT: String(port),
            DIFFS_DATA_DIR: dataDir,
            DIFFS_ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
          },
          stdio: "pipe",
          serviceName: "Diffs Git service",
        },
      );
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(
              new Error(
                "The local Git service could not start. Please quit and reopen Diffs.",
              ),
            ),
          15000,
        );
        let output = "";
        bridgeProcess.stdout.on("data", (chunk) => {
          output += chunk.toString();
          if (output.includes("listening")) {
            clearTimeout(timeout);
            resolve();
          }
        });
        bridgeProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
        bridgeProcess.once("exit", (code) => {
          clearTimeout(timeout);
          reject(new Error(`Git service stopped (${code}).`));
        });
      });
      ipcMain.handle("git-request", async (event, route, method, body) => {
        ownedFrame(event);
        if (
          typeof route !== "string" ||
          !/^\/projects(?:\/[a-f0-9]{16}(?:\/(?:files|tree|file|action))?)?(?:\?.*)?$/.test(
            route,
          ) ||
          !["GET", "POST", "DELETE"].includes(method)
        )
          throw new Error("Invalid request");
        try {
          const response = await fetch(`http://127.0.0.1:${port}${route}`, {
            method,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(70000),
          });
          const result = await response.json();
          return response.ok
            ? { ok: true, data: result }
            : { ok: false, error: result.error || "Git operation failed" };
        } catch {
          return {
            ok: false,
            error:
              "The Git service is unavailable. Quit and reopen Diffs, then try again.",
          };
        }
      });
      ipcMain.handle("choose-project", async (event) => {
        ownedFrame(event);
        const result = await dialog.showOpenDialog(window, {
          title: "Open a project",
          buttonLabel: "Open project",
          properties: ["openDirectory", "createDirectory"],
        });
        return result.canceled ? null : result.filePaths[0];
      });
      const createWindow = () => {
        window = new BrowserWindow({
          width: 1440,
          height: 920,
          minWidth: 700,
          minHeight: 500,
          title: "Diffs",
          backgroundColor: "#0a0a0a",
          webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        window.webContents.setWindowOpenHandler(({ url }) => {
          if (url.startsWith("https://github.com/Davidkle/diffs-workbench"))
            shell.openExternal(url);
          return { action: "deny" };
        });
        window.webContents.on("will-navigate", (event, url) => {
          if (url.split("#")[0] !== entryUrl) event.preventDefault();
        });
        window.webContents.session.setPermissionRequestHandler(
          (_webContents, _permission, callback) => callback(false),
        );
        window.loadFile(entry);
      };
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          { role: "appMenu" },
          {
            label: "File",
            submenu: [
              {
                label: "Open Project…",
                accelerator: "CmdOrCtrl+O",
                click: () => window?.webContents.send("open-project"),
              },
            ],
          },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" },
        ]),
      );
      createWindow();
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error) => {
      dialog.showErrorBox("Diffs could not open", error.message);
      app.quit();
    });
  app.on("before-quit", () => bridgeProcess?.kill());
  app.on("window-all-closed", () => app.quit());
}
