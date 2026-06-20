import { useMemo } from "react";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { DEPARTMENTS, PLATFORM_NAV } from "../moduleConfig";

const FLAT_NAMES: Record<string, string> = {
  dashboard: "工作台",
  statistics: "统计分析",
  importExport: "导入导出",
  attachments: "附件档案",
  operationLog: "操作日志",
  settings: "模板字段",
  backup: "备份恢复",
  version: "版权信息",
  systemSettings: "系统设置",
  dailyNotes: "日常随手记",
  timeline: "案件时间轴",
  graph: "案件图谱",
};

function findPageName(id: string): string {
  if (FLAT_NAMES[id]) return FLAT_NAMES[id];
  for (const dept of DEPARTMENTS) {
    for (const mod of dept.modules) {
      if (mod.id === id) return mod.label;
    }
  }
  for (const group of [PLATFORM_NAV.top, PLATFORM_NAV.data]) {
    for (const item of group) {
      if (item.id === id) return item.label;
    }
  }
  return id;
}

export default function Breadcrumb() {
  const currentPage = useAppStore((s) => s.currentPage);
  const name = useMemo(() => findPageName(currentPage), [currentPage]);
  if (currentPage === "dashboard") return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#9CA3AF", marginBottom: 14 }}>
      <LayoutDashboard size={13} color="#9CA3AF" />
      <span style={{ cursor: "pointer", color: "#6B7280" }}>首页</span>
      <ChevronRight size={11} />
      <span style={{ color: "#374151", fontWeight: 600 }}>{name}</span>
    </div>
  );
}
