/**
 * HTML 转义工具 —— 防止 XSS 攻击
 * 所有用户输入在拼接进 HTML 之前必须经过转义
 */

/** 对字符串进行 HTML 转义 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** 安全取值，null/undefined 返回 fallback */
export function safe(val: unknown, fallback = '—'): string {
  if (val === null || val === undefined) return fallback;
  return String(val).trim() || fallback;
}

/** 安全取值并 HTML 转义 */
export function safeHtml(val: unknown, fallback = '—'): string {
  return escapeHtml(safe(val, fallback));
}

/** 格式化日期值 */
export function formatDateValue(val: unknown): string {
  if (!val) return '—';
  const s = String(val).trim();
  if (s.includes('T')) return s.slice(0, 10);
  return s;
}
