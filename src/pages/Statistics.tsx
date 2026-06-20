import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, FileText, Check, Users, Paperclip, TrendingUp, TrendingDown, Download } from 'lucide-react';
import * as echarts from 'echarts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useAppStore } from "../store/appStore"
import { getMassRecords } from '../store/massStore';
import { getBaseModules } from '../moduleConfig';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } } };

/** 简单的 ECharts 包装组件 */
function EChartBox({ option, style }: { option: Record<string, unknown>; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option, true);
    const h = () => chart.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); chart.dispose(); };
  }, [option]);
  return <div ref={ref} style={{ width: '100%', ...style }} />;
}

export default function Statistics() {
  const showToast = useAppStore((s) => s.showToast);
  const darkMode = useAppStore((s) => s.darkMode);
  const dk = darkMode;

  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { setRefreshKey(k => k + 1); }, []);

  const [records, setRecords] = useState(() => getMassRecords());
  const [cases, setCases] = useState(() => getMassRecords('squad-case'));
  useEffect(() => {
    setRecords(getMassRecords());
    setCases(getMassRecords('squad-case'));
  }, [refreshKey]);
  useEffect(() => {
    const onFocus = () => { setRecords(getMassRecords()); setCases(getMassRecords('squad-case')); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const modules = useMemo(() => getBaseModules(), []);
  const moduleRecords: Record<string, number> = {};
  for (const r of records) moduleRecords[r.moduleId] = (moduleRecords[r.moduleId] || 0) + 1;

  const totalRecords = records.length;
  const totalCases = cases.length;
  const thisMonth = records.filter(r => r.createdAt?.startsWith(new Date().toISOString().slice(0, 7))).length;
  const lastMonth = records.filter(r => { const d = new Date(); d.setMonth(d.getMonth() - 1); return r.createdAt?.startsWith(d.toISOString().slice(0, 7)); }).length;

  const STATS = [
    { label: '总记录数', value: String(totalRecords + totalCases), change: `本月+${thisMonth}`, up: true, color: '#1B5E9B' },
    { label: '案件总数', value: String(totalCases), change: '累计案件', up: true, color: '#38A169' },
    { label: '本月新增', value: String(thisMonth), change: `上月${lastMonth}`, up: thisMonth >= lastMonth, color: '#00ACC1' },
    { label: '活跃模块', value: String(Object.keys(moduleRecords).length), change: '有数据模块', up: false, color: '#E67E22' },
  ];

  const rawModuleStats = modules.map(mod => ({ dept: mod.departmentLabel, type: mod.label, count: moduleRecords[mod.id] || 0 }));
  const moduleStats = rawModuleStats.filter(m => m.count > 0);
  const hasData = totalRecords > 0;

  const textColor = '#1F2937';
  const mutedColor = '#6B7280';
  const CHART_PALETTE = ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626', '#6D28D9', '#E11D48', '#0284C7', '#9333EA'];

  // 各模块记录对比 — dataset-encode0 风格柱状图
  const barData = moduleStats.slice(0, 10);
  const barOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const, axisPointer: { type: 'shadow' as const },
      backgroundColor: dk ? '#1a1d25' : '#fff',
      borderColor: dk ? '#374151' : '#E5E7EB',
      textStyle: { color: dk ? '#e2e2e6' : textColor },
    },
    grid: { left: 8, right: 30, top: 20, bottom: 8, containLabel: true },
    dataset: {
      source: barData.map((d, i) => ({
        module: d.type,
        dept: d.dept,
        count: d.count,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
      })).reverse(),
    },
    xAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: dk ? '#2a2e38' : '#F3F4F6' } },
      axisLabel: { color: dk ? '#6b7280' : mutedColor, fontSize: 10 },
    },
    yAxis: {
      type: 'category' as const,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: dk ? '#9ca3af' : mutedColor, fontSize: 11, width: 80, overflow: 'truncate' },
    },
    series: [{
      type: 'bar' as const,
      encode: { x: 'count', y: 'module' },
      barWidth: 18,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: (params: any) => {
          const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];
          return colors[params.dataIndex % colors.length];
        },
      },
      label: {
        show: true, position: 'right' as const, fontSize: 12, fontWeight: 700,
        color: dk ? '#e2e2e6' : textColor,
        formatter: (p: { value: { count: number } }) => String(p.value?.count ?? ''),
      },
      animationDuration: 800,
      animationEasing: 'cubicOut' as const,
    }],
  }), [barData, darkMode]);

  // 记录类型分布 — ECharts 玫瑰图
  const pieOption = useMemo(() => ({
    tooltip: { trigger: 'item' as const, backgroundColor: '#fff', borderColor: '#E5E7EB', textStyle: { color: textColor } },
    legend: { bottom: 0, textStyle: { color: mutedColor, fontSize: 10 }, type: 'scroll' as const },
    series: [{
      type: 'pie' as const,
      radius: ['28%', '62%'],
      center: ['50%', '45%'],
      roseType: 'area' as const,
      avoidLabelOverlap: true,
      padAngle: 2,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 10, color: mutedColor, lineHeight: 14 },
      labelLine: { length: 10, length2: 12, smooth: true },
      data: barData.length > 0
        ? barData.map((d, i) => ({ name: d.type, value: d.count, itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] } }))
        : [{ name: '暂无数据', value: 1, itemStyle: { color: '#E5E7EB' } }],
      animationDuration: 900,
      animationEasing: 'cubicOut' as const,
    }],
  }), [barData]);

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, #1B5E9B, #2E7DCA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(27,94,155,.3)' }}>
            <BarChart3 size={20} color="#fff" />
          </motion.div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text)' }}>数据统计</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>工作数据可视化分析 · 基于本地存储真实数据</div>
          </div>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => {
            const wb = XLSX.utils.book_new();
            const rows = moduleStats.map(m => ({ 部门: m.dept, 模块: m.type, 记录数: m.count }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '模块统计');
            saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `模块统计明细_${new Date().toISOString().slice(0,10)}.xlsx`);
            showToast('已导出 Excel', 'success');
          }}
          style={{ height: 34, padding: '0 16px', background: 'var(--color-surface)', color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
          <Download size={14} />导出报告
        </motion.button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={container} initial="hidden" animate="show"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {STATS.map((s, i) => (
          <motion.div key={s.label} variants={item} whileHover={{ y: -3 }}
            className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.color + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {i === 0 && <FileText size={19} color={s.color} />}
              {i === 1 && <Check size={19} color={s.color} />}
              {i === 2 && <Users size={19} color={s.color} />}
              {i === 3 && <Paperclip size={19} color={s.color} />}
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: s.up ? '#388E3C' : 'var(--color-text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                {s.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {s.change}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {hasData && (
        <>
          {/* ECharts Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            {/* 各模块记录对比 */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="card" style={{ padding: '14px 14px 6px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                各模块记录对比 <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 400 }}>单位：条记录</span>
              </div>
              <EChartBox option={barOption} style={{ height: 240 }} />
            </motion.div>

            {/* 记录类型分布 */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="card" style={{ padding: '14px 14px 6px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                记录类型分布 <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 400 }}>按数量占比</span>
              </div>
              <EChartBox option={pieOption} style={{ height: 240 }} />
            </motion.div>
          </div>

          {/* Module Stats Table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>各模块记录统计明细</div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => {
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(moduleStats.map(m => ({ 部门: m.dept, 模块: m.type, 记录数: m.count }))), '模块统计');
                saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `模块统计明细_${new Date().toISOString().slice(0,10)}.xlsx`);
                showToast('已导出 Excel', 'success');
              }}
                style={{ height: 30, padding: '0 12px', background: 'var(--color-surface)', color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)', borderRadius: 7, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
                <Download size={13} />导出
              </motion.button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'var(--color-surface-hover)' }}>
                    {['部门', '模块', '记录数', '操作'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {moduleStats.length > 0 ? moduleStats.map((row, i) => (
                    <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.04 }}
                      whileHover={{ background: 'var(--color-surface-hover)' }} style={{ borderBottom: '1px solid var(--color-surface-hover)' }}>
                      <td style={{ padding: '11px 14px', fontSize: 12.5 }}>{row.dept}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5 }}>{row.type}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, fontWeight: 600 }}>{row.count}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12.5, color: 'var(--color-text-muted)' }}>{row.count > 0 ? '有数据' : '无数据'}</td>
                    </motion.tr>
                  )) : (
                    <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>暂无数据，请先在工作模块中新建记录</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}

      {!hasData && (
        <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
          <BarChart3 size={48} color="var(--color-text-muted)" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>暂无统计数据</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>请先在各个工作模块中新建记录，统计数据将自动生成。</div>
        </div>
      )}
    </div>
  );
}
