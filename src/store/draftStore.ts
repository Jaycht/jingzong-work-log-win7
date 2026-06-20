/**
 * 表单草稿存储
 * 自动保存未提交的表单数据到 IndexedDB，支持恢复
 */

import { indexedDBAdapter } from './adapter';

const DRAFT_PREFIX = 'jingzong.draft.';
const DRAFT_INDEX_KEY = 'jingzong.draftIndex';

export interface DraftEntry {
  id: string;
  moduleId: string;
  tabId: string;
  step: number;
  data: Record<string, unknown>;
  savedAt: string;
}

function getDraftIndex(): string[] {
  return indexedDBAdapter.getItem<string[]>(DRAFT_INDEX_KEY, []);
}

function saveDraftIndex(index: string[]): void {
  indexedDBAdapter.setItem(DRAFT_INDEX_KEY, index);
}

/** 保存草稿 */
export function saveDraft(
  moduleId: string,
  tabId: string,
  step: number,
  data: Record<string, unknown>
): void {
  const draftId = `${moduleId}__${tabId}`;
  const entry: DraftEntry = {
    id: draftId,
    moduleId,
    tabId,
    step,
    data,
    savedAt: new Date().toISOString(),
  };
  indexedDBAdapter.setItem(DRAFT_PREFIX + draftId, entry);

  const index = getDraftIndex();
  if (!index.includes(draftId)) {
    index.push(draftId);
    saveDraftIndex(index);
  }
}

/** 读取草稿 */
export function getDraft(moduleId: string, tabId: string): DraftEntry | null {
  const draftId = `${moduleId}__${tabId}`;
  return indexedDBAdapter.getItem<DraftEntry | null>(DRAFT_PREFIX + draftId, null);
}

/** 删除草稿 */
export function deleteDraft(moduleId: string, tabId: string): void {
  const draftId = `${moduleId}__${tabId}`;
  indexedDBAdapter.removeItem(DRAFT_PREFIX + draftId);
  const index = getDraftIndex().filter((id) => id !== draftId);
  saveDraftIndex(index);
}

/** 获取所有草稿 */
export function getAllDrafts(): DraftEntry[] {
  const index = getDraftIndex();
  return index
    .map((id) => indexedDBAdapter.getItem<DraftEntry | null>(DRAFT_PREFIX + id, null))
    .filter((d): d is DraftEntry => d !== null);
}

/** 清除所有草稿 */
export function clearAllDrafts(): void {
  const index = getDraftIndex();
  for (const id of index) {
    indexedDBAdapter.removeItem(DRAFT_PREFIX + id);
  }
  saveDraftIndex([]);
}
