import { describe, it, expect, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from '../App';

// jsdom 缺失的浏览器 API 兜底（antd / framer-motion 需要）
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    })) as unknown as typeof window.matchMedia;
  }
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = RO as unknown as typeof ResizeObserver;
  class IO {
    root = null;
    rootMargin = '';
    thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  global.IntersectionObserver = IO as unknown as typeof IntersectionObserver;
});

describe('App 运行期冒烟测试（Web 模式 / jsdom）', () => {
  it('应用能正常挂载并渲染登录页，无运行期崩溃', async () => {
    const { container } = render(<App />);

    // 等待首屏渲染完成（含异步 effect）
    await waitFor(
      () => {
        const text = document.body.textContent || '';
        expect(text).toContain('账号');
      },
      { timeout: 5000 }
    );

    // 不应出现 ErrorBoundary 兜底
    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('页面出现异常');

    // 挂载点应有实际渲染内容
    expect(container.innerHTML.length).toBeGreaterThan(50);
  });
});
