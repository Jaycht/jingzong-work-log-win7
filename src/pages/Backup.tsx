import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Download, Upload, RefreshCw, Trash2, Clock, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { App } from 'antd';
import { useAppStore } from "../store/appStore"
import { generateBackup, getBackupMetas, deleteBackupMeta, restoreFromJson, previewBackupFile } from '../utils/excelUtils';
import { indexedDBAdapter } from '../store/adapter';
import { clearAttachments } from '../store/attachmentStore';

interface BackupMeta {
  id: string;
  name: string;
  time: string;
  type: 'auto' | 'manual';
}

/** 获取 localStorage 中所有 jingzong.* 数据的总大小（估算） */
function estimateDataSize(): string {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('jingzong.')) {
      total += localStorage.getItem(key)?.length || 0;
    }
  }
  if (total < 1024) return `${total}B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(0)}KB`;
  return `${(total / (1024 * 1024)).toFixed(1)}MB`;
}

/** 估算各模块记录数（数据现存储于 IndexedDB，从 IndexedDB 读取） */
function getRecordStats(): Record<string, number> {
  try {
    const records = indexedDBAdapter.getItem<Array<{ moduleId?: string }>>(
      'jingzong.mass.records',
      [],
    );
    if (!Array.isArray(records)) return { '总记录数': 0 };
    const counts: Record<string, number> = { '总记录数': records.length };
    const moduleCounts: Record<string, number> = {};
    for (const r of records) {
      const moduleId = r.moduleId ?? '';
      moduleCounts[moduleId] = (moduleCounts[moduleId] || 0) + 1;
    }
    const sorted = Object.entries(moduleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [modId, count] of sorted) {
      counts[modId] = count;
    }
    return counts;
  } catch {
    return { '总记录数': 0 };
  }
}

