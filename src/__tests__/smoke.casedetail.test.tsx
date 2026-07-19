import { describe, it, expect, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import CaseDetail from '../pages/CaseDetail';
import type { MassRecord } from '../store/massStore';

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false, media: q, onchange: null,
      addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
    })) as unknown as typeof window.matchMedia;
  }
  class RO { observe() {} unobserve() {} disconnect() {} }
  global.ResizeObserver = RO as unknown as typeof ResizeObserver;
  class IO { root = null; rootMargin = ''; thresholds: ReadonlyArray<number> = []; observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  global.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
});

const record: MassRecord = {
  id: 'test-1',
  moduleId: 'legal-report-case',
  tabId: 'tab-1',
  data: {
    caseNo: 'A123',
    caseName: '测试案件',
    reporters: [
      { reporterName: '张三', reporterIdNo: '110101199001011234', reporterPhone: '13800000000', reporterAddress: '北京市朝阳区' },
    ],
    suspects: [
      { suspectName: '李四', suspectIdNo: '120101199002022345', suspectPhone: '13900000000' },
    ],
    involvedEntities: [
      { involvedEntity: '某某公司', involvedPhone: '010-88888888' },
    ],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CaseDetail 个人信息渲染实证', () => {
  it('报案人/嫌疑人等个人信息数组应出现在查看页 DOM 中', async () => {
    render(
      <ConfigProvider locale={zhCN}>
        <CaseDetail record={record} onClose={() => {}} />
      </ConfigProvider>
    );
    await waitFor(() => {
      const t = document.body.textContent || '';
      expect(t).toContain('张三');
    });
    const text = document.body.textContent || '';
    console.log('[CaseDetail rendered snippet]', text.slice(0, 1200));
    expect(text).toContain('张三');          // 报案人姓名
    expect(text).toContain('110101199001011234'); // 报案人身份证
    expect(text).toContain('李四');          // 嫌疑人姓名
    expect(text).toContain('某某公司');       // 涉案主体
  });
});
