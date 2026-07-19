const { app, BrowserWindow, ipcMain, Menu, dialog, shell, Tray, nativeImage, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
// 内联图标 base64（避免打包后 app.ico 在 asar 内外落点错乱导致托盘不显示，V2.41.20 修复 #1）
const APP_ICO_BASE64 = require("./app-icon.cjs");

const isDev = !app.isPackaged;
let mainWindow = null;
let tray = null;

// Windows 通知必须设置 AppUserModelID，否则 Notification.show() 静默失败
app.setAppUserModelId("com.jingzong.worklog");

// 允许 Audio.play() 无需用户手势（提醒声音播放）
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");



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

// ======================== 应用图标解析 ========================
// 生产环境下 app.ico 通过 electron-builder 的 extraResources 放到 asar 外（resources/app.ico），
// 直接 path.join(__dirname,'..','app.ico') 在 asar 内会指向不存在的 resources/app.asar/app.ico，
// 导致 new Tray() 抛错而中断 createTray，进而关闭处理器无法注册。这里做多级兜底解析。
function resolveAppIcon() {
  // 首选：内联 base64 图标，彻底摆脱打包后 app.ico 在 asar 内外落点错乱的问题（V2.41.20 修复 #1）
  try {
    const buf = Buffer.from(APP_ICO_BASE64, "base64");
    const img = nativeImage.createFromBuffer(buf);
    if (!img.isEmpty()) return img;
  } catch (e) {
    console.error("[icon] 内联 base64 图标解析失败：", e);
  }
  // 兜底：外部 resources/app.ico（extraResources）与 asar 内 app.ico
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, "app.ico"), path.join(__dirname, "..", "app.ico")]
    : [path.join(__dirname, "..", "app.ico")];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) return img;
      }
    } catch {}
  }
  try {
    const asarPath = path.join(__dirname, "..", "app.ico");
    if (fs.existsSync(asarPath)) {
      return nativeImage.createFromBuffer(fs.readFileSync(asarPath));
    }
  } catch {}
  return nativeImage.createEmpty();
}

let attachmentsDir = getAttachmentsDir();
// 历史附件目录集合：切换路径后旧目录仍允许读取，避免旧附件打不开（数据安全）
const allowedAttachmentDirs = new Set([attachmentsDir]);

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
    icon: resolveAppIcon(),
    show: false,
    title: "经侦大队工作记录管理系统",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 关闭行为处理器：无条件注册，不再依赖 createTray 是否成功（V2.41.17 修复 #2）
  registerCloseHandler(mainWindow);

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
    const filePath = path.join(attachmentsDir, safeName);
    await fsp.writeFile(filePath, Buffer.from(buffer));
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/** 校验路径位于附件目录下，防止渲染进程访问任意磁盘文件 */
function safePath(filePath) {
  const resolved = path.resolve(filePath);
  // 允许当前目录及所有历史目录（切换路径前的旧附件仍可读取）
  for (const dir of allowedAttachmentDirs) {
    if (resolved.startsWith(path.resolve(dir))) return resolved;
  }
  throw new Error('Access denied: path outside attachments directory');
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
  return attachmentsDir;
});

// 获取/设置附件保存路径（用户可自定义）
ipcMain.handle("get-attachments-path", () => {
  return getPathConfig("attachmentsDir") || attachmentsDir;
});

