/**
 * Word 兼容报告统一导出（M-11：合并 reportUtils / reportGenerator 的重复导出样板）
 * 两份报告各自只保留 HTML 拼装逻辑，最终都经由本函数落盘。
 */
import { saveAs } from 'file-saver';

const BOM = '﻿';

export function buildDocReport(html: string, fileName: string): void {
  const blob = new Blob([BOM + html], { type: 'application/msword;charset=utf-8' });
  saveAs(blob, fileName);
}
