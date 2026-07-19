/**
 * 导入导出 + 备份恢复共享工具函数
 *
 * Excel 为主（用户日常操作），JSON 为辅（完整备份/恢复）
 *
 * 扁平化策略：
 * - 无 repeatable section → 1 条记录 = 1 行
 * - 有 repeatable section → 主字段重复 × N 行（N = 该 section 的数组元素个数）
 * - 多个 repeatable section → 展开第一个，其余暂略（全展开会导致列数爆炸）
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { findModule, getBaseModules } from '../moduleConfig';
import { getMassRecords, saveMassRecord } from '../store/massStore';
import { getOperationLogs } from '../store/operationLogStore';
import type { FieldDefinition } from '../moduleConfig';
import { localStorageAdapter, indexedDBAdapter } from "../store/adapter";
import type { MassRecord } from '../store/massStore';
import { exportAttachmentSnapshot, importAttachmentSnapshot } from '../store/attachmentStore';
import { notifyDataChanged } from '../store/dataEvents';
import { APP_VERSION } from '../version';

// ─── 类型 ─────────────────────────────────────────────

interface ParsedFields {
  /** 顶层的非 section 字段（如 案件名称、受案日期） */
  topLevel: FieldDefinition[];
  /** repeatable section 列表 */
  sections: Array<{
    section: FieldDefinition;
    fields: FieldDefinition[];
  }>;
  /** 非 repeatable 的 section（纯分组，展开时只读取它后面的字段作为顶层字段） */
  groups: Array<{
    section: FieldDefinition;
    fields: FieldDefinition[];
  }>;
}

type RowData = Record<string, unknown>;
type RepeatableItem = Record<string, unknown>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '未知错误';
}

// ─── 字段结构解析 ────────────────────────────────────

/** 解析字段定义，分离出顶层字段和各 repeatable section 的子字段 */
function parseFieldDefs(fields: FieldDefinition[]): ParsedFields {
  const result: ParsedFields = { topLevel: [], sections: [], groups: [] };
  let currentRepeatable: { section: FieldDefinition; fields: FieldDefinition[] } | null = null;

  for (const f of fields) {
    if (f.type === 'section') {
      currentRepeatable = null;
      if (f.repeatable) {
        currentRepeatable = { section: f, fields: [] };
        result.sections.push(currentRepeatable);
      } else {
        result.groups.push({ section: f, fields: [] });
      }
    } else if (f.type === 'attachment') {
      // 附件在导出中忽略（仅输出文件名计数）
    } else {
      if (currentRepeatable) {
        currentRepeatable.fields.push(f);
      } else {
        result.topLevel.push(f);
      }
    }
  }
  return result;
}

/** 是否为无 repeatable section 的简单模块 */
function isSimpleModule(fields: FieldDefinition[]): boolean {
  return !fields.some((f) => f.type === 'section' && f.repeatable);
}

// ─── Excel 表头生成 ─────────────────────────────────

/** 从字段定义生成 Excel 表头（标签数组） */
function getHeadersFromFields(fields: FieldDefinition[]): string[] {
  const parsed = parseFieldDefs(fields);

  // 简单模块：所有字段依次排列
  if (isSimpleModule(fields)) {
    return fields
      .filter((f) => f.type !== 'section' && f.type !== 'attachment')
      .map((f) => f.label);
  }

  // 复杂模块：顶层字段 + 第一个 repeatable section 的子字段
  const headers: string[] = [];
  for (const f of parsed.topLevel) {
    headers.push(f.label);
  }
  if (parsed.sections.length > 0) {
    for (const f of parsed.sections[0].fields) {
      headers.push(f.label);
    }
  }
  return headers;
}

/** 获取模块所有 tab 的字段 + label 映射 */
function getModuleTabs(moduleId: string): Array<{ tabId: string; label: string; fields: FieldDefinition[] }> {
  const mod = findModule(moduleId, getBaseModules());
  if (!mod) return [];
  return mod.tabs.map((t) => ({ tabId: t.id, label: t.label, fields: t.fields || [] }));
}

