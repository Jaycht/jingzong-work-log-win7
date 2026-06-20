/**
 * localStorage 存储适配器实现
 */

import type { StorageAdapter } from './types';

export const localStorageAdapter: StorageAdapter = {
  getItem<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[StorageAdapter] Failed to read key "${key}":`, err);
      return fallback;
    }
  },

  setItem(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(`[StorageAdapter] Failed to write key "${key}":`, err);
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[StorageAdapter] Failed to remove key "${key}":`, err);
    }
  },

  keys(prefix?: string): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (!prefix || key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    return keys;
  },

  estimateSize(prefix?: string): number {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (!prefix || key.startsWith(prefix))) {
        total += localStorage.getItem(key)?.length || 0;
      }
    }
    return total;
  },

  clear(prefix?: string): void {
    if (!prefix) {
      localStorage.clear();
      return;
    }
    const keysToRemove = this.keys(prefix);
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  },
};
