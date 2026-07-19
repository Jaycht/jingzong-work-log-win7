import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConfigProvider } from "antd";
import AppLayout from "../components/AppLayout";
import { useAppStore } from "../store/appStore";

// 回归守卫：AppLayout 的「URL ↔ store.currentPage」同步曾经因双向 effect 互相打架，
// 在挂载时触发 "Maximum update depth exceeded" 无限循环（首屏白屏 + ErrorBoundary）。
// 已改为单向同步（store 为事实源，hashchange 仅用于外部导航回写），此测试确保挂载不抛错。
function mountAt(path: string, page: string) {
  useAppStore.setState({ currentPage: page as never });
  useAppStore.getState().setView("app");
  render(
    <ConfigProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppLayout />
      </MemoryRouter>
    </ConfigProvider>
  );
}

describe("AppLayout 挂载不应触发无限循环", () => {
  const cases: Array<[string, string]> = [
    ["/app/dashboard", "dashboard"],
    ["/app/importExport", "importExport"],
    ["/app/legal-report-case", "dashboard"],
    ["/app/dailyNotes", "dashboard"],
  ];
  test.each(cases)("path=%s currentPage=%s 正常挂载", (path, page) => {
    expect(() => mountAt(path, page)).not.toThrow();
  });
});
