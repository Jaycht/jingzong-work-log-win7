/**
 * 输入历史存储
 * 记录用户在各输入框中输入过的历史值，以 fieldId 为维度存储（跨模块共享）。
 * 每次保存记录时，自动从表单数据中提取 field 值写入历史。
 * 每个 fieldId 最多保留 20 条历史记录。
 */

import { localStorageAdapter } from './adapter';

const STORAGE_KEY = 'jingzong.inputHistory.v2';

const MAX_HISTORY_PER_FIELD = 20;

interface InputHistoryStore {
  [fieldId: string]: string[];
}

function loadStore(): InputHistoryStore {
  return localStorageAdapter.getItem<InputHistoryStore>(STORAGE_KEY, {});
}

function saveStore(store: InputHistoryStore): void {
  localStorageAdapter.setItem(STORAGE_KEY, store);
}

/**
 * 获取某个字段的输入历史（去重，最新的在前）
 */
export function getFieldHistory(fieldId: string): string[] {
  const store = loadStore();
  return store[fieldId] || [];
}

/**
 * 记录一个字段的输入值到历史
 */
export function recordFieldValue(fieldId: string, value: string): void {
  const v = (value || '').trim();
  if (!v) return;

  const store = loadStore();
  const history = store[fieldId] || [];

  // 去重：如果已存在则移除旧位置
  const filtered = history.filter((item) => item !== v);
  // 插入到最前面
  filtered.unshift(v);
  // 截断长度
  store[fieldId] = filtered.slice(0, MAX_HISTORY_PER_FIELD);
  saveStore(store);
}

/**
 * 隐藏建议项存储：用户点了删除，只隐藏不删真实数据
 */
const HIDDEN_SUGGESTIONS_KEY = 'jingzong.inputHistory.hidden.v1';
type HiddenSuggestionStore = Record<string, string[]>;

function loadHiddenSuggestions(): HiddenSuggestionStore {
  return localStorageAdapter.getItem<HiddenSuggestionStore>(HIDDEN_SUGGESTIONS_KEY, {});
}

function saveHiddenSuggestions(store: HiddenSuggestionStore): void {
  localStorageAdapter.setItem(HIDDEN_SUGGESTIONS_KEY, store);
}

/** 获取某个字段已隐藏的建议项列表 */
export function getHiddenSuggestions(fieldId: string): string[] {
  const store = loadHiddenSuggestions();
  return store[fieldId] || [];
}

/**
 * 隐藏一条建议项（同时从输入历史中删除，并加入隐藏列表）
 * 用于案件名称/编号这类下拉数据来自已保存记录索引的字段
 */
export function hideFieldSuggestion(fieldId: string, value: string): void {
  const v = value.trim();
  if (!v) return;

  // 加入隐藏列表
  const store = loadHiddenSuggestions();
  const list = store[fieldId] || [];
  if (!list.includes(v)) {
    store[fieldId] = [v, ...list];
    saveHiddenSuggestions(store);
  }

  // 同时从输入历史中删除
  deleteFieldHistoryEntry(fieldId, v);
}

/**
 * 删除某条历史记录
 */
export function deleteFieldHistoryEntry(fieldId: string, value: string): void {
  const store = loadStore();
  const history = store[fieldId];
  if (!history) return;
  store[fieldId] = history.filter((item) => item !== value);
  saveStore(store);
}

/**
 * 批量记录表单数据中的字段值
 * 支持从扁平数据和 repeatable section 数组中都提取
 */
export function recordFormFields(
  fieldsIds: string[],
  data: Record<string, unknown>,
): void {
  // 1) 记录顶层扁平字段
  for (const id of fieldsIds) {
    const raw = data[id];
    if (typeof raw === 'string') {
      recordFieldValue(id, raw);
    }
  }

  // 2) 遍历所有值，从 repeatable section 数组中提取嵌套字段
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            if (typeof v === 'string' && v.trim()) {
              recordFieldValue(k, v);
            }
          }
        }
      }
    }
  }
}

/**
 * 全局案件编号/案件名称联动数据
 * 从所有模块的所有记录中提取 caseNo 和 caseName，并建立映射关系
 * 同时记录每条案件的详细信息（主办民警、受案日期等），用于联动填充更多字段
 */

const CASE_DATA_KEY = 'jingzong.caseData.v2';

