/**
 * 案件关系图谱 — 高级现代风重设计
 * - 真实缩放（zoom 控件 + 全屏 resize 联动，修复"虚假放大/拖动消失"）
 * - 多布局模式：力导向 / 环形 / 分簇 / 辐射
 * - 分类过滤、搜索高亮、节点详情抽屉、导出图片
 */
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, RefreshCw, Maximize2, Minimize2, Search, Download, ZoomIn, ZoomOut, Maximize as FitIcon, Network, CircleDot, Users, FileSearch, Workflow, Radiation } from 'lucide-react';
import * as echarts from '../lib/echarts';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';

interface GraphNode { id: string; name: string; category: number; symbolSize: number; value: number; }
interface GraphLink { source: string; target: string; }

type LayoutMode = 'force' | 'circular' | 'cluster' | 'radial';

const CATS = [
  { name: '案件', color: '#6366F1' },
  { name: '嫌疑人', color: '#F43F5E' },
  { name: '证据/线索', color: '#10B981' },
];

const LAYOUTS: { id: LayoutMode; label: string; icon: typeof Network }[] = [
  { id: 'force', label: '力导向', icon: Workflow },
  { id: 'circular', label: '环形', icon: CircleDot },
  { id: 'cluster', label: '分簇', icon: Network },
  { id: 'radial', label: '辐射', icon: Radiation },
];

/** 嫌疑人条目可能的名称字段（结构化收敛自 any） */
type SuspectLike = { suspectName?: string; suspect?: string };

/** echarts formatter 回调参数 */
interface EChartsParam {
  name: string;
  dataIndex: number;
  dataType?: string;
  data?: unknown;
  value?: unknown;
}

/** 节点外观样式（两处复用，保证搜索/主渲染一致） */
function nodeItemStyle(n: GraphNode, dk: boolean) {
  const color = CATS[n.category]?.color || '#999';
  return {
    color,
    borderColor: dk ? 'rgba(255,255,255,0.18)' : '#fff',
    borderWidth: 3,
    shadowBlur: 16,
    shadowColor: color + '50',
  };
}

/** 为「分簇 / 辐射」布局计算像素坐标（围绕原点，便于 zoom/center 居中） */
function computePositions(nodes: GraphNode[], mode: LayoutMode): Map<string, { x: number; y: number }> {
  const byCat: Record<number, GraphNode[]> = { 0: [], 1: [], 2: [] };
  nodes.forEach((n) => (byCat[n.category] || (byCat[n.category] = [])).push(n));
  const map = new Map<string, { x: number; y: number }>();

  const placeGrid = (arr: GraphNode[], originX: number, cols: number, colGap: number, rowGap: number) => {
    const rows = Math.max(1, Math.ceil(arr.length / cols));
    arr.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      map.set(node.id, { x: originX + col * colGap, y: (row - (rows - 1) / 2) * rowGap });
    });
  };
  const placeRing = (arr: GraphNode[], radius: number) => {
    const n = arr.length;
    arr.forEach((node, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      map.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    });
  };

  if (mode === 'cluster') {
    // 三列纵向居中：案件(左) / 证据线索(中) / 嫌疑人(右)
    placeGrid(byCat[0] || [], -560, 2, 160, 92);
    placeGrid(byCat[2] || [], 0, 4, 130, 78);
    placeGrid(byCat[1] || [], 560, 3, 150, 84);
  } else {
    // 辐射：案件内环、证据线索中环、嫌疑人外环
    placeRing(byCat[0] || [], 80);
    placeRing(byCat[2] || [], 300);
    placeRing(byCat[1] || [], 470);
  }
  return map;
}

