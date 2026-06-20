import { theme } from "antd";
import type { ThemeConfig } from "antd";

/* ============================================================
   品牌色 - 更鲜活的经侦蓝
   ============================================================ */
export const BRAND = {
  primary: "#2563EB",
  primaryLight: "#3B82F6",
  primaryDark: "#1D4ED8",
  success: "#059669",
  warning: "#D97706",
  error: "#DC2626",
  info: "#0284C7",
} as const;

/* ============================================================
   浅色主题
   ============================================================ */
export const LIGHT_THEME: ThemeConfig = {
  algorithm: undefined,
  token: {
    colorPrimary: BRAND.primary,
    colorInfo: BRAND.info,
    colorSuccess: BRAND.success,
    colorWarning: BRAND.warning,
    colorError: BRAND.error,
    colorBgContainer: "#ffffff",
    colorBgLayout: "#F0F2F5",
    colorBorder: "#E5E7EB",
    colorText: "#1F2937",
    colorTextSecondary: "#6B7280",
    borderRadius: 8,
    fontFamily: '"Microsoft YaHei","Microsoft YaHei UI","PingFang SC","Noto Sans SC",sans-serif',
  },
  components: {
    Button: { borderRadius: 6, controlHeight: 34, fontWeight: 500 },
    Input: { borderRadius: 6, controlHeight: 34 },
    Select: { borderRadius: 6, controlHeight: 34 },
    DatePicker: { borderRadius: 6, controlHeight: 34 },
    Table: { headerBg: "#F6F8FB", headerColor: "#475569", rowHoverBg: "#F9FAFB", borderRadius: 8 },
    Tabs: { itemSelectedColor: BRAND.primary, inkBarColor: BRAND.primary, cardBorderRadius: 7 },
    Modal: { borderRadiusLG: 12 },
    Drawer: { borderRadiusLG: 12 },
    Card: { borderRadiusLG: 12 },
    Dropdown: { borderRadiusLG: 8 },
  },
};

/* ============================================================
   深色主题
   ============================================================ */
export const DARK_THEME: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#A3C9FF",
    colorInfo: "#A3C9FF",
    colorSuccess: "#6FCF97",
    colorWarning: "#F5A623",
    colorError: "#FF6B6B",
    colorBgContainer: "#1a1d25",
    colorBgLayout: "#0f1114",
    colorBorder: "#374151",
    colorText: "#e2e2e6",
    colorTextSecondary: "#8c919a",
    borderRadius: 8,
    fontFamily: '"Microsoft YaHei","Microsoft YaHei UI","PingFang SC","Noto Sans SC",sans-serif',
  },
  components: {
    Button: { borderRadius: 6, controlHeight: 34, fontWeight: 500 },
    Input: { borderRadius: 6, controlHeight: 34 },
    Select: { borderRadius: 6, controlHeight: 34 },
    DatePicker: { borderRadius: 6, controlHeight: 34 },
    Table: { headerBg: "#1E2023", headerColor: "#C2C6D0", rowHoverBg: "#22262e", borderRadius: 8 },
    Tabs: { itemSelectedColor: "#A3C9FF", inkBarColor: "#A3C9FF", cardBorderRadius: 7 },
    Modal: { borderRadiusLG: 12 },
    Drawer: { borderRadiusLG: 12 },
    Card: { borderRadiusLG: 12 },
    Dropdown: { borderRadiusLG: 8 },
  },
};

/* ============================================================
   图表 & KPI 颜色
   ============================================================ */
export const KPI_GRADIENTS = [
  `linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`,
  `linear-gradient(135deg,#0E7C4B,#38A169)`,
  `linear-gradient(135deg,#C2410C,#E67E22)`,
  `linear-gradient(135deg,#6D28D9,#8B5CF6)`,
];

export const CHART_COLORS = [
  BRAND.primaryLight, "#38A169", "#E67E22", "#9C27B0",
  "#00ACC1", "#D32F2F", "#F59E0B", "#6366F1",
];

export const STAT_COLORS = [
  BRAND.primaryDark, "#38A169", "#E67E22", "#9C27B0",
  "#00ACC1", "#D32F2F",
];

export const KPI_ENTRY_GRADIENTS = [
  `linear-gradient(135deg,${BRAND.primaryDark},${BRAND.primaryLight})`,
  `linear-gradient(135deg,#0E7C4B,#38A169)`,
  `linear-gradient(135deg,#C2410C,#E67E22)`,
  `linear-gradient(135deg,#6D28D9,#8B5CF6)`,
  `linear-gradient(135deg,#0369A1,#0EA5E9)`,
  `linear-gradient(135deg,#86198F,#D946EF)`,
  `linear-gradient(135deg,#166534,#22C55E)`,
  `linear-gradient(135deg,#9A3412,#F97316)`,
];

/** 模块名称映射 — 统一从 moduleConfig 导出 */
export { MODULE_NAMES } from '../moduleConfig';
