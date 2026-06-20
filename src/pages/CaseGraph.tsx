/**
 * 案件关系图谱 — graph-npm 风格
 * 经典力导向图：圆形节点、分类着色、径向渐变、关联高亮
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import * as echarts from 'echarts';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';

interface GraphNode { id: string; name: string; category: number; symbolSize: number; value: number; }
interface GraphLink { source: string; target: string; }

const CATS = [
  { name: '案件', color: '#6366F1' },
  { name: '嫌疑人', color: '#F43F5E' },
  { name: '证据/线索', color: '#10B981' },
];

export default function CaseGraph() {
  const darkMode = useAppStore((s) => s.darkMode);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts>();
  const [search, setSearch] = useState('');
  const [full, setFull] = useState(false);
  const [rk, setRk] = useState(0);
  const records = useMemo(() => { void rk; return getMassRecords(); }, [rk]);

  const { nodes, links, stats } = useMemo(() => {
    const nm = new Map<string, GraphNode>();
    const ls = new Set<string>();
    const ll: GraphLink[] = [];
    let c = 0, s = 0, e = 0;
    const addN = (id: string, name: string, cat: number, sz: number) => {
      if (nm.has(id)) { const n = nm.get(id)!; n.value++; n.symbolSize = Math.min(n.symbolSize + 4, 60); }
      else { nm.set(id, { id, name, category: cat, symbolSize: sz, value: 1 }); if (cat === 0) c++; else if (cat === 1) s++; else e++; }
    };
    const addL = (a: string, b: string) => { const k = `${a}-${b}`; if (!ls.has(k) && a !== b) { ls.add(k); ll.push({ source: a, target: b }); } };
    for (const r of records) {
      const d = r.data || {};
      const cn = String(d.caseName || '').trim();
      const cl = String(d.clueName || d.projectName || '').trim();
      if (cn) addN(`c-${cn}`, cn.length > 10 ? cn.slice(0, 10) + '…' : cn, 0, 40);
      if (cl) { addN(`e-${cl}`, cl.length > 10 ? cl.slice(0, 10) + '…' : cl, 2, 24); if (cn) addL(`c-${cn}`, `e-${cl}`); }

      // 提取嫌疑人：支持所有可能的数据位置
      const suspectNames = new Set<string>();
      const topSuspect = String(d.suspect || d.suspectName || '').trim();
      if (topSuspect) suspectNames.add(topSuspect);
      // suspects repeatable section
      if (Array.isArray(d.suspects)) {
        for (const item of d.suspects) {
          const name = String(item?.suspectName || item?.suspect || '').trim();
          if (name) suspectNames.add(name);
        }
      }
      // coerciveMeasures repeatable section（强制措施模块的嫌疑人）
      if (Array.isArray(d.coerciveMeasures)) {
        for (const item of d.coerciveMeasures) {
          const name = String(item?.suspect || item?.suspectName || '').trim();
          if (name) suspectNames.add(name);
        }
      }
      // 其他可能包含嫌疑人的 repeatable section
      for (const key of Object.keys(d)) {
        if (key === 'suspects' || key === 'coerciveMeasures') continue;
        const val = d[key];
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          for (const item of val) {
            const name = String((item as any)?.suspectName || (item as any)?.suspect || '').trim();
            if (name) suspectNames.add(name);
          }
        }
      }
      for (const sn of suspectNames) {
        addN(`s-${sn}`, sn.length > 10 ? sn.slice(0, 10) + '…' : sn, 1, 30);
        if (cn) addL(`c-${cn}`, `s-${sn}`);
      }
    }
    return { nodes: Array.from(nm.values()), links: ll, stats: { cases: c, suspects: s, clues: e } };
  }, [records]);

  useEffect(() => {
    if (!chartRef.current) return;
    const ch = echarts.init(chartRef.current);
    chartInstance.current = ch;
    const h = () => ch.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); ch.dispose(); };
  }, []);

  useEffect(() => {
    const ch = chartInstance.current;
    if (!ch) return;
    const dk = darkMode;

    ch.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: dk ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)',
        borderColor: dk ? '#334155' : '#e2e8f0', borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: dk ? '#e2e8f0' : '#1e293b', fontSize: 13 },
        extraCssText: 'backdrop-filter:blur(8px);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);',
        formatter: (p: any) => {
          if (p.dataType !== 'node') return '';
          const cat = CATS[p.data.category];
          return `<b>${p.name}</b><br/><span style="color:${cat?.color}">●</span> ${cat?.name}　关联 ${p.data.value} 条`;
        },
      },
      legend: {
        data: CATS.map(c => c.name),
        top: 10, left: 'center',
        textStyle: { color: dk ? '#94a3b8' : '#64748b', fontSize: 12 },
        itemWidth: 14, itemHeight: 14, itemGap: 20, icon: 'circle',
      },
      animationDuration: 1500,
      animationEasingUpdate: 'quinticInOut',
      series: [{
        type: 'graph',
        layout: 'force',
        data: nodes.map(n => ({
          ...n,
          label: {
            show: true, position: 'right', fontSize: 12, fontWeight: 600,
            color: dk ? '#e2e8f0' : '#1e293b',
            formatter: (p: any) => p.name,
          },
          itemStyle: {
            color: CATS[n.category]?.color || '#999',
            borderColor: dk ? 'rgba(255,255,255,0.15)' : '#fff',
            borderWidth: 3,
            shadowBlur: 16,
            shadowColor: (CATS[n.category]?.color || '#999') + '50',
          },
        })),
        links: links.map(l => ({
          ...l,
          lineStyle: {
            color: dk ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.2)',
            width: 2.5, curveness: 0.15,
          },
        })),
        categories: CATS.map(c => ({ name: c.name, itemStyle: { color: c.color, shadowBlur: 8, shadowColor: c.color + '40' } })),
        roam: true, draggable: true,
        force: { repulsion: 280, edgeLength: [100, 220], gravity: 0.08 },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 4, opacity: 0.8 },
          itemStyle: { shadowBlur: 24, shadowColor: 'rgba(0,0,0,0.2)' },
        },
        blur: { itemStyle: { opacity: 0.15 }, label: { opacity: 0.2 } },
      }],
    }, true);

    if (search) {
      const mid = new Set(nodes.filter(n => n.name.toLowerCase().includes(search.toLowerCase())).map(n => n.id));
      if (mid.size > 0) ch.setOption({ series: [{ data: nodes.map(n => ({ ...n, itemStyle: { opacity: mid.has(n.id) ? 1 : 0.08 } })) }] });
    }
  }, [nodes, links, darkMode, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex-between">
        <div className="flex items-center gap-3">
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #5470c6, #91cc75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(84,112,198,0.3)',
          }}>
            <GitBranch size={22} color="#fff" />
          </div>
          <div>
            <div className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>案件图谱</div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>拖拽节点 · 滚轮缩放 · 悬停查看关联</div>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索节点..."
            style={{
              height: 34, paddingInline: 12, borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text)',
              fontSize: 13, width: 160, outline: 'none', fontFamily: 'inherit',
            }} />
          <button className="btn btn-ghost" onClick={() => setRk(k => k + 1)}><RefreshCw size={14} /></button>
          <button className="btn btn-ghost" onClick={() => setFull(v => !v)}>{full ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
        </div>
      </motion.div>

      <div className="flex gap-3">
        {[
          { label: '案件', value: stats.cases, color: '#5470c6' },
          { label: '嫌疑人', value: stats.suspects, color: '#91cc75' },
          { label: '证据/线索', value: stats.clues, color: '#fac858' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 20px', flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}50` }} />
            <div>
              <div className="stat-value" style={{ fontSize: 20, color: s.color }}>{s.value}</div>
              <div className="stat-label" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="panel" style={{ overflow: 'hidden' }}>
        {nodes.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🕸️</div>
            <div className="text-lg font-semibold" style={{ marginBottom: 8, color: 'var(--color-text)' }}>暂无关联数据</div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>录入案件和嫌疑人信息后将自动生成关系图谱</div>
          </div>
        ) : (
          <div ref={chartRef} style={{ width: '100%', height: full ? 'calc(100vh - 280px)' : 'min(520px, 60vh)', transition: 'height 0.3s' }} />
        )}
      </motion.div>
    </div>
  );
}
