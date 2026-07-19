/**
 * IndexedDB 存储适配器
 * 通过内存缓存实现同步接口，底层持久化到 IndexedDB
 * 解决 localStorage 5MB 限制，适合存储大量业务数据
 */

import type { StorageAdapter } from './types';

const DB_NAME = 'jingzong_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

class IndexedDBAdapter implements StorageAdapter {
  private cache = new Map<string, unknown>();
  private ready: Promise<void>;
  private db: IDBDatabase | null = null;
  /** DB 未就绪时排队的写/删操作，就绪后统一 flush，避免静默丢写（C-1） */
  private pendingWrites = new Map<string, unknown>();
  private pendingRemoves = new Set<string>();

  constructor() {
    this.ready = this.initDB();
  }

  /** 等待 IndexedDB 加载完成后再执行操作 */
  async whenReady(): Promise<void> {
    return this.ready;
  }

  private initDB(): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        console.warn('[IndexedDB] Failed to open, falling back to memory-only mode');
        resolve();
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        // 先填充缓存（跳过已排队写入的 key，保留内存中的最新值），再 flush 排队操作
        this.loadAll()
          .then(() => this.flushPending())
          .then(resolve)
          .catch(() => {
            this.flushPending();
            resolve();
          });
      };
    });
  }

  private async loadAll(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          // 已排队写入的 key 以内存中值（最新）为准，不要被磁盘旧值覆盖
          if (!this.pendingWrites.has(cursor.key as string)) {
            this.cache.set(cursor.key as string, cursor.value);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** DB 就绪后，将启动期间排队的写/删落盘 */
  private flushPending(): void {
    if (!this.db) return;
    for (const [key, value] of this.pendingWrites) {
      this.persist(key, value);
    }
    this.pendingWrites.clear();
    for (const key of this.pendingRemoves) {
      this.removeKey(key);
    }
    this.pendingRemoves.clear();
  }

  private persist(key: string, value: unknown): void {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
    } catch (err) {
      console.warn(`[IndexedDB] Failed to persist key "${key}":`, err);
    }
  }

  private removeKey(key: string): void {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
    } catch (err) {
      console.warn(`[IndexedDB] Failed to delete key "${key}":`, err);
    }
  }

  getItem<T>(key: string, fallback: T): T {
    const raw = this.cache.get(key);
    if (raw === undefined) return fallback;
    return raw as T;
  }

  setItem(key: string, value: unknown): void {
    this.cache.set(key, value);
    if (this.db) {
      this.persist(key, value);
    } else {
      // DB 尚未就绪：排队，待 initDB 完成后 flush（C-1）
      this.pendingWrites.set(key, value);
    }
  }

  removeItem(key: string): void {
    this.cache.delete(key);
    if (this.db) {
      this.removeKey(key);
    } else {
      this.pendingRemoves.add(key);
    }
  }

  keys(prefix?: string): string[] {
    const result: string[] = [];
    for (const key of this.cache.keys()) {
      if (!prefix || key.startsWith(prefix)) {
        result.push(key);
      }
    }
    return result;
  }

  estimateSize(prefix?: string): number {
    let total = 0;
    for (const [key, value] of this.cache) {
      if (!prefix || key.startsWith(prefix)) {
        total += JSON.stringify(value).length;
      }
    }
    return total;
  }

  clear(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      this.pendingWrites.clear();
      this.pendingRemoves.clear();
      if (this.db) {
        try {
          const tx = this.db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).clear();
        } catch (err) {
          console.warn('[IndexedDB] Failed to clear store:', err);
        }
      }
      return;
    }
    const keysToRemove = this.keys(prefix);
    keysToRemove.forEach((key) => this.removeItem(key));
  }
}

export const indexedDBAdapter: StorageAdapter = new IndexedDBAdapter();
