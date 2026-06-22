const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // 窗口大小切换
  resizeToMain: () => ipcRenderer.send('resize-to-main'),
  resizeToLogin: () => ipcRenderer.send('resize-to-login'),

  // 窗口控制
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // 附件文件操作（异步返回 Promise）
  saveAttachmentFile: (buffer, fileName, moduleId) =>
    ipcRenderer.invoke('save-attachment-file', { buffer, fileName, moduleId }),
  readAttachmentFile: (filePath) =>
    ipcRenderer.invoke('read-attachment-file', filePath),
  deleteAttachmentFile: (filePath) =>
    ipcRenderer.invoke('delete-attachment-file', filePath),
  getAttachmentsDir: () =>
    ipcRenderer.invoke('get-attachments-dir'),
  showSaveDialog: (defaultName, buffer) =>
    ipcRenderer.invoke('show-save-dialog', { defaultName, buffer }),
  checkAttachmentFile: (filePath) =>
    ipcRenderer.invoke('check-attachment-file', filePath),
  getDocumentsDir: () =>
    ipcRenderer.invoke('get-documents-dir'),
  showDirectoryDialog: () =>
    ipcRenderer.invoke('show-directory-dialog'),
  saveJsonFile: (json, fileName) =>
    ipcRenderer.invoke('save-json-file', { json, fileName }),
  getAttachmentsPath: () =>
    ipcRenderer.invoke('get-attachments-path'),
  setAttachmentsPath: (newPath) =>
    ipcRenderer.invoke('set-attachments-path', newPath),
  onTriggerQuitBackup: (callback) =>
    ipcRenderer.on('trigger-quit-backup', () => callback()),

  // Win7版：自动更新已移除

  // 开机自启
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),

  // 提醒系统
  showReminder: (title, body, soundFile, noteId) => ipcRenderer.invoke('show-reminder', { title, body, soundFile, noteId }),
  cancelReminder: (id) => ipcRenderer.invoke('cancel-reminder', { id }),

  // 通知窗口操作
  closeNotifWindow: () => ipcRenderer.send('notif-close'),
  notifSnooze: (minutes, noteId) => ipcRenderer.send('notif-snooze', minutes, noteId),
  notifDismiss: (noteId) => ipcRenderer.send('notif-dismiss', noteId),
  onReminderSnoozed: (callback) => ipcRenderer.on('reminder-snoozed', (_event, data) => callback(data)),
  onReminderDismissed: (callback) => ipcRenderer.on('reminder-dismissed', (_event, data) => callback(data)),

  // 桌面便签
  createNoteWindow: (noteData) => ipcRenderer.invoke('create-note-window', noteData),
  noteUpdate: (id, updates) => ipcRenderer.send('note-update', { id, updates }),
  noteDrag: (id, dx, dy) => ipcRenderer.send('note-drag', { id, dx, dy }),
  noteMinimize: (id) => ipcRenderer.send('note-minimize', { id }),
  noteClose: (id) => ipcRenderer.send('note-close', { id }),
  noteCopyText: (text) => ipcRenderer.send('note-copy-text', { text }),
  onInitNote: (callback) => ipcRenderer.on('init-note', (_event, data) => callback(data)),
  onNoteClosed: (callback) => ipcRenderer.on('note-closed', (_event, data) => callback(data)),
  onNoteContentChanged: (callback) => ipcRenderer.on('note-content-changed', (_event, data) => callback(data)),
  onNoteMinState: (callback) => ipcRenderer.on('note-minimize-state', (_event, data) => callback(data)),
});