// ─── 数据扁平化 ─────────────────────────────────────

/** 将单条 MassRecord 展平为 Excel 行数组（可能返回多行） */
function flattenRecord(
  record: MassRecord,
  fields: FieldDefinition[],
): RowData[] {
  const parsed = parseFieldDefs(fields);
  const data = record.data || {};

  // 提取顶层值
  const topValues: RowData = {};
  for (const f of parsed.topLevel) {
    topValues[f.label] = data[f.id] ?? '';
  }

  // 简单模块：1 条记录 = 1 行
  if (parsed.sections.length === 0) {
    return [topValues];
  }

  // 展开第一个 repeatable section
  const firstSection = parsed.sections[0];
  const listName = firstSection.section.listName || 'items';
  const rawItems = data[listName];
  const items: RepeatableItem[] = Array.isArray(rawItems)
    ? rawItems.filter((item): item is RepeatableItem => typeof item === 'object' && item !== null)
    : [];

  if (items.length === 0) {
    // 有 section 但无数据 → 返回一行空 section 字段
    const row = { ...topValues };
    for (const f of firstSection.fields) {
      row[f.label] = '';
    }
    return [row];
  }

  return items.map((item) => {
    const row = { ...topValues };
    for (const f of firstSection.fields) {
      row[f.label] = item[f.id] ?? '';
    }
    return row;
  });
}

// ─── Excel 写入（导出） ────────────────────────────

/** 创建工作簿并触发下载 */
function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, filename);
}

/** 安全的下载辅助：优先 saveAs，回退创建临时 <a> 标签 */
function safeDownload(wb: XLSX.WorkBook, filename: string) {
  let wbout: ArrayBuffer;
  try {
    wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  } catch (writeErr) {
    console.error('[excelUtils] XLSX.write 失败:', writeErr);
    return;
  }
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  try {
    saveAs(blob, filename);
  } catch {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (fallbackErr) {
      console.error('[excelUtils] 浏览器下载失败:', fallbackErr);
    }
  }
}

/**
 * 导出指定模块的全部数据到 Excel
 * @param moduleId 模块 ID
 * @param tabId 可选，指定标签页
 */
