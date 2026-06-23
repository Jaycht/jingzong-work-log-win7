const { app, BrowserWindow, ipcMain, Menu, dialog, shell, Tray, nativeImage, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");

const isDev = !app.isPackaged;
let mainWindow = null;
let tray = null;

// Windows 通知必须设置 AppUserModelID，否则 Notification.show() 静默失败
app.setAppUserModelId("com.jingzong.worklog");

// 允许 Audio.play() 无需用户手势（提醒声音播放）
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// Win7版：不支持自动更新

// 窗口尺寸常量
const LOGIN_SIZE = { width: 974, height: 711 };
const MAIN_SIZE = { width: 1400, height: 900 };
const MAIN_MIN = { minWidth: 1100, minHeight: 700 };

// 附件存储目录 — 优先放非C盘，找不到则用userData
function getAttachmentsDir() {
  const configPath = path.join(app.getPath("userData"), "path-config.json");
  try {
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (cfg.attachmentsDir && fs.existsSync(cfg.attachmentsDir)) return cfg.attachmentsDir;
    }
  } catch {}

  // 扫描可用盘符，优先非C盘
  const drives = ["D:", "E:", "F:", "G:", "H:", "I:", "J:"];
  for (const d of drives) {
    const candidate = path.join(d + "\\", "jingzong_data", "attachments");
    try {
      const dir = d + "\\";
      if (fs.existsSync(dir)) {
        if (!fs.existsSync(candidate)) fs.mkdirSync(candidate, { recursive: true });
        return candidate;
      }
    } catch {}
  }

  // 全部失败则用 userData
  return path.join(app.getPath("userData"), "attachments");
}

const ATTACHMENTS_DIR = getAttachmentsDir();

