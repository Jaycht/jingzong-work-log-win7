import { useMemo, useState, useEffect, useCallback } from "react";
import type React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronLeft, Settings, Plus,
} from "lucide-react";
import { useAppStore } from "../store/appStore";
import { DEPARTMENTS, PLATFORM_NAV } from "../moduleConfig";
import { useCustomModules } from "../customModules";
import { APP_VERSION } from "../version";
import { BRAND } from "../constants/theme";

type IconComponent = React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;

export default function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const darkMode = useAppStore((s) => s.darkMode);
  const { customModules } = useCustomModules();

  const SIDEBAR_WIDTH_EXPANDED = 268;
  const SIDEBAR_WIDTH_COLLAPSED = 76;

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
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [autoCollapse]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem("jingzong.sidebar.collapsed", String(next));
      return next;
    });
  }, []);

  // 业务模块分组（部门 + 自定义模块）
  const departments = useMemo(() => {
    return DEPARTMENTS.map((dept) => ({
      ...dept,
      modules: [
        ...dept.modules,
        ...customModules.filter((module) => module.departmentId === dept.id),
      ],
    }));
  }, [customModules]);

  const OVERVIEW = PLATFORM_NAV.top;
  const SYSTEM: { id: string; label: string; icon: IconComponent }[] = [
    { id: "systemSettings", label: "系统设置", icon: Settings },
  ];

  // 当前激活模块所属部门，自动展开
  const activeDeptId = useMemo(() => {
    const all = departments.flatMap((d) => d.modules.map((m) => ({ id: d.id, mid: m.id })));
    return all.find((x) => x.mid === currentPage)?.id || null;
  }, [departments, currentPage]);

  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { if (activeDeptId) setExpanded(activeDeptId); }, [activeDeptId]);

  const toggleExpand = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  // 主题色板
  const surface = darkMode ? "#11161d" : "#ffffff";
  const borderColor = darkMode ? "rgba(255,255,255,0.08)" : "#EAEFF5";
  const textColor = darkMode ? "#E6EAF2" : "#1F2937";
  const textMuted = darkMode ? "#8A94A6" : "#6B7280";
  const hoverBg = darkMode ? "rgba(255,255,255,0.06)" : "#F1F5F9";
  const pillBg = darkMode ? "rgba(37,99,235,0.18)" : "rgba(37,99,235,0.10)";

  // 激活指示（共享 layoutId，自动在各级导航间滑动）
  const ActivePill = () => (
    <motion.span
      layoutId="nav-active"
      transition={{ type: "spring", stiffness: 500, damping: 38 }}
      style={{
        position: "absolute", inset: 0, borderRadius: 12, background: pillBg,
        pointerEvents: "none",
      }}
    />
  );

  // 图标块：大厂仪表盘风格的圆角彩色图标块，比裸线图标更醒目、不简陋
  const IconTile = ({ Icon, active }: { Icon: IconComponent; active: boolean }) => (
    <span style={{
      width: 38, height: 38, borderRadius: 11, flexShrink: 0, position: "relative", zIndex: 1,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: active ? BRAND.primary : (darkMode ? "rgba(255,255,255,0.05)" : "#EEF2F8"),
      boxShadow: active
        ? "0 6px 16px rgba(37,99,235,.35)"
        : "inset 0 0 0 1px rgba(37,99,235,.07)",
      transition: "background .18s, box-shadow .18s",
    }}>
      <Icon size={20} color={active ? "#fff" : textMuted} />
    </span>
  );

  const renderNavItem = (
    item: { id: string; label: string; icon: IconComponent },
    indent = false
  ) => {
    const Icon = item.icon;
    const active = currentPage === item.id;
    return (
      <motion.div
        key={item.id}
        role="button"
        tabIndex={0}
        aria-current={active ? "page" : undefined}
        whileTap={{ scale: 0.98 }}
        onClick={() => setCurrentPage(item.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCurrentPage(item.id); } }}
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 12,
          padding: indent ? "10px 12px 10px 44px" : "9px 12px", cursor: "pointer",
          outline: "none", borderRadius: 12, overflow: "hidden",
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = hoverBg; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
      >
        {active && <ActivePill />}
        {indent && (
          <span style={{ position: "absolute", left: 26, top: 0, bottom: 0, width: 1, background: borderColor }} />
        )}
        <IconTile Icon={Icon} active={active} />
        {!collapsed && (
          <span style={{ fontSize: 15, color: active ? BRAND.primary : textColor, fontWeight: active ? 700 : 500, flex: 1, whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>
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
        background: surface,
        display: "flex", flexDirection: "column", overflow: "visible", flexShrink: 0,
        position: "relative",
        borderRight: `1px solid ${borderColor}`,
        boxShadow: darkMode
          ? "1px 0 10px rgba(0,0,0,.45)"
          : "1px 0 14px rgba(15,23,42,.05)",
      }}
    >
      {/* 左侧渐变装饰条 */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${BRAND.primaryLight}, ${BRAND.primaryDark})`, opacity: 0.9 }} />

      {/* 折叠按钮 */}
      <button
        type="button"
        onClick={toggleCollapsed}
        style={{
          position: "absolute", top: 12, right: -13, zIndex: 20,
          width: 26, height: 26, borderRadius: "50%",
          background: surface, border: `1px solid ${borderColor}`, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,.5)" : "0 2px 8px rgba(15,23,42,.12)",
          color: textMuted,
        }}
      >
        <motion.div animate={{ rotate: collapsed ? 0 : 180 }} transition={{ duration: 0.3 }}>
          <ChevronLeft size={13} />
        </motion.div>
      </button>

      {/* 品牌标识与个人信息卡已迁移至顶部常驻栏 */}

      {/* 导航区 */}
      <div className="sidebar-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px" }}>
        <SectionLabel text="概览" collapsed={collapsed} />
        {OVERVIEW.map((item) => renderNavItem(item))}

        <SectionLabel text="业务模块" collapsed={collapsed} />
        {departments.map((dept) => {
          const Icon = dept.icon;
          const isExpanded = expanded === dept.id;
          const childActive = dept.modules.some((m) => currentPage === m.id);
          const active = childActive;
          return (
            <div key={dept.id}>
              <motion.div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggleExpand(dept.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(dept.id); } }}
                style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", cursor: "pointer", outline: "none", borderRadius: 12, overflow: "hidden" }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = hoverBg; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                {active && <ActivePill />}
                <IconTile Icon={Icon} active={active} />
                {!collapsed && (
                  <span style={{ fontSize: 15, color: active ? BRAND.primary : textColor, fontWeight: active ? 700 : 500, flex: 1, whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>
                    {dept.label}
                  </span>
                )}
                {!collapsed && (
                  <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
                    <ChevronDown size={15} color={textMuted} />
                  </motion.div>
                )}
              </motion.div>
              <AnimatePresence>
                {isExpanded && !collapsed && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
                    {dept.modules.map((m) => renderNavItem({ id: m.id, label: m.label, icon: m.icon ?? dept.icon }, true))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        <SectionLabel text="系统" collapsed={collapsed} />
        {SYSTEM.map((item) => renderNavItem(item))}
      </div>

      {/* 底部：新建 + 版本 */}
      {!collapsed && (
        <div style={{ padding: "10px 12px 12px", borderTop: `1px solid ${borderColor}` }}>
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 6px 18px rgba(37,99,235,.32)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => useAppStore.getState().openModal("newRecord")}
            style={{
              width: "100%", height: 46, borderRadius: 12, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryLight})`, color: "#fff",
              fontSize: 14.5, fontWeight: 700, fontFamily: "inherit", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 7, boxShadow: "0 3px 12px rgba(37,99,235,.25)",
            }}
          >
            <Plus size={18} /> 新建记录
          </motion.button>
          <div style={{ marginTop: 9, textAlign: "center", fontSize: 11, color: textMuted, fontFamily: "'JetBrains Mono',monospace" }}>
            {APP_VERSION} &copy; 2026
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** 概览/系统/业务 分组标题 */
function SectionLabel({ text, collapsed }: { text: string; collapsed: boolean }) {
  const darkMode = useAppStore((s) => s.darkMode);
  if (collapsed) {
    return <div style={{ height: 1, background: darkMode ? "rgba(255,255,255,.08)" : "#EAEFF5", margin: "10px 8px" }} />;
  }
  return (
    <div style={{ fontSize: 12.5, fontWeight: 800, color: darkMode ? "#7A8599" : "#94A0B0", letterSpacing: "0.08em", padding: "12px 14px 7px", textTransform: "uppercase" }}>
      {text}
    </div>
  );
}

// 个人信息卡相关组件（MiniBtn / ToolbarIcon）已迁移至顶部常驻栏
