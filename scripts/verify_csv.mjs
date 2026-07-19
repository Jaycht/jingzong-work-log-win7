import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// 与 src/utils/excelUtils.ts 中 csvToString 逻辑保持一致，用于生成验证样本
const HEADERS = ['项目名称', '受害人姓名', '性别', '身份证号', '联系电话', '投资金额', '登记日期'];

function csvToString(headers, rows, options) {
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const vals = headers.map((h) => {
      const v = row[h] ?? '';
      const str = String(v);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(vals.join(','));
  }
  const text = csvRows.join('\r\n');
  return options && options.withBom ? '\uFEFF' + text : text;
}

// 用你给的真实数据（李某某记录）验证修复后格式
const rows = [
  { '项目名称': '某集资诈骗案', '受害人姓名': '李某某', '性别': '男', '身份证号': '', '联系电话': '1234523423', '投资金额': '', '登记日期': '2026/06/07' },
];
const csv = '\uFEFF' + csvToString(HEADERS, rows, { withBom: true });
const outDir = resolve(process.cwd(), 'output');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, '受害人信息_验证.csv');
writeFileSync(outPath, csv, 'utf-8');
console.log('验证文件已生成:', outPath);
console.log('--- 内容预览 ---');
console.log(csv);
