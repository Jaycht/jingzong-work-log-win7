/**
 * 工作台 Dashboard — 待办驱动
 * 核心区域：待办列表 + 快捷统计 + 最近动态
 */
import { useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, ArrowUp, ArrowDown, Clock, AlertTriangle, CheckCircle2,
  FileText, Gavel, Activity, Zap, FolderOpen, BarChart3
} from "lucide-react";
import * as echarts from 'echarts';
import { getMassRecords } from "../store/massStore";
import type { MassRecord } from "../store/massStore";
import { useAppStore } from "../store/appStore";
import { MODULE_NAMES, findModule } from "../moduleConfig";

/* ===================== 到期预警计算 ===================== */

interface WarnItem {
  id: string;
  recordId: string;
  moduleId: string;
  caseName: string;
  type: string;
  deadline: string;
  remainingDays: number;
  severity: 'overdue' | 'critical' | 'warning';
}

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d: Date, n: number) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }
function toStr(d: Date) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function calcRemaining(deadline: Date) { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.floor((deadline.getTime() - t.getTime()) / 86400000); }

function calcWarnings(records: MassRecord[]): WarnItem[] {
  const rules = [
    { mids: ['legal-report-case', 'legal-case-ledger', 'squad-case'], f: 'receiveDate', t: '受案→立案（7日）', calc: (d: string) => toStr(addDays(new Date(d), 7)) },
    { mids: ['squad-coercive', 'legal-case-ledger'], f: 'criminalDetentionDate', t: '刑事拘留（30日）', calc: (d: string) => toStr(addDays(new Date(d), 30)) },
    { mids: ['squad-coercive', 'legal-case-ledger', 'squad-case'], f: 'arrestDate', t: '侦查羁押（2个月）', calc: (d: string) => toStr(addMonths(new Date(d), 2)) },
    { mids: ['squad-coercive', 'legal-case-ledger'], f: 'bailDate', t: '取保候审（12个月）', calc: (d: string) => toStr(addMonths(new Date(d), 12)) },
    { mids: ['squad-coercive', 'legal-case-ledger'], f: 'residentialSurveillanceDate', t: '监视居住（6个月）', calc: (d: string) => toStr(addMonths(new Date(d), 6)) },
    { mids: ['squad-case', 'legal-case-ledger'], f: 'filingDate', t: '立案侦查（2个月）', calc: (d: string) => toStr(addMonths(new Date(d), 2)) },
  ];
  const items: WarnItem[] = [];
  for (const rule of rules) {
    for (const rec of records.filter(r => rule.mids.includes(r.moduleId))) {
      const raw = rec.data?.[rule.f];
      if (typeof raw !== 'string') continue;
      try {
        const deadline = rule.calc(raw);
        const remaining = calcRemaining(new Date(deadline));
        if (remaining > 30) continue;
        const severity: WarnItem['severity'] = remaining <= 0 ? 'overdue' : remaining <= 3 ? 'critical' : 'warning';
        items.push({
          id: rec.id + rule.f + rule.t, recordId: rec.id, moduleId: rec.moduleId,
          caseName: String(rec.data?.caseName || rec.data?.reportMatter || rec.data?.suspect || '未命名').slice(0, 14),
          type: rule.t, deadline, remainingDays: remaining, severity,
        });
      } catch { /* ignore */ }
    }
  }
  const order: Record<string, number> = { overdue: 0, critical: 1, warning: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity] || a.remainingDays - b.remainingDays);
  return items;
}

/* ===================== KPI 卡片 ===================== */

