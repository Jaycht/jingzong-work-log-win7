import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, FolderOpen, CheckCircle, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { generateBackup } from '../utils/excelUtils';
import { localStorageAdapter, indexedDBAdapter } from '../store/adapter';
import { exportAttachmentSnapshot } from '../store/attachmentStore';
import { getBaseModules } from '../moduleConfig';

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

export default function AutoBackupPanel() {
  const showToast = useAppStore((s) => s.showToast);
  const [settings, setSettings] = useState<AutoBackupSettings>(() => loadSettings());
  const [customPath, setCustomPath] = useState(settings.backupPath);
  const [currentAttachmentsPath, setCurrentAttachmentsPath] = useState('');
  useEffect(() => {
    const api = window.electronAPI;
    if (api?.getAttachmentsPath) {
      api.getAttachmentsPath().then((p: string) => setCurrentAttachmentsPath(p || '')).catch(() => {});
    }
  }, []);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allModules = getBaseModules();

  // 保存设置
  const updateSettings = useCallback((patch: Partial<AutoBackupSettings>) => {
    setSettings((prev) => {
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

  // 退出时自动备份监听
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onTriggerQuitBackup) return;
    const off = api.onTriggerQuitBackup(async () => {
      const s = loadSettings();
      if (!s.backupOnQuit) return;
      try {
        const data: Record<string, unknown> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('jingzong.')) {
            try { data[key] = localStorageAdapter.getItem(key, ''); } catch {}
          }
        }
        const idbKeys = indexedDBAdapter.keys('jingzong.');
        for (const key of idbKeys) {
          try {
            const val = indexedDBAdapter.getItem(key, null);
            if (val !== null && val !== undefined) data[key] = val;
          } catch {}
        }
        const attachments = await exportAttachmentSnapshot() || [];
        const backup = { version: '2.0', createdAt: new Date().toISOString(), data, attachments };
        const json = JSON.stringify(backup);
        const ts = new Date().toISOString().slice(0, 16).replace('T', '_');
        await api.saveJsonFile(json, `jingzong_退出备份_${ts}.json`);
      } catch {}
    });
    return () => { if (typeof off === 'function') off(); };
  }, []);

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
              setCurrentAttachmentsPath(result.path);
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
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
        <Settings size={15} />
        <span>自动备份与存储路径</span>
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
          style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: settings.enabled ? 'var(--color-success)' : 'var(--color-surface-hover)', position: 'relative', transition: 'background 0.2s' }}
        >
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: settings.enabled ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
        </button>
      </div>

      {/* 备份频率 */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>备份频率</label>
        <select
          value={settings.intervalMinutes}
          onChange={(e) => updateSettings({ intervalMinutes: Number(e.target.value) })}
          disabled={!settings.enabled}
          style={{ width: '100%', height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit', opacity: settings.enabled ? 1 : 0.5 }}
        >
          {INTERVAL_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
        </select>
      </div>

      {/* 备份内容 */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>备份内容</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button onClick={() => updateSettings({ selectedModules: [] })} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', borderColor: settings.selectedModules.length === 0 ? 'var(--color-primary)' : 'var(--color-border)', background: settings.selectedModules.length === 0 ? 'var(--color-primary-bg)' : 'var(--color-surface)', color: settings.selectedModules.length === 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            全部数据
          </button>
          {allModules.slice(0, 8).map((mod) => {
            const isSelected = settings.selectedModules.includes(mod.id);
            return (
              <button key={mod.id} onClick={() => { const next = isSelected ? settings.selectedModules.filter((id) => id !== mod.id) : [...settings.selectedModules, mod.id]; updateSettings({ selectedModules: next }); }}
                style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)', background: isSelected ? 'var(--color-primary-bg)' : 'var(--color-surface)', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
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
        <button onClick={() => updateSettings({ backupOnQuit: !settings.backupOnQuit })} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: settings.backupOnQuit ? 'var(--color-primary)' : 'var(--color-surface-hover)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: settings.backupOnQuit ? 22 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
        </button>
      </div>

      {/* 附件保存路径 */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>附件保存路径</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentAttachmentsPath || '点击右侧按钮修改'}>
            {currentAttachmentsPath || '附件存储在软件自动检测的磁盘路径下'}
          </div>
          <button onClick={handleBrowseAttachmentsPath} style={{ height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit', color: 'var(--color-text-secondary)' }}>
            <FolderOpen size={13} /> 修改
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>修改后新附件即保存到所选目录（已存附件仍在原目录，可正常打开）</div>
      </div>

      {/* 备份路径 */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>备份路径</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="text" value={customPath} onChange={(e) => setCustomPath(e.target.value)} onBlur={() => updateSettings({ backupPath: customPath })} placeholder="点击右侧按钮获取默认路径" disabled={!settings.enabled} style={{ flex: 1, height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, fontFamily: 'inherit', opacity: settings.enabled ? 1 : 0.5 }} />
          <button onClick={handleBrowsePath} disabled={!settings.enabled} style={{ height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit', color: 'var(--color-text-secondary)', opacity: settings.enabled ? 1 : 0.5 }}>
            <FolderOpen size={13} /> 浏览
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>Electron 环境下默认为「文档」文件夹，浏览器环境为下载目录</div>
      </div>

      {/* 当前状态 */}
      {settings.enabled && (
        <div style={{ padding: '10px 14px', background: 'var(--color-surface-hover)', borderRadius: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>备份频率</span>
            <span style={{ fontWeight: 600 }}>{INTERVAL_OPTIONS.find((o) => o.value === settings.intervalMinutes)?.label || '未知'}</span>
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
    </div>
  );
}
