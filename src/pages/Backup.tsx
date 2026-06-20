import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Download, Upload, RefreshCw, Trash2, Clock, CheckCircle, AlertCircle, Settings, FolderOpen, AlertTriangle } from 'lucide-react';
import { Modal } from 'antd';
import { useAppStore } from "../store/appStore"
import { generateBackup, getBackupMetas, deleteBackupMeta, restoreFromJson } from '../utils/excelUtils';
import { getBaseModules } from '../moduleConfig';
import { localStorageAdapter } from '../store/adapter';
import { indexedDBAdapter } from '../store/adapter';

interface BackupMeta {
  id: string;
  name: string;
  time: string;
  type: 'auto' | 'manual';
}

interface AutoBackupSettings {
  enabled: boolean;
  intervalMinutes: number;
  selectedModules: string[];
  backupPath: string;
  backupOnQuit: boolean;
}

const DEFAULT_SETTINGS: AutoBackupSettings = {
  enabled: false,
  intervalMinutes: 0,
  selectedModules: [],
  backupPath: '',
  backupOnQuit: false,
};

const INTERVAL_OPTIONS = [
  { value: 0, label: '仅手动备份' },
  { value: 30, label: '每 30 分钟' },
  { value: 60, label: '每 1 小时' },
  { value: 120, label: '每 2 小时' },
  { value: 240, label: '每 4 小时' },
  { value: 480, label: '每 8 小时' },
];

const SETTINGS_KEY = 'jingzong.autoBackupSettings';

function loadSettings(): AutoBackupSettings {
  return localStorageAdapter.getItem(SETTINGS_KEY, DEFAULT_SETTINGS);
}