export default function Backup({ noHeader }: { noHeader?: boolean }) {
  const { modal } = App.useApp();
  const showToast = useAppStore((s) => s.showToast);
  const [backups, setBackups] = useState<BackupMeta[]>(() => getBackupMetas());
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const [stats, setStats] = useState<Record<string, number>>(() => getRecordStats());

  const loadData = () => {
    setBackups(getBackupMetas());
    setStats(getRecordStats());
  };

  useEffect(() => { loadData(); }, []);

  const handleBackup = async () => {
    const ok = await generateBackup();
    if (ok) {
      showToast('备份已生成', 'success');
      setTimeout(loadData, 500);
    } else {
      showToast('已取消备份', 'info');
    }
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setRestoring(true);
      setRestoreResult(null);
      try {
        const preview = await previewBackupFile(file);
        if (!preview.valid) {
          const msg = preview.error || '无效的备份文件';
          setRestoreResult({ success: false, message: msg });
          showToast(msg, 'error');
          setRestoring(false);
          return;
        }
        modal.confirm({
          title: '确认从备份恢复？',
          content: (
            <div style={{ whiteSpace: 'pre-line', fontSize: 13, lineHeight: 1.9, color: 'var(--color-text-secondary)' }}>
              {`备份时间：${preview.createdAt || '未知'}\n`}
              {`软件版本：${preview.appVersion || '未知'}\n`}
              {`记录条数：${preview.recordCount ?? '未知'}\n`}
              {`附件数量：${preview.attachmentCount}\n`}
              {`文件大小：${preview.sizeLabel}\n\n`}
              <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                ⚠️ 将覆盖当前全部数据并重新加载应用，此操作不可撤销！
              </span>
            </div>
          ),
          okText: '确认恢复',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: async () => {
            try {
              const result = await restoreFromJson(file);
              if (result.success) {
                showToast(result.message, 'success');
                // 恢复清空并重建了全部持久化数据，重载让会话与各 store 重新初始化，保证界面一致
                setTimeout(() => window.location.reload(), 1200);
              } else {
                setRestoreResult(result);
                showToast(result.message, 'error');
                setRestoring(false);
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : '恢复失败';
              setRestoreResult({ success: false, message });
              showToast(`恢复失败: ${message}`, 'error');
              setRestoring(false);
            }
          },
          onCancel: () => {
            setRestoring(false);
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '读取备份失败';
        setRestoreResult({ success: false, message });
        showToast(`读取备份失败: ${message}`, 'error');
        setRestoring(false);
      }
    };
    input.click();
  };

  const handleDelete = (id: string) => {
    deleteBackupMeta(id);
    setBackups((prev) => prev.filter((b) => b.id !== id));
    showToast('备份记录已删除', 'info');
  };

  const handleDownloadBackup = () => {
    generateBackup();
    showToast('正在重新生成备份...', 'info');
  };

  return (
    <div>
      {!noHeader && (
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, #1B5E9B, #2E7DCA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(27,94,155,.3)' }}>
          <Database size={20} color="#fff" />
        </motion.div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>备份与恢复</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>数据备份 · 恢复点管理 · 自动备份请见下方配置</div>
        </div>
      </motion.div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* 左侧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 数据概览 */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>数据概览</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, padding: '10px 12px', background: 'var(--color-primary-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)' }}>{stats['总记录数'] ?? 0}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>总记录数</div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', background: 'var(--color-success-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-success)' }}>{estimateDataSize()}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>数据大小</div>
              </div>
              <div style={{ flex: 1, padding: '10px 12px', background: 'var(--color-warning-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-warning)' }}>{backups.length}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>备份次数</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
              {Object.entries(stats).filter(([k]) => k !== '总记录数').map(([modId, count]) => (
                <span key={modId} style={{
                  fontSize: 10.5, padding: '1px 8px', borderRadius: 10,
                  background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)',
                }}>
                  {modId.slice(0, 16)}: {count}
                </span>
              ))}
            </div>
          </motion.div>

          {/* 操作按钮 */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ display: 'flex', gap: 10 }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleBackup}
              style={{
                flex: 1, height: 40, background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, fontFamily: 'inherit',
              }}>
              <Upload size={14} />立即备份
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={handleRestore}
              disabled={restoring}
              style={{
                flex: 1, height: 40, background: restoring ? 'var(--color-surface-hover)' : 'var(--color-surface)',
                color: restoring ? 'var(--color-text-muted)' : 'var(--color-primary)',
                border: restoring ? '1px solid var(--color-border)' : '1.5px solid var(--color-primary)',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: restoring ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, fontFamily: 'inherit',
              }}>
              <RefreshCw size={14} />{restoring ? '恢复中...' : '从文件恢复'}
            </motion.button>
          </motion.div>

          {/* 恢复结果提示 */}
          <AnimatePresence>
            {restoreResult && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="card"
                style={{
                  padding: '12px 14px',
                  borderColor: restoreResult.success ? 'var(--color-success)' : 'var(--color-danger)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {restoreResult.success
                    ? <CheckCircle size={16} color="var(--color-success)" />
                    : <AlertCircle size={16} color="var(--color-danger)" />
                  }
                  <span style={{ fontSize: 13, fontWeight: 600, color: restoreResult.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {restoreResult.success ? '恢复成功' : '恢复失败'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  {restoreResult.message}
                </div>
                <button
                  onClick={() => setRestoreResult(null)}
                  style={{
                    marginTop: 8, padding: '4px 12px', background: 'none',
                    border: '1px solid var(--color-border)', borderRadius: 4, fontSize: 12,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  关闭
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右侧：备份记录列表 */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--color-border)', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>历史备份记录</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 400 }}>
              {backups.length > 0 ? `共 ${backups.length} 条` : '暂无备份'}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
            {backups.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
                <Database size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                <div>暂无备份记录</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>点击「立即备份」创建第一个备份</div>
              </div>
            ) : (
              backups.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="hover-bg"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px',
                    borderBottom: i < backups.length - 1 ? '1px solid var(--color-surface-hover)' : 'none',
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: b.type === 'auto' ? 'var(--color-primary-bg)' : 'var(--color-warning-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Clock size={14} color={b.type === 'auto' ? 'var(--color-primary)' : 'var(--color-warning)'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{b.time} · {b.type === 'auto' ? '自动备份' : '手动备份'}</div>
                  </div>
                  <span style={{
                    fontSize: 10.5, padding: '1px 7px', borderRadius: 8,
                    background: 'var(--color-success-bg)', color: 'var(--color-success)', fontWeight: 600, flexShrink: 0,
                  }}>
                    成功
                  </span>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={handleDownloadBackup}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                      <Download size={13} />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => handleDelete(b.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 4 }}>
                      <Trash2 size={13} />
                    </motion.button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* 数据重置区域（危险操作） */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{ marginTop: 24, background: 'var(--color-surface)', border: '1px solid var(--color-danger)', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <AlertTriangle size={18} color="var(--color-danger)" />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-danger)' }}>危险操作</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
          重置将清除所有工作记录、附件和设置数据，此操作不可撤销。建议先创建备份。
        </p>
        <button
          onClick={() => {
            modal.confirm({
              title: '确认重置所有数据？',
              content: '此操作将清除所有工作记录、附件、设置和用户数据，不可恢复！',
              okText: '确认重置',
              okButtonProps: { danger: true },
              cancelText: '取消',
              onOk: async () => {
                localStorage.clear();
                indexedDBAdapter.clear();
                // 一并清空附件库（M-2：重置须清理附件，否则残留孤立附件）
                try { await clearAttachments(); } catch { /* ignore */ }
                showToast('所有数据已重置，页面即将刷新', 'info');
                setTimeout(() => window.location.reload(), 1000);
              },
            });
          }}
          style={{
            padding: '8px 16px', background: 'var(--color-danger)', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
          }}
        >
          <Trash2 size={14} /> 重置所有数据
        </button>
      </motion.div>
    </div>
  );
}