export function exportModuleToExcel(moduleId: string, tabId?: string): void {
  const tabs = getModuleTabs(moduleId);
  if (tabs.length === 0) {
    console.warn(`[excelUtils] 未找到模块: ${moduleId}`);
    return;
  }

  const wb = XLSX.utils.book_new();
  const records = getMassRecords(moduleId);

  // 按 tab 分组导出
  const targetTabs = tabId ? tabs.filter((t) => t.tabId === tabId) : tabs;

  for (const tab of targetTabs) {
    const tabRecords = records.filter((r) => r.tabId === tab.tabId);

    if (tabRecords.length === 0 && !tabId) continue;

    const headers = getHeadersFromFields(tab.fields);
    if (headers.length === 0) continue;

    // 展平所有记录
    const allRows: RowData[] = [];
    for (const rec of tabRecords) {
      const rows = flattenRecord(rec, tab.fields);
      allRows.push(...rows);
    }

    // 如果没有数据，建一个空模板
    if (allRows.length === 0) {
      const emptyRow: RowData = {};
      for (const h of headers) emptyRow[h] = '';
      allRows.push(emptyRow);
    }

    const ws = XLSX.utils.json_to_sheet(allRows, { header: headers });

    // 设置列宽
    ws['!cols'] = headers.map(() => ({ wch: 16 }));

    // 工作表名最多 31 字符
    const sheetName = tab.label.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const module = findModule(moduleId, getBaseModules());
  const filename = `${module?.label || moduleId}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadWorkbook(wb, filename);
}

/**
 * 导出所有模块的全部数据到 Excel（数据中心“全部记录”）
 * 每个模块一个 sheet，sheet 名取模块名简称
 */
export function exportAllModulesToExcel(): void {
  try {
    const allRecords = getMassRecords();
    const wb = XLSX.utils.book_new();

    if (allRecords.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([['暂无数据']]);
      XLSX.utils.book_append_sheet(wb, ws, '说明');
      safeDownload(wb, `全部工作记录_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return;
    }

    const grouped: Record<string, MassRecord[]> = {};
    for (const r of allRecords) {
      if (!grouped[r.moduleId]) grouped[r.moduleId] = [];
      grouped[r.moduleId].push(r);
    }

    const allModules = getBaseModules();

    for (const [moduleId, records] of Object.entries(grouped)) {
      const mod = allModules.find((m) => m.id === moduleId);
      const tabs = mod?.tabs || [];

      for (const tab of tabs) {
        try {
          const fields = tab.fields || [];
          const headers = getHeadersFromFields(fields);
          if (headers.length === 0) continue;

          const tabRecords = records.filter((r) => r.tabId === tab.id);
          if (tabRecords.length === 0) continue;

          const allRows: RowData[] = [];
          for (const rec of tabRecords) {
            const rows = flattenRecord(rec, fields);
            allRows.push(...rows);
          }

          if (allRows.length === 0) continue;

          const ws = XLSX.utils.json_to_sheet(allRows, { header: headers });
          ws['!cols'] = headers.map(() => ({ wch: 16 }));

          const sheetName = `${mod?.label || moduleId}_${tab.label}`.slice(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        } catch (tabErr) {
          console.warn(`[excelUtils] 导出模块 ${moduleId} 标签 ${tab.label} 时跳过:`, tabErr);
        }
      }
    }

    safeDownload(wb, `全部工作记录_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) {
    console.error('[excelUtils] exportAllModulesToExcel error:', err);
  }
}

/**
 * 导出选中的记录到 Excel
 * @param recordIds 要导出的记录 ID 数组
 * @param moduleId 模块 ID
 * @param tabId 标签页 ID
 */
export function exportSelectedRecords(recordIds: string[], moduleId: string, tabId: string): void {
  const allRecords = getMassRecords(moduleId);
  const selected = allRecords.filter((r) => recordIds.includes(r.id) && r.tabId === tabId);
  if (selected.length === 0) return;

  const tabs = getModuleTabs(moduleId);
  const tab = tabs.find((t) => t.tabId === tabId);
  if (!tab) return;

  const mod = findModule(moduleId, getBaseModules());
  const headers = getHeadersFromFields(tab.fields);
  if (headers.length === 0) return;

  const allRows: RowData[] = [];
  for (const rec of selected) {
    const rows = flattenRecord(rec, tab.fields);
    allRows.push(...rows);
  }

  const ws = XLSX.utils.json_to_sheet(allRows, { header: headers });
  ws['!cols'] = headers.map(() => ({ wch: 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tab.label.slice(0, 31));
  downloadWorkbook(wb, `${mod?.label || moduleId}_选中记录_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * 导出案件台账到 Excel
 */
export function exportCasesToExcel(): void {
  // 迁移后 squad-case 使用 massStore，复用通用导出
  exportModuleToExcel('squad-case', 'squad-case-1');
}

/**
 * 下载指定模块的空模板（仅表头，无数据）
 */
export function downloadModuleTemplate(moduleId: string, tabId?: string): void {
  const tabs = getModuleTabs(moduleId);
  if (tabs.length === 0) return;

  const wb = XLSX.utils.book_new();

  const targetTabs = tabId ? tabs.filter((t) => t.tabId === tabId) : tabs;

  for (const tab of targetTabs) {
    const headers = getHeadersFromFields(tab.fields);
    if (headers.length === 0) continue;

    const emptyRow: RowData = {};
    for (const h of headers) emptyRow[h] = '';

    const ws = XLSX.utils.json_to_sheet([emptyRow], { header: headers });
    ws['!cols'] = headers.map(() => ({ wch: 16 }));
    const sheetName = `${tab.label}模板`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const mod = findModule(moduleId, getBaseModules());
  const filename = `${mod?.label || moduleId}_导入模板.xlsx`;
  downloadWorkbook(wb, filename);
}

// ─── Excel 读取（导入） ────────────────────────────

/**
 * 解析导入的 Excel 文件并保存到指定模块
 * @param file 上传的文件
 * @param moduleId 目标模块 ID
 * @param tabId 可选目标标签页 ID
 * @returns 导入统计
 */
export async function importExcelToModule(
  file: File,
  moduleId: string,
  tabId?: string,
): Promise<{ success: number; failed: number; errors: string[] }> {
  const result = { success: 0, failed: 0, errors: [] as string[] };

  // ── squad-case：数据已迁移到 massStore ──
  if (moduleId === 'squad-case') {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) { result.errors.push('Excel 文件中没有工作表'); return result; }
      const ws = wb.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
      if (jsonRows.length === 0) { result.errors.push('Excel 文件中没有有效数据'); return result; }

      // Excel 列名 → 字段映射
      const LABEL_TO_FIELD: Record<string, string> = {
        '案件编号': 'caseNo', '案件名称': 'caseName', '案件类型': 'caseType',
        '涉案金额(万元)': 'totalAmount', '受害人数': 'victimCount',
        '案件来源': 'caseSource', '受案日期': 'receiveDate', '立案日期': 'filingDate',
        '承办人': 'leadOfficer', '协办人': 'assistOfficer',
        '结案日期': 'caseCloseDate', '办理状态': 'progressStatus',
        '受/立案文书号': 'filingDocNo', '不予立案日期': 'noFilingDate',
        '主办民警': 'leadOfficer', '协办民警': 'assistOfficer',
        '涉案总金额(万)': 'totalAmount', '涉案总金额（万元）': 'totalAmount',
      };

      for (const row of jsonRows) {
        try {
          const data: Record<string, string> = {};
          for (const [label, value] of Object.entries(row)) {
            const field = LABEL_TO_FIELD[label];
            if (field) data[field] = value;
          }
          if (!data.caseName && !data.caseNo) {
            result.failed++;
            result.errors.push('缺少案件名称或案件编号');
            continue;
          }
          saveMassRecord('squad-case', 'squad-case-1', data);
          result.success++;
        } catch {
          result.failed++;
        }
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : '导入 squad-case 失败');
    }
    return result;
  }

  // ── 通用导入流程 ──
  const tabs = getModuleTabs(moduleId);
  if (tabs.length === 0) {
    result.errors.push(`未找到模块: ${moduleId}`);
    return result;
  }

  const targetTabs = tabId ? tabs.filter((t) => t.tabId === tabId) : tabs;

  try {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    for (const tab of targetTabs) {
      // 找匹配的 sheet（按标签名匹配）
      const sheetName = wb.SheetNames.find(
        (name) => name.includes(tab.label) || tab.label.includes(name),
      );
      if (!sheetName) continue;

      const ws = wb.Sheets[sheetName];
      const jsonRows = XLSX.utils.sheet_to_json<RowData>(ws, { defval: '' });
      if (jsonRows.length === 0) continue;

      // 构建 label → fieldId 映射
      const fieldMap = buildFieldLabelMap(tab.fields);
      const parsed = parseFieldDefs(tab.fields);
      const isSimple = isSimpleModule(tab.fields);

      for (const row of jsonRows) {
        try {
          const data: RowData = {};

          if (isSimple) {
            // 简单模块：直接映射
            for (const [label, value] of Object.entries(row)) {
              const fieldId = fieldMap[label];
              if (fieldId) data[fieldId] = value;
            }
          } else {
            // 复杂模块：顶层字段直接映射，section 字段需要收集
            const topData: RowData = {};

            // 分离顶层和 section 字段
            const topFieldIds = new Set(parsed.topLevel.map((f) => f.id));
            const sectionFieldIds = new Map<string, string>(); // label → id
            if (parsed.sections.length > 0) {
              for (const f of parsed.sections[0].fields) {
                sectionFieldIds.set(f.label, f.id);
              }
            }

            let currentItem: RepeatableItem | null = null;

            // 对于 repeatable 场景，每行就是一个 section 元素
            // 顶层字段取当前行的值，section 字段也取当前行的值
            for (const [label, value] of Object.entries(row)) {
              const fieldId = fieldMap[label];
              if (!fieldId) continue;

              if (topFieldIds.has(fieldId)) {
                topData[fieldId] = value;
              } else if (sectionFieldIds.has(label)) {
                if (!currentItem) currentItem = {};
                currentItem[sectionFieldIds.get(label)!] = value;
              } else {
                topData[fieldId] = value;
              }
            }

            // 合并到 data
            Object.assign(data, topData);
            if (currentItem && parsed.sections.length > 0) {
              const listName = parsed.sections[0].section.listName || 'items';
              data[listName] = [currentItem];
            }
          }

          saveMassRecord(moduleId, tab.tabId, data);
          result.success++;
        } catch (err) {
          result.failed++;
          result.errors.push(`行 ${result.success + result.failed}: ${getErrorMessage(err)}`);
        }
      }
    }
  } catch (err) {
    result.errors.push(`文件解析失败: ${getErrorMessage(err)}`);
  }

  return result;
}

/** 从字段定义构建 label → id 映射 */
function buildFieldLabelMap(fields: FieldDefinition[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of fields) {
    if (f.type !== 'section' && f.type !== 'attachment') {
      map[f.label] = f.id;
    }
  }
  return map;
}

// ─── JSON 备份与恢复 ───────────────────────────────

const BACKUP_META_KEY = 'jingzong.backup.meta';

interface BackupMeta {
  id: string;
  name: string;
  time: string;
  size: string;
  type: 'auto' | 'manual';
}

/**
 * 生成全量 JSON 备份
 * 读取所有 jingzong.* 开头的 localStorage key + IndexedDB 中的数据
 */
/**
 * 生成全量 JSON 备份
 * 读取所有 jingzong.* 开头的 localStorage key + IndexedDB 中的数据
 * @returns true=备份已生成，false=用户取消或失败
 */
export async function generateBackup(): Promise<boolean> {
  const data: RowData = {};

  // 1) 读取 localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('jingzong.')) {
      try {
        data[key] = localStorageAdapter.getItem(key, '');
      } catch {
        data[key] = localStorageAdapter.getItem<string>(key, "");
      }
    }
  }

  // 2) 读取 IndexedDB 中的数据（dailyNotes、massRecords、drafts 等）
  const idbKeys = indexedDBAdapter.keys('jingzong.');
  for (const key of idbKeys) {
    try {
      const val = indexedDBAdapter.getItem(key, null);
      if (val !== null && val !== undefined) {
        data[key] = val;
      }
    } catch {}
  }

  const attachments = await exportAttachmentSnapshot();

  const backup = {
    version: '2.1',
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    idbKeys,
    data,
    attachments,
  };

  const json = JSON.stringify(backup, null, 2);
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '-');
  const defaultName = `jingzong_备份_${timestamp}.json`.replace(/[\\/:*?"<>|]/g, '-');

  // Electron 环境：弹出原生保存对话框，让用户选择任意路径（如 U 盘/备份文件夹）
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (api?.showSaveDialog) {
    try {
      const buffer = Array.from(new TextEncoder().encode(json));
      const res = await api.showSaveDialog(defaultName, buffer);
      if (res.canceled) return false;
      if (res.success) {
        saveBackupMeta(timestamp);
        return true;
      }
      // 写入失败则回退到浏览器下载
    } catch {
      // 回退到浏览器下载
    }
  }

  // 浏览器环境（或非 Electron）回退：直接触发下载到默认下载目录
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, defaultName);
  saveBackupMeta(timestamp);
  return true;
}

