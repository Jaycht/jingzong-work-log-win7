/**
 * 全局命令面板 (Ctrl+K)
 * 搜索所有模块记录 + 快捷命令入口
 */
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, BarChart3, Download, Upload, Database, Clock, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';
import { MODULE_NAMES, DEPARTMENTS } from '../moduleConfig';

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  type: 'record' | 'action' | 'page';
  moduleId?: string;
  recordId?: string;
  action?: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const MODULE_ICONS: Record<string, string> = {
  'office': '🏢', 'mass': '👥', 'legal': '⚖️', 'squad': '🛡️', 'evidence': '🔍',
};

function getModuleEmoji(moduleId: string): string {
  const prefix = moduleId.split('-')[0];
  return MODULE_ICONS[prefix] || '📋';
}

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const setCurrentTabId = useAppStore((s) => s.setCurrentTabId);
  const setEditRecord = useAppStore((s) => s.setEditRecord);
  const records = useMemo(() => getMassRecords(), [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // 构建搜索结果
  const items = useMemo<CommandItem[]>(() => {
    const result: CommandItem[] = [];
    const kw = query.trim().toLowerCase();

    // 快捷命令
    const actions: CommandItem[] = [
      { id: 'act-new', label: '新建记录', sublabel: '打开新建表单', icon: <Plus size={16} />, type: 'action', action: () => { navigate('dashboard'); openModal('newRecord'); } },
      { id: 'act-stats', label: '统计分析', sublabel: '查看数据统计', icon: <BarChart3 size={16} />, type: 'page', action: () => navigate('statistics') },
      { id: 'act-import', label: '导入数据', sublabel: '从 Excel 导入', icon: <Upload size={16} />, type: 'page', action: () => navigate('importExport') },
      { id: 'act-export', label: '导出数据', sublabel: '导出 Excel', icon: <Download size={16} />, type: 'page', action: () => navigate('importExport') },
      { id: 'act-backup', label: '备份恢复', sublabel: '数据备份与恢复', icon: <Database size={16} />, type: 'page', action: () => navigate('backup') },
      { id: 'act-timeline', label: '案件时间轴', sublabel: '查看案件时间线', icon: <Clock size={16} />, type: 'page', action: () => navigate('timeline') },
    ];

    // 各模块快捷入口
    for (const dept of DEPARTMENTS) {
      for (const mod of dept.modules) {
        actions.push({
          id: `page-${mod.id}`,
          label: mod.label,
          sublabel: `${dept.label} · 新建${mod.label}`,
          icon: <span style={{ fontSize: 14 }}>{getModuleEmoji(mod.id)}</span>,
          type: 'page',
          moduleId: mod.id,
          action: () => {
            navigate(mod.id);
            setCurrentTabId(mod.tabs[0]?.id || '');
            setTimeout(() => openModal('newRecord'), 100);
          },
        });
      }
    }

    if (!kw) return actions.slice(0, 12);

    // 命令过滤
    const matchedActions = actions.filter((a) =>
      a.label.toLowerCase().includes(kw) || (a.sublabel && a.sublabel.toLowerCase().includes(kw))
    );

    // 记录搜索
    const matchedRecords: CommandItem[] = [];
    for (const rec of records) {
      const data = rec.data || {};
      const searchText = [
        data.caseName, data.caseNo, data.suspect, data.suspectName,
        data.title, data.name, data.handler, data.projectName, data.clueName,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchText.includes(kw)) continue;
      const moduleName = MODULE_NAMES[rec.moduleId] || rec.moduleId;
      matchedRecords.push({
        id: `rec-${rec.id}`,
        label: String(data.caseName || data.suspect || data.title || data.name || moduleName),
        sublabel: `${moduleName} · ${new Date(rec.updatedAt).toLocaleDateString('zh-CN')}`,
        icon: <span style={{ fontSize: 14 }}>{getModuleEmoji(rec.moduleId)}</span>,
        type: 'record',
        moduleId: rec.moduleId,
        recordId: rec.id,
        action: () => {
          setEditRecord(rec);
          navigate(rec.moduleId);
          openModal('newRecord');
        },
      });
      if (matchedRecords.length >= 8) break;
    }

    return [...matchedActions.slice(0, 6), ...matchedRecords].slice(0, 12);
  }, [query, records, navigate, openModal, setCurrentTabId, setEditRecord]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  useEffect(() => { setSelectedIdx(0); }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[selectedIdx]) {
      e.preventDefault();
      items[selectedIdx].action?.();
      onClose();
    }
  }, [items, selectedIdx, onClose]);

  const typeLabels: Record<string, string> = { action: '快捷命令', page: '模块入口', record: '匹配记录' };
  let lastType = '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="command-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="command-panel"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 搜索输入 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--color-border-light)' }}>
              <Search size={18} color="var(--color-text-muted)" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="搜索案件名称、姓名、手机号、身份证号、模块..."
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 15, color: 'var(--color-text)', fontFamily: 'inherit',
                }}
              />
              <kbd style={{
                padding: '2px 6px', borderRadius: 4, fontSize: 11,
                background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)',
              }}>ESC</kbd>
            </div>

            {/* 结果列表 */}
            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '6px' }}>
              {items.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                  未找到匹配结果
                </div>
              ) : (
                items.map((item, idx) => {
                  const showTypeLabel = item.type !== lastType;
                  if (showTypeLabel) lastType = item.type;
                  const isSelected = idx === selectedIdx;
                  return (
                    <div key={item.id}>
                      {showTypeLabel && (
                        <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {typeLabels[item.type]}
                        </div>
                      )}
                      <div
                        onClick={() => { item.action?.(); onClose(); }}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                          background: isSelected ? 'var(--color-primary-bg)' : 'transparent',
                          transition: 'background 0.1s',
                        }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--color-primary)' : 'var(--color-surface-hover)', color: isSelected ? '#fff' : 'var(--color-text-secondary)', flexShrink: 0, transition: 'all 0.15s' }}>
                          {item.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                          {item.sublabel && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{item.sublabel}</div>}
                        </div>
                        {isSelected && <ArrowRight size={14} color="var(--color-primary)" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 底部提示 */}
            <div style={{ padding: '8px 18px', borderTop: '1px solid var(--color-border-light)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--color-text-muted)' }}>
              <span><kbd style={kbdStyle}>↑↓</kbd> 导航</span>
              <span><kbd style={kbdStyle}>Enter</kbd> 选择</span>
              <span><kbd style={kbdStyle}>Esc</kbd> 关闭</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: '1px 5px', borderRadius: 3, fontSize: 10,
  background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)',
  fontFamily: 'var(--font-mono)', marginRight: 3,
};
