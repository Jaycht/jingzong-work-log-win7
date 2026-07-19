/**
 * 通用格式化工具
 * 集中项目中散落重复的日期 / 数值格式化逻辑（M-7），各组件统一引用。
 */

import { useAppStore } from "../store/appStore";

/** 在日期上增加天数，返回新 Date */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** 在日期上增加月数，返回新 Date */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/** Date → 'YYYY-MM-DD' */
export function toDateStr(date: Date): string {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

/** 两个日期之间相差的整天数（b - a，按自然日 0 点计算） */
export function daysBetween(a: Date, b: Date): number {
  const start = new Date(a);
  start.setHours(0, 0, 0, 0);
  const end = new Date(b);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

/**
 * 将任意字段值安全转为可读字符串：
 * 对象/数组序列化，日期时间统一格式化为 YYYY-MM-DD HH:mm，其余转字符串；用于列表/详情展示。
 * 空值返回 '—'（与表格展示约定一致）。
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    // ISO 日期时间字符串统一格式化为 YYYY-MM-DD HH:mm（ModulePage 原 displayValue 行为）
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      return value.slice(0, 16).replace('T', ' ');
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (v && typeof v === 'object' && 'name' in v) return String((v as { name: unknown }).name);
        if (v && typeof v === 'object' && 'uid' in v) return String((v as { uid: unknown }).uid);
        return String(v);
      })
      .join('、');
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if ('name' in rec) return String(rec.name);
    if ('uid' in rec) return String(rec.uid);
    if ('value' in rec) return String(rec.value);
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

/**
 * 任意值转中文日期（YYYY年M月D日），兼容字符串 / dayjs / Date / ISO（M-7：承载 CaseTimeline 原 fmtDateStr）。
 * 无法解析时返回 '—'，与原 fmtDateStr 的哨兵值保持一致。
 */
export function formatChineseDate(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') {
    const m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}年${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
    return raw.slice(0, 10);
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    // dayjs 对象：$d 是底层 Date/string
    if (obj.$d !== undefined) {
      const dv = obj.$d instanceof Date ? obj.$d : new Date(String(obj.$d));
      if (!isNaN(dv.getTime())) return `${dv.getFullYear()}年${dv.getMonth() + 1}月${dv.getDate()}日`;
    }
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return `${raw.getFullYear()}年${raw.getMonth() + 1}月${raw.getDate()}日`;
    }
    if (typeof (raw as { toJSON?: unknown }).toJSON === 'function') {
      const s = String((raw as { toJSON: () => unknown }).toJSON());
      const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}年${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
    }
    try {
      const s = String(raw);
      if (s !== '[object Object]' && s.length < 50) {
        const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}年${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
      }
    } catch {
      /* ignore */
    }
    return '—';
  }
  const s = String(raw);
  if (s.startsWith('20')) {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}年${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
  }
  return s.slice(0, 10);
}

/**
 * 受全局「时间格式」设置驱动的格式化（V2.17.0 新增）。
 * 按 setting.timeFormat 切换 YYYY-MM-DD / YYYY/MM/DD；withTime 时附 时:分。
 * 解析时按本地时区处理 ISO，避免 UTC 偏移导致跨日错位。
 */
const pad2 = (n: number) => String(n).padStart(2, "0");
function toLocalDate(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  let s = String(input).trim();
  if (s.includes("T")) s = s.replace("T", " ").replace(/Z$/, "").replace(/\.\d+$/, "");
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(NaN) : d;
}

export function formatBySetting(
  input: string | number | Date,
  opts?: { withTime?: boolean },
): string {
  const tf = useAppStore.getState().timeFormat;
  const d = toLocalDate(input);
  if (isNaN(d.getTime())) return String(input);
  const sep = tf === "YYYY/MM/DD" ? "/" : "-";
  let out = `${d.getFullYear()}${sep}${pad2(d.getMonth() + 1)}${sep}${pad2(d.getDate())}`;
  if (opts?.withTime) out += ` ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return out;
}