/** 备份文件头部预览信息（用于恢复前确认弹窗） */
export interface BackupPreview {
  valid: boolean;
  createdAt?: string;
  appVersion?: string;
  recordCount?: number;
  attachmentCount: number;
  sizeLabel: string;
  error?: string;
}

/** 解析备份文件头部，提取元信息（不依赖附件二进制大小，仅统计数量） */
export async function previewBackupFile(file: File): Promise<BackupPreview> {
  const sizeKB = file.size / 1024;
  const sizeLabel = sizeKB < 1024 ? `${sizeKB.toFixed(0)}KB` : `${(sizeKB / 1024).toFixed(1)}MB`;
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    if (!backup || typeof backup !== 'object' || !backup.data) {
      return { valid: false, attachmentCount: 0, sizeLabel, error: '无效的备份文件格式' };
    }
    const data = backup.data as Record<string, unknown>;
    const records = Array.isArray(data['jingzong.mass.records'])
      ? (data['jingzong.mass.records'] as unknown[]).length
      : undefined;
    const attachments = Array.isArray(backup.attachments) ? backup.attachments.length : 0;
    return {
      valid: true,
      createdAt: backup.createdAt,
      appVersion: backup.appVersion,
      recordCount: records,
      attachmentCount: attachments,
      sizeLabel,
    };
  } catch (err) {
    return {
      valid: false,
      attachmentCount: 0,
      sizeLabel,
      error: err instanceof Error ? err.message : '备份文件解析失败',
    };
  }
}

