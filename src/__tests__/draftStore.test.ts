/**
 * Tests for draftStore
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock indexedDB for jsdom environment
const mockIDB = {
  open: vi.fn(() => ({
    onupgradeneeded: null as any,
    onsuccess: null as any,
    onerror: null as any,
    result: {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          put: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
          openCursor: vi.fn(() => ({
            onsuccess: null as any,
          })),
        })),
      })),
    },
  })),
};

// @ts-ignore
global.indexedDB = mockIDB;

import { saveDraft, getDraft, deleteDraft, getAllDrafts, clearAllDrafts } from '../store/draftStore';

describe('draftStore', () => {
  beforeEach(() => {
    clearAllDrafts();
  });

  it('should save and retrieve a draft', () => {
    saveDraft('module-1', 'tab-1', 0, { name: 'Test', value: 123 });
    const draft = getDraft('module-1', 'tab-1');
    expect(draft).not.toBeNull();
    expect(draft?.moduleId).toBe('module-1');
    expect(draft?.tabId).toBe('tab-1');
    expect(draft?.step).toBe(0);
    expect(draft?.data.name).toBe('Test');
    expect(draft?.data.value).toBe(123);
  });

  it('should overwrite existing draft', () => {
    saveDraft('module-1', 'tab-1', 0, { name: 'First' });
    saveDraft('module-1', 'tab-1', 1, { name: 'Second' });
    const draft = getDraft('module-1', 'tab-1');
    expect(draft?.step).toBe(1);
    expect(draft?.data.name).toBe('Second');
  });

  it('should delete a draft', () => {
    saveDraft('module-1', 'tab-1', 0, { name: 'Test' });
    deleteDraft('module-1', 'tab-1');
    const draft = getDraft('module-1', 'tab-1');
    expect(draft).toBeNull();
  });

  it('should return null for non-existent draft', () => {
    const draft = getDraft('non-existent', 'non-existent');
    expect(draft).toBeNull();
  });

  it('should list all drafts', () => {
    saveDraft('m1', 't1', 0, { a: 1 });
    saveDraft('m2', 't2', 0, { b: 2 });
    const drafts = getAllDrafts();
    expect(drafts.length).toBe(2);
  });

  it('should clear all drafts', () => {
    saveDraft('m1', 't1', 0, { a: 1 });
    saveDraft('m2', 't2', 0, { b: 2 });
    clearAllDrafts();
    const drafts = getAllDrafts();
    expect(drafts.length).toBe(0);
  });
});
