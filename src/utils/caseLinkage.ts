/**
 * 串并案自动识别引擎（P0-3）
 * ------------------------------------------------------------------
 * 思路：经侦办案的核心是"查人、查钱、查关联"。同一主体常出现在多份记录中
 * （如同一嫌疑人既在「接报案登记」又在「中队案件管理」；同一公司统一社会信用代码
 * 既在「资金分析」又在「调证登记」；同一银行账号在「资金查控」与「涉案财物」反复出现）。
 * 本引擎扫描全量记录，抽取三类强身份键并做「同类型精确归一化匹配」，自动发现
 * 跨记录的疑似关联线索，供研判人员一键串并。
 *
 * 与 CaseDetail 现有「弱关联」（任意≥2字串 + 任意≥4位数字模糊匹配，噪音大）不同，
 * 这里只做强信号：身份证号 / 统一社会信用代码 / 银行账号 的精确等值匹配。
 */

import type { MassRecord } from '../store/massStore';
import { getMassRecords } from '../store/massStore';
import { MODULE_NAMES } from '../moduleConfig';

export type LinkKeyType = 'idCard' | 'creditCode' | 'bankAccount';

/** 三类身份键对应的字段 id（含嵌套数组内的字段，如嫌疑人/报案人数组中的 idNo） */
export const KEY_FIELDS: Record<LinkKeyType, string[]> = {
  // 身份证号（含各类别名）
  idCard: ['reporterIdNo', 'suspectIdNo', 'idNo', 'intervieweeIdNo'],
  // 统一社会信用代码
  creditCode: ['creditCode'],
  // 银行账号 / 对公户 / 调证账号 / 资金账号（排除社交账号 socialAccount，避免微信/支付宝昵称误匹配）
  bankAccount: [
    'selfAccount', 'counterpartyAccount', 'accountNo', 'bankAccount',
    'companyAccount', 'investigateAccount', 'fundAccount', 'penetrationAccount', 'fundAccountDetail',
  ],
};

export const KEY_TYPES: LinkKeyType[] = ['idCard', 'creditCode', 'bankAccount'];

export const KEY_LABEL: Record<LinkKeyType, string> = {
  idCard: '身份证号',
  creditCode: '统一社会信用代码',
  bankAccount: '银行账号',
};

/* ----------------------------- 归一化与校验 ----------------------------- */

function normIdCard(v: string): string {
  const s = v.replace(/\s/g, '').toUpperCase();
  // 18 位（末位可为 X）或 15 位
  if (/^\d{17}[\dX]$/.test(s) || /^\d{15}$/.test(s)) return s;
  return '';
}

function normCreditCode(v: string): string {
  const s = v.replace(/\s/g, '').toUpperCase();
  // 统一社会信用代码：18 位（数字 + 大写字母，排除 I O S V Z 等易混字符）
  if (/^[0-9A-HJ-NP-RT-UW-Y]{18}$/.test(s)) return s;
  return '';
}

export function normBank(v: string): string {
  const s = v.replace(/[\s-]/g, '').toUpperCase();
  const cleaned = s.replace(/[^0-9A-Z]/g, '');
  // 银行账号绝大多数为纯数字且长度≥10；要求含≥10位数字，排除手机号/邮箱类钱包账号
  if (/\d{10,}/.test(cleaned)) return cleaned;
  return '';
}

const NORM: Record<LinkKeyType, (v: string) => string> = {
  idCard: normIdCard,
  creditCode: normCreditCode,
  bankAccount: normBank,
};

/** 脱敏展示：身份证/信用代码保留首尾各 3 位，银行账号仅保留末 4 位 */
export function maskValue(type: LinkKeyType, value: string): string {
  if (type === 'bankAccount') return '****' + value.slice(-4);
  const keep = 3;
  if (value.length <= keep * 2) return value;
  return value.slice(0, keep) + '*'.repeat(value.length - keep * 2) + value.slice(-keep);
}

/* ----------------------------- 字段抽取 ----------------------------- */

/** 递归遍历对象/数组，对每个字符串值回调 (key, value) */
function walk(obj: unknown, cb: (k: string, v: string) => void): void {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) walk(item, cb);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') cb(k, v);
    else if (v && typeof v === 'object') walk(v, cb);
  }
}

/** 从一条记录的数据中抽取三类身份键（已归一化、已校验，仅保留合法值） */
export function extractIdentityValues(
  data: Record<string, unknown>
): Record<LinkKeyType, Set<string>> {
  const result: Record<LinkKeyType, Set<string>> = {
    idCard: new Set(),
    creditCode: new Set(),
    bankAccount: new Set(),
  };
  walk(data, (k, v) => {
    for (const t of KEY_TYPES) {
      if (KEY_FIELDS[t].includes(k)) {
        const norm = NORM[t](v);
        if (norm) result[t].add(norm);
      }
    }
  });
  return result;
}