/** 一条案件的详细摘要 */
export interface CaseDetail {
  caseName: string;
  /** 主办民警 */
  leadOfficer?: string;
  /** 协办民警 */
  assistOfficer?: string;
  /** 受案日期 */
  receiveDate?: string;
  /** 立案日期 */
  filingDate?: string;
  /** 案件类型 */
  caseType?: string;
  /** 案件来源 */
  caseSource?: string;
  /** 涉案总金额 */
  totalAmount?: number;
  /** 简要案情 */
  caseSummary?: string;
  /** 受立案文书号 */
  filingDocNo?: string;
}

interface CaseDataMap {
  caseNoToName: Record<string, string[]>;
  caseNameToNo: Record<string, string[]>;
  /** 按案件编号索引的详细信息（最新记录覆盖旧记录） */
  caseDetails: Record<string, CaseDetail>;
}

function loadCaseData(): CaseDataMap {
  return localStorageAdapter.getItem<CaseDataMap>(CASE_DATA_KEY, {
    caseNoToName: {},
    caseNameToNo: {},
    caseDetails: {},
  });
}

function saveCaseData(map: CaseDataMap): void {
  localStorageAdapter.setItem(CASE_DATA_KEY, map);
}

/** 从记录中安全读取字符串值 */
function str(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** 从记录中安全读取数值 */
function num(data: Record<string, unknown>, key: string): number | undefined {
  const v = data[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * 从一条记录中提取 CaseDetail（只取有值的字段）
 */
function extractCaseDetail(data: Record<string, unknown>): CaseDetail {
  return {
    caseName: str(data, 'caseName') || '',
    leadOfficer: str(data, 'leadOfficer'),
    assistOfficer: str(data, 'assistOfficer'),
    receiveDate: str(data, 'receiveDate'),
    filingDate: str(data, 'filingDate'),
    caseType: str(data, 'caseType'),
    caseSource: str(data, 'caseSource'),
    totalAmount: num(data, 'totalAmount'),
    caseSummary: str(data, 'caseSummary'),
    filingDocNo: str(data, 'filingDocNo'),
  };
}

/**
 * 根据所有已保存的记录，重建案件编号 / 案件名称映射索引
 */
export function rebuildCaseIndex(records: Array<{ data: Record<string, unknown> }>): void {
  const map: CaseDataMap = { caseNoToName: {}, caseNameToNo: {}, caseDetails: {} };

  for (const rec of records) {
    const data = rec.data || {};
    const caseNo = str(data, 'caseNo') || '';
    const caseName = str(data, 'caseName') || '';

    if (caseNo || caseName) {
      // 建立编号↔名称双向映射
      if (caseNo && caseName) {
        if (!map.caseNoToName[caseNo]) map.caseNoToName[caseNo] = [];
        if (!map.caseNoToName[caseNo].includes(caseName)) {
          map.caseNoToName[caseNo].push(caseName);
        }
        if (!map.caseNameToNo[caseName]) map.caseNameToNo[caseName] = [];
        if (!map.caseNameToNo[caseName].includes(caseNo)) {
          map.caseNameToNo[caseName].push(caseNo);
        }
      } else if (caseNo) {
        if (!map.caseNoToName[caseNo]) map.caseNoToName[caseNo] = [];
      } else if (caseName) {
        if (!map.caseNameToNo[caseName]) map.caseNameToNo[caseName] = [];
      }

      // 提取案件详情（以 caseNo 为 key，无 caseNo 时用 caseName）
      const detailKey = caseNo || caseName;
      if (detailKey) {
        const existing = map.caseDetails[detailKey];
        const detail = extractCaseDetail(data);
        // 后写入覆盖先写入，保留最新的记录信息
        map.caseDetails[detailKey] = { ...existing, ...detail };
      }
    }
  }

  saveCaseData(map);
}

/**
 * 根据案件编号获取关联的案件名称列表
 */
export function getCaseNamesByNo(caseNo: string): string[] {
  const map = loadCaseData();
  return map.caseNoToName[caseNo] || [];
}

/**
 * 根据案件名称获取关联的案件编号列表
 */
export function getCaseNosByName(caseName: string): string[] {
  const map = loadCaseData();
  return map.caseNameToNo[caseName] || [];
}

/**
 * 根据案件编号（或名称）获取案件详细信息
 */
export function getCaseDetail(caseNo: string): CaseDetail | null {
  const map = loadCaseData();
  return map.caseDetails[caseNo] || null;
}

/**
 * 获取所有已知的案件编号列表（去重）
 */
export function getAllCaseNos(): string[] {
  const map = loadCaseData();
  return Object.keys(map.caseNoToName);
}

/**
 * 获取所有已知的案件名称列表（去重）
 */
export function getAllCaseNames(): string[] {
  const map = loadCaseData();
  return Object.keys(map.caseNameToNo);
}

/* ============================================================
   全局嫌疑人联动数据
   从所有模块的记录中提取嫌疑人姓名及关联信息（身份证号、手机号、地址、关联案件）
   ============================================================ */

const SUSPECT_DATA_KEY = 'jingzong.suspectData.v1';

interface SuspectInfo {
  idNo: string;
  phone: string;
  address: string;
  caseName: string;
}

type SuspectDataMap = Record<string, SuspectInfo>;

function loadSuspectData(): SuspectDataMap {
  return localStorageAdapter.getItem<SuspectDataMap>(SUSPECT_DATA_KEY, {});
}

function saveSuspectData(map: SuspectDataMap): void {
  localStorageAdapter.setItem(SUSPECT_DATA_KEY, map);
}

/**
 * 根据所有已保存的记录，重建嫌疑人姓名索引
 * 数据来源：
 *   - squad-case.suspects[] （含 suspectName + suspectIdNo + suspectPhone + suspectAddress）
 *   - evidence-freeze.suspect （仅姓名）
 *   - squad-coercive.suspect   （仅姓名）
 *   - evidence-phone-collection.holder （仅姓名，持有人也可能是嫌疑人）
 *   - squad-property.holder    （仅姓名）
 * 后写入的值会覆盖先写入的（保证最新记录优先）
 */
export function rebuildSuspectIndex(records: Array<{ moduleId: string; data: Record<string, unknown> }>): void {
  const map: SuspectDataMap = {};

  // 从旧到新遍历，后出现的覆盖前面的（最新记录获胜）
  for (const rec of records) {
    const moduleId = rec.moduleId;
    const data = rec.data || {};

    // 1) squad-case：嫌疑人 section 数组
    if (moduleId === 'squad-case') {
      const suspects = data.suspects;
      if (Array.isArray(suspects)) {
        for (const s of suspects) {
          const name = typeof s.suspectName === 'string' ? s.suspectName.trim() : '';
          if (!name) continue;
          map[name] = {
            idNo: typeof s.suspectIdNo === 'string' ? s.suspectIdNo.trim() : '',
            phone: typeof s.suspectPhone === 'string' ? s.suspectPhone.trim() : '',
            address: typeof s.suspectAddress === 'string' ? s.suspectAddress.trim() : '',
            caseName: typeof data.caseName === 'string' ? data.caseName.trim() : '',
          };
        }
      }
    }

    // 2) evidence-freeze / squad-coercive：扁平 suspect 字段
    if (moduleId === 'evidence-freeze' || moduleId === 'squad-coercive') {
      const name = typeof data.suspect === 'string' ? data.suspect.trim() : '';
      if (!name) continue;
      if (!map[name]) {
        map[name] = { idNo: '', phone: '', address: '', caseName: typeof data.caseName === 'string' ? data.caseName.trim() : '' };
      } else if (data.caseName) {
        // 已有信息则补充案件名称
        map[name].caseName = map[name].caseName || (typeof data.caseName === 'string' ? data.caseName.trim() : '');
      }
    }

    // 3) 持有人字段（可能是嫌疑人）
    if (moduleId === 'evidence-phone-collection' || moduleId === 'squad-property') {
      const name = typeof data.holder === 'string' ? data.holder.trim() : '';
      if (!name) continue;
      if (!map[name]) {
        map[name] = {
          idNo: typeof data.idNo === 'string' ? data.idNo.trim() : '',
          phone: typeof data.phone === 'string' ? data.phone.trim() : '',
          address: '',
          caseName: typeof data.caseName === 'string' ? data.caseName.trim() : '',
        };
      }
    }
  }

  saveSuspectData(map);
}

/**
 * 根据嫌疑人姓名获取关联信息
 */
export function getSuspectInfo(name: string): SuspectInfo | null {
  const map = loadSuspectData();
  return map[name] || null;
}

/**
 * 获取所有已知的嫌疑人姓名列表（去重排序）
 */
export function getAllSuspectNames(): string[] {
  const map = loadSuspectData();
  return Object.keys(map).sort();
}
