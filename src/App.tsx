import { useEffect } from "react";
import { ConfigProvider, App as AntApp } from "antd";
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
import { isElectron as isElectronEnv } from "./lib/env";

function AppContent() {
  const navigate = useNavigate();
  const isElectron = isElectronEnv();

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

  // 恢复持久化的用户登录状态（跨刷新/跨应用重启）
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
    const here = window.location.hash || window.location.pathname;

    if (saved && saved.name) {
      if (isAutoLogin) {
        // 勾选了自动登录：恢复会话并直接进入主界面
        useAppStore.getState().setUser(saved.name, saved.role, {
          badge: saved.badge,
          phone: saved.phone,
          department: saved.department,
        });
        if (isElectron) {
          window.electronAPI?.resizeToMain();
        }
        navigate("/app/dashboard", { replace: true });
      } else if (here.includes("/app")) {
        // 未勾选自动登录，但刷新/重开时落在 /app（如地址栏直链）→ 恢复会话数据，
        // 避免顶栏显示「未登录」、资料页空白
        useAppStore.getState().setUser(saved.name, saved.role, {
          badge: saved.badge,
          phone: saved.phone,
          department: saved.department,
        });
      }
      // 否则停留在 /login，由用户手动登录（登录即无缝进入）
    } else if (here.includes("/app")) {
      // 无有效会话却直链到 /app：退回登录页，避免空会话进入主界面
      navigate("/login", { replace: true });
    }
  }, []);

  const setUser = useAppStore((s) => s.setUser);
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);
  const lowPerfMode = useAppStore((s) => s.lowPerfMode);
  const { modal } = AntApp.useApp();

  // 把关闭行为设置同步给 Electron 主进程（主进程无法直接读 localStorage）
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.setCloseBehavior) return;
    try {
      const behavior = localStorage.getItem('jingzong.closeBehavior') || 'ask';
      window.electronAPI.setCloseBehavior(behavior as 'exit' | 'tray' | 'ask');
    } catch { /* ignore */ }
  }, [isElectron]);

  const handleLogin = (name: string, role: string, extra?: { badge?: string; phone?: string; department?: string }) => {
    setUser(name, role, extra);
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
  const uiDensity = useAppStore((s) => s.uiDensity);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);
  useEffect(() => {
    document.documentElement.setAttribute('data-density', uiDensity);
  }, [uiDensity]);
  return (
    <ConfigProvider locale={zhCN} theme={darkMode ? DARK_THEME : LIGHT_THEME}>
      <AntApp>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent />
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
}
