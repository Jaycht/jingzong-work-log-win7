/**
 * 附件存储 — 双模式适配
 * - Electron 模式：文件存硬盘（userData/attachments/），IndexedDB 只存元数据
 * - 浏览器模式：完整文件二进制存 IndexedDB
 */

const DB_NAME = 'jingzong-attachments';
const DB_VERSION = 2;
const STORE_NAME = 'files';

export interface AttachmentRecord {
  id: string;
  recordId: string;
  moduleId: string;
  fieldId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  data: ArrayBuffer;
  uploadedAt: string;
  /** Electron 模式下存文件路径，浏览器模式下为空 */
  filePath?: string;
}

export interface AttachmentReference {
  id: string;
  uid: string;
  name: string;
  status: 'done';
  size: number;
  type: string;
  uploadedAt: string;
}

export interface AttachmentBackupItem {
  id: string;
  recordId: string;
  moduleId: string;
  fieldId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  dataBase64: string;
}

/** 判断是否运行在 Electron 环境 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('recordId', 'recordId', { unique: false });
        store.createIndex('moduleId', 'moduleId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function toAttachmentReference(record: AttachmentRecord): AttachmentReference {
  return {
    id: record.id,
    uid: record.id,
    name: record.fileName,
    status: 'done',
    size: record.fileSize,
    type: record.fileType,
    uploadedAt: record.uploadedAt,
  };
}

/** 保存文件到 IndexedDB */
export async function saveAttachment(
  recordId: string,
  moduleId: string,
  fieldId: string,
  file: File,
): Promise<AttachmentRecord> {
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = file.name;
  const fileType = file.type;
  const fileSize = file.size;
  const uploadedAt = new Date().toISOString();

  // Electron 模式：文件存硬盘，IDB 只存元数据
  if (isElectron()) {
    const buffer = await file.arrayBuffer();
    const result = await (window as any).electronAPI.saveAttachmentFile(
      Array.from(new Uint8Array(buffer)),
      fileName,
      moduleId,
    );
    if (!result.success) {
      throw new Error(`保存附件到硬盘失败: ${result.error}`);
    }
    const record: AttachmentRecord = {
      id,
      recordId,
      moduleId,
      fieldId,
      fileName,
      fileType,
      fileSize,
      uploadedAt,
      data: new ArrayBuffer(0), // 不存二进制
      filePath: result.filePath,
    };

    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return record;
  }

  // 浏览器模式：完整二进制存 IDB（原逻辑）
  const buffer = await file.arrayBuffer();
  const record: AttachmentRecord = {
    id,
    recordId,
    moduleId,
    fieldId,
    fileName,
    fileType,
    fileSize,
    data: buffer,
    uploadedAt,
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  return record;
}

/** 读取文件数据 */
export async function getAttachment(id: string): Promise<AttachmentRecord | null> {
  const db = await openDB();
  const record = await new Promise<AttachmentRecord | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!record) return null;

  // Electron 模式：从硬盘读取文件数据
  if (isElectron() && record.filePath) {
    const result = await (window as any).electronAPI.readAttachmentFile(record.filePath);
    if (result.success) {
      record.data = new Uint8Array(result.buffer).buffer;
    }
  }

  return record;
}

