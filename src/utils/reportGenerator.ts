/**
 * 通用日报/周报/月报生成器
 * 为每个模块生成 Word 兼容格式的报表
 */
import { buildDocReport } from './docReport';
import { getMassRecords } from '../store/massStore';
import type { MassRecord } from '../store/massStore';
import type { WorkModule } from '../moduleConfig';
import { escapeHtml } from './htmlUtils';
import { formatChineseDate } from './format';

type ReportType = 'daily' | 'weekly' | 'monthly';

const REPORT_LABELS: Record<ReportType, string> = {
  daily: '日报',
  weekly: '周报',
  monthly: '月报',
};

function getPeriodRange(type: ReportType): { start: Date; end: Date; label: string } {
  const now = new Date();
  let end = new Date(now);
  let start: Date;

  switch (type) {
    case 'daily':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly': {
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(now);
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      // 结束时间设为当周周日 23:59:59
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
  }

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start, end, label: `${fmt(start)} ~ ${fmt(end)}` };
}

/**
 * 生成并导出 Word 报表
 */
export function exportModuleReport(
  module: WorkModule,
  type: ReportType,
): void {
  const allRecords = getMassRecords(module.id);
  if (allRecords.length === 0) {
    throw new Error(`${module.label} 暂无数据，请先录入记录`);
  }

  const period = getPeriodRange(type);
  const filtered = allRecords.filter((r) => {
    const created = new Date(r.createdAt);
    return created >= period.start && created <= period.end;
  });

  const html = buildReportHtml(module, type, period, filtered);
  const fileName = `${module.departmentLabel}_${module.label}_${REPORT_LABELS[type]}_${period.label.replace(/[/\\?*[\]]/g, '_')}.doc`;
  buildDocReport(html, fileName);
}


function getFieldValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) return val.map((v) => escapeHtml(v)).join('、');
  if (typeof val === 'object') return escapeHtml(JSON.stringify(val).slice(0, 50));
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return escapeHtml(s.slice(0, 16).replace('T', ' '));
  }
  return escapeHtml(s);
}

function buildReportHtml(
  module: WorkModule,
  type: ReportType,
  period: { start: Date; end: Date; label: string },
  records: MassRecord[],
): string {
  const typeLabel = REPORT_LABELS[type];
  const now = new Date();
  const tabStats = module.tabs.map((tab) => {
    const count = records.filter((r) => r.tabId === tab.id).length;
    return { label: tab.label, count };
  });
  const totalCount = records.length;

  // Build narrative text for each tab
  const tabDetails = module.tabs.map((tab) => {
    const tabRecords = records.filter((r) => r.tabId === tab.id);
    if (tabRecords.length === 0) return '';

    const fields = (tab.fields || []).filter((f) => f.type !== 'section' && f.type !== 'attachment');
    if (fields.length === 0) return '';

    const recordItems = tabRecords.map((rec, idx) => {
      const fieldLines = fields.map((f) => {
        const val = getFieldValue(rec.data?.[f.id]);
        if (val === '—') return '';
        const isLong = val.length > 30;
        if (isLong) {
          return `<div style="margin:2px 0 4px 20px;"><span style="font-weight:600;color:#1a5276;">${f.label}：</span><br/><span style="margin-left:0;color:#444;line-height:1.6;">${val}</span></div>`;
        }
        return `<div style="margin:2px 0 2px 20px;"><span style="font-weight:600;color:#1a5276;">${f.label}：</span><span style="margin-left:6px;color:#444;">${val}</span></div>`;
      }).filter(Boolean).join('');

      return `<div style="margin:12px 0 16px;padding:10px 14px;background:#f9fafb;border-left:3px solid #1a5276;border-radius:2px;">
        <div style="font-weight:700;color:#1a5276;margin-bottom:6px;font-size:12pt;">第${idx + 1}项</div>
        ${fieldLines}
      </div>`;
    }).join('');

    return `
  <h2 style="font-size:15px;margin:20px 0 10px;padding:6px 0;border-bottom:2px solid #1a5276;color:#1a5276;">${tab.label}（${tabRecords.length} 条记录）</h2>
  ${recordItems}`;
  }).join('');

  const statsText = tabStats.map((s) => s.label + s.count + '条').join('，');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${module.departmentLabel} ${module.label} ${typeLabel}</title>
<style>
  @page { margin: 2.5cm 2cm; }
  body { font-family: 'SimSun','宋体',serif; font-size: 12pt; line-height: 1.8; color: #222; }
  .report-title { text-align: center; font-size: 22pt; font-weight: 700; letter-spacing: 4px; margin-bottom: 4px; }
  .report-sub { text-align: center; font-size: 14pt; color: #555; margin-bottom: 6px; }
  .report-period { text-align: center; font-size: 11pt; color: #888; margin-bottom: 20px; }
  hr { border: none; border-top: 2px solid #1a5276; margin: 12px 0 20px; }
  h1 { font-size: 16px; margin: 20px 0 10px; padding: 6px 10px; background: #f0f4f8; border-left: 4px solid #1a5276; }
  .footer { margin-top: 40px; text-align: center; font-size: 10pt; color: #999; }
  .sign { display: flex; justify-content: space-between; margin-top: 30px; }
  .sign-item { text-align: center; min-width: 120px; }
  .sign-line { margin-top: 36px; }
</style>
</head>
<body>

<div class="report-title">${module.departmentLabel}</div>
<div class="report-sub">${module.label} ${typeLabel}</div>
<div class="report-period">统计周期：${period.label}</div>
<hr />

<h1>一、数据概览</h1>
<p>本报告期内，${module.label} 共产生 <strong>${totalCount}</strong> 条工作记录。其中：${statsText}。</p>

<h1>二、详细记录</h1>
${tabDetails || '<p style="color:#999;">无详细记录数据。</p>'}

<div class="footer">
  <hr style="border-top:1px dashed #ccc;margin:30px 0 10px;" />
  <div>报告生成日期：${formatChineseDate(now)}</div>
  <div class="sign">
    <div class="sign-item"><div>填报人：</div><div class="sign-line">（签名）</div></div>
    <div class="sign-item"><div>审核人：</div><div class="sign-line">（签名）</div></div>
    <div class="sign-item"><div>日期：</div><div class="sign-line">${formatChineseDate(now)}</div></div>
  </div>
  <div style="margin-top:20px;">本报告由经侦大队工作记录管理系统自动生成</div>
</div>

</body>
</html>`;
}
