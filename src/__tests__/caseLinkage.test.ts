import { describe, it, expect } from 'vitest';
import {
  detectLinkageClusters,
  extractIdentityValues,
  maskValue,
  type LinkKeyType,
} from '../utils/caseLinkage';
import type { MassRecord } from '../store/massStore';

function rec(id: string, moduleId: string, data: Record<string, unknown>, updatedAt = '2026-01-01T00:00:00.000Z'): MassRecord {
  return { id, moduleId, data, createdAt: updatedAt, updatedAt } as MassRecord;
}

describe('extractIdentityValues', () => {
  it('抽取顶层与嵌套数组内的身份键并归一化', () => {
    const r = rec('1', 'legal-report-case', {
      suspectIdNo: '11010119900307123X', // 小写 x 应被大写
      reporters: [{ reporterIdNo: ' 320583199001010024 ' }], // 含空格应被清洗
    });
    const v = extractIdentityValues(r.data);
    expect(v.idCard.has('11010119900307123X')).toBe(true);
    expect(v.idCard.has('320583199001010024')).toBe(true);
  });

  it('过滤不合法的身份证号（位数不足）', () => {
    const v = extractIdentityValues({ suspectIdNo: '123' });
    expect(v.idCard.size).toBe(0);
  });

  it('银行账号要求≥10位数字，排除社交账号/邮箱类', () => {
    const v = extractIdentityValues({ counterpartyAccount: '6222 0212 3456 7890', socialAccount: 'zhangsan@wechat' });
    expect(v.bankAccount.has('6222021234567890')).toBe(true);
    expect(v.bankAccount.size).toBe(1);
  });

  it('统一社会信用代码 18 位校验', () => {
    const v = extractIdentityValues({ creditCode: '91350100M000100Y1X' });
    expect(v.creditCode.has('91350100M000100Y1X')).toBe(true);
  });
});

describe('maskValue', () => {
  it('身份证保留首尾各3位', () => {
    const m = maskValue('idCard' as LinkKeyType, '110101199003071234');
    expect(m).toBe('110************234');
  });
  it('银行账号仅保留末4位', () => {
    const m = maskValue('bankAccount' as LinkKeyType, '6222021234567890');
    expect(m).toBe('****7890');
  });
});

describe('detectLinkageClusters', () => {
  it('跨模块同身份证号 → 疑似串并案(isCrossModule)', () => {
    const recs = [
      rec('a', 'legal-report-case', { suspectIdNo: '110101199003071234', caseName: '甲案' }),
      rec('b', 'squad-case', { suspectIdNo: '110101199003071234', caseName: '乙案' }),
    ];
    const clusters = detectLinkageClusters(recs);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('merge');
    expect(clusters[0].isCrossModule).toBe(true);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].hits.map((h) => h.record.id).sort()).toEqual(['a', 'b']);
  });

  it('同模块同案名同身份证号 → 疑似重复录入(duplicate)', () => {
    const recs = [
      rec('a', 'legal-report-case', { suspectIdNo: '110101199003071234', caseName: '甲案' }),
      rec('b', 'legal-report-case', { suspectIdNo: '110101199003071234', caseName: '甲案' }),
    ];
    const clusters = detectLinkageClusters(recs);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind).toBe('duplicate');
    expect(clusters[0].isCrossModule).toBe(false);
  });

  it('仅出现 1 次的身份键不产生线索', () => {
    const recs = [rec('a', 'evidence-freeze', { bankAccount: '6222021234567890' })];
    expect(detectLinkageClusters(recs)).toHaveLength(0);
  });

  it('不同类型的身份键互不串扰（身份证与银行账号各匹配）', () => {
    const recs = [
      rec('a', 'evidence-freeze', { bankAccount: '6222021234567890' }),
      rec('b', 'squad-property', { bankAccount: '6222021234567890' }),
      rec('c', 'legal-report-case', { suspectIdNo: '110101199003071234' }),
      rec('d', 'squad-case', { suspectIdNo: '110101199003071234' }),
    ];
    const clusters = detectLinkageClusters(recs);
    expect(clusters).toHaveLength(2);
    const types = clusters.map((c) => c.keyType).sort();
    expect(types).toEqual(['bankAccount', 'idCard']);
  });

  it('同一记录内重复身份键不去重导致误增', () => {
    const recs = [
      rec('a', 'evidence-freeze', { bankAccount: '6222021234567890', companyAccount: '6222021234567890' }),
      rec('b', 'squad-property', { bankAccount: '6222021234567890' }),
    ];
    const clusters = detectLinkageClusters(recs);
    expect(clusters).toHaveLength(1);
    // 同一条记录因两个字段命中同一银行账号，去重后仍只算 2 条记录
    expect(clusters[0].count).toBe(2);
  });
});
