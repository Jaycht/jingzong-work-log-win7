/**
 * 趋势与绩效统计（P1-5）
 * 纯函数，便于单测复用。输入全量记录，输出：
 *  - 按月办案趋势（近 N 月案件量 + 办结率）
 *  - 经办人绩效（负责数 / 超期数 / 超期率）
 *
 * 设计要点（经侦多模块字段不统一，需归一化）：
 *  - 办结判定：status / handleStatus 字段值含「办结 / 完成 / 已结」即算已办结
 *    （node 流程节点、partyStatus 党员状态 等不算办结状态）
 *  - 经办人：依次取 handler / leadOfficer / handlingOfficer / handlerPolice 第一个非空值
 */
import type { MassRecord } from '../store/massStore';

/** 判定一条记录是否已办结（多状态字段归一化） */
export function isRecordCompleted(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  const statusKeys = ['status', 'handleStatus'];
  for (const key of statusKeys) {
    const v = data[key];
    if (typeof v === 'string' && /(办结|完成|已结)/.test(v)) return true;
  }
  return false;
}

/** 归一化取经办人姓名（多字段依次取首个非空） */
export function getRecordHandler(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  const keys = ['handler', 'leadOfficer', 'handlingOfficer', 'handlerPolice'];
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export interface MonthTrend {
  /** YYYY-MM */
  month: string;
  /** 展示用：M月（跨年仅保留月） */
  label: string;
  count: number;
  completed: number;
  /** 0-100，整数 */
  completionRate: number;
}

/** 生成最近 months 个月的办案趋势（含当月，不足则补 0） */
export function buildMonthlyTrend(records: MassRecord[], months = 12): MonthTrend[] {
  const now = new Date();
  const buckets: { key: string; label: string; count: number; completed: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({ key, label: `${d.getMonth() + 1}月`, count: 0, completed: 0 });
  }
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));
  for (const r of records) {
    const ym = (r.createdAt || '').slice(0, 7);
    const idx = ym ? indexByKey.get(ym) : undefined;
    if (idx === undefined) continue;
    buckets[idx].count += 1;
    if (isRecordCompleted(r.data)) buckets[idx].completed += 1;
  }
  return buckets.map((b) => ({
    month: b.key,
    label: b.label,
    count: b.count,
    completed: b.completed,
    completionRate: b.count > 0 ? Math.round((b.completed / b.count) * 100) : 0,
  }));
}

export interface HandlerPerf {
  handler: string;
  total: number;
  overdue: number;
  /** 0-100，整数 */
  overdueRate: number;
}

/**
 * 按经办人聚合绩效。
 * @param overdueRecordIds 超期（含 critical）记录的 id 集合，由预警计算提供
 * @param topN 取负责数最多的前 N 人
 */
export function buildHandlerPerf(
  records: MassRecord[],
  overdueRecordIds: Set<string>,
  topN = 8,
): HandlerPerf[] {
  const map = new Map<string, { total: number; overdue: number }>();
  for (const r of records) {
    const h = getRecordHandler(r.data);
    if (!h) continue;
    const entry = map.get(h) || { total: 0, overdue: 0 };
    entry.total += 1;
    if (overdueRecordIds.has(r.id)) entry.overdue += 1;
    map.set(h, entry);
  }
  return [...map.entries()]
    .map(([handler, v]) => ({
      handler,
      total: v.total,
      overdue: v.overdue,
      overdueRate: v.total > 0 ? Math.round((v.overdue / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
}
