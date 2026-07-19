import { describe, it, expect } from 'vitest';
import {
  isRecordCompleted,
  getRecordHandler,
  buildMonthlyTrend,
  buildHandlerPerf,
  type MonthTrend,
  type HandlerPerf,
} from '../utils/performanceStats';
import type { MassRecord } from '../store/massStore';

function rec(partial: Partial<MassRecord>): MassRecord {
  return {
    id: partial.id || 'r1',
    moduleId: partial.moduleId || 'm1',
    tabId: partial.tabId || 't1',
    createdAt: partial.createdAt || '2026-07-01T00:00:00.000Z',
    updatedAt: partial.updatedAt || '',
    data: partial.data || {},
  } as MassRecord;
}

describe('趋势与绩效统计', () => {
  describe('isRecordCompleted 办结判定', () => {
    it('status 含 已办结 算办结', () => {
      expect(isRecordCompleted({ status: '已办结' })).toBe(true);
    });
    it('handleStatus 含 已办结 算办结', () => {
      expect(isRecordCompleted({ handleStatus: '已办结' })).toBe(true);
    });
    it('status 含 完成 算办结', () => {
      expect(isRecordCompleted({ status: '已完成' })).toBe(true);
    });
    it('办理中 / 待补充 不算办结', () => {
      expect(isRecordCompleted({ handleStatus: '办理中' })).toBe(false);
      expect(isRecordCompleted({ status: '待补充' })).toBe(false);
    });
    it('node 流程节点 / partyStatus 党员状态 不算办结', () => {
      expect(isRecordCompleted({ node: '侦查期限' })).toBe(false);
      expect(isRecordCompleted({ partyStatus: '在岗' })).toBe(false);
    });
    it('无数据返回 false', () => {
      expect(isRecordCompleted(undefined)).toBe(false);
    });
  });

  describe('getRecordHandler 经办人归一化', () => {
    it('优先取 handler', () => {
      expect(getRecordHandler({ handler: '张三', leadOfficer: '李四' })).toBe('张三');
    });
    it('handler 空时取 leadOfficer', () => {
      expect(getRecordHandler({ leadOfficer: '李四' })).toBe('李四');
    });
    it('handler/leadOfficer 空时取 handlingOfficer', () => {
      expect(getRecordHandler({ handlingOfficer: '王五' })).toBe('王五');
    });
    it('全部空返回空串', () => {
      expect(getRecordHandler({})).toBe('');
    });
  });

  describe('buildMonthlyTrend 按月趋势', () => {
    it('返回近 12 个月且统计当月案件量', () => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const records = [rec({ id: 'a', createdAt: `${ym}-15T00:00:00.000Z`, data: { status: '已办结' } })];
      const trend: MonthTrend[] = buildMonthlyTrend(records, 12);
      expect(trend.length).toBe(12);
      const cur = trend[trend.length - 1];
      expect(cur.count).toBe(1);
      expect(cur.completed).toBe(1);
      expect(cur.completionRate).toBe(100);
    });
    it('办结率四舍五入为整数', () => {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const records = [
        rec({ id: 'a', createdAt: `${ym}-10T00:00:00.000Z`, data: { status: '已办结' } }),
        rec({ id: 'b', createdAt: `${ym}-11T00:00:00.000Z`, data: { status: '办理中' } }),
        rec({ id: 'c', createdAt: `${ym}-12T00:00:00.000Z`, data: {} }),
      ];
      const trend = buildMonthlyTrend(records, 12);
      const cur = trend[trend.length - 1];
      expect(cur.count).toBe(3);
      expect(cur.completionRate).toBe(33); // 1/3 ≈ 33.3 → 33
    });
    it('不在近 12 个月的记录不计入', () => {
      const records = [rec({ id: 'old', createdAt: '2020-01-01T00:00:00.000Z' })];
      const trend = buildMonthlyTrend(records, 12);
      const total = trend.reduce((s, m) => s + m.count, 0);
      expect(total).toBe(0);
    });
  });

  describe('buildHandlerPerf 经办人绩效', () => {
    it('按经办人聚合负责数 / 超期数 / 超期率', () => {
      const records = [
        rec({ id: 'a', data: { handler: '张三' } }),
        rec({ id: 'b', data: { handler: '张三' } }),
        rec({ id: 'c', data: { handler: '李四' } }),
      ];
      const overdue = new Set(['b']);
      const perf: HandlerPerf[] = buildHandlerPerf(records, overdue, 8);
      expect(perf).toHaveLength(2);
      const zhang = perf.find((p) => p.handler === '张三')!;
      expect(zhang.total).toBe(2);
      expect(zhang.overdue).toBe(1);
      expect(zhang.overdueRate).toBe(50);
    });
    it('无经办人字段的记录被忽略', () => {
      const records = [rec({ id: 'a', data: {} })];
      const perf = buildHandlerPerf(records, new Set(), 8);
      expect(perf).toHaveLength(0);
    });
    it('按负责数降序且只取 topN', () => {
      const records = [
        rec({ id: 'a', data: { handler: '甲' } }),
        rec({ id: 'b', data: { handler: '乙' } }),
        rec({ id: 'c', data: { handler: '乙' } }),
        rec({ id: 'd', data: { handler: '丙' } }),
        rec({ id: 'e', data: { handler: '丙' } }),
        rec({ id: 'f', data: { handler: '丙' } }),
      ];
      const perf = buildHandlerPerf(records, new Set(), 2);
      expect(perf).toHaveLength(2);
      expect(perf[0].handler).toBe('丙'); // 3 条
      expect(perf[1].handler).toBe('乙'); // 2 条
    });
  });
});
