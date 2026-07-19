/**
 * 资金分析报告生成
 * 读取 evidence-report 模块的存储数据，生成 Word 兼容格式的 .doc 文件
 */

import { buildDocReport } from './docReport';
import { getMassRecords } from '../store/massStore';
import { formatDateValue, safeHtml } from './htmlUtils';
import { formatChineseDate } from './format';

const MODULE_ID = 'evidence-report';
type ReportData = Record<string, unknown>;
type ReportRow = Record<string, unknown>;

/**
 * 生成资金分析 Word 报告
 * @param recordId 可选，指定某条资金分析记录；不指定则取最新一条
 */
export function generateFundReport(recordId?: string): void {
  const allRecords = getMassRecords(MODULE_ID);
  if (allRecords.length === 0) {
    throw new Error('暂无资金分析数据，请先在资金分析模块中录入数据');
  }

  const targetRecord = recordId
    ? allRecords.find((r) => r.id === recordId)
    : allRecords[0];

  if (!targetRecord) {
    throw new Error('未找到指定的资金分析记录');
  }

  const data = targetRecord.data || {};

  // 构建报告 HTML
  const html = buildReportHtml(data);

  // 保存为 .doc（Word 可打开）
  const caseName = String(data.caseName || '资金分析报告').replace(/[/\\?*[\]]/g, '_');
  buildDocReport(html, `${caseName}_资金分析报告.doc`);
}

