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

  // 以下 on* 包装统一返回「取消监听」函数，便于组件 cleanup 时对称移除（M-1 防泄漏）
  onTriggerQuitBackup: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-quit-backup', handler);
    return () => ipcRenderer.removeListener('trigger-quit-backup', handler);
  },

  // 开机自启
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),

  // 关闭窗口行为（V2.41.15）
  setCloseBehavior: (behavior) => ipcRenderer.send('set-close-behavior', behavior),

  // 提醒系统
  showReminder: (title, body, soundFile, noteId, extra) => ipcRenderer.invoke('show-reminder', { title, body, soundFile, noteId, extra: extra || {} }),
  cancelReminder: (id) => ipcRenderer.invoke('cancel-reminder', { id }),

  // 通知窗口操作
  closeNotifWindow: () => ipcRenderer.send('notif-close'),
  notifSnooze: (minutes, noteId) => ipcRenderer.send('notif-snooze', minutes, noteId),
  notifDismiss: (noteId) => ipcRenderer.send('notif-dismiss', noteId),
  onReminderSnoozed: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('reminder-snoozed', handler);
    return () => ipcRenderer.removeListener('reminder-snoozed', handler);
  },
  onReminderDismissed: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('reminder-dismissed', handler);
    return () => ipcRenderer.removeListener('reminder-dismissed', handler);
  },

  // 桌面便签
  createNoteWindow: (noteData) => ipcRenderer.invoke('create-note-window', noteData),
  noteUpdate: (id, updates) => ipcRenderer.send('note-update', { id, updates }),
  noteDrag: (id, dx, dy) => ipcRenderer.send('note-drag', { id, dx, dy }),
  noteMinimize: (id) => ipcRenderer.send('note-minimize', { id }),
  noteClose: (id) => ipcRenderer.send('note-close', { id }),
  noteCopyText: (text) => ipcRenderer.send('note-copy-text', { text }),
  onInitNote: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('init-note', handler);
    return () => ipcRenderer.removeListener('init-note', handler);
  },
  onNoteClosed: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('note-closed', handler);
    return () => ipcRenderer.removeListener('note-closed', handler);
  },
  onNoteContentChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('note-content-changed', handler);
    return () => ipcRenderer.removeListener('note-content-changed', handler);
  },
  onNoteMinState: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('note-minimize-state', handler);
    return () => ipcRenderer.removeListener('note-minimize-state', handler);
  },
});
