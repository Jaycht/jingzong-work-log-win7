import { lazy, Suspense, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { App } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore"
import Sidebar from "./Sidebar";
import PageSkeleton from "./PageSkeleton";
import ProfileModal from "./ProfileModal";
import DrawerNewRecord from "./DrawerNewRecord";
import ModalNewUser from "./ModalNewUser";
import Drawer from "./Drawer";
import Breadcrumb from "./Breadcrumb";
import ErrorBoundary from "./ErrorBoundary";
import NotificationPanel from "./NotificationPanel";
import GlobalSearch from "./GlobalSearch";
import badgeIcon from '../assets/badge-icon.png';
import { User, LogOut, Sun, Moon, Gauge } from "lucide-react";
import { BRAND } from "../constants/theme";
import { useReminderService } from "../hooks/useReminderService";
import { isElectron as isElectronEnv } from "../lib/env";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const OperationLog = lazy(() => import("../pages/OperationLog"));
const ImportExport = lazy(() => import("../pages/ImportExport"));
const Backup = lazy(() => import("../pages/Backup"));
const Version = lazy(() => import("../pages/Version"));
const Attachments = lazy(() => import("../pages/Attachments"));
const LegalForms = lazy(() => import("../pages/LegalForms"));
const LegalKnowledge = lazy(() => import("../pages/LegalKnowledge"));
const PlaceholderPage = lazy(() => import("../pages/PlaceholderPage"));
const ModulePage = lazy(() => import("../pages/ModulePage"));

const CaseTimeline = lazy(() => import("../pages/CaseTimeline"));
const CaseGraph = lazy(() => import("../pages/CaseGraph"));
const CaseLinkage = lazy(() => import("../pages/CaseLinkage"));
const DailyNotes = lazy(() => import("../pages/DailyNotes"));
const SystemSettings = lazy(() => import("../pages/SystemSettings"));

const PAGES: Record<string, React.FC> = {
  dashboard: Dashboard,
  settings: SettingsPage, operationLog: OperationLog,
  importExport: ImportExport, backup: Backup, version: Version,
  attachments: Attachments,
  legalForms: LegalForms,
  legalKnowledge: LegalKnowledge,
  timeline: CaseTimeline,
  graph: CaseGraph,
  linkage: CaseLinkage,
  dailyNotes: DailyNotes,
  systemSettings: SystemSettings,
  interview: PlaceholderPage, meeting: PlaceholderPage, victim: PlaceholderPage,
  clue: PlaceholderPage, daily: PlaceholderPage,
  party: PlaceholderPage, report: PlaceholderPage, userSettings: PlaceholderPage,
  'legal-assessment': PlaceholderPage,
};

const isElectron = isElectronEnv();

export default function AppLayout() {
  useReminderService();
  const { modal } = App.useApp();

  const winControls = {
    min: () => window.electronAPI?.minimize(),
    max: () => window.electronAPI?.maximize(),
    close: () => {
      // 关闭行为统一交给 Electron 主进程处理（exit / tray / ask）
      if (window.electronAPI?.close) {
        window.electronAPI.close();
      } else {
        try { window.close(); } catch {}
      }
    },
  };

  const modalId = useAppStore((s) => s.modalId);
  const closeModal = useAppStore((s) => s.closeModal);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const closeDrawer = useAppStore((s) => s.closeDrawer);
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const lowPerfMode = useAppStore((s) => s.lowPerfMode);
  const toggleLowPerfMode = useAppStore((s) => s.toggleLowPerfMode);
  const userName = useAppStore((s) => s.userName);
  const userDepartment = useAppStore((s) => s.userDepartment);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = useAppStore((s) => s.currentPage);

  // 外部导航（浏览器前进/后退、书签、手动改地址、刷新直达）时，用 URL 单向回写 store。
  // 必须在「store→URL」同步之前声明，确保挂载时先以 URL 为准，避免被默认页覆盖。
  useEffect(() => {
    const applyFromUrl = () => {
      const hash = window.location.hash || "";
      const urlPage =
        hash.replace(/^#\/app\//, "").replace(/^#\/?/, "") || "dashboard";
      if (urlPage !== useAppStore.getState().currentPage) {
        useAppStore.getState().setCurrentPage(urlPage);
      }
    };
    applyFromUrl(); // 挂载即采纳 URL（刷新 / 书签直达）
    window.addEventListener("hashchange", applyFromUrl);
    return () => window.removeEventListener("hashchange", applyFromUrl);
  }, []);

  // 单向同步：store.currentPage 为唯一事实源，URL 仅作镜像（支持刷新与历史记录）。
  // 不再反向用 effect 把 URL 写回 store，避免「URL↔store」双向回环导致的
  // "Maximum update depth exceeded" 死循环（根因：两 effect 同拍触发、快照不一致）。
  useEffect(() => {
    const urlPage = location.pathname.replace("/app/", "") || "dashboard";
    if (urlPage !== currentPage) {
      navigate("/app/" + currentPage, { replace: true });
    }
  }, [currentPage, location.pathname, navigate]);

  // 持久化当前模块，供「启动行为=上次模块」恢复
  useEffect(() => {
    try { localStorage.setItem("jingzong.lastPage", currentPage); } catch { /* ignore */ }
  }, [currentPage]);

  // 启动行为：无 hash（全新打开）时，若设为「上次模块」则恢复
  useEffect(() => {
    const sb = useAppStore.getState().startupBehavior;
    if (sb === "last" && !window.location.hash) {
      const last = (() => { try { return localStorage.getItem("jingzong.lastPage"); } catch { return null; } })();
      if (last && last !== "dashboard") {
        useAppStore.getState().setCurrentPage(last);
      }
    }
  }, []);

  const editRecord = useAppStore((s) => s.editRecord);
  const setEditRecord = useAppStore((s) => s.setEditRecord);

  const [profileOpen, setProfileOpen] = useState(false);

  const customAvatar = (() => { try { return localStorage.getItem("jingzong.avatar"); } catch { return null; } })();
  const avatarSrc = customAvatar || badgeIcon;

  const handleLogout = () => {
    modal.confirm({
      title: "确认退出登录？",
      content: "退出后需要重新登录。",
      okText: "退出",
      cancelText: "取消",
      onOk: () => {
        try {
          const raw = localStorage.getItem("jingzong.login.v1");
          if (raw) {
            const saved = JSON.parse(raw);
            saved.autoLogin = false;
            localStorage.setItem("jingzong.login.v1", JSON.stringify(saved));
          }
        } catch { /* ignore */ }
        useAppStore.getState().setUser("", "");
        if (isElectron) window.electronAPI?.resizeToLogin();
        navigate("/login");
        useAppStore.getState().showToast("已退出登录", "info");
      },
    });
  };

  const topBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6,
    height: 34, padding: "0 10px", borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.28)",
    background: "transparent", color: "rgba(255,255,255,0.92)",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
    ...extra,
  });

  const Page = PAGES[currentPage] || ModulePage;

  return (
    <div className="app-shell" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: darkMode ? 'var(--stitch-surface-container-low)' : '#F0F2F5' }}>
      {isElectron && (
        <div
          className="electron-titlebar"
          style={{
            height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            WebkitAppRegion: 'drag',
            background: darkMode ? 'linear-gradient(135deg,#13325c,#1d4ed8)' : 'linear-gradient(135deg,#155A8A,#2563EB)',
            paddingLeft: 14,
            paddingRight: 14,
            borderBottom: 'none',
          }}
        >
          <div style={{ WebkitAppRegion: 'no-drag', display: 'flex', gap: 2, paddingRight: 4 }}>
            <div onClick={winControls.min} title="最小化" style={{ width: 32, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', fontSize: 12 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>─</div>
            <div onClick={winControls.max} title="最大化" style={{ width: 32, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', fontSize: 11 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>□</div>
            <div onClick={winControls.close} title="关闭" style={{ width: 32, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9CA3AF', fontSize: 13 }} onMouseEnter={e => { e.currentTarget.style.background = '#E81123'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}>×</div>
          </div>
        </div>
      )}

      {/* ── 顶部常驻栏：品牌（最左） + 全局检索（居中） + 个人信息（最右） ── */}
      <div
        className="app-topbar"
        style={{
          position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16, padding: '12px 22px',
          background: darkMode ? 'linear-gradient(135deg,#13325c,#1d4ed8)' : 'linear-gradient(135deg,#155A8A,#2563EB)',
          borderBottom: darkMode ? '1px solid rgba(163,201,255,0.12)' : '1px solid rgba(13,42,84,0.35)',
        }}
      >
        {/* 左：品牌标识 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'drag', minWidth: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontWeight: 800, fontSize: 20, flexShrink: 0, boxShadow: '0 3px 12px rgba(255,255,255,.35)' }}>
            经
          </div>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>经侦工作记录</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>ECONOMIC INVESTIGATION</div>
          </div>
        </div>

        {/* 中：全局检索 — 绝对定位真正水平居中于整个顶栏（窗口），避免 grid 左右列不对称导致偏移（V2.41.19 修复 #5） */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', maxWidth: 720, WebkitAppRegion: 'no-drag' }}>
          <GlobalSearch />
        </div>

        {/* 右：个人信息 */}
        <div style={{ WebkitAppRegion: 'no-drag', justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'fit-content', flexShrink: 0 }}>
          <div title="点击查看个人资料" onClick={() => setProfileOpen(true)} style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: `2px solid ${darkMode ? 'rgba(255,255,255,0.25)' : '#fff'}`, boxShadow: darkMode ? '0 2px 10px rgba(0,0,0,.45)' : '0 2px 10px rgba(15,23,42,.18)', flexShrink: 0 }}>
            <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div onClick={() => setProfileOpen(true)} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1.25, cursor: 'pointer', paddingRight: 4, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{userName || '未登录'}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>{userDepartment || '—'}</span>
          </div>
          <button className="wb-hover-ghost" onClick={() => setProfileOpen(true)} title="个人资料" style={topBtn()}>
            <User size={15} /><span>资料</span>
          </button>
          <button className="wb-hover-ghost" onClick={toggleDarkMode} title={darkMode ? '切换为浅色' : '切换为深色'} style={topBtn()}>
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}<span>{darkMode ? '浅色' : '深色'}</span>
          </button>
          <button className="wb-hover-ghost" onClick={toggleLowPerfMode} title={lowPerfMode ? '当前：低性能模式（点击切换为高性能）' : '当前：高性能模式（点击切换为低性能）'} style={topBtn()}>
            <Gauge size={15} color={lowPerfMode ? '#F59E0B' : '#10B981'} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: lowPerfMode ? '#F59E0B' : '#10B981', boxShadow: `0 0 0 2px ${lowPerfMode ? 'rgba(245,158,11,.25)' : 'rgba(16,185,129,.25)'}` }} />
              {lowPerfMode ? '低性能' : '高性能'}
            </span>
          </button>
          <button className="wb-hover-ghost" onClick={handleLogout} title="退出登录" style={{ ...topBtn(), color: '#FCA5A5' }}>
            <LogOut size={15} /><span>退出</span>
          </button>
        </div>
      </div>

      <div className="app-main-row" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <Sidebar />
      <div className="content-area" style={{
        flex: 1, overflow: 'auto', padding: '16px 20px',
        background: darkMode ? 'var(--stitch-surface-container-low)' : '#F0F2F5',
      }}>
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Breadcrumb />
            <Suspense fallback={<PageSkeleton />}>
              <Page />
            </Suspense>
          </motion.div>
      </div>
      <NotificationPanel />
      </div>

      {modalId === 'newRecord' && (
        <ErrorBoundary>
        <DrawerNewRecord
          key={editRecord?.id || 'new'}
          onClose={() => { closeModal(); setEditRecord(null); }}
          editRecord={editRecord}
        />
        </ErrorBoundary>
      )}
      {modalId === 'newUser' && <ErrorBoundary><ModalNewUser onClose={closeModal} /></ErrorBoundary>}

      {drawerOpen && <Drawer onClose={closeDrawer} />}

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