function saveSettings(settings: AutoBackupSettings): void {
  localStorageAdapter.setItem(SETTINGS_KEY, settings);
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

/** 估算各模块记录数 */
function getRecordStats(): Record<string, number> {
  try {
    const raw = localStorage.getItem('jingzong.mass.records');
    if (!raw) return { '总记录数': 0 };
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) return { '总记录数': 0 };
    const counts: Record<string, number> = { '总记录数': records.length };
    const moduleCounts: Record<string, number> = {};
    for (const r of records) {
      moduleCounts[r.moduleId] = (moduleCounts[r.moduleId] || 0) + 1;
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

export default function Backup() {
  const showToast = useAppStore((s) => s.showToast);
  const [backups, setBackups] = useState<BackupMeta[]>(() => getBackupMetas());
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
  const [stats, setStats] = useState<Record<string, number>>(() => getRecordStats());
  const [settings, setSettings] = useState<AutoBackupSettings>(() => loadSettings());
  const [customPath, setCustomPath] = useState(settings.backupPath);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const allModules = getBaseModules();

  const loadData = () => {
    setBackups(getBackupMetas());
    setStats(getRecordStats());
  };

  // 退出时自动备份监听
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onTriggerQuitBackup) return;
    api.onTriggerQuitBackup(async () => {
      const s = loadSettings();
      if (!s.backupOnQuit) return;
      try {
        const data: Record<string, unknown> = {};
        // 读取 localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('jingzong.')) {
            try { data[key] = localStorageAdapter.getItem(key, ''); } catch {}
          }
        }
        // 读取 IndexedDB（dailyNotes、massRecords、drafts）
        const idbKeys = indexedDBAdapter.keys('jingzong.');
        for (const key of idbKeys) {
          try {
            const val = indexedDBAdapter.getItem(key, null);
            if (val !== null && val !== undefined) data[key] = val;
          } catch {}
        }
        const attachments = await (await import('../utils/excelUtils')).exportAttachmentSnapshot?.() || [];
        const backup = { version: '2.0', createdAt: new Date().toISOString(), data, attachments };
        const json = JSON.stringify(backup);
        const ts = new Date().toISOString().slice(0, 16).replace('T', '_');
        await api.saveJsonFile(json, `jingzong_退出备份_${ts}.json`);
      } catch {}
    });
  }, []);

  // 获取默认备份路径
  const getDefaultPath = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.getDocumentsDir) {
      try {
        return await window.electronAPI.getDocumentsDir();
      } catch {
        return '文档文件夹';
      }
    }
    return '浏览器下载目录';
  }, []);

  // 保存设置
  const updateSettings = useCallback((patch: Partial<AutoBackupSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      if (patch.backupPath !== undefined) setCustomPath(patch.backupPath);
      saveSettings(next);
      return next;
    });
  }, []);

  // 自动备份定时器
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (settings.enabled && settings.intervalMinutes > 0) {
      timerRef.current = setInterval(() => {
        try {
          generateBackup();
          loadData();
          showToast('自动备份完成', 'success');
        } catch {
          showToast('自动备份失败', 'error');
        }
      }, settings.intervalMinutes * 60 * 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [settings.enabled, settings.intervalMinutes, showToast]);

  const handleBackup = () => {
    generateBackup();
    showToast('备份已生成并下载', 'success');
    setTimeout(loadData, 500);
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
        const result = await restoreFromJson(file);
        setRestoreResult(result);
        if (result.success) {
          showToast(result.message, 'success');
          loadData();
        } else {
          showToast(result.message, 'error');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '恢复失败';
        setRestoreResult({ success: false, message });
        showToast(`恢复失败: ${message}`, 'error');
      } finally {
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

  const handleBrowsePath = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.showDirectoryDialog) {
      try {
        const result = await window.electronAPI.showDirectoryDialog();
        if (result && !result.canceled && result.path) {
          updateSettings({ backupPath: result.path });
          showToast('备份目录已设置', 'success');
        }
      } catch {
        showToast('无法打开目录选择对话框', 'error');
      }
    } else {
      showToast('浏览器环境不支持选择目录', 'info');
    }
  };

  const handleBrowseAttachmentsPath = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.showDirectoryDialog) {
      try {
        const result = await window.electronAPI.showDirectoryDialog();
        if (result && !result.canceled && result.path) {
          if (window.electronAPI?.setAttachmentsPath) {
            const r = await window.electronAPI.setAttachmentsPath(result.path);
            if (r.success) {
              showToast(`附件保存路径已切换到: ${result.path}`, 'success');
            } else {
              showToast(r.error || '设置失败', 'error');
            }
          }
        }
      } catch {
        showToast('无法打开目录选择对话框', 'error');
      }
    }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, #1B5E9B, #2E7DCA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(27,94,155,.3)' }}>
          <Database size={20} color="#fff" />
        </motion.div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>备份与恢复</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>数据备份 · 恢复点管理 · 自动备份计划</div>
        </div>
      </motion.div>

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

          {/* 自动备份设置 */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={15} />
              <span>自动备份设置</span>
            </div>

            {/* 启用开关 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: settings.enabled ? 'var(--color-success-bg)' : 'var(--color-surface-hover)', border: `1px solid ${settings.enabled ? 'var(--color-success)' : 'var(--color-border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {settings.enabled ? <CheckCircle size={16} color="var(--color-success)" /> : <AlertCircle size={16} color="var(--color-text-muted)" />}
                <span style={{ fontSize: 13, fontWeight: 600, color: settings.enabled ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                  {settings.enabled ? '自动备份已启用' : '自动备份未启用'}
                </span>
              </div>
              <button
                onClick={() => updateSettings({ enabled: !settings.enabled })}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: settings.enabled ? 'var(--color-success)' : 'var(--color-surface-hover)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 2, left: settings.enabled ? 22 : 2,
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }} />
              </button>
            </div>

            {/* 备份频率 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>备份频率</label>
              <select
                value={settings.intervalMinutes}
                onChange={(e) => updateSettings({ intervalMinutes: Number(e.target.value) })}
                disabled={!settings.enabled}
                style={{
                  width: '100%', height: 34, padding: '0 10px', borderRadius: 6,
                  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                  color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit',
                  opacity: settings.enabled ? 1 : 0.5,
                }}
              >
                {INTERVAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 备份内容 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>备份内容</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <button
                  onClick={() => updateSettings({ selectedModules: [] })}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: '1px solid',
                    borderColor: settings.selectedModules.length === 0 ? 'var(--color-primary)' : 'var(--color-border)',
                    background: settings.selectedModules.length === 0 ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                    color: settings.selectedModules.length === 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  }}
                >
                  全部数据
                </button>
                {allModules.slice(0, 8).map(mod => {
                  const isSelected = settings.selectedModules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => {
                        const next = isSelected
                          ? settings.selectedModules.filter(id => id !== mod.id)
                          : [...settings.selectedModules, mod.id];
                        updateSettings({ selectedModules: next });
                      }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid',
                        borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                        background: isSelected ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {mod.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {settings.selectedModules.length === 0 ? '已选择全部数据' : `已选择 ${settings.selectedModules.length} 个模块`}
              </div>
            </div>

            {/* 退出时自动备份 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: settings.backupOnQuit ? 'var(--color-primary-bg)' : 'var(--color-surface-hover)', border: `1px solid ${settings.backupOnQuit ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>退出时自动备份</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>点击「退出」时自动保存一份全局备份到文档/jingzong_backups</div>
              </div>
              <button
                onClick={() => updateSettings({ backupOnQuit: !settings.backupOnQuit })}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: settings.backupOnQuit ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 2, left: settings.backupOnQuit ? 22 : 2,
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                }} />
              </button>
            </div>

            {/* 附件保存路径 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>附件保存路径</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <div
                  style={{
                    flex: 1, height: 34, padding: '0 10px', borderRadius: 6,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                    color: 'var(--color-text)', fontSize: 12, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title="点击右侧按钮修改"
                >
                  附件存储在软件自动检测的磁盘路径下
                </div>
                <button
                  onClick={handleBrowseAttachmentsPath}
                  style={{
                    height: 34, padding: '0 10px', borderRadius: 6,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontFamily: 'inherit', color: 'var(--color-text-secondary)',
                  }}
                >
                  <FolderOpen size={13} /> 修改
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                附件默认保存到非C盘（如D:\\jingzong_data\\attachments），可手动切换
              </div>
            </div>

            {/* 备份路径 */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>备份路径</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  onBlur={() => updateSettings({ backupPath: customPath })}
                  placeholder="点击右侧按钮获取默认路径"
                  disabled={!settings.enabled}
                  style={{
                    flex: 1, height: 34, padding: '0 10px', borderRadius: 6,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                    color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit',
                    opacity: settings.enabled ? 1 : 0.5,
                  }}
                />
                <button
                  onClick={handleBrowsePath}
                  disabled={!settings.enabled}
                  style={{
                    height: 34, padding: '0 10px', borderRadius: 6,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontFamily: 'inherit', color: 'var(--color-text-secondary)',
                    opacity: settings.enabled ? 1 : 0.5,
                  }}
                >
                  <FolderOpen size={13} /> 浏览
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Electron 环境下默认为「文档」文件夹，浏览器环境为下载目录
              </div>
            </div>

            {/* 当前状态 */}
            {settings.enabled && (
              <div style={{ padding: '10px 14px', background: 'var(--color-surface-hover)', borderRadius: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>备份频率</span>
                  <span style={{ fontWeight: 600 }}>{INTERVAL_OPTIONS.find(o => o.value === settings.intervalMinutes)?.label || '未知'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>备份范围</span>
                  <span style={{ fontWeight: 600 }}>{settings.selectedModules.length === 0 ? '全部数据' : `${settings.selectedModules.length} 个模块`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>备份路径</span>
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{customPath || '未设置'}</span>
                </div>
              </div>
            )}
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
            Modal.confirm({
              title: '确认重置所有数据？',
              content: '此操作将清除所有工作记录、附件、设置和用户数据，不可恢复！',
              okText: '确认重置',
              okButtonProps: { danger: true },
              cancelText: '取消',
              onOk: () => {
                localStorage.clear();
                indexedDBAdapter.clear();
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