/** 获取全部附件 */
export async function getAllAttachments(): Promise<AttachmentRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** 获取某条记录的所有附件 */
export async function getAttachmentsByRecord(recordId: string): Promise<AttachmentRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('recordId');
    const req = index.getAll(recordId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** 获取某个模块的所有附件 */
export async function getAttachmentsByModule(moduleId: string): Promise<AttachmentRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('moduleId');
    const req = index.getAll(moduleId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** 更新附件所属记录 */
export async function relinkAttachment(id: string, recordId: string): Promise<void> {
  const db = await openDB();
  const record = await getAttachment(id);
  if (!record) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put({ ...record, recordId });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 删除附件 */
export async function deleteAttachment(id: string): Promise<void> {
  const record = await getAttachment(id);
  if (!record) return;

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Electron 模式：同时删除硬盘文件
  if (isElectron() && record.filePath) {
    (window as any).electronAPI.deleteAttachmentFile(record.filePath).catch(() => {});
  }
}

/** 清空全部附件 */
export async function clearAttachments(): Promise<void> {
  const all = await getAllAttachments();

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Electron 模式：同时删除所有硬盘文件
  if (isElectron()) {
    for (const att of all) {
      if (att.filePath) {
        (window as any).electronAPI.deleteAttachmentFile(att.filePath).catch(() => {});
      }
    }
  }
}

/** 下载附件 */
export async function downloadAttachment(id: string): Promise<void> {
  const att = await getAttachment(id);
  if (!att) throw new Error('附件不存在');

  const buf = Array.from(new Uint8Array(att.data));

  // Electron 模式：弹出原生保存对话框，由用户选择位置
  if (isElectron() && (window as any).electronAPI?.showSaveDialog) {
    const result = await (window as any).electronAPI.showSaveDialog(att.fileName, buf);
    if (result.success) {
      return; // 保存成功，无需额外提示
    } else if (!result.canceled) {
      throw new Error(result.error || '保存失败');
    }
    return; // 用户取消，不抛异常
  }

  // 浏览器模式：通过 Blob URL 下载
  const blob = new Blob([att.data], { type: att.fileType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = att.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** 获取附件统计 */
export async function getAttachmentStats(): Promise<{ count: number; totalBytes: number }> {
  const attachments = await getAllAttachments();
  return {
    count: attachments.length,
    totalBytes: attachments.reduce((sum, item) => sum + item.fileSize, 0),
  };
}

/** 获取所有附件总数 */
export async function getAttachmentCount(): Promise<number> {
  const stats = await getAttachmentStats();
  return stats.count;
}

/** 导出附件快照，用于完整备份 */
export async function exportAttachmentSnapshot(): Promise<AttachmentBackupItem[]> {
  const attachments = await getAllAttachments();

  const items: AttachmentBackupItem[] = [];
  for (const item of attachments) {
    let dataBase64 = '';
    // Electron 模式：从硬盘读取文件数据
    if (isElectron() && item.filePath) {
      const result = await (window as any).electronAPI.readAttachmentFile(item.filePath);
      if (result.success) {
        dataBase64 = arrayBufferToBase64(new Uint8Array(result.buffer).buffer);
      }
    } else {
      dataBase64 = arrayBufferToBase64(item.data);
    }
    items.push({
      id: item.id,
      recordId: item.recordId,
      moduleId: item.moduleId,
      fieldId: item.fieldId,
      fileName: item.fileName,
      fileType: item.fileType,
      fileSize: item.fileSize,
      uploadedAt: item.uploadedAt,
      dataBase64,
    });
  }
  return items;
}

/** 从备份快照恢复附件 */
export async function importAttachmentSnapshot(items: AttachmentBackupItem[]): Promise<number> {
  if (items.length === 0) {
    await clearAttachments();
    return 0;
  }

  for (const item of items) {
    const buffer = base64ToArrayBuffer(item.dataBase64);

    // Electron 模式：先写硬盘再存元数据
    if (isElectron()) {
      const result = await (window as any).electronAPI.saveAttachmentFile(
        Array.from(new Uint8Array(buffer)),
        item.fileName,
        item.moduleId,
      );
      if (result.success) {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
          id: item.id,
          recordId: item.recordId,
          moduleId: item.moduleId,
          fieldId: item.fieldId,
          fileName: item.fileName,
          fileType: item.fileType,
          fileSize: item.fileSize,
          uploadedAt: item.uploadedAt,
          data: new ArrayBuffer(0),
          filePath: result.filePath,
        });
        await transactionDone(tx);
      }
    } else {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        id: item.id,
        recordId: item.recordId,
        moduleId: item.moduleId,
        fieldId: item.fieldId,
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSize,
        uploadedAt: item.uploadedAt,
        data: buffer,
      });
      await transactionDone(tx);
    }
  }

  return items.length;
}