// 保存附件路径配置
function savePathConfig(key, value) {
  const configPath = path.join(app.getPath("userData"), "path-config.json");
  let cfg = {};
  try { if (fs.existsSync(configPath)) cfg = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch {}
  cfg[key] = value;
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf-8");
}

// 读取附件路径配置
function getPathConfig(key) {
  const configPath = path.join(app.getPath("userData"), "path-config.json");
  try {
    if (fs.existsSync(configPath)) {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      return cfg[key];
    }
  } catch {}
  return null;
}

// 移除默认菜单栏（全局生效）
Menu.setApplicationMenu(null);

function createWindow() {
  mainWindow = new BrowserWindow({
    ...LOGIN_SIZE,
    resizable: true,
    frame: false,
    backgroundColor: "#0B0F1A",
    icon: path.join(__dirname, "..", "app.ico"),
    show: false,
    title: "经侦大队工作记录管理系统",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.center();

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173/");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ======================== IPC 处理器 ========================

// 单窗口大小调整：登录态 → 主页态
ipcMain.on("resize-to-main", () => {
  if (mainWindow) {
    mainWindow.setMinimumSize(MAIN_MIN.minWidth, MAIN_MIN.minHeight);
    mainWindow.setSize(MAIN_SIZE.width, MAIN_SIZE.height);
    mainWindow.center();
  }
});

// 单窗口大小调整：主页态 → 登录态
ipcMain.on("resize-to-login", () => {
  if (mainWindow) {
    mainWindow.setMinimumSize(LOGIN_SIZE.width, LOGIN_SIZE.height);
    mainWindow.setSize(LOGIN_SIZE.width, LOGIN_SIZE.height);
    mainWindow.center();
  }
});

// 窗口控制 — 使用 event.sender 获取准确的窗口引用
function getWin(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.on("window-minimize", (event) => {
  const win = getWin(event);
  if (win) win.minimize();
});

ipcMain.on("window-maximize", (event) => {
  const win = getWin(event);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on("window-close", (event) => {
  const win = getWin(event);
  if (win) win.close();
});

// 附件文件操作 — 保存文件到硬盘
ipcMain.handle("save-attachment-file", async (_event, { buffer, fileName, moduleId }) => {
  try {
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName.replace(/[<>:"/\\|?*]/g, "_")}`;
    const filePath = path.join(ATTACHMENTS_DIR, safeName);
    await fsp.writeFile(filePath, Buffer.from(buffer));
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** 校验路径位于附件目录下，防止渲染进程访问任意磁盘文件 */
function safePath(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(ATTACHMENTS_DIR))) {
    throw new Error('Access denied: path outside attachments directory');
  }
  return resolved;
}

// 附件文件操作 — 从硬盘读取文件
ipcMain.handle("read-attachment-file", async (_event, filePath) => {
  try {
    const resolved = safePath(filePath);
    const buffer = await fsp.readFile(resolved);
    const uint8 = new Uint8Array(buffer);
    return { success: true, buffer: uint8.buffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 附件文件操作 — 从硬盘删除文件
ipcMain.handle("delete-attachment-file", async (_event, filePath) => {
  try {
    const resolved = safePath(filePath);
    await fsp.unlink(resolved);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 获取附件目录路径
ipcMain.handle("get-attachments-dir", () => {
  return ATTACHMENTS_DIR;
});

// 获取/设置附件保存路径（用户可自定义）
ipcMain.handle("get-attachments-path", () => {
  return getPathConfig("attachmentsDir") || ATTACHMENTS_DIR;
});

ipcMain.handle("set-attachments-path", (_event, newPath) => {
  if (newPath && fs.existsSync(newPath)) {
    savePathConfig("attachmentsDir", newPath);
    return { success: true, path: newPath };
  }
  return { success: false, error: "路径不存在" };
});

// 获取文档文件夹路径（用于默认备份路径）
ipcMain.handle("get-documents-dir", () => {
  return app.getPath("documents");
});

// 选择目录对话框
ipcMain.handle("show-directory-dialog", async () => {
  const result = await dialog.showOpenDialog({
    title: "选择备份目录",
    defaultPath: app.getPath("documents"),
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true };
  return { path: result.filePaths[0] };
});

// 保存 JSON 文件到指定路径（退出时自动备份用）
ipcMain.handle("save-json-file", async (_event, { json, fileName }) => {
  try {
    const dir = app.getPath("documents");
    const backupDir = path.join(dir, "jingzong_backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const filePath = path.join(backupDir, fileName);
    await fsp.writeFile(filePath, json, "utf-8");
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 检查附件文件是否存在
ipcMain.handle("check-attachment-file", async (_event, filePath) => {
  try {
    const resolved = safePath(filePath);
    const exists = fs.existsSync(resolved);
    return { success: true, exists };
  } catch (err) {
    return { success: false, exists: false, error: err.message };
  }
});

// 弹出保存文件对话框（下载附件时使用）
ipcMain.handle("show-save-dialog", async (_event, { defaultName, buffer }) => {
  try {
    const result = await dialog.showSaveDialog({
      title: "保存附件",
      defaultPath: path.join(app.getPath("downloads"), defaultName),
      filters: [{ name: "所有文件", extensions: ["*"] }],
    });
    if (result.canceled) return { success: false, canceled: true };
    await fsp.writeFile(result.filePath, Buffer.from(buffer));
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ======================== 托盘功能 ========================
function createTray() {
  const iconPath = path.join(__dirname, "..", "app.ico");
  tray = new Tray(iconPath);
  tray.setToolTip("经侦大队工作记录管理系统");

  const contextMenu = Menu.buildFromTemplate([
    { label: "显示窗口", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: "separator" },
    { label: "退出", click: () => {
      app.isQuitting = true;
      // 通知渲染进程执行退出前备份
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send("trigger-quit-backup");
        // 给渲染进程 3 秒执行备份，然后强制退出
        setTimeout(() => { app.quit(); }, 3000);
      } else {
        app.quit();
      }
    }},
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // 窗口关闭时最小化到托盘
  if (mainWindow) {
    mainWindow.on("close", (e) => {
      if (!app.isQuitting) {
        e.preventDefault();
        mainWindow.hide();
      }
    });
  }
}

// ======================== 开机自启 ========================
ipcMain.handle("get-auto-start", () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle("set-auto-start", (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
  return app.getLoginItemSettings().openAtLogin;
});

// ======================== 提醒系统 ========================
// 创建独立浮动通知窗口（桌面右下角，不在主窗口内）
let notifWindows = [];

function createNotifWindow(title, body, soundFile, noteId) {
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  const notifWidth = 400;
  const notifHeight = 160;
  const gap = 16;
  const index = notifWindows.length;
  const x = screenW - notifWidth - gap;
  const y = screenH - notifHeight - gap - index * (notifHeight + gap);

  const params = new URLSearchParams({ title, body, sound: soundFile || "", noteId: noteId || "" });

  const notifWin = new BrowserWindow({
    width: notifWidth,
    height: notifHeight,
    x: Math.max(0, x),
    y: Math.max(0, y),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try { notifWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}

  const notifPath = path.join(__dirname, "notification.html");
  notifWin.loadFile(notifPath, { search: params.toString() });

  notifWindows.push(notifWin);

  notifWin.on("closed", () => {
    notifWindows = notifWindows.filter((w) => w !== notifWin);
  });

  // 10秒后自动关闭
  setTimeout(() => {
    if (!notifWin.isDestroyed()) notifWin.close();
  }, 12000);
}

ipcMain.handle("show-reminder", (_event, { title, body, soundFile, noteId }) => {
  createNotifWindow(title, body, soundFile, noteId);
  return { shown: true };
});

// 通知窗口操作
ipcMain.on("notif-close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.close();
});

ipcMain.on("notif-snooze", (event, minutes, noteId) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("reminder-snoozed", { minutes, noteId });
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.close();
});

ipcMain.on("notif-dismiss", (event, noteId) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("reminder-dismissed", { noteId });
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.close();
});

ipcMain.handle("cancel-reminder", (_event, { id }) => {
  return { cancelled: true };
});

// ======================== 桌面便签 ========================
const noteWindows = new Map(); // id -> { win, data }

function createNoteWindow(noteData) {
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
  const id = noteData.id || `note-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  const data = {
    id,
    title: noteData.title || "",
    text: noteData.text || "",
    date: noteData.date || new Date().toISOString().slice(0,10),
    colorIdx: noteData.colorIdx ?? Math.floor(Math.random() * 6),
    alwaysOnTop: true,
    x: noteData.x ?? Math.max(0, screenW - 320),
    y: noteData.y ?? Math.max(0, 60 + noteWindows.size * 40),
    w: noteData.w ?? 280,
    h: noteData.h ?? 320,
  };

  const win = new BrowserWindow({
    x: data.x, y: data.y, width: data.w, height: data.h,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, hasShadow: false,
    resizable: true, minWidth: 200, minHeight: 100,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  try { win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {} // Electron 22 兼容
  win.setAlwaysOnTop(true, "floating");
  win.loadFile(path.join(__dirname, "note.html"));

  win.once("ready-to-show", () => {
    win.webContents.send("init-note", data);
    win.showInactive();
  });

  win.on("moved", () => {
    if (win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    data.x = x; data.y = y;
  });

  win.on("closed", () => {
    noteWindows.delete(id);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send("note-closed", { id });
    }
  });

  noteWindows.set(id, { win, data });
  return id;
}

// 便签 IPC
ipcMain.handle("create-note-window", (_event, noteData) => {
  const id = noteData.id || `note-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
  // 去重：如果同ID便签已打开，直接聚焦
  const existing = noteWindows.get(id);
  if (existing && !existing.win.isDestroyed()) {
    existing.win.show();
    existing.win.focus();
    return id;
  }
  return createNoteWindow({ ...noteData, id });
});

ipcMain.on("note-update", (event, { id, updates }) => {
  const entry = noteWindows.get(id);
  if (!entry) return;
  Object.assign(entry.data, updates);
  if (updates.alwaysOnTop !== undefined && !entry.win.isDestroyed()) {
    entry.win.setAlwaysOnTop(!!updates.alwaysOnTop, "floating");
  }
  if (updates.opacity !== undefined && !entry.win.isDestroyed()) {
    entry.win.setOpacity(Math.max(0.3, Math.min(1, updates.opacity)));
  }
  // 便签内容变更 → 同步回主窗口渲染进程，写入 IndexedDB
  if (updates.text !== undefined && mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("note-content-changed", { id, text: updates.text });
  }
});

ipcMain.on("note-minimize", (event, { id }) => {
  const entry = noteWindows.get(id);
  if (!entry || entry.win.isDestroyed()) return;
  const HEADER_H = 36;
  const MIN_H = 120;
  if (entry.data.minimized) {
    // 展开：恢复高度
    entry.data.minimized = false;
    entry.win.setResizable(true);
    entry.win.setMinimumSize(200, MIN_H);
    entry.win.setBounds({ x: entry.data.x, y: entry.data.y, width: entry.data.w, height: entry.data.h || 320 });
  } else {
    // 折叠：缩到标题栏高度
    entry.data.minimized = true;
    const [w] = entry.win.getSize();
    entry.data.h = entry.win.getSize()[1];
    entry.win.setMinimumSize(200, HEADER_H);
    entry.win.setBounds({ x: entry.data.x, y: entry.data.y, width: w, height: HEADER_H });
    entry.win.setResizable(false);
  }
  entry.win.webContents.send("note-minimize-state", { id, minimized: entry.data.minimized });
});

ipcMain.on("note-close", (event, { id }) => {
  const entry = noteWindows.get(id);
  if (!entry || entry.win.isDestroyed()) return;
  entry.win.close();
});

ipcMain.on("note-copy-text", (_event, { text }) => {
  const { clipboard } = require("electron");
  clipboard.writeText(text);
});

// ======================== 启动逻辑 ========================
app.whenReady().then(() => {
  // 确保附件目录存在
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
  createWindow();
  createTray();
});

app.on("window-all-closed", () => {
  // 不关闭，保持在托盘
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
