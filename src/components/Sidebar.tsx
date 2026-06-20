import { useMemo, useState, useEffect, useCallback } from 'react';
import type React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronLeft, Database, Settings, ShieldCheck, User, KeyRound, LogOut, Plus } from 'lucide-react';
import { Modal } from "antd";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/appStore"
import { DEPARTMENTS, PLATFORM_NAV } from '../moduleConfig';
import { useCustomModules } from '../customModules';
import { APP_VERSION } from '../version';

interface Props {
  onOpenProfile: () => void;
  onOpenPassword: () => void;
}

type IconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}>;

export default function Sidebar({ onOpenProfile, onOpenPassword }: Props) {
  const navigate = useNavigate();
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const userName = useAppStore((s) => s.userName);
  const userRole = useAppStore((s) => s.userRole);
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const lowPerfMode = useAppStore((s) => s.lowPerfMode);
  const toggleLowPerfMode = useAppStore((s) => s.toggleLowPerfMode);
  const customAvatar = (() => { try { return localStorage.getItem("jingzong.avatar"); } catch { return null; } })();
  const { customModules } = useCustomModules();
  const [expanded, setExpanded] = useState<string | null>('office');

  const autoCollapse = useCallback(() => window.innerWidth < 900, []);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("jingzong.sidebar.collapsed");
      if (saved !== null) return saved === "true";
    } catch { /* ignore */ }
    return autoCollapse();
  });

  useEffect(() => {
    const onResize = () => {
      const shouldCollapse = autoCollapse();
      setCollapsed((prev) => {
        if (shouldCollapse && !prev) return true;
        if (!shouldCollapse && prev) {
          try { const saved = localStorage.getItem("jingzong.sidebar.collapsed"); return saved === "true"; } catch { return false; }
        }
        return prev;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [autoCollapse]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem("jingzong.sidebar.collapsed", String(next));
      return next;
    });
  }, []);

  const SIDEBAR_WIDTH_EXPANDED = 226;
  const SIDEBAR_WIDTH_COLLAPSED = 60;

  const departments = useMemo(() => {
    return DEPARTMENTS.map((dept) => ({
      ...dept,
      modules: [
        ...dept.modules,
        ...customModules.filter((module) => module.departmentId === dept.id),
      ],
    }));
  }, [customModules]);

  const toggleExpand = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  const isElectron = typeof window !== "undefined" && (window as any).electronAPI?.isElectron;

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出登录？',
      content: '退出后需要重新登录。',
      okText: '退出',
      cancelText: '取消',
      onOk: () => {
        try {
          const raw = localStorage.getItem("jingzong.login.v1");
          if (raw) {
            const saved = JSON.parse(raw);
            saved.autoLogin = false; // 只禁用自动登录，保留已保存的账号密码
            localStorage.setItem("jingzong.login.v1", JSON.stringify(saved));
          }
        } catch {
          // Continue even if storage cleanup fails.
        }
        useAppStore.getState().setUser("", "");
        // 单窗口模式：窗口缩回登录尺寸
        if (isElectron) {
          (window as any).electronAPI?.resizeToLogin();
        }
        navigate("/login");
        useAppStore.getState().showToast("已退出登录", "info");
      },
    });
  };

  const renderPlatformItem = (item: typeof PLATFORM_NAV.top[number]) => {
    const Icon = item.icon;
    const active = currentPage === item.id;
    return (
      <motion.div
        key={item.id}
        role="button"
        tabIndex={0}
        aria-current={active ? 'page' : undefined}
        whileHover={{ background: darkMode ? '#374151' : '#F9FAFB' }}
        whileTap={{ scale: 0.99 }}
        onClick={() => setCurrentPage(item.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentPage(item.id); } }}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 14px', cursor: 'pointer', outline: 'none',
          borderLeft: '3px solid',
          borderLeftColor: active ? '#2563EB' : 'transparent',
          background: active ? (darkMode ? '#1E3A5F' : '#EFF6FF') : 'transparent',
        }}
      >
        <Icon size={15} color={active ? '#2563EB' : (darkMode ? '#9CA3AF' : '#6B7280')} style={{ flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ fontSize: 13, color: active ? '#2563EB' : (darkMode ? '#D1D5DB' : '#374151'), flex: 1, whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div
      animate={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: darkMode ? 'var(--color-surface)' : '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        flexShrink: 0,
        position: 'relative',
        borderRight: 'none',
        boxShadow: darkMode
          ? '1px 0 8px rgba(0,0,0,.3), 1px 0 0 rgba(255,255,255,0.03)'
          : '1px 0 12px rgba(0,0,0,.04), 1px 0 0 rgba(0,0,0,0.03)',
      }}
    >
      {/* Electron 无边框窗口拖拽区域 */}
      {/* @ts-expect-error WebkitAppRegion is Electron-only CSS property */}
      <div style={{ WebkitAppRegion: 'drag' as any, height: 30, flexShrink: 0 }} />

      {/* 折叠按钮 */}
      <button
        type="button"
        onClick={toggleCollapsed}
        style={{
          position: 'absolute',
          top: 32,
          right: -14,
          zIndex: 10,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: darkMode ? '#374151' : '#fff',
          border: `1px solid ${darkMode ? '#4b5563' : '#D8E1EA'}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,.4)' : '0 2px 8px rgba(0,0,0,.16)',
          color: darkMode ? '#9ca3af' : '#64748B',
          transition: 'all 0.2s',
        }}
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.3 }}>
          <ChevronLeft size={14} />
        </motion.div>
      </button>

      {/* 用户信息区域 */}
      {!collapsed && (
        <div style={{ padding: "16px 14px 12px" }}>
          {/* 用户卡片 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
            padding: "12px", borderRadius: 10,
            background: darkMode ? 'rgba(163,201,255,0.05)' : 'linear-gradient(135deg, #EFF6FF, #F0F9FF)',
            border: darkMode ? '1px solid rgba(163,201,255,0.1)' : '1px solid #DBEAFE',
          }}>
            {customAvatar ? (
              <img src={customAvatar} alt="avatar" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", flexShrink: 0, boxShadow: "0 2px 12px rgba(37,99,235,0.2)" }} />
            ) : (
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0,
                boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
              }}>
                {(userName || "用")[0]}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                color: darkMode ? "#e2e2e6" : "#1e293b",
              }}>
                {userName || "用户"}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 3, padding: '2px 8px', borderRadius: 4,
                fontSize: 10.5, fontWeight: 600,
                background: darkMode ? 'rgba(163,201,255,0.12)' : '#DBEAFE',
                color: darkMode ? '#93c5fd' : '#2563EB',
              }}>
                {userRole || "普通用户"}
              </div>
            </div>
          </div>
          {/* 操作按钮行 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <ActionBtn icon={User} label="信息" onClick={onOpenProfile} />
            <ActionBtn icon={KeyRound} label="密码" onClick={onOpenPassword} />
            <ActionBtn icon={() => <span style={{fontSize:12}}>{darkMode ? "☀️" : "🌙"}</span>} label={darkMode ? "浅色" : "深色"} onClick={toggleDarkMode} />
            <ActionBtn icon={LogOut} label="退出" onClick={handleLogout} />
          </div>
        </div>
      )}
      {/* 折叠状态用户工具栏 */}
      {collapsed && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0 8px", gap: 6, borderBottom: darkMode ? "1px solid #374151" : "1px solid #E5E7EB" }}>
          {customAvatar ? (
              <img src={customAvatar} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#4B9EFF,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {(userName || "用")[0]}
              </div>
            )}
          <ToolbarIcon icon={User} title="个人信息" onClick={onOpenProfile} />
          <ToolbarIcon icon={KeyRound} title="修改密码" onClick={onOpenPassword} />

          <ToolbarIcon icon={() => <span style={{fontSize:11}}>{darkMode ? "☀️" : "🌙"}</span>} title={darkMode ? "浅色模式" : "深色模式"} onClick={toggleDarkMode} />
          <ToolbarIcon icon={() => <span style={{fontSize:11}}>{lowPerfMode ? "⚡" : "🐢"}</span>} title={lowPerfMode ? "高性能" : "低性能"} onClick={toggleLowPerfMode} />
          <ToolbarIcon icon={LogOut} title="退出" onClick={handleLogout} />
        </div>
      )}
      {/* 分隔线 */}
      <div style={{ height: 1, background: darkMode ? "#374151" : "#E5E7EB", margin: "0 14px" }} />

      {/* 侧边栏主导航区域 */}
      <div className="sidebar-scroll" style={{ paddingTop: 2 }}>
        {PLATFORM_NAV.top.map(renderPlatformItem)}

        {departments.map((dept) => {
          const Icon = dept.icon;
          const isExpanded = expanded === dept.id;
          const childActive = dept.modules.some((module) => currentPage === module.id);

          return (
            <div key={dept.id}>
              <motion.div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                whileHover={{ background: darkMode ? '#374151' : '#F9FAFB' }}
                whileTap={{ scale: 0.99 }}
                onClick={() => toggleExpand(dept.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(dept.id); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '10px 14px', cursor: 'pointer', outline: 'none',
                  borderLeft: '3px solid',
                  borderLeftColor: childActive || isExpanded ? '#2563EB' : 'transparent',
                  background: childActive || isExpanded ? (darkMode ? '#1E3A5F' : '#EFF6FF') : 'transparent',
                }}
              >
                <Icon size={15} color={childActive || isExpanded ? '#2563EB' : (darkMode ? '#9CA3AF' : '#6B7280')} style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <span style={{ fontSize: 13, color: childActive || isExpanded ? '#2563EB' : (darkMode ? '#D1D5DB' : '#374151'), flex: 1, whiteSpace: 'nowrap' }}>
                    {dept.label}
                  </span>
                )}
                {!collapsed && (
                  <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} style={{ flexShrink: 0 }}>
                    <ChevronDown size={13} color="#9CA3AF" />
                  </motion.div>
                )}
              </motion.div>

              <AnimatePresence>
                {isExpanded && !collapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    {dept.modules.map((module) => {
                      const active = currentPage === module.id;
                      return (
                        <motion.div
                          key={module.id}
                          role="button"
                          tabIndex={0}
                          aria-current={active ? 'page' : undefined}
                          whileHover={{ background: darkMode ? '#374151' : '#F9FAFB' }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setCurrentPage(module.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentPage(module.id); } }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 9,
                            padding: '9px 14px 9px 42px',
                            cursor: 'pointer', outline: 'none', position: 'relative',
                            background: active ? (darkMode ? '#1E3A5F' : '#EFF6FF') : 'transparent',
                          }}
                        >
                          <div style={{ position: 'absolute', left: 24, top: 0, bottom: 0, width: 1, background: darkMode ? '#374151' : '#E5E7EB' }} />
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#2563EB' : (darkMode ? '#6B7280' : '#D1D5DB'), flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, color: active ? '#2563EB' : (darkMode ? '#D1D5DB' : '#4B5563'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {module.label}
                          </span>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        <NavGroup
          id="data-center"
          label="系统设置"
          icon={Settings}
          expanded={expanded}
          collapsed={collapsed}
          currentPage={currentPage}
          items={PLATFORM_NAV.data}
          onToggle={toggleExpand}
          onNavigate={setCurrentPage}
        />

        {/* 关于软件 */}
        {renderPlatformItem({ id: 'version', label: '关于软件', icon: ShieldCheck })}

        {/* 快速新建按钮 */}
        {!collapsed && (
          <div style={{ padding: '8px 14px', flexShrink: 0 }}>
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 4px 16px rgba(21,90,138,0.3)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                useAppStore.getState().openModal('newRecord');
              }}
              style={{
                width: '100%', height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: '0 2px 12px rgba(21,90,138,0.25)',
                transition: 'all 0.2s var(--ease-out)',
              }}
            >
              <Plus size={15} /> 新建记录
            </motion.button>
          </div>
        )}
      </div>

      {/* 底部版权 */}
      {!collapsed && (
        <div style={{
          padding: '4px 14px 8px', flexShrink: 0,
          fontSize: 10, color: '#9CA3AF',
          textAlign: 'center', borderTop: darkMode ? '1px solid #374151' : '1px solid #E5E7EB',
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          {APP_VERSION} &copy; 2026
        </div>
      )}
    </motion.div>
  );
}

/** 带文字标签的操作按钮 */
function ActionBtn({ icon: Icon, label, onClick }: { icon: IconComponent; label: string; onClick: () => void }) {
  const darkMode = useAppStore((s) => s.darkMode);
  return (
    <div
      onClick={onClick}
      title={label}
      className="hover-bg"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        flex: 1, padding: '6px 4px', borderRadius: 6, cursor: 'pointer',
        color: darkMode ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 500,
        whiteSpace: 'nowrap', transition: 'all .15s',
        background: 'transparent',
      }}
    >
      <Icon size={13} /><span>{label}</span>
    </div>
  );
}

/** 紧凑工具栏图标按钮 */
function ToolbarIcon({ icon: Icon, title, onClick }: { icon: IconComponent; title: string; onClick: () => void }) {
  const darkMode = useAppStore((s) => s.darkMode);
  return (
    <div
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: darkMode ? '#D1D5DB' : '#6B7280', flexShrink: 0,
        fontSize: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = darkMode ? '#374151' : '#F3F4F6'; e.currentTarget.style.color = darkMode ? '#F9FAFB' : '#111827'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = darkMode ? '#D1D5DB' : '#6B7280'; }}
    >
      <Icon size={15} />
    </div>
  );
}

interface NavGroupProps {
  id: string;
  label: string;
  icon: IconComponent;
  expanded: string | null;
  collapsed: boolean;
  currentPage: string;
  items: Array<{ id: string; label: string; icon: IconComponent }>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
}

function NavGroup({ id, label, icon: Icon, expanded, collapsed, currentPage, items, onToggle, onNavigate }: NavGroupProps) {
  const isExpanded = expanded === id;
  const childActive = items.some((item) => currentPage === item.id);
  const darkMode = useAppStore((s) => s.darkMode);

  return (
    <div>
      <motion.div
        whileHover={{ background: darkMode ? '#374151' : '#F9FAFB' }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onToggle(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 14px', cursor: 'pointer',
          borderLeft: '3px solid',
          borderLeftColor: childActive || isExpanded ? '#2563EB' : 'transparent',
          background: childActive || isExpanded ? (darkMode ? '#1E3A5F' : '#EFF6FF') : 'transparent',
        }}
      >
        <Icon size={15} color={childActive || isExpanded ? '#2563EB' : (darkMode ? '#9CA3AF' : '#6B7280')} style={{ flexShrink: 0 }} />
        {!collapsed && <span style={{ fontSize: 13, color: childActive || isExpanded ? '#2563EB' : (darkMode ? '#D1D5DB' : '#374151'), flex: 1, whiteSpace: 'nowrap' }}>{label}</span>}
        {!collapsed && (
          <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} style={{ flexShrink: 0 }}>
            <ChevronDown size={13} color="#9CA3AF" />
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {isExpanded && !collapsed && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            {items.map((item) => {
              const active = currentPage === item.id;
              const ChildIcon = item.icon;
              return (
                <motion.div
                  key={item.id}
                  whileHover={{ background: darkMode ? '#374151' : '#F9FAFB' }}
                  onClick={() => onNavigate(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px 9px 42px', cursor: 'pointer', background: active ? (darkMode ? '#1E3A5F' : '#EFF6FF') : 'transparent' }}
                >
                  <ChildIcon size={13} color={active ? '#2563EB' : '#6B7280'} />
                  <span style={{ fontSize: 12.5, color: active ? '#2563EB' : '#4B5563', whiteSpace: 'nowrap' }}>{item.label}</span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