function KpiCard({ label, value, unit, icon: Icon, color, delay }: {
  label: string; value: string | number; unit: string;
  icon: React.ComponentType<{ size?: number; color?: string }>; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card-static"
      style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flex: 1,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `linear-gradient(135deg, ${color}18, ${color}08)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div className="stat-label">{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span className="stat-value" style={{ color }}>{value}</span>
          <span className="text-sm text-secondary">{unit}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ===================== ECharts ===================== */

function EChartBox({ option, style }: { option: Record<string, unknown>; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const darkMode = useAppStore((s) => s.darkMode);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option, true);
    const h = () => chart.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); chart.dispose(); };
  }, [option, darkMode]);
  return <div ref={ref} style={{ width: '100%', ...style }} />;
}

/* ===================== 主组件 ===================== */

export default function Dashboard() {
  const darkMode = useAppStore((s) => s.darkMode);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const setEditRecord = useAppStore((s) => s.setEditRecord);
  const records = useMemo(() => getMassRecords(), []);

  const warnings = useMemo(() => calcWarnings(records), [records]);
  const overdue = warnings.filter(w => w.severity === 'overdue').length;
  const critical = warnings.filter(w => w.severity === 'critical').length;
  const warningCount = warnings.filter(w => w.severity === 'warning').length;

  const total = records.length;
  const completed = records.filter(r => r.data?.status === '已完成' || r.data?.status === '已办结').length;
  const ongoing = total - completed;
  const thisMonth = records.filter(r => r.createdAt?.startsWith(new Date().toISOString().slice(0, 7))).length;

  const textColor = 'var(--color-text)';
  const mutedColor = 'var(--color-text-secondary)';

  // 模块记录统计
  const moduleRecords: Record<string, number> = {};
  for (const r of records) moduleRecords[r.moduleId] = (moduleRecords[r.moduleId] || 0) + 1;

  // 最近 8 条动态
  const recentActivity = useMemo(() =>
    records.slice(0, 8).map(r => ({
      moduleId: r.moduleId,
      moduleName: MODULE_NAMES[r.moduleId] || r.moduleId,
      title: String(r.data?.caseName || r.data?.suspect || r.data?.title || ''),
      date: r.createdAt?.slice(0, 10) || '',
    })),
    [records]
  );

  // 最近案件（去重）
  const recentCases = useMemo(() => {
    const seen = new Set<string>();
    return records
      .filter(r => {
        const name = String(r.data?.caseName || '');
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      })
      .slice(0, 6)
      .map(r => ({
        name: String(r.data?.caseName || ''),
        moduleId: r.moduleId,
        moduleName: MODULE_NAMES[r.moduleId] || r.moduleId,
        status: r.data?.status || '办理中',
        date: r.updatedAt?.slice(0, 10) || '',
      }));
  }, [records]);

  const handleWarnClick = (item: WarnItem) => {
    const rec = getMassRecords().find(r => r.id === item.recordId);
    if (rec) { setEditRecord(rec); setCurrentPage(item.moduleId); openModal('newRecord'); }
  };

  const severityColors = {
    overdue: { bg: 'var(--color-danger-bg)', dot: 'var(--color-danger)', label: '已过期' },
    critical: { bg: 'var(--color-warning-bg)', dot: 'var(--color-warning)', label: '紧急' },
    warning: { bg: 'var(--color-info-bg)', dot: 'var(--color-info)', label: '注意' },
  };

  // 案件类型分布图表
  const caseTypes = useMemo(() => {
    const targets = new Set(['mass-statistics', 'legal-report-case', 'legal-case-ledger', 'squad-case']);
    const map: Record<string, number> = {};
    for (const r of records) {
      if (!targets.has(r.moduleId)) continue;
      const val = r.data?.caseType;
      if (typeof val === 'string' && val.trim()) map[val.trim()] = (map[val.trim()] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, backgroundColor: darkMode ? '#1a1d25' : '#fff', borderColor: darkMode ? '#374151' : '#E5E7EB', textStyle: { color: textColor } },
    legend: { bottom: 0, textStyle: { color: mutedColor, fontSize: 10 }, type: 'scroll' as const },
    series: [{
      type: 'pie' as const, radius: ['30%', '65%'], center: ['50%', '45%'],
      avoidLabelOverlap: true, padAngle: 1,
      itemStyle: { borderRadius: 4, borderColor: darkMode ? '#1a1d25' : '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{c}', fontSize: 10, color: mutedColor, lineHeight: 14 },
      data: caseTypes.length > 0
        ? caseTypes.slice(0, 8).map(([name, value], i) => ({ name: name.length > 6 ? name.slice(0, 6) + '…' : name, value, itemStyle: { color: ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#6D28D9', '#E11D48'][i % 8] } }))
        : [{ name: '暂无数据', value: 1, itemStyle: { color: darkMode ? '#374151' : '#E5E7EB' } }],
      animationDuration: 800,
    }],
  }), [caseTypes, darkMode, textColor, mutedColor]);

  // 模块活跃度柱状图
  const moduleBarData = useMemo(() => {
    const top = Object.entries(moduleRecords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, count]) => ({ name: MODULE_NAMES[id] || id, value: count }));
    return top;
  }, [moduleRecords]);

  const barOption = useMemo(() => ({
    tooltip: { trigger: 'axis' as const, backgroundColor: darkMode ? '#1a1d25' : '#fff', borderColor: darkMode ? '#374151' : '#E5E7EB', textStyle: { color: textColor } },
    grid: { left: 10, right: 20, top: 10, bottom: 30, containLabel: true },
    xAxis: { type: 'category' as const, data: moduleBarData.map(d => d.name), axisLabel: { color: mutedColor, fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: darkMode ? '#374151' : '#E5E7EB' } } },
    yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: darkMode ? '#2a2e38' : '#F3F4F6' } }, axisLabel: { color: mutedColor, fontSize: 10 } },
    series: [{
      type: 'bar' as const,
      data: moduleBarData.map((d, i) => ({
        value: d.value,
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: ['#3B82F6', '#8B5CF6', '#0891B2', '#10B981', '#F59E0B', '#EF4444'][i % 6] },
          { offset: 1, color: ['#3B82F6', '#8B5CF6', '#0891B2', '#10B981', '#F59E0B', '#EF4444'][i % 6] + '44' },
        ]), borderRadius: [4, 4, 0, 0] },
      })),
      barWidth: 24,
      label: { show: true, position: 'top' as const, fontSize: 11, fontWeight: 600, color: textColor },
    }],
  }), [moduleBarData, darkMode, textColor, mutedColor]);

  if (total === 0) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <div style={{ textAlign: 'center' }}>
          <TrendingUp size={40} color="var(--color-text-muted)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 18, fontWeight: 600, color: textColor, marginBottom: 8 }}>欢迎使用经侦工作台</div>
          <div style={{ fontSize: 13, color: mutedColor, marginBottom: 20 }}>开始录入工作记录后将在这里展示待办和统计</div>
          <button className="btn btn-primary" onClick={() => openModal('newRecord')} style={{ height: 42, paddingInline: 24, fontSize: 14 }}>
            + 新建第一条记录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto' }}>

      {/* ── KPI 概览 ── */}
      <div style={{ display: 'flex', gap: 12 }}>
        <KpiCard label="待录入" value={ongoing} unit="条" icon={FileText} color="#D97706" delay={0} />
        <KpiCard label="办理中" value={ongoing} unit="条" icon={Activity} color="#2563EB" delay={0.05} />
        <KpiCard label="即将到期" value={overdue + critical} unit="件" icon={AlertTriangle} color={overdue > 0 ? '#DC2626' : '#D97706'} delay={0.1} />
        <KpiCard label="本月新增" value={thisMonth} unit="条" icon={TrendingUp} color="#059669" delay={0.15} />
      </div>

      {/* ── 主内容区：待办 + 统计 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* 左侧：今日待办列表 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="panel"
        >
          <div className="panel-header">
            <AlertTriangle size={15} color="var(--color-warning)" />
            <span className="font-semibold" style={{ fontSize: 14 }}>待办预警</span>
            {warnings.length > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: 'auto' }}>{warnings.length} 项</span>
            )}
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {warnings.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: mutedColor, fontSize: 13 }}>
                <CheckCircle2 size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                <div>暂无到期预警，一切正常</div>
              </div>
            ) : (
              <div style={{ padding: '8px 12px' }}>
                {warnings.slice(0, 8).map((item, i) => {
                  const c = severityColors[item.severity];
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.03 }}
                      className="hover-bg"
                      onClick={() => handleWarnClick(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{item.caseName}</div>
                        <div style={{ fontSize: 11, color: mutedColor, marginTop: 2 }}>{item.type}</div>
                      </div>
                      <span className={`badge ${item.severity === 'overdue' ? 'badge-danger' : item.severity === 'critical' ? 'badge-warning' : 'badge-info'}`}>
                        {item.remainingDays <= 0 ? '已过期' : `剩${item.remainingDays}天`}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* 右侧：快速统计 + 图表 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="panel"
        >
          <div className="panel-header">
            <Activity size={15} color="var(--color-primary)" />
            <span className="font-semibold" style={{ fontSize: 14 }}>数据概览</span>
          </div>
          <div style={{ padding: '8px 16px' }}>
            {/* 统计数字行 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                { label: '总记录', value: total, color: 'var(--color-primary)' },
                { label: '已完成', value: completed, color: 'var(--color-success)' },
                { label: '完成率', value: total > 0 ? Math.round(completed / total * 100) + '%' : '0%', color: 'var(--color-info)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '10px 0', borderRadius: 8, background: 'var(--color-surface-hover)' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            {/* 玫瑰图 */}
            <EChartBox option={pieOption} style={{ height: 200 }} />
          </div>
        </motion.div>
      </div>

      {/* ── 底部：最近动态 + 模块活跃度 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* 最近动态 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="panel">
          <div className="panel-header">
            <Zap size={15} color="var(--color-primary)" />
            <span className="font-semibold" style={{ fontSize: 14 }}>最近动态</span>
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: mutedColor, fontSize: 12 }}>暂无动态</div>
            ) : (
              <div style={{ position: 'relative', padding: '8px 16px 8px 32px' }}>
                <div style={{ position: 'absolute', left: 16, top: 12, bottom: 12, width: 1.5, background: `linear-gradient(to bottom, var(--color-primary), transparent)`, opacity: 0.3 }} />
                {recentActivity.map((a, i) => (
                  <div key={i} style={{ position: 'relative', paddingBottom: i < recentActivity.length - 1 ? 12 : 0, borderBottom: i < recentActivity.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                    <div style={{ position: 'absolute', left: -20, top: 5, width: 8, height: 8, borderRadius: '50%', background: i < 3 ? 'var(--color-primary)' : 'var(--color-border)', border: '2px solid var(--color-surface)' }} />
                    <div style={{ fontSize: 11, color: mutedColor }}>
                      <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{a.moduleName}</span>
                      <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
                      <span>{a.date}</span>
                    </div>
                    <div className="truncate font-medium" style={{ fontSize: 13, color: textColor, marginTop: 2 }}>{a.title || a.moduleName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* 模块活跃度（独立面板） */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="panel">
          <div className="panel-header">
            <BarChart3 size={15} color="var(--color-success)" />
            <span className="font-semibold" style={{ fontSize: 14 }}>模块活跃度</span>
          </div>
          <div style={{ padding: '8px 12px', minHeight: 200 }}>
            {moduleBarData.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: mutedColor, fontSize: 12 }}>暂无数据</div>
            ) : (
              <EChartBox option={barOption} style={{ height: 220 }} />
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
