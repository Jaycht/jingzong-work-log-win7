import { useEffect } from "react";
import { isElectron as isElectronEnv } from "../lib/env";

/**
 * 未保存变更拦截钩子
 * 在 Electron 模式下不阻止窗口关闭，仅保留浏览器环境的提醒
 */
export function useUnsavedChanges(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const isElectron = isElectronEnv();
    if (isElectron) return; // Electron 下不拦截窗口关闭
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