export default function CaseGraph() {
  const darkMode = useAppStore((s) => s.darkMode);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const positionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);
  const metaRef = useRef<Map<string, string[]>>(new Map());
  const degreeRef = useRef<Map<string, number>>(new Map());

  const [search, setSearch] = useState('');
  const [full, setFull] = useState(false);
  const [rk, setRk] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [layout, setLayout] = useState<LayoutMode>('force');
  const [activeCats, setActiveCats] = useState<Set<number>>(new Set([0, 1, 2]));
  const [selectedNode, setSelectedNode] = useState<{ id: string; name: string; category: number; degree: number; cases: string[] } | null>(null);

  const records = useMemo(() => { void rk; return getMassRecords(); }, [rk]);

  // M-9：搜索防抖
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { nodes, links, stats, nodeMeta, degree } = useMemo(() => {
    const nm = new Map<string, GraphNode>();
    const ls = new Set<string>();
    const ll: GraphLink[] = [];
    const mc = new Map<string, Set<string>>(); // nodeId -> 关联案件名
    let c = 0, s = 0, e = 0;
    const addN = (id: string, name: string, cat: number, sz: number) => {
      if (nm.has(id)) { const n = nm.get(id)!; n.value++; n.symbolSize = Math.min(n.symbolSize + 4, 60); }
      else { nm.set(id, { id, name, category: cat, symbolSize: sz, value: 1 }); if (cat === 0) c++; else if (cat === 1) s++; else e++; }
    };
    const addL = (a: string, b: string) => { const k = `${a}-${b}`; if (!ls.has(k) && a !== b) { ls.add(k); ll.push({ source: a, target: b }); } };
    const tagCase = (id: string, cn: string) => { if (!mc.has(id)) mc.set(id, new Set()); if (cn) mc.get(id)!.add(cn); };

    for (const r of records) {
      const d = r.data || {};
      const cn = String(d.caseName || '').trim();
      const cl = String(d.clueName || d.projectName || '').trim();
      if (cn) { addN(`c-${cn}`, cn.length > 10 ? cn.slice(0, 10) + '…' : cn, 0, 40); tagCase(`c-${cn}`, cn); }
      if (cl) { addN(`e-${cl}`, cl.length > 10 ? cl.slice(0, 10) + '…' : cl, 2, 24); if (cn) { addL(`c-${cn}`, `e-${cl}`); tagCase(`e-${cl}`, cn); } }

      const suspectNames = new Set<string>();
      const topSuspect = String(d.suspect || d.suspectName || '').trim();
      if (topSuspect) suspectNames.add(topSuspect);
      if (Array.isArray(d.suspects)) for (const item of d.suspects) { const name = String(item?.suspectName || item?.suspect || '').trim(); if (name) suspectNames.add(name); }
      if (Array.isArray(d.coerciveMeasures)) for (const item of d.coerciveMeasures) { const name = String(item?.suspect || item?.suspectName || '').trim(); if (name) suspectNames.add(name); }
      for (const key of Object.keys(d)) {
        if (key === 'suspects' || key === 'coerciveMeasures') continue;
        const val = d[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          for (const item of val) { const name = String((item as SuspectLike)?.suspectName || (item as SuspectLike)?.suspect || '').trim(); if (name) suspectNames.add(name); }
        }
      }
      for (const sn of suspectNames) {
        addN(`s-${sn}`, sn.length > 10 ? sn.slice(0, 10) + '…' : sn, 1, 30);
        if (cn) { addL(`c-${cn}`, `s-${sn}`); tagCase(`s-${sn}`, cn); }
      }
    }

    const degree = new Map<string, number>();
    for (const l of ll) { degree.set(l.source, (degree.get(l.source) || 0) + 1); degree.set(l.target, (degree.get(l.target) || 0) + 1); }
    const meta = new Map<string, string[]>();
    for (const [id, set] of mc) meta.set(id, Array.from(set));

    return { nodes: Array.from(nm.values()), links: ll, stats: { cases: c, suspects: s, clues: e }, nodeMeta: meta, degree };
  }, [records]);

  const displayNodes = useMemo(() => nodes.filter((n) => activeCats.has(n.category)), [nodes, activeCats]);
  const displayLinks = useMemo(() => {
    const ids = new Set(displayNodes.map((n) => n.id));
    return links.filter((l) => ids.has(l.source) && ids.has(l.target));
  }, [links, displayNodes]);

  // 初始化 + ResizeObserver（修复：容器尺寸变化<含全屏>必须同步 resize 画布）
  useEffect(() => {
    if (!chartRef.current) return;
    const ch = echarts.init(chartRef.current);
    chartInstance.current = ch;

    const ro = new ResizeObserver(() => ch.resize());
    ro.observe(chartRef.current);
    const onWin = () => ch.resize();
    window.addEventListener('resize', onWin);

    ch.on('click', (params: echarts.ECElementEvent) => {
      if (params.dataType === 'node' && params.data) {
        const data = params.data as { id: string; name: string; category: number };
        setSelectedNode({ id: data.id, name: data.name, category: data.category, degree: degreeRef.current.get(data.id) ?? 0, cases: metaRef.current.get(data.id) ?? [] });
      } else if (params.dataType !== 'edge') {
        setSelectedNode(null);
      }
    });

    return () => { ro.disconnect(); window.removeEventListener('resize', onWin); ch.dispose(); chartInstance.current = null; };
  }, []);

  // 主渲染：随数据/主题/布局/过滤变化重绘
  useEffect(() => {
    const ch = chartInstance.current;
    if (!ch) return;
    const dk = darkMode;
    const nonePositions = layout === 'cluster' || layout === 'radial' ? computePositions(displayNodes, layout) : null;
    positionsRef.current = nonePositions;
    metaRef.current = nodeMeta;
    degreeRef.current = degree;

    const echLayout = layout === 'force' ? 'force' : layout === 'circular' ? 'circular' : 'none';

    ch.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: dk ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)',
        borderColor: dk ? '#334155' : '#e2e8f0', borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: dk ? '#e2e8f0' : '#1e293b', fontSize: 13 },
        extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);',
        formatter: (p: EChartsParam) => {
          if (p.dataType !== 'node') return '';
          const node = p.data as { category?: number; value?: number };
          const cat = CATS[node.category ?? 0];
          return `<b>${p.name}</b><br/><span style="color:${cat?.color}">●</span> ${cat?.name}　关联 ${node.value ?? 0} 条`;
        },
      },
      legend: {
        data: CATS.filter((_, i) => activeCats.has(i)).map((c) => c.name),
        top: 12, left: 'center',
        textStyle: { color: dk ? '#94a3b8' : '#64748b', fontSize: 12 },
        itemWidth: 14, itemHeight: 14, itemGap: 20, icon: 'circle',
      },
      animationDuration: 1200,
      animationEasingUpdate: 'quinticInOut',
      series: [{
        type: 'graph',
        layout: echLayout,
        zoom,
        center: ['50%', '50%'],
        label: {
          show: true, position: 'right', fontSize: 12, fontWeight: 600,
          color: dk ? '#e2e8f0' : '#1e293b',
          formatter: (p: EChartsParam) => p.name,
        },
        data: displayNodes.map((n) => ({
          ...n,
          x: nonePositions?.get(n.id)?.x,
          y: nonePositions?.get(n.id)?.y,
          itemStyle: nodeItemStyle(n, dk),
        })),
        links: displayLinks.map((l) => ({
          ...l,
          lineStyle: { color: dk ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.22)', width: 2.5, curveness: 0.15 },
        })),
        categories: CATS.map((c) => ({ name: c.name, itemStyle: { color: c.color, shadowBlur: 8, shadowColor: c.color + '40' } })),
        roam: true, draggable: true,
        force: { repulsion: 320, edgeLength: [90, 200], gravity: 0.08, layoutAnimation: true },
        circular: { rotateLabel: true },
        emphasis: { focus: 'adjacency', lineStyle: { width: 4, opacity: 0.85 }, itemStyle: { shadowBlur: 26, shadowColor: 'rgba(0,0,0,0.2)' } },
        blur: { itemStyle: { opacity: 0.12 }, label: { opacity: 0.18 } },
      }],
    }, true);

    // 搜索高亮：仅改透明度，不重建布局
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      const mid = new Set(displayNodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id));
      ch.setOption({ series: [{ data: displayNodes.map((n) => ({ ...n, x: nonePositions?.get(n.id)?.x, y: nonePositions?.get(n.id)?.y, itemStyle: { ...nodeItemStyle(n, dk), opacity: mid.has(n.id) ? 1 : 0.08 } })) }] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayNodes, displayLinks, darkMode, layout, nodeMeta, rk]);

  // 缩放：独立 merge，不触发力导向重排
  useEffect(() => {
    const ch = chartInstance.current;
    if (!ch) return;
    ch.setOption({ series: [{ zoom }] });
  }, [zoom]);

  // 切换布局时把视图缩放复位，避免坐标尺度错位
  const handleLayout = useCallback((m: LayoutMode) => {
    setLayout(m);
    setZoom(1);
    setSelectedNode(null);
  }, []);

  const toggleCat = (cat: number) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) { if (next.size > 1) next.delete(cat); }
      else next.add(cat);
      return next;
    });
  };

  const handleFit = () => {
    setZoom(1);
    const ch = chartInstance.current;
    if (ch) (ch.dispatchAction as (a: { type: string }) => void)({ type: 'restore' });
  };

  const handleExport = () => {
    const ch = chartInstance.current;
    if (!ch) return;
    const url = ch.getDataURL({ backgroundColor: darkMode ? '#0f172a' : '#ffffff', pixelRatio: 2, excludeComponents: ['toolbox'] });
    const a = document.createElement('a');
    a.href = url;
    a.download = `案件图谱_${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  const statsCards = [
    { label: '案件', value: stats.cases, color: '#6366F1', bg: 'rgba(99,102,241,0.12)', icon: FileSearch },
    { label: '嫌疑人', value: stats.suspects, color: '#F43F5E', bg: 'rgba(244,63,94,0.12)', icon: Users },
    { label: '证据/线索', value: stats.clues, color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: CircleDot },
  ];

  return (
    <div className="graph-page">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="graph-head">
        <div className="graph-head-ico"><GitBranch size={23} color="#fff" /></div>
        <div>
          <div className="graph-head-title">案件图谱</div>
          <div className="graph-head-sub">拖拽节点 · 滚轮缩放 · 点击查看详情</div>
        </div>
      </motion.div>

      {/* 工具栏 */}
      <div className="graph-toolbar">
        <div className="gt-group">
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: 11, color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
            <input
              className="gt-search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索节点..." style={{ paddingLeft: 32 }}
            />
          </div>
        </div>

        <div className="gt-divider" />

        <div className="gt-group">
          <span className="gt-label">布局</span>
          <div className="seg">
            {LAYOUTS.map((l) => {
              const Icon = l.icon;
              return (
                <button key={l.id} className={`seg-btn ${layout === l.id ? 'active' : ''}`} onClick={() => handleLayout(l.id)}>
                  <Icon size={14} />{l.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="gt-divider" />

        <div className="gt-group">
          <span className="gt-label">筛选</span>
          {CATS.map((cat, i) => (
            <button key={cat.name} className={`chip ${activeCats.has(i) ? '' : 'off'}`} onClick={() => toggleCat(i)}>
              <span className="dot" style={{ background: cat.color }} />{cat.name}
            </button>
          ))}
        </div>

        <div className="gt-spacer" />

        <div className="gt-group">
          <div className="zoom-ctrl">
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.3, +(z / 1.2).toFixed(2)))} title="缩小"><ZoomOut size={15} /></button>
            <span className="zoom-val">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.min(4, +(z * 1.2).toFixed(2)))} title="放大"><ZoomIn size={15} /></button>
            <button className="zoom-btn" onClick={handleFit} title="适应视图"><FitIcon size={15} /></button>
          </div>
        </div>

        <div className="gt-group">
          <button className="gt-btn" onClick={handleExport} title="导出图片"><Download size={16} /></button>
          <button className="gt-btn" onClick={() => { setRk((k) => k + 1); setSelectedNode(null); }} title="重新布局"><RefreshCw size={16} /></button>
          <button className={`gt-btn ${full ? 'active' : ''}`} onClick={() => setFull((v) => !v)} title="全屏画布">
            {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* 统计卡 */}
      <div className="dash-kpi">
        {statsCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="wb-kpi">
              <div className="graph-stat-ico" style={{ background: s.bg, color: s.color }}><Icon size={22} /></div>
              <div>
                <div className="wb-kpi-val" style={{ color: s.color }}>{s.value}</div>
                <div className="wb-kpi-label">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 画布 */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="wb-panel graph-canvas-panel">
        {nodes.length === 0 ? (
          <div style={{ padding: 90, textAlign: 'center' }}>
            <div style={{ fontSize: 50, marginBottom: 16 }}>🕸️</div>
            <div className="text-lg font-semibold" style={{ marginBottom: 8, color: 'var(--color-text)' }}>暂无关联数据</div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>录入案件和嫌疑人信息后将自动生成关系图谱</div>
          </div>
        ) : (
          <div className="graph-canvas-wrap" style={{ borderRadius: 'inherit' }}>
            <div ref={chartRef} className={`graph-canvas ${full ? 'full' : ''}`} />
            {selectedNode && (
              <div className="graph-detail">
                <button className="graph-detail-close" onClick={() => setSelectedNode(null)}><Minimize2 size={14} /></button>
                <div className="graph-detail-name">{selectedNode.name}</div>
                <div className="graph-detail-cat" style={{ color: CATS[selectedNode.category]?.color }}>
                  <span className="dot" style={{ width: 9, height: 9, borderRadius: '50%', background: CATS[selectedNode.category]?.color }} />
                  {CATS[selectedNode.category]?.name}
                </div>
                <div className="graph-detail-meta">
                  <div className="m"><div className="m-val">{selectedNode.degree}</div><div className="m-label">关联节点</div></div>
                  <div className="m"><div className="m-val">{selectedNode.cases.length}</div><div className="m-label">关联案件</div></div>
                </div>
                <div className="graph-detail-sec-title">关联案件</div>
                {selectedNode.cases.length === 0 ? (
                  <div className="graph-detail-empty">无直接关联案件</div>
                ) : (
                  selectedNode.cases.map((cn, i) => (
                    <div key={i} className="graph-detail-case"><span className="cdot" />{cn}</div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