/** 派生记录标题（与 CaseDetail 保持一致的业务主键优先级） */
export function recTitle(data: Record<string, unknown> | undefined): string {
  const d = data || {};
  const cands = [d.caseName, d.suspect, d.subjectName, d.projectName, d.reporterName, d.name, d.title];
  for (const c of cands) {
    if (c != null && String(c).trim() !== '') return String(c).trim();
  }
  for (const [k, v] of Object.entries(d)) {
    if (!k.startsWith('__') && typeof v === 'string' && v.trim() !== '') return v.trim().slice(0, 40);
  }
  return '未命名';
}

/* ----------------------------- 聚类检测 ----------------------------- */

export interface LinkageHit {
  record: MassRecord;
  title: string;
  moduleId: string;
  moduleName: string;
  updatedAt: string;
}

export interface LinkageCluster {
  id: string;            // `${keyType}:${keyValue}`
  keyType: LinkKeyType;
  keyValue: string;      // 归一化原始值（用于持久化关联，不展示）
  masked: string;        // 脱敏展示值
  hits: LinkageHit[];
  moduleIds: string[];
  moduleNames: string[];
  isCrossModule: boolean;
  isMultiCase: boolean;
  /** 'merge' = 疑似串并案（跨模块或多案名）；'duplicate' = 疑似重复录入（同模块同案名） */
  kind: 'merge' | 'duplicate';
  /** 优先级：跨模块 +2、多案名 +1、记录数≥3 再 +1 */
  priority: number;
  count: number;
}

/**
 * 检测全部串并案线索。
 * @param records 可选，传入则基于该集合（便于测试/局部分析），否则读全量。
 */
export function detectLinkageClusters(records?: MassRecord[]): LinkageCluster[] {
  const recs = records ?? getMassRecords();
  const buckets: Record<LinkKeyType, Map<string, MassRecord[]>> = {
    idCard: new Map(),
    creditCode: new Map(),
    bankAccount: new Map(),
  };

  for (const r of recs) {
    const vals = extractIdentityValues(r.data || {});
    for (const t of KEY_TYPES) {
      for (const v of vals[t]) {
        const arr = buckets[t].get(v) || [];
        arr.push(r);
        buckets[t].set(v, arr);
      }
    }
  }

  const out: LinkageCluster[] = [];
  for (const t of KEY_TYPES) {
    for (const [value, arr] of buckets[t]) {
      // 同一条记录可能多次命中（理论上同类型同值只会出现一次，仍去重兜底）
      const uniq = Array.from(new Map(arr.map((r) => [r.id, r])).values());
      if (uniq.length < 2) continue;

      const moduleIds = [...new Set(uniq.map((r) => r.moduleId))];
      const titles = uniq.map((r) => recTitle(r.data));
      const distinctTitles = [...new Set(titles)];
      const isCrossModule = moduleIds.length > 1;
      const isMultiCase = distinctTitles.length > 1;
      const kind: LinkageCluster['kind'] = isCrossModule || isMultiCase ? 'merge' : 'duplicate';
      const priority =
        (isCrossModule ? 2 : 0) + (isMultiCase ? 1 : 0) + (uniq.length >= 3 ? 1 : 0);

      out.push({
        id: `${t}:${value}`,
        keyType: t,
        keyValue: value,
        masked: maskValue(t, value),
        hits: uniq.map((r) => ({
          record: r,
          title: recTitle(r.data),
          moduleId: r.moduleId,
          moduleName: MODULE_NAMES[r.moduleId] || r.moduleId,
          updatedAt: String(r.updatedAt || ''),
        })),
        moduleIds,
        moduleNames: [...new Set(uniq.map((r) => MODULE_NAMES[r.moduleId] || r.moduleId))],
        isCrossModule,
        isMultiCase,
        kind,
        priority,
        count: uniq.length,
      });
    }
  }

  out.sort((a, b) => b.priority - a.priority || b.count - a.count);
  return out;
}

/** 线索总数 / 涉及记录数 / 跨模块线索数 概览 */
export function linkageSummary(clusters: LinkageCluster[]) {
  const involved = new Set<string>();
  let cross = 0;
  for (const c of clusters) {
    c.hits.forEach((h) => involved.add(h.record.id));
    if (c.isCrossModule) cross += 1;
  }
  return { clusters: clusters.length, records: involved.size, cross };
}