function buildReportHtml(data: ReportData): string {
  // 基础信息（使用 safeHtml 防止 XSS）
  const caseName = safeHtml(data.caseName, '—');
  const caseNo = safeHtml(data.caseNo, '—');
  const filingDocNo = safeHtml(data.filingDocNo, '—');
  const caseSource = safeHtml(data.caseSource, '—');
  const caseType = safeHtml(data.caseType, '—');
  const totalAmount = safeHtml(data.totalAmount, '—');
  const victimCount = safeHtml(data.victimCount, '—');
  const receiveDate = safeHtml(formatDateValue(data.receiveDate), '—');
  const filingDate = safeHtml(formatDateValue(data.filingDate), '—');
  const caseSummary = safeHtml(data.caseSummary, '—');
  const leadOfficer = safeHtml(data.leadOfficer, '—');
  const assistOfficer = safeHtml(data.assistOfficer, '—');

  // 涉案企业
  const enterpriseSubjects = formatArray(data.enterpriseSubjects, [
    { key: 'enterprise', label: '涉案企业' },
    { key: 'creditCode', label: '统一社会信用代码' },
    { key: 'legalRep', label: '法人' },
    { key: 'address', label: '单位地址' },
    { key: 'companyAccount', label: '公司公户' },
    { key: 'bank', label: '归属行' },
    { key: 'balance', label: '账户余额' },
  ]);

  // 涉案个人
  const personalSubjects = formatArray(data.personalSubjects, [
    { key: 'person', label: '涉案个人' },
    { key: 'idNo', label: '身份证号码' },
    { key: 'phone', label: '联系方式' },
    { key: 'homeAddress', label: '家庭地址' },
    { key: 'bankAccount', label: '银行账户' },
    { key: 'personalBank', label: '归属行' },
    { key: 'personalBalance', label: '账户余额' },
  ]);

  // 调证情况
  const investigationItems = formatArray(data.investigationItems, [
    { key: 'investigateCount', label: '调证数量' },
    { key: 'investigateAccount', label: '调证账号' },
    { key: 'investigatePlatform', label: '调证平台' },
  ]);

  // 资金来源
  const fundSources = formatArray(data.fundSources, [
    { key: 'fundUpstream', label: '资金上游' },
    { key: 'fundAccount', label: '资金账号' },
    { key: 'fundLink', label: '资金链路' },
    { key: 'tradeTime', label: '交易时间' },
    { key: 'tradePlatform', label: '交易平台' },
  ]);

  // 资金去向
  const penetrationItems = formatArray(data.penetrationItems, [
    { key: 'penetrationLevel', label: '层级' },
    { key: 'penetrationAccount', label: '账户名称/账号' },
    { key: 'penetrationType', label: '账户类型' },
    { key: 'penetrationReceived', label: '接收资金总额' },
    { key: 'penetrationTransferred', label: '转出资金总额' },
    { key: 'penetrationBalance', label: '账户余额' },
    { key: 'penetrationFrozen', label: '冻结状态' },
    { key: 'penetrationAttr', label: '账户属性' },
  ]);

  // 流出统计
  const outflowStats = [
    { label: '个人挥霍', value: safeHtml(data.personalWaste, '0') },
    { label: '购置固定资产', value: safeHtml(data.fixedAssets, '0') },
    { label: '虚假项目投资', value: safeHtml(data.fakeInvestment, '0') },
    { label: '运营成本', value: safeHtml(data.operatingCosts, '0') },
    { label: '日常开销', value: safeHtml(data.dailyExpenses, '0') },
    { label: '跑分账户转移', value: safeHtml(data.moneyTransfer, '0') },
    { label: '跨境转移', value: safeHtml(data.crossBorderTransfer, '0') },
    { label: '提现', value: safeHtml(data.withdraw, '0') },
    { label: '其他', value: safeHtml(data.otherOutflow, '0') },
  ].filter((item) => parseFloat(String(item.value).replace(/[^0-9.-]/g, '')) > 0);

  // 结论
  const conclusionFlow = safeHtml(data.conclusionFlow, '');
  const conclusionCaseSupport = safeHtml(data.conclusionCaseSupport, '');
  const conclusionDeepClue = safeHtml(data.conclusionDeepClue, '');
  const conclusionNextStep = safeHtml(data.conclusionNextStep, '');

  const dateStr = formatChineseDate(new Date());

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 2.54cm 3.18cm; }
  body { font-family: 'SimSun', '宋体', serif; font-size: 14px; line-height: 1.8; color: #000; }
  h1 { text-align: center; font-size: 22px; font-weight: 700; font-family: 'SimHei', '黑体', sans-serif; margin: 30px 0 10px; letter-spacing: 2px; }
  h2 { font-size: 16px; font-weight: 700; font-family: 'SimHei', '黑体', sans-serif; margin: 20px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #333; }
  h3 { font-size: 14px; font-weight: 700; font-family: 'SimHei', '黑体', sans-serif; margin: 15px 0 8px; }
  .subtitle { text-align: center; font-size: 13px; color: #555; margin-bottom: 30px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
  th { background: #F0F0F0; font-weight: 700; text-align: center; padding: 6px 8px; border: 1px solid #999; font-family: 'SimHei', '黑体', sans-serif; }
  td { padding: 5px 8px; border: 1px solid #999; }
  .info-table td:first-child { width: 140px; font-weight: 600; background: #F8F8F8; text-align: right; padding-right: 12px; }
  .info-table td:last-child { padding-left: 12px; }
  .conclusion { text-indent: 2em; margin: 8px 0; line-height: 2; }
  .report-header { text-align: center; margin-bottom: 20px; }
  .report-header .title { font-size: 18px; font-weight: 700; letter-spacing: 3px; }
  .report-header .dept { font-size: 14px; margin-top: 4px; }
  .footer { margin-top: 40px; }
  .footer .sign { display: flex; justify-content: space-between; margin-top: 30px; }
  .footer .sign-item { text-align: center; }
</style>
</head>
<body>

<div class="report-header">
  <div class="title">资金分析报告</div>
  <div class="dept">经侦大队 · 调证分析组</div>
</div>

<hr style="border: 1px solid #333; margin: 16px 0;" />

<h1>一、案件基本信息</h1>
<table class="info-table">
  <tr><td>案件名称</td><td>${caseName}</td></tr>
  <tr><td>案件编号</td><td>${caseNo}</td></tr>
  <tr><td>受/立案文书号</td><td>${filingDocNo}</td></tr>
  <tr><td>案件来源</td><td>${caseSource}</td></tr>
  <tr><td>案件类型</td><td>${caseType}</td></tr>
  <tr><td>涉案总金额（万元）</td><td>${totalAmount}</td></tr>
  <tr><td>受害人数</td><td>${victimCount}</td></tr>
  <tr><td>受案日期</td><td>${receiveDate}</td></tr>
  <tr><td>立案日期</td><td>${filingDate}</td></tr>
  <tr><td>简要案情</td><td>${caseSummary}</td></tr>
  <tr><td>主办民警</td><td>${leadOfficer}</td></tr>
  <tr><td>协办民警</td><td>${assistOfficer}</td></tr>
</table>

${enterpriseSubjects ? `
<h1>二、涉案企业情况</h1>
${enterpriseSubjects}
` : ''}

${personalSubjects ? `
<h1>三、涉案个人情况</h1>
${personalSubjects}
` : ''}

${investigationItems ? `
<h1>四、调证情况</h1>
${investigationItems}
` : ''}

${fundSources ? `
<h1>五、资金来源分析</h1>
${fundSources}
` : ''}

${penetrationItems ? `
<h1>六、资金去向分析</h1>
${penetrationItems}
` : ''}

${outflowStats.length > 0 ? `
<h1>七、资金流出分类统计</h1>
<table>
  <tr>
    <th style="width:60%">资金流出类别</th>
    <th style="width:40%">金额（万元）</th>
  </tr>
  ${outflowStats.map((item) => `
  <tr>
    <td>${item.label}</td>
    <td style="text-align:right">${item.value}</td>
  </tr>
  `).join('')}
</table>
` : ''}

${conclusionFlow || conclusionCaseSupport || conclusionDeepClue || conclusionNextStep ? `
<h1>八、资金分析结论</h1>

${conclusionFlow ? `
<h2>（一）资金流向总结</h2>
<p class="conclusion">${conclusionFlow}</p>
` : ''}

${conclusionCaseSupport ? `
<h2>（二）案件定性支撑</h2>
<p class="conclusion">${conclusionCaseSupport}</p>
` : ''}

${conclusionDeepClue ? `
<h2>（三）待深挖线索</h2>
<p class="conclusion">${conclusionDeepClue}</p>
` : ''}

${conclusionNextStep ? `
<h2>（四）下一步工作</h2>
<p class="conclusion">${conclusionNextStep}</p>
` : ''}
` : ''}

<div class="footer">
  <hr style="border: 0; border-top: 1px dashed #999; margin: 30px 0 10px;" />
  <div style="text-align: center; font-size: 12px; color: #666;">报告生成日期：${dateStr}</div>
  <div class="sign">
    <div class="sign-item">
      <div>分析人：</div>
      <div style="margin-top: 30px;">（签名）</div>
    </div>
    <div class="sign-item">
      <div>审核人：</div>
      <div style="margin-top: 30px;">（签名）</div>
    </div>
    <div class="sign-item">
      <div>日期：</div>
      <div style="margin-top: 30px;">${dateStr}</div>
    </div>
  </div>
  <div style="text-align: center; font-size: 12px; color: #999; margin-top: 30px;">
    本报告由经侦大队工作记录管理系统自动生成
  </div>
</div>

</body>
</html>`;
}

/** 格式化为 HTML 表格（数组 → table），所有数据 safeHtml 转义 */
function formatArray(arr: unknown, fields: Array<{ key: string; label: string }>): string {
  if (!Array.isArray(arr) || arr.length === 0) return '';

  const thead = fields.map((f) => `<th>${f.label}</th>`).join('');
  const tbody = arr.map((item) => {
    const row: ReportRow = typeof item === 'object' && item !== null ? item as ReportRow : {};
    const cells = fields.map((f) => `<td>${safeHtml(row[f.key], '—')}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table><tr>${thead}</tr>${tbody}</table>`;
}
