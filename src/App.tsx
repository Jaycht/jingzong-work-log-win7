import { useEffect } from "react";
import { ConfigProvider, Modal } from "antd";
import zhCN from "antd/locale/zh_CN";
import { motion, MotionConfig } from "framer-motion";
import { HashRouter, Route, Routes, useNavigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import { Toaster } from "./components/Toaster";
import { LIGHT_THEME, DARK_THEME } from "./constants/theme";
import { useAppStore, loadUserFromStorage } from "./store/appStore";
import { migrateOldCasesToMassStore, getMassRecords } from "./store/massStore";
import { rebuildCaseIndex, rebuildSuspectIndex } from "./store/inputHistoryStore";
import { indexedDBAdapter } from "./store/adapter";

declare global {
  interface Window {
    electronAPI?: {
      resizeToMain: () => void;
      resizeToLogin: () => void;
      isElectron: boolean;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      saveAttachmentFile: (buffer: number[], fileName: string, moduleId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      readAttachmentFile: (filePath: string) => Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
      deleteAttachmentFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      checkAttachmentFile: (filePath: string) => Promise<{ success: boolean; exists: boolean; error?: string }>;
      getAttachmentsDir: () => Promise<string>;
      showSaveDialog: (defaultName: string, buffer: number[]) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
      checkForUpdates: () => Promise<{ available: boolean; version?: string; error?: string }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => void;
    };
  }
}

function AppContent() {
  const navigate = useNavigate();
  const isElectron = typeof window !== "undefined" && window.electronAPI?.isElectron;

  // 数据迁移 + 重建案件索引
  useEffect(() => {
    migrateOldCasesToMassStore();
    // 等待 IndexedDB 加载完成后再重建索引
    indexedDBAdapter.whenReady().then(() => {
      const allRecords = getMassRecords();
      // 迁移强制措施旧数据
      let migrated = false;
      for (const rec of allRecords) {
        if (rec.moduleId !== 'squad-coercive') continue;
        const data = rec.data || {};
        if (!data.caseNo && !data.caseName) {
          const list = data.coerciveMeasures;
          if (Array.isArray(list) && list.length > 0 && (list[0].caseNo || list[0].caseName)) {
            const item = list[0];
            if (item.caseNo) data.caseNo = item.caseNo;
            if (item.caseName) data.caseName = item.caseName;
            for (const entry of list) {
              delete entry.caseNo;
              delete entry.caseName;
            }
            migrated = true;
          }
        }
      }
      if (migrated) {
        indexedDBAdapter.setItem('jingzong.mass.records', allRecords);
      }
      rebuildCaseIndex(allRecords);
      rebuildSuspectIndex(allRecords);
    });
  }, []);

  // 恢复持久化的用户登录状态（跨窗口/跨应用重启）
  useEffect(() => {
    // 先检查用户是否开启了「自动登录」
    let isAutoLogin = false;
    try {
      const loginRaw = localStorage.getItem('jingzong.login.v1');
      if (loginRaw) {
        const loginData = JSON.parse(loginRaw);
        isAutoLogin = !!loginData.autoLogin;
      }
    } catch { /* ignore */ }

    const saved = loadUserFromStorage();
    if (saved && saved.name && isAutoLogin) {
      useAppStore.getState().setUser(saved.name, saved.role);
      // 有持久化的用户且开启了自动登录 → 直接进入主界面
      if (isElectron) {
        window.electronAPI?.resizeToMain();
      }
      navigate("/app/dashboard", { replace: true });
    }
  }, []);

  const setUser = useAppStore((s) => s.setUser);
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);
  const darkMode = useAppStore((s) => s.darkMode);
  const lowPerfMode = useAppStore((s) => s.lowPerfMode);

  // Electron 自动更新检查
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.checkForUpdates) return;
    const timer = setTimeout(async () => {
      try {
        const result = await window.electronAPI.checkForUpdates();
        if (result?.available) {
          Modal.confirm({
            title: `发现新版本 v${result.version}`,
            content: '是否下载并安装更新？',
            okText: '更新',
            cancelText: '稍后',
            onOk: async () => {
              await window.electronAPI.downloadUpdate();
              window.electronAPI.installUpdate();
            },
          });
        }
      } catch {
        // 静默失败，不影响正常使用
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isElectron]);

  const handleLogin = (name: string, role: string) => {
    setUser(name, role);
    if (isElectron) {
      window.electronAPI?.resizeToMain();
    }
    navigate("/app/dashboard", { replace: true });
  };

  return (
    <div
      className={lowPerfMode ? "low-perf-mode" : ""}
      style={{ minHeight: "100vh" }}
    >
      <MotionConfig reducedMotion={lowPerfMode ? "always" : "never"}>
        <Routes>
          <Route
            path="/login"
            element={
              <motion.div
                key="login"
                {...(lowPerfMode
                  ? { initial: false, animate: true, transition: { duration: 0 } }
                  : {
                      initial: { opacity: 0, x: -40 },
                      animate: { opacity: 1, x: 0 },
                      exit: { opacity: 0, x: 40 },
                      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                    })}
              >
                  <LoginPage onLogin={handleLogin} onRegister={() => navigate("/register")} />
              </motion.div>
            }
          />
          <Route
            path="/register"
            element={
              <motion.div
                key="register"
                {...(lowPerfMode
                  ? { initial: false, animate: true, transition: { duration: 0 } }
                  : {
                      initial: { opacity: 0, x: 40 },
                      animate: { opacity: 1, x: 0 },
                      exit: { opacity: 0, x: -40 },
                      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                    })}
              >
                <RegisterPage onBack={() => navigate("/login")} />
              </motion.div>
            }
          />
          <Route
            path="/app/*"
            element={
              <motion.div
                key="app"
                {...(lowPerfMode
                  ? { initial: false, animate: true, transition: { duration: 0 } }
                  : {
                      initial: { opacity: 0 },
                      animate: { opacity: 1 },
                      transition: { duration: 0.4 },
                    })}
              >
                <AppLayout />
              </motion.div>
            }
          />
          <Route
            path="*"
            element={<LoginPage onLogin={handleLogin} onRegister={() => navigate("/register")} />}
          />
        </Routes>
        <Toaster toasts={toasts} removeToast={removeToast} />
      </MotionConfig>
    </div>
  );
}

export default function App() {
  const darkMode = useAppStore((s) => s.darkMode);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  return (
    <ConfigProvider locale={zhCN} theme={darkMode ? DARK_THEME : LIGHT_THEME}>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ConfigProvider>
  );
}