/** 记录备份到 localStorage 元信息列表 */
function saveBackupMeta(timestamp: string): void {
  const metas = getBackupMetas();
  const meta: BackupMeta = {
    id: `backup-${Date.now()}`,
    name: `手动备份_${timestamp.replace(/[_:-]/g, '')}`,
    time: new Date().toISOString().slice(0, 16).replace('T', ' '),
    size: '—',
    type: 'manual',
  };
  metas.unshift(meta);
  // 保留最近 30 条
  while (metas.length > 30) metas.pop();
  localStorageAdapter.setItem(BACKUP_META_KEY, metas);
}

/** 获取备份元信息列表 */
export function getBackupMetas(): BackupMeta[] {
  try {
    const raw = localStorageAdapter.getItem(BACKUP_META_KEY, "[]");
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return JSON.parse(raw);
    return [];
  } catch {
    return [];
  }
}

/** 删除一条备份元信息 */
export function deleteBackupMeta(id: string): void {
  const metas = getBackupMetas().filter((m) => m.id !== id);
  localStorageAdapter.setItem(BACKUP_META_KEY, metas);
}

/**
 * 从 JSON 文件恢复数据
 */
export async function restoreFromJson(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.version || !backup.data || typeof backup.data !== 'object') {
      return { success: false, message: '无效的备份文件格式' };
    }

    // 需要写回 IndexedDB 的 key 列表：优先使用备份时记录的清单，
    // 旧备份无此字段则回退到已知键（dailyNotes/mass.records），并兜底 draft.*，避免漏恢复。
    const backupIdbKeys: string[] = Array.isArray(backup.idbKeys)
      ? backup.idbKeys
      : ['jingzong.dailyNotes', 'jingzong.mass.records'];

    // —— 非破坏性恢复（V2.41.17 修复 #3/#4）——
    // 1) 先对当前数据做内存快照；写回失败则整体回滚，绝不「先清空再失败」导致数据全丢。
    const snapshotLocal: Record<string, unknown> = {};
    const snapshotIdb: Record<string, unknown> = {};
    for (const k of localStorageAdapter.keys('jingzong.')) {
      snapshotLocal[k] = localStorageAdapter.getItem(k, null);
    }
    for (const k of indexedDBAdapter.keys('jingzong.')) {
      snapshotIdb[k] = indexedDBAdapter.getItem(k, null);
    }
    const rollback = () => {
      localStorageAdapter.clear('jingzong.');
      indexedDBAdapter.clear('jingzong.');
      for (const [k, v] of Object.entries(snapshotLocal)) {
        if (v !== null && v !== undefined) localStorageAdapter.setItem(k, v);
      }
      for (const [k, v] of Object.entries(snapshotIdb)) {
        if (v !== null && v !== undefined) indexedDBAdapter.setItem(k, v);
      }
    };

    try {
      // 2) 清空并写回备份数据
      localStorageAdapter.clear('jingzong.');
      indexedDBAdapter.clear('jingzong.');

      let count = 0;
      for (const [key, value] of Object.entries(backup.data)) {
        if (key.startsWith('jingzong.') && value !== undefined) {
          // 写入 localStorage
          localStorageAdapter.setItem(key, value);
          count++;

          // 写入 IndexedDB（业务主存储）：以备份清单为准，兼容旧备份再兜底 draft.*
          if (backupIdbKeys.includes(key) || key.startsWith('jingzong.draft.')) {
            indexedDBAdapter.setItem(key, value);
          }
        }
      }

      // 3) 重建索引
      try {
        const { rebuildCaseIndex, rebuildSuspectIndex } = await import('../store/inputHistoryStore');
        const records = indexedDBAdapter.getItem('jingzong.mass.records', []);
        if (Array.isArray(records) && records.length > 0) {
          rebuildCaseIndex(records);
          rebuildSuspectIndex(records);
        }
      } catch { /* ignore */ }

      // 4) 附件恢复：失败不致命，仅提示，不再因附件问题导致整库数据丢失
      let attachmentMessage = '';
      if (Array.isArray(backup.attachments)) {
        try {
          const attachmentCount = await importAttachmentSnapshot(backup.attachments);
          attachmentMessage = `，${attachmentCount} 个附件`;
        } catch (attErr) {
          console.warn('[restore] 附件恢复失败，已保留其他数据：', attErr);
          attachmentMessage = '（附件恢复失败，已保留其余数据）';
        }
      }

      // 通知各依赖 getMassRecords() 的组件重新读取（仪表盘/预警等）
      notifyDataChanged();

      return { success: true, message: `成功恢复 ${count} 项数据${attachmentMessage}` };
    } catch (writeErr) {
      // 写回阶段出错：回滚到快照，原数据不丢失
      try { rollback(); } catch { /* ignore */ }
      return { success: false, message: `恢复失败，已回滚至恢复前状态（原数据未丢失）：${getErrorMessage(writeErr)}` };
    }
  } catch (err) {
    return { success: false, message: `恢复失败: ${getErrorMessage(err)}` };
  }
}

// ─── CSV / JSON 导出辅助 ────────────────────────────

/** 导出操作日志为 JSON（读取 operationLogStore 中的真实数据） */
export function exportOperationLog(): void {
  const logs = getOperationLogs();
  const json = logs.length > 0 ? JSON.stringify(logs, null, 2) : JSON.stringify([]);
  const blob = new Blob([json], { type: 'application/json' });
  saveAs(blob, `操作日志_${new Date().toISOString().slice(0, 10)}.json`);
}

/** 将表头与行数据序列化为 CSV 文本（表头为第一行，每条数据一行，\r\n 分隔，确保每项信息落在对应表头列） */
export function csvToString(headers: string[], rows: RowData[], options?: { withBom?: boolean }): string {
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const vals = headers.map((h) => {
      const v = row[h] ?? '';
      const str = String(v);
      // 含逗号、引号或换行时包裹，避免破坏列结构
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(vals.join(','));
  }
  const text = csvRows.join('\r\n');
  return options?.withBom ? '\uFEFF' + text : text;
}

/** 导出 CSV 文件（用于"受害人信息CSV"等场景） */
export function exportCsv(headers: string[], rows: RowData[], filename: string): void {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel
  const blob = new Blob([csvToString(headers, rows, { withBom: true })], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
}

