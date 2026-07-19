/**
 * 工作台 Dashboard — 高级感现代风
 * 顶部欢迎区 + 快捷入口 · KPI 概览 · 待办预警 · 数据概览 · 最近动态 · 模块活跃度
 */
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, AlertTriangle, CheckCircle2,
  Activity, Zap, BarChart3, Plus, Network, CalendarClock, Waypoints, ArrowRight, Users,
} from "lucide-react";
import * as echarts from '../lib/echarts';
import { getMassRecords, getMassRecordById } from "../store/massStore";
import type { MassRecord } from "../store/massStore";
import { useAppStore } from "../store/appStore";
import { useDataChanged } from "../store/dataEvents";
import { MODULE_NAMES } from "../moduleConfig";
import EChartBox from "../components/EChartBox";
import { LEGAL_DEADLINE_RULES, getDeadlineSeverity } from '../constants/legalDeadlines';
import { daysBetween } from '../utils/format';
import { detectLinkageClusters, KEY_LABEL } from '../utils/caseLinkage';
import { buildMonthlyTrend, buildHandlerPerf } from '../utils/performanceStats';

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

function calcWarnings(records: MassRecord[]): WarnItem[] {
  const items: WarnItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const rule of LEGAL_DEADLINE_RULES) {
    for (const rec of records.filter((r) => rule.moduleIds.includes(r.moduleId))) {
      const raw = rec.data?.[rule.dateField];
      if (typeof raw !== 'string') continue;
      try {
        const deadline = rule.calcDeadline(raw);
        const remaining = daysBetween(today, new Date(deadline));
        if (remaining > 30) continue;
        const sev = getDeadlineSeverity(remaining);
        const severity: WarnItem['severity'] = sev === 'normal' ? 'warning' : sev;
        items.push({
          id: rec.id + rule.dateField + rule.label, recordId: rec.id, moduleId: rec.moduleId,
          caseName: String(rec.data?.caseName || rec.data?.reportMatter || rec.data?.suspect || '未命名').slice(0, 14),
          type: rule.label, deadline, remainingDays: remaining, severity,
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
      className="wb-kpi"
    >
      <div className="wb-kpi-ico" style={{ background: `${color}1A`, color }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div className="wb-kpi-label">{label}</div>
        <div className="wb-kpi-val">
          {value}
          <span className="wb-kpi-unit">{unit}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ===================== 面板头部 ===================== */

function PanelHead({ icon: Icon, color, tint, title, sub, extra }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string; tint: string; title: string; sub?: string; extra?: React.ReactNode;
}) {
  return (
    <div className="wb-panel-head">
      <div className="wb-panel-ico" style={{ background: tint, color }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, overflow: 'hidden' }}>
        <span className="wb-panel-title">{title}</span>
        {sub && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
      </div>
      {extra}
    </div>
  );
}

/* 顶部欢迎区实时时钟（精确到秒，独立重渲染不影响父组件） */
function HeroClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeStr = t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return <span>{timeStr}</span>;
}

/* ===================== 主组件 ===================== */

export default function Dashboard() {
  const darkMode = useAppStore((s) => s.darkMode);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const setEditRecord = useAppStore((s) => s.setEditRecord);
  const userName = useAppStore((s) => s.userName);
  const userBadge = useAppStore((s) => s.userBadge);
  const userDepartment = useAppStore((s) => s.userDepartment);
  // 依赖数据版本号：IndexedDB 就绪 / 数据变更后自动重读，避免“首页永远为 0”
  const dataVersion = useDataChanged();
  const records = useMemo(() => getMassRecords(), [dataVersion]);

  const warnings = useMemo(() => calcWarnings(records), [records]);
  const warnCounts = useMemo(() => {
    let overdue = 0, critical = 0, warning = 0;
    for (const w of warnings) {
      if (w.severity === 'overdue') overdue++;
      else if (w.severity === 'critical') critical++;
      else warning++;
    }
    return { overdue, critical, warning };
  }, [warnings]);
  const { overdue, critical } = warnCounts;

  const stats = useMemo(() => {
    const total = records.length;
    const completed = records.filter(r => r.data?.status === '已完成' || r.data?.status === '已办结').length;
    const toSupplement = records.filter(r => r.data?.status === '待补充').length;
    const inProgress = total - completed - toSupplement;
    const monthPrefix = new Date().toISOString().slice(0, 7);
    const thisMonth = records.filter(r => r.createdAt?.startsWith(monthPrefix)).length;
    return { total, completed, toSupplement, inProgress, thisMonth };
  }, [records]);
  const { total, completed, inProgress, thisMonth } = stats;

  const textColor = 'var(--color-text)';
  const mutedColor = 'var(--color-text-secondary)';

  // 模块记录统计
  const moduleRecords: Record<string, number> = {};
  for (const r of records) moduleRecords[r.moduleId] = (moduleRecords[r.moduleId] || 0) + 1;

  // 最近 8 条动态（按创建时间倒序，最新在前）
  const recentActivity = useMemo(() =>
    [...records]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 8)
      .map(r => ({
        id: r.id,
        moduleId: r.moduleId,
        moduleName: MODULE_NAMES[r.moduleId] || r.moduleId,
        title: String(r.data?.caseName || r.data?.suspect || r.data?.title || ''),
        date: r.createdAt?.slice(0, 10) || '',
      })),
    [records]
  );

  // 串并案线索（仅跨模块，取前 5，供工作台一屏预警）
  const linkageClusters = useMemo(
    () => detectLinkageClusters(records).filter((c) => c.isCrossModule).slice(0, 5),
    [records]
  );

  const handleWarnClick = (item: WarnItem) => {
    const rec = getMassRecordById(item.recordId);
    if (rec) { setEditRecord(rec); setCurrentPage(item.moduleId); openModal('newRecord'); }
  };

  const severityColors = {
    overdue: { bg: 'var(--color-danger-bg)', dot: 'var(--color-danger)', label: '已过期' },
    critical: { bg: 'var(--color-warning-bg)', dot: 'var(--color-warning)', label: '紧急' },
    warning: { bg: 'var(--color-info-bg)', dot: 'var(--color-info)', label: '注意' },
  };

  // 案件类型分布图表
  const caseTypes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of records) {
      const val = r.data?.caseType;
      if (typeof val === 'string' && val.trim()) map[val.trim()] = (map[val.trim()] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const PIE_PALETTE = ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#DB2777', '#4F46E5'];
  const BAR_PALETTE = ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626'];

  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, backgroundColor: darkMode ? '#1a1d25' : '#fff', borderColor: darkMode ? '#374151' : '#E5E7EB', textStyle: { color: textColor } },
    legend: { bottom: 0, textStyle: { color: mutedColor, fontSize: 10 }, type: 'scroll' as const },
    series: [{
      type: 'pie' as const, radius: ['32%', '66%'], center: ['50%', '44%'],
      avoidLabelOverlap: true, padAngle: 2,
      itemStyle: { borderRadius: 5, borderColor: darkMode ? '#1a1d25' : '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{c}', fontSize: 10, color: mutedColor, lineHeight: 14 },
      data: caseTypes.length > 0
        ? caseTypes.slice(0, 8).map(([name, value], i) => ({ name: name.length > 6 ? name.slice(0, 6) + '…' : name, value, itemStyle: { color: PIE_PALETTE[i % PIE_PALETTE.length] } }))
        : [{ name: '暂无数据', value: 1, itemStyle: { color: darkMode ? '#374151' : '#E5E7EB' } }],
      animationDuration: 800,
    }],
  }), [caseTypes, darkMode, textColor, mutedColor, PIE_PALETTE]);

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
    grid: { left: 10, right: 20, top: 16, bottom: 34, containLabel: true },
    xAxis: { type: 'category' as const, data: moduleBarData.map(d => d.name), axisLabel: { color: mutedColor, fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: darkMode ? '#374151' : '#E5E7EB' } } },
    yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: darkMode ? '#2a2e38' : '#F3F4F6' } }, axisLabel: { color: mutedColor, fontSize: 10 } },
    series: [{
      type: 'bar' as const,
      data: moduleBarData.map((d, i) => ({
        value: d.value,
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: BAR_PALETTE[i % BAR_PALETTE.length] },
            { offset: 1, color: BAR_PALETTE[i % BAR_PALETTE.length] + '33' },
          ]),
        },
      })),
      barWidth: 26,
      label: { show: true, position: 'top' as const, fontSize: 11, fontWeight: 600, color: textColor },
    }],
  }), [moduleBarData, darkMode, textColor, mutedColor, BAR_PALETTE]);

  // ── 趋势与绩效（P1-5） ──
  const monthlyTrend = useMemo(() => buildMonthlyTrend(records), [records]);

  // 超期记录集合（overdue / critical），供经办人超期率统计
  const overdueRecordIds = useMemo(
    () => new Set(warnings.filter((w) => w.severity === 'overdue' || w.severity === 'critical').map((w) => w.recordId)),
    [warnings]
  );
  const handlerPerf = useMemo(() => buildHandlerPerf(records, overdueRecordIds), [records, overdueRecordIds]);

  // 办案趋势：案件量（柱）+ 办结率（折线，右轴）
  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' as const, backgroundColor: darkMode ? '#1a1d25' : '#fff', borderColor: darkMode ? '#374151' : '#E5E7EB', textStyle: { color: textColor } },
    legend: { data: ['案件量', '办结率'], textStyle: { color: mutedColor, fontSize: 11 }, top: 2, right: 4 },
    grid: { left: 8, right: 14, top: 38, bottom: 26, containLabel: true },
    xAxis: { type: 'category' as const, data: monthlyTrend.map((d) => d.label), axisLabel: { color: mutedColor, fontSize: 10 }, axisLine: { lineStyle: { color: darkMode ? '#374151' : '#E5E7EB' } } },
    yAxis: [
      { type: 'value' as const, name: '件', nameTextStyle: { color: mutedColor, fontSize: 10 }, splitLine: { lineStyle: { color: darkMode ? '#2a2e38' : '#F3F4F6' } }, axisLabel: { color: mutedColor, fontSize: 10 } },
      { type: 'value' as const, name: '办结率', max: 100, nameTextStyle: { color: mutedColor, fontSize: 10 }, splitLine: { show: false }, axisLabel: { color: mutedColor, fontSize: 10, formatter: '{value}%' } },
    ],
    series: [
      {
        name: '案件量', type: 'bar' as const, yAxisIndex: 0, barWidth: 16,
        data: monthlyTrend.map((d) => d.count),
        itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#2563EB' }, { offset: 1, color: '#2563EB33' }]) },
      },
      {
        name: '办结率', type: 'line' as const, yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 6,
        data: monthlyTrend.map((d) => d.completionRate),
        lineStyle: { width: 2.5, color: '#059669' }, itemStyle: { color: '#059669' },
      },
    ],
  }), [monthlyTrend, darkMode, textColor, mutedColor]);

  // 欢迎区信息
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 6 ? '凌晨好' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const displayName = userName || '用户';
  const subParts = [userBadge ? `警号 ${userBadge}` : '', userDepartment, dateStr].filter(Boolean);
  const avatarText = (displayName || '用').slice(0, 1);

  /* ── 空状态 ── */
  if (total === 0) {
    return (
      <div className="dash">
        <div className="wb-panel" style={{ padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: 18, background: 'var(--color-primary-bg)', color: 'var(--color-primary)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <TrendingUp size={30} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: textColor, marginBottom: 8 }}>欢迎使用经侦工作台</div>
          <div style={{ fontSize: 13, color: mutedColor, marginBottom: 22 }}>开始录入工作记录后，这里会展示待办预警与统计概览</div>
          <button className="dash-action dash-action-primary" onClick={() => openModal('newRecord')} style={{ height: 42, paddingInline: 22, fontSize: 14 }}>
            <Plus size={16} /> 新建第一条记录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">

      {/* ── 顶部欢迎区 + 快捷入口 ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="dash-hero">
        <div className="dash-hero-avatar">{avatarText}</div>
        <div>
          <div className="dash-hero-greet">{greet}，{displayName}</div>
          <div className="dash-hero-sub">{subParts.join('　·　')}　·　<HeroClock /></div>
        </div>
        <div className="dash-hero-actions">
          <button className="dash-action dash-action-primary" onClick={() => openModal('newRecord')}>
            <Plus size={15} /> 新建记录
          </button>
          <button className="dash-action" onClick={() => setCurrentPage('graph')}>
            <Network size={15} color="var(--color-primary)" /> 案件图谱
          </button>
          <button className="dash-action" onClick={() => setCurrentPage('timeline')}>
            <CalendarClock size={15} color="var(--color-primary)" /> 案件时间轴
          </button>
        </div>
      </motion.div>

      {/* ── KPI 概览 ── */}
      <div className="dash-kpi">
        <KpiCard label="办理中" value={inProgress} unit="件" icon={Activity} color="#2563EB" delay={0} />
        <KpiCard label="即将到期" value={overdue + critical} unit="件" icon={AlertTriangle} color={overdue > 0 ? '#DC2626' : '#D97706'} delay={0.05} />
        <KpiCard label="已完成" value={completed} unit="件" icon={CheckCircle2} color="#059669" delay={0.1} />
        <KpiCard
          label="本月新增"
          value={thisMonth}
          unit="条"
          icon={TrendingUp}
          color="#7C3AED"
          delay={0.15}
        />
      </div>

      {/* ── 办案趋势（近 12 个月） ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="wb-panel">
        <PanelHead icon={TrendingUp} color="#7C3AED" tint="rgba(124,58,237,0.12)" title="办案趋势（近 12 个月）" sub="案件量 + 办结率" />
        <div className="wb-panel-body" style={{ minHeight: 240 }}>
          <EChartBox option={trendOption} style={{ height: 250 }} />
        </div>
      </motion.div>

      {/* ── 主内容区：待办预警 + 数据概览 ── */}
      <div className="dash-grid-2">

        {/* 待办预警 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="wb-panel">
          <PanelHead
            icon={AlertTriangle}
            color="var(--color-warning)"
            tint="var(--color-warning-bg)"
            title="待办预警"
            extra={warnings.length > 0 ? (
              <span className="badge badge-danger" style={{ marginLeft: 'auto' }}>{warnings.length} 项</span>
            ) : undefined}
          />
          <div style={{ maxHeight: 330, overflowY: 'auto' }}>
            {warnings.length === 0 ? (
              <div style={{ padding: 44, textAlign: 'center', color: mutedColor, fontSize: 13 }}>
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
                        padding: '11px 12px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>{item.caseName}</div>
                        <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{item.type}</div>
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

        {/* 数据概览 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="wb-panel">
          <PanelHead icon={Activity} color="var(--color-primary)" tint="var(--color-primary-bg)" title="数据概览" />
          <div className="wb-panel-body">
            <div className="wb-stat-grid">
              <div className="wb-stat">
                <div className="wb-stat-val" style={{ color: 'var(--color-primary)' }}>{total}</div>
                <div className="wb-stat-label">总记录</div>
              </div>
              <div className="wb-stat">
                <div className="wb-stat-val" style={{ color: 'var(--color-success)' }}>{completed}</div>
                <div className="wb-stat-label">已完成</div>
              </div>
              <div className="wb-stat">
                <div className="wb-stat-val" style={{ color: 'var(--color-info)' }}>{total > 0 ? Math.round(completed / total * 100) + '%' : '0%'}</div>
                <div className="wb-stat-label">完成率</div>
              </div>
            </div>
            <EChartBox option={pieOption} style={{ height: 210 }} />
          </div>
        </motion.div>
      </div>

      {/* ── 底部：最近动态 + 模块活跃度 ── */}
      <div className="dash-grid-2">

        {/* 最近动态 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="wb-panel">
          <PanelHead icon={Zap} color="var(--color-info)" tint="var(--color-info-bg)" title="最近动态" />
          <div style={{ maxHeight: 270, overflowY: 'auto', padding: '4px 0' }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: mutedColor, fontSize: 12 }}>暂无动态</div>
            ) : (
              <div style={{ position: 'relative', padding: '10px 18px 10px 36px' }}>
                <div style={{ position: 'absolute', left: 20, top: 14, bottom: 14, width: 1.5, background: 'var(--color-primary)', opacity: 0.22 }} />
                {recentActivity.map((a, i) => (
                  <div key={a.id} style={{ position: 'relative', paddingBottom: i < recentActivity.length - 1 ? 14 : 0, borderBottom: i < recentActivity.length - 1 ? '1px solid var(--color-border-light)' : 'none' }}>
                    <div style={{ position: 'absolute', left: -24, top: 6, width: 9, height: 9, borderRadius: '50%', background: i < 3 ? 'var(--color-primary)' : 'var(--color-border)', border: '2px solid var(--color-surface)' }} />
                    <div style={{ fontSize: 12, color: mutedColor }}>
                      <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{a.moduleName}</span>
                      <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
                      <span>{a.date}</span>
                    </div>
                    <div className="truncate font-medium" style={{ fontSize: 14, color: textColor, marginTop: 3 }}>{a.title || a.moduleName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* 模块活跃度 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="wb-panel">
          <PanelHead icon={BarChart3} color="var(--color-success)" tint="var(--color-success-bg)" title="模块活跃度" />
          <div className="wb-panel-body" style={{ minHeight: 210 }}>
            {moduleBarData.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: mutedColor, fontSize: 12 }}>暂无数据</div>
            ) : (
              <EChartBox option={barOption} style={{ height: 230 }} />
            )}
          </div>
        </motion.div>

        {/* 串并案线索 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="wb-panel">
          <PanelHead
            icon={Waypoints}
            color="#2563EB"
            tint="rgba(37,99,235,0.12)"
            title="串并案线索"
            extra={linkageClusters.length > 0 ? (
              <span className="badge badge-danger" style={{ marginLeft: 'auto' }}>{linkageClusters.length} 条</span>
            ) : undefined}
          />
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {linkageClusters.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: mutedColor, fontSize: 13 }}>
                暂无跨模块串并线索
              </div>
            ) : (
              linkageClusters.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setCurrentPage('linkage')}
                  className="hover-bg"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 4, borderRadius: 8, cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-bg)', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>{KEY_LABEL[c.keyType]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>{c.masked}</div>
                    <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{c.moduleNames.join(' · ')} · {c.count} 条</div>
                  </div>
                  <ArrowRight size={15} color="var(--color-text-muted)" />
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* ── 经办人绩效 ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="wb-panel">
        <PanelHead icon={Users} color="#0EA5E9" tint="rgba(14,165,233,0.12)" title="经办人绩效" sub="负责案件数 / 超期率" />
        <div className="wb-panel-body">
          {handlerPerf.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: mutedColor, fontSize: 13 }}>暂无经办人信息</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {handlerPerf.map((h) => {
                const rateColor = h.overdueRate >= 30 ? '#DC2626' : h.overdueRate > 0 ? '#D97706' : '#059669';
                const trackBg = darkMode ? 'rgba(255,255,255,0.1)' : '#F1F5F9';
                return (
                  <div key={h.handler} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="truncate" style={{ width: 84, flexShrink: 0, fontSize: 14, fontWeight: 500, color: textColor }}>{h.handler}</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: trackBg, overflow: 'hidden' }}>
                        <div style={{ width: `${h.overdueRate}%`, height: '100%', borderRadius: 4, background: rateColor, transition: 'width .3s' }} />
                      </div>
                      <div style={{ width: 168, flexShrink: 0, fontSize: 12, color: mutedColor, display: 'flex', justifyContent: 'space-between' }}>
                        <span>负责 {h.total}</span>
                        <span>超期 {h.overdue}</span>
                        <span style={{ color: rateColor, fontWeight: 600 }}>{h.overdueRate}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

    </div>
  );
}
