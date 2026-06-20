import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Sparkles, RefreshCw, Wrench } from "lucide-react";
import { getCurrentVersion } from "../store/versionStore";

interface ParsedEntry {
  version: string;
  type: "新增" | "优化" | "修复" | "重构" | "发布";
  item: string;
}

interface VersionGroup {
  version: string;
  items: string[];
  fixes: string[];
}

/**
 * Parse a flat changelog string like:
 *   "V1.2.0 发布 - 全新UI界面重构，新增数据统计可视化"
 * into multiple ParsedEntry objects (one per comma-separated item).
 */
function parseChangelogEntry(raw: string): ParsedEntry[] {
  const match = raw.match(/^(V[\d.]+)\s+(新增|优化|修复|重构|发布|增强)\s*[-—]\s*(.+)$/);
  if (!match) return [];
  const version = match[1];
  const type = match[2] as ParsedEntry["type"];
  const content = match[3];
  const parts = content.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) parts.push(content.trim());
  return parts.map((item) => ({ version, type, item }));
}

/** Build version groups from the flat changelog array, newest first */
function buildVersionGroups(changelog: string[]): VersionGroup[] {
  const all: ParsedEntry[] = [];
  for (const raw of changelog) {
    all.push(...parseChangelogEntry(raw));
  }

  const versionOrder: string[] = [];
  const seen = new Set<string>();
  for (const e of all) {
    if (!seen.has(e.version)) {
      seen.add(e.version);
      versionOrder.push(e.version);
    }
  }

  const groups = new Map<string, { items: string[]; fixes: string[] }>();
  for (const e of all) {
    if (!groups.has(e.version)) {
      groups.set(e.version, { items: [], fixes: [] });
    }
    const g = groups.get(e.version)!;
    if (e.type === "修复") {
      g.fixes.push(e.item);
    } else {
      g.items.push(e.item);
    }
  }

  const result: VersionGroup[] = [];
  for (let i = 0; i < versionOrder.length; i++) {
    const v = versionOrder[i];
    const g = groups.get(v)!;
    result.push({ version: v, items: g.items, fixes: g.fixes });
  }
  return result;
}

const CHANGELOG_META = [
  { label: "新增", color: "#388E3C", bg: "#E8F5E9", icon: Sparkles },
  { label: "优化", color: "#1B5E9B", bg: "#EBF5FF", icon: RefreshCw },
  { label: "增强", color: "#7C3AED", bg: "#F3E8FF", icon: RefreshCw },
  { label: "修复", color: "#E67E22", bg: "#FFF3E0", icon: Wrench },
];

export default function Version() {
  const versionInfo = useMemo(() => getCurrentVersion(), []);

  const versionGroups = useMemo(() => buildVersionGroups(versionInfo.changelog), [versionInfo.changelog]);

  // Count by type across all entries
  const statCounts = useMemo(() => {
    let 新增 = 0, 优化 = 0, 修复 = 0;
    for (const raw of versionInfo.changelog) {
      const entries = parseChangelogEntry(raw);
      for (const e of entries) {
        if (e.type === "新增") 新增++;
        else if (e.type === "优化" || e.type === "重构" || e.type === "发布") 优化++;
        else if (e.type === "修复") 修复++;
      }
    }
    return { 新增, 优化, 修复 };
  }, [versionInfo.changelog]);

  const statData = CHANGELOG_META.map((m) => ({
    ...m,
    count: statCounts[m.label as keyof typeof statCounts],
  }));

  return (
    <div style={{ paddingBottom: 40 }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ background: "var(--color-surface)", borderRadius: 12, border: "1px solid var(--color-border)", boxShadow: "var(--shadow-sm)", padding: "40px 24px 32px", marginBottom: 22, textAlign: "center" }}
      >
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }} style={{ marginBottom: 20 }}>
          <img src="./logo.png" alt="" style={{ width: 360, height: 360, objectFit: "contain" }} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)", marginBottom: 6, letterSpacing: 1 }}>{"经侦大队工作记录管理系统-Win7版"}</motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} style={{ fontSize: 32, fontWeight: 900, color: "#155A8A", marginBottom: 8, letterSpacing: 2, fontFamily: "'Courier New', monospace" }}>{versionInfo.version}</motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 22, letterSpacing: 0.5 }}>Economic Investigation Work Log Registration System</motion.div>
        <div style={{ width: 60, height: 2, background: "linear-gradient(90deg, transparent, #1B5E9B, transparent)", margin: "0 auto 22px" }} />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} style={{ fontSize: 14, color: "var(--color-text)", marginBottom: 18, fontWeight: 500 }}>{"制作人：陈洪涛 © 版权所有"}</motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} style={{ fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.8, maxWidth: 720, margin: "0 auto 14px" }}>
          {"本系统为经侦大队内部工作记录管理专用，未经授权不得复制、传播或用于商业用途。\n本系统所有数据存储于用户本地设备，不收集任何个人隐私信息。\n软件著作权归开发者陈洪涛所有。\n技术支持：如遇问题请联系系统管理员或开发者。"}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>Copyright © 2026 陈洪涛. All rights reserved.</motion.div>
      </motion.div>

      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        {statData.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08 }}
            className="card" style={{ flex: 1, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <c.icon size={20} color={c.color} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: "var(--color-text-secondary)" }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.count}{" 项"}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="panel" style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--color-border)", fontSize: 13, fontWeight: 700 }}>{"更新日志"}</div>
        <div>
          {versionGroups.map((g, i) => (
            <motion.div key={g.version} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.08 }}
              style={{ padding: "16px 18px", borderBottom: i < versionGroups.length - 1 ? "1px solid var(--color-surface-hover)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)" }}>{g.version}</span>
                  {i === 0 && (
                    <span style={{ fontSize: 10.5, padding: "1px 8px", borderRadius: 8, background: "#EBF5FF", color: "#1B5E9B", fontWeight: 600 }}>{"当前版本"}</span>
                  )}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>{versionInfo.updatedAt}</span>
              </div>
              {g.items.length > 0 && g.items.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                  <ArrowRight size={12} color="#388E3C" style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>{item}</span>
                </div>
              ))}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
