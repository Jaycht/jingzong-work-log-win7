import { useState } from 'react';
import { motion } from 'framer-motion';
import { History, User, FileText, Download } from 'lucide-react';
import { useAppStore } from "../store/appStore"
import { getOperationLogs, clearOperationLogs } from '../store/operationLogStore';
import { exportOperationLog } from '../utils/excelUtils';
import type { OperationLog as OpLog } from '../store/operationLogStore';

const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  create: { bg: '#E8F5E9', color: '#388E3C', label: '创建' },
  edit: { bg: '#EBF5FF', color: '#1B5E9B', label: '编辑' },
  export: { bg: '#FFF3E0', color: '#E67E22', label: '导出' },
  delete: { bg: '#FFEBEE', color: '#D32F2F', label: '删除' },
  login: { bg: '#F3E5F5', color: '#9C27B0', label: '登录' },
  logout: { bg: '#F3E5F5', color: '#9C27B0', label: '退出' },
  system: { bg: '#E0F7FA', color: '#00ACC1', label: '系统' },
  import: { bg: '#FFF3E0', color: '#E67E22', label: '导入' },
  backup: { bg: '#E0F7FA', color: '#00ACC1', label: '备份' },
};

export default function OperationLog() {
    const showToast = useAppStore((s) => s.showToast);
  const [, setRefreshKey] = useState(0);
  const [filterType, setFilterType] = useState<string>('全部');
  const [searchText, setSearchText] = useState('');

  const allLogs = getOperationLogs();
  let logs = allLogs;
  if (filterType !== '全部') {
    const typeMap: Record<string, OpLog['type']> = {
      '登录': 'login', '创建': 'create', '编辑': 'edit',
      '删除': 'delete', '导出': 'export', '系统': 'system',
    };
    const t = typeMap[filterType];
    if (t) logs = logs.filter((l) => l.type === t);
  }
  if (searchText.trim()) {
    const q = searchText.toLowerCase();
    logs = logs.filter((l) =>
      l.user.toLowerCase().includes(q) || l.action.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q)
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, #1B5E9B, #2E7DCA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(27,94,155,.3)' }}>
            <History size={20} color="#fff" />
          </motion.div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>操作日志</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>用户操作全程留痕 · 可追溯审计 · 数据安全保障</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => {
              clearOperationLogs();
              setRefreshKey(k => k + 1);
              showToast('操作日志已清空', 'success');
            }}
            style={{ height: 34, padding: '0 14px', background: 'var(--color-surface)', color: '#DC2626', border: '1.5px solid #DC2626', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
            清空日志
          </motion.button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => { showToast('正在导出日志...', 'info'); exportOperationLog(); }}
            style={{ height: 34, padding: '0 14px', background: 'var(--color-surface)', color: '#1B5E9B', border: '1.5px solid #1B5E9B', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
            <Download size={14} />导出日志
          </motion.button>
        </div>
      </motion.div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['全部', '登录', '创建', '编辑', '删除', '导出', '系统'].map((f) => (
          <button key={f}
            onClick={() => setFilterType(f)}
            style={{
              height: 30, padding: '0 14px',
              border: '1.5px solid ' + (f === filterType ? 'var(--color-primary)' : 'var(--color-border)'),
              background: f === filterType ? '#EBF5FF' : 'var(--color-surface)',
              color: f === filterType ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {f}
          </button>
        ))}
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索操作人 / 操作内容..."
          style={{ flex: 1, height: 30, padding: '0 10px', border: '1.5px solid var(--color-border)', borderRadius: 6, fontSize: 12, outline: 'none', fontFamily: 'inherit', maxWidth: 260 }}
        />
      </div>

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>共 <strong style={{ color: 'var(--color-text)' }}>{logs.length}</strong> 条操作记录</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>日志保留期限：最近 5000 条</div>
        </div>
        <div>
          {logs.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              暂无操作日志。开始使用系统后，操作记录将自动生成。
            </div>
          ) : logs.map((log, i) => (
            <motion.div
              key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.06 }}
              whileHover={{ background: 'var(--color-surface-hover)' }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < logs.length - 1 ? '1px solid var(--color-surface-hover)' : 'none' }}
            >
              {/* Timeline dot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: TYPE_COLORS[log.type as keyof typeof TYPE_COLORS].bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: TYPE_COLORS[log.type as keyof typeof TYPE_COLORS].color }}>
                    {TYPE_COLORS[log.type as keyof typeof TYPE_COLORS].label}
                  </span>
                </div>
                {i < logs.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--color-border)', minHeight: 20 }} />}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <User size={12} color="var(--color-text-muted)" />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)' }}>{log.user}</span>
                  <FileText size={12} color="var(--color-text-muted)" />
                  <span style={{ fontSize: 12.5, color: 'var(--color-text)' }}>{log.action}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginLeft: 20 }}>{log.detail}</div>
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{log.time}</span>
                <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>IP: {log.ip}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
