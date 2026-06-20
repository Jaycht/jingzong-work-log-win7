/**
 * 涉众模块数据存储
 * 使用 IndexedDB 持久化涉众模块记录（自动迁移旧 localStorage 数据），并写入操作日志。
 */

import { indexedDBAdapter } from './adapter';
import { addOperationLog } from './operationLogStore';
import { useAppStore } from './appStore';
import { rebuildCaseIndex, rebuildSuspectIndex } from './inputHistoryStore';

const STORAGE_KEY = 'jingzong.mass.records';
const MIGRATION_KEY = 'jingzong.mass.migratedToIDB.v1';

export type MassRecordData = Record<string, unknown>;

export interface MassRecord {
  id: string;
  moduleId: string;
  tabId: string;
  data: MassRecordData;
  createdAt: string;
  updatedAt: string;
}

function currentUser(): string {
  try {
    return useAppStore.getState().userName || 'system';
  } catch {
    return 'system';
  }
}

export function getMassRecords(moduleId?: string): MassRecord[] {
  const all = indexedDBAdapter.getItem<MassRecord[]>(STORAGE_KEY, []);
  return moduleId ? all.filter((record) => record.moduleId === moduleId) : all;
}

export function saveMassRecord(moduleId: string, tabId: string, data: MassRecordData): MassRecord {
  const records = getMassRecords();
  const now = new Date().toISOString();
  const record: MassRecord = {
    id: `mass-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    moduleId,
    tabId,
    data,
    createdAt: now,
    updatedAt: now,
  };

  records.unshift(record);
  indexedDBAdapter.setItem(STORAGE_KEY, records);
  addOperationLog({
    user: currentUser(),
    action: '新建',
    detail: `新建记录 (${moduleId}/${tabId})`,
    ip: 'local',
    type: 'create',
  });

  return record;
}

export function updateMassRecord(id: string, data: MassRecordData): MassRecord | null {
  const records = getMassRecords();
  const index = records.findIndex((record) => record.id === id);
  if (index === -1) return null;

  records[index] = {
    ...records[index],
    data,
    updatedAt: new Date().toISOString(),
  };

  indexedDBAdapter.setItem(STORAGE_KEY, records);
  addOperationLog({
    user: currentUser(),
    action: '更新',
    detail: `更新记录 (${records[index].moduleId})`,
    ip: 'local',
    type: 'edit',
  });

  return records[index];
}

export function deleteMassRecord(id: string): void {
  const records = getMassRecords().filter((record) => record.id !== id);
  indexedDBAdapter.setItem(STORAGE_KEY, records);
  rebuildCaseIndex(records);
  rebuildSuspectIndex(records);
  addOperationLog({
    user: currentUser(),
    action: '删除',
    detail: `删除记录 ${id}`,
    ip: 'local',
    type: 'delete',
  });
}

export function deleteMassRecords(ids: string[]): void {
  const idSet = new Set(ids);
  const records = getMassRecords().filter((record) => !idSet.has(record.id));
  indexedDBAdapter.setItem(STORAGE_KEY, records);
  rebuildCaseIndex(records);
  rebuildSuspectIndex(records);
  addOperationLog({
    user: currentUser(),
    action: '批量删除',
    detail: `批量删除 ${ids.length} 条记录`,
    ip: 'local',
    type: 'delete',
  });
}

/**
 * 从所有记录中移除指定附件 ID 的引用
 * 通过适配器读取/写入，兼容 IndexedDB 存储
 */
export function removeAttachmentRefsFromAllRecords(attachmentIds: Set<string>): number {
  if (attachmentIds.size === 0) return 0;

  const records = getMassRecords();
  if (records.length === 0) return 0;

  let totalRemoved = 0;
  let anyModified = false;

  for (const record of records) {
    const dataStr = JSON.stringify(record.data);
    let modified = dataStr;
    let removedForRecord = 0;
    for (const id of attachmentIds) {
      if (!id) continue;
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patterns = [
        new RegExp(`,\\s*\\{[^}]*"uid"\\s*:\\s*"${escaped}"[^}]*\\}`, 'g'),
        new RegExp(`\\{[^}]*"uid"\\s*:\\s*"${escaped}"[^}]*\\}\\s*,`, 'g'),
      ];
      for (const re of patterns) {
        const before = modified.length;
        modified = modified.replace(re, '');
        if (modified.length !== before) removedForRecord++;
      }
    }
    if (modified !== dataStr) {
      try {
        const cleaned = modified
          .replace(/,\s*\}/g, '}')
          .replace(/,\s*\]/g, ']');
        JSON.parse(cleaned); // 验证 JSON 合法性
        record.data = JSON.parse(cleaned);
        totalRemoved += removedForRecord;
        anyModified = true;
      } catch {
        // JSON 解析失败，跳过该条记录，不计入移除数
      }
    }
  }

  if (anyModified) {
    indexedDBAdapter.setItem(STORAGE_KEY, records);
  }

  return totalRemoved;
}

function collectUniqueStringValues(moduleId: string, key: string): string[] {
  const records = getMassRecords(moduleId);
  const values = new Set<string>();

  for (const record of records) {
    const raw = record.data?.[key];
    if (typeof raw === 'string') {
      const normalized = raw.trim();
      if (normalized) {
        values.add(normalized);
      }
    }
  }

  return Array.from(values);
}

export function getClueProjectNames(): string[] {
  return collectUniqueStringValues('mass-clue', 'projectName');
}

export function getLegalReportMatters(): string[] {
  return collectUniqueStringValues('legal-report-case', 'reportMatter');
}

export function getEvidenceClueNames(): string[] {
  return collectUniqueStringValues('evidence-clue', 'clueName');
}

// ─── 中队案件数据兼容 ────────────────────────────

/** 获取 squad-case 案件名称列表（去重） */
export function getSquadCaseNames(): string[] {
  return collectUniqueStringValues('squad-case', 'caseName');
}

/** 获取 squad-case 案件编号列表（去重） */
export function getSquadCaseNos(): string[] {
  return collectUniqueStringValues('squad-case', 'caseNo');
}

const SQUAD_CASE_MIGRATED_KEY = 'jingzong.squad-cases.migrated.v1';

/**
 * 将旧 caseStore 数据迁移到 massStore
 * 幂等：迁移完成后设置标记，不会重复迁移
 */
export function migrateOldCasesToMassStore(): void {
  try {
    if (localStorage.getItem(SQUAD_CASE_MIGRATED_KEY)) return;
    const oldRaw = localStorage.getItem('jingzong.squad.cases');
    if (!oldRaw) { localStorage.setItem(SQUAD_CASE_MIGRATED_KEY, '1'); return; }
    const oldCases = JSON.parse(oldRaw);
    if (!Array.isArray(oldCases) || oldCases.length === 0) {
      localStorage.setItem(SQUAD_CASE_MIGRATED_KEY, '1');
      return;
    }
    const records = getMassRecords();
    const now = new Date().toISOString();
    let count = 0;
    for (const c of oldCases) {
      if (!c.id || !c.caseName) continue;
      if (records.some(r => r.data?.__oldCaseId === c.id)) continue;
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = c;
      records.push({
        id: `mass-squad-case-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        moduleId: 'squad-case',
        tabId: 'squad-case-1',
        data: { ...rest, __oldCaseId: c.id },
        createdAt: c.createdAt || now,
        updatedAt: now,
      });
      count++;
    }
    if (count > 0) indexedDBAdapter.setItem(STORAGE_KEY, records);
    localStorage.setItem(SQUAD_CASE_MIGRATED_KEY, '1');
    console.log(`[migration] 已迁移 ${count} 条旧案件数据到 massStore`);
  } catch (err) {
    console.warn('[migration] 案件数据迁移失败:', err);
  }
}

/**
 * 从 localStorage 迁移旧版 mass records 到 IndexedDB
 * 幂等：迁移后设置标记，不会重复执行
 */
export function migrateLocalStorageToIndexedDB(): void {
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(MIGRATION_KEY, '1');
      return;
    }
    const records = JSON.parse(raw);
    if (Array.isArray(records) && records.length > 0) {
      indexedDBAdapter.setItem(STORAGE_KEY, records);
      console.log(`[migration] 已迁移 ${records.length} 条记录从 localStorage 到 IndexedDB`);
    }
    localStorage.setItem(MIGRATION_KEY, '1');
  } catch (err) {
    console.warn('[migration] localStorage → IndexedDB 迁移失败:', err);
  }
}
