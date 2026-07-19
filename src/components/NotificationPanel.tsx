/**
 * 快捷操作面板
 * 右侧可收起面板，显示快捷入口 + 系统状态（与工作台不重复）
 */
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Gavel, FileText, Shield, Database, Search, Scale, Zap } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';
import { useDataChanged } from '../store/dataEvents';

const QUICK_MODULES = [
  { id: 'legal-report-case', label: '接报案', icon: FileText, color: '#F59E0B' },
  { id: 'squad-case', label: '中队案件', icon: Gavel, color: '#8B5CF6' },
  { id: 'squad-coercive', label: '强制措施', icon: Shield, color: '#EF4444' },
  { id: 'evidence-clue', label: '线索登记', icon: Search, color: '#10B981' },
  { id: 'evidence-freeze', label: '资金查控', icon: Database, color: '#3B82F6' },
  { id: 'office-finance-assets', label: '经费保障', icon: Scale, color: '#EC4899' },
];

export default function NotificationPanel() {
  const [collapsed, setCollapsed] = useState(true);
  const darkMode = useAppStore((s) => s.darkMode);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);

  // 系统状态
  const dataVersion = useDataChanged();
  const stats = useMemo(() => {
    const records = getMassRecords();
    const total = records.length;
    const thisMonth = records.filter(r => r.createdAt?.startsWith(new Date().toISOString().slice(0, 7))).length;
    const completed = records.filter(r => r.data?.status === '已完成' || r.data?.status === '已办结').length;
    const moduleCount = new Set(records.map(r => r.moduleId)).size;
    return { total, thisMonth, completed, rate: total > 0 ? Math.round(completed / total * 100) : 0, modules: moduleCount };
  }, [dataVersion]);

  const handleModuleClick = (moduleId: string) => {
    setCurrentPage(moduleId);
    setTimeout(() => openModal('newRecord'), 100);
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0, zIndex: 50 }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setCollapsed(v => !v)}
        style={{
          position: 'absolute', left: -32, top: 12,
          width: 28, height: 28, padding: 0, borderRadius: '6px 0 0 6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 51,
        }}
        title={collapsed ? '展开快捷面板' : '收起快捷面板'}
      >
        {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{
              height: '100%', overflow: 'hidden',
              background: darkMode ? 'var(--color-surface)' : '#fff',
              borderLeft: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* 快捷模块入口 */}
            <div style={{ padding: '14px 14px 8px' }}>
              <div className="text-xs font-semibold text-muted" style={{ marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Zap size={12} style={{ marginRight: 4, verticalAlign: -1 }} />快捷新建
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {QUICK_MODULES.map(m => {
                  const Icon = m.icon;
                  return (
                    <div
                      key={m.id}
                      className="hover-bg"
                      onClick={() => handleModuleClick(m.id)}
                      style={{
                        padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        background: darkMode ? 'transparent' : `${m.color}08`,
                        border: `1px solid ${darkMode ? 'var(--color-border)' : m.color + '15'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${m.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={15} color={m.color} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text)' }}>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 系统状态 */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border-light)', flex: 1 }}>
              <div className="text-xs font-semibold text-muted" style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📊 数据概览
              </div>
              {[
                { label: '总记录', value: stats.total, color: 'var(--color-primary)' },
                { label: '本月新增', value: stats.thisMonth, color: 'var(--color-success)' },
                { label: '已完成', value: stats.completed, color: 'var(--color-info)' },
                { label: '完成率', value: `${stats.rate}%`, color: 'var(--color-warning)' },
                { label: '活跃模块', value: stats.modules, color: '#8B5CF6' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-border-light)' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