ipcMain.handle("set-attachments-path", (_event, newPath) => {
  if (newPath && fs.existsSync(newPath)) {
    allowedAttachmentDirs.add(attachmentsDir); // 旧目录仍允许读取，避免旧附件打不开
    attachmentsDir = newPath;
    allowedAttachmentDirs.add(newPath);
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

// ======================== 关闭窗口行为 ========================
// 关闭窗口行为：'exit' 直接退出 | 'tray' 最小化到托盘 | 'ask' 弹窗询问
// 默认改为 'ask'（每次询问），与系统设置默认项一致（V2.41.19 修复 #4）
let appCloseBehavior = 'ask';

ipcMain.on('set-close-behavior', (_event, behavior) => {
  if (behavior === 'exit' || behavior === 'tray' || behavior === 'ask') {
    appCloseBehavior = behavior;
  }
});

// ======================== 关闭行为 ========================
// 窗口关闭处理器：独立于托盘创建，无论托盘是否可用都会注册（V2.41.17 修复 #2）
function registerCloseHandler(win) {
  if (!win) return;
  win.on("close", (e) => {
    if (app.isQuitting) return;
    e.preventDefault();

    const doQuit = () => {
      app.isQuitting = true;
      if (win && win.webContents) {
        win.webContents.send("trigger-quit-backup");
        setTimeout(() => { app.quit(); }, 3000);
      } else {
        app.quit();
      }
    };

    if (appCloseBehavior === 'exit') {
      doQuit();
    } else if (appCloseBehavior === 'ask') {
      const { dialog } = require('electron');
      const choice = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['最小化到托盘', '退出软件'],
        defaultId: 0,
        cancelId: 0,
        title: '关闭程序',
        message: '您希望如何关闭本程序？',
        detail: '选择「最小化到托盘」可保留后台运行，双击托盘图标恢复。',
        noLink: true,
      });
      if (choice === 1) {
        doQuit();
      } else {
        win.hide();
      }
    } else {
      // 默认 'tray'：托盘可用则最小化到托盘；托盘缺失（极罕见）则直接退出，避免无窗无托盘的孤儿进程
      if (tray) {
        win.hide();
      } else {
        doQuit();
      }
    }
  });
}

// ======================== 托盘功能 ========================
function createTray() {
  try {
    const base = resolveAppIcon();
    if (base.isEmpty()) {
      console.error('[tray] 未找到有效的托盘图标资源，将不启用托盘');
      tray = null;
      return;
    }
    // Windows 系统托盘需要 16/32px 尺寸图标：源 app.ico 多为 256/128px，
    // 若缺小尺寸会被系统忽略导致托盘不显示。这里从源图缩放为 32x32 保证可见（V2.41.19 修复 #1）
    let trayIcon = base;
    try {
      const r = base.resize({ width: 32, height: 32 });
      if (!r.isEmpty()) trayIcon = r;
    } catch {}
    tray = new Tray(trayIcon);
  } catch (err) {
    console.error('[tray] 创建托盘图标失败，将不启用托盘：', err);
    tray = null;
    return;
  }
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

function createNotifWindow(title, body, soundFile, noteId, extra) {
  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  const notifWidth = 400;
  const notifHeight = 196;
  const gap = 16;
  const index = notifWindows.length;
  const x = screenW - notifWidth - gap;
  const y = screenH - notifHeight - gap - index * (notifHeight + gap);

  const params = new URLSearchParams({
    title,
    body,
    sound: soundFile || "",
    noteId: noteId || "",
    type: (extra && extra.type) || "",
    priority: (extra && extra.priority) || "",
    date: (extra && extra.date) || "",
  });

  const notifWin = new BrowserWindow({
    width: notifWidth,
    height: notifHeight,
    x: Math.max(0, x),
    y: Math.max(0, y),
    frame: false,
    transparent: false,
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

  notifWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const notifPath = path.join(__dirname, "notification.html");
  notifWin.loadFile(notifPath, { search: params.toString() });

  notifWindows.push(notifWin);

  notifWin.on("closed", () => {
    notifWindows = notifWindows.filter((w) => w !== notifWin);
  });

  // 12秒后自动关闭
  setTimeout(() => {
    if (!notifWin.isDestroyed()) notifWin.close();
  }, 12000);
}

ipcMain.handle("show-reminder", (_event, { title, body, soundFile, noteId, extra }) => {
  createNotifWindow(title, body, soundFile, noteId, extra);
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
    frame: false, transparent: false, backgroundColor: "#F1F2F4", alwaysOnTop: true,
    skipTaskbar: true, hasShadow: false,
    resizable: true, minWidth: 200, minHeight: 100,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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

ipcMain.on("note-drag", (event, { id, dx, dy }) => {
  const entry = noteWindows.get(id);
  if (!entry || entry.win.isDestroyed()) return;
  const [x, y] = entry.win.getPosition();
  entry.win.setPosition(x + dx, y + dy, false);
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
// 单实例锁：防止重复启动多个进程（多实例会抢占资源、拖慢启动，V2.41.17 修复 #5）
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // 确保附件目录存在
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir, { recursive: true });
    }
    createWindow();
    createTray();
  });
}

app.on("window-all-closed", () => {
  // 不关闭，保持在托盘
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
