import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Power, Monitor, ShieldCheck } from 'lucide-react';
import { Switch } from 'antd';
import { useAppStore } from '../store/appStore';
import { APP_VERSION } from '../version';

const isElectron = typeof window !== 'undefined' && (window as any).electronAPI?.isElectron;

export default function SystemSettings() {
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const [autoStart, setAutoStart] = useState(false);
  const [closeToTray, setCloseToTray] = useState(() => {
    try { return localStorage.getItem('jingzong.closeToTray') !== 'false'; } catch { return true; }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isElectron) {
      (window as any).electronAPI.getAutoStart().then((v: boolean) => setAutoStart(v)).catch(() => {});
    }
  }, []);

  const handleAutoStart = async (checked: boolean) => {
    setLoading(true);
    try {
      if (isElectron) {
        const result = await (window as any).electronAPI.setAutoStart(checked);
        setAutoStart(result);
      }
    } catch {}
    setLoading(false);
  };

  const handleCloseToTray = (checked: boolean) => {
    setCloseToTray(checked);
    try { localStorage.setItem('jingzong.closeToTray', String(checked)); } catch {}
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #6366F1, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(99,102,241,.3)' }}>
          <Settings size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>系统设置</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>自启 · 托盘 · 主题 · 关于</div>
        </div>
      </motion.div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* 左侧：设置项 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minWidth: 0, maxWidth: 600 }}>
          <Section title="启动与窗口" icon={<Power size={16} />}>
            <SettingRow
              title="开机自动启动"
              desc="系统启动时自动运行程序"
              extra={
                isElectron ? (
                  <Switch checked={autoStart} onChange={handleAutoStart} loading={loading} />
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>仅桌面版</span>
                )
              }
            />
            {isElectron && (
              <SettingRow
                title="关闭时最小化到托盘"
                desc="点击关闭按钮时隐藏到系统托盘，双击托盘图标恢复"
                extra={<Switch checked={closeToTray} onChange={handleCloseToTray} />}
              />
            )}
          </Section>

          <Section title="显示" icon={<Monitor size={16} />}>
            <SettingRow
              title="深色模式"
              desc="切换浅色/深色界面主题"
              extra={<Switch checked={darkMode} onChange={toggleDarkMode} />}
            />
          </Section>

          <Section title="关于软件" icon={<ShieldCheck size={16} />}>
            <div style={{ padding: '12px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                经侦大队工作记录管理系统
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                <div>版本：{APP_VERSION}</div>
                <div>技术栈：React + Electron + IndexedDB</div>
                <div>Copyright © 2026 陈洪涛</div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                  本系统用于经侦大队日常工作记录管理，包含案件管理、调证分析、涉众处理、
                  法制审核等业务模块。数据完全本地存储，支持离线使用。
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* 右侧：大 Logo */}
        <div style={{ flexShrink: 0, width: 380, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 10 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
          >
            <img
              src="./logo.png"
              alt="经侦大队工作记录管理系统"
              style={{
                width: 360,
                height: 360,
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,.12))',
              }}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border-light)' }}>
        <span style={{ color: 'var(--pri)' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{title}</span>
      </div>
      <div style={{ padding: '4px 16px' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ title, desc, extra }: { title: string; desc: string; extra: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--color-border-light)' }}>
      <div style={{ flex: 1, marginRight: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>{desc}</div>
      </div>
      {extra}
    </div>
  );
}
