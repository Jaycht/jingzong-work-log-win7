import { describe, it, expect } from 'vitest';
import { csvToString } from '../utils/excelUtils';

const HEADERS = ['项目名称', '受害人姓名', '性别', '身份证号', '联系电话', '投资金额', '登记日期'];

describe('csvToString（受害人信息 CSV 导出）', () => {
  it('表头与数据按行分隔（\\r\\n），每项信息落在对应表头列', () => {
    const rows = [
      { '项目名称': '某集资诈骗案', '受害人姓名': '李某某', '性别': '男', '身份证号': '', '联系电话': '1234523423', '投资金额': '', '登记日期': '2026/06/07' },
    ];
    const csv = csvToString(HEADERS, rows);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADERS.join(','));
    expect(lines[1]).toBe('某集资诈骗案,李某某,男,,1234523423,,2026/06/07');
  });

  it('含逗号或换行的字段被双引号包裹，避免破坏列结构', () => {
    const rows = [
      { '项目名称': 'A,B 系列案', '受害人姓名': '张三', '性别': '男', '身份证号': '', '联系电话': '1', '投资金额': '', '登记日期': '2026/01/01' },
    ];
    const csv = csvToString(HEADERS, rows);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('"A,B 系列案",张三,男,,1,,2026/01/01');
  });

  it('空值保留逗号占位，行数随数据增加', () => {
    const rows = [
      { '项目名称': '案1', '受害人姓名': '甲', '性别': '女', '身份证号': '', '联系电话': '111', '投资金额': '5000', '登记日期': '2026/02/02' },
      { '项目名称': '案2', '受害人姓名': '乙', '性别': '男', '身份证号': '', '联系电话': '222', '投资金额': '', '登记日期': '2026/03/03' },
    ];
    const csv = csvToString(HEADERS, rows);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('案2,乙,男,,222,,2026/03/03');
  });

  it('默认不带 BOM，withBom 时带 UTF-8 BOM', () => {
    expect(csvToString(HEADERS, []).startsWith('﻿')).toBe(false);
    expect(csvToString(HEADERS, [], { withBom: true }).startsWith('﻿')).toBe(true);
  });
});
