import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Power, Monitor, ShieldCheck, Boxes,
  FileArchive, DatabaseBackup,
  Volume2, ListOrdered, Clock,
} from 'lucide-react';
import { Switch, Select } from 'antd';
import { useAppStore } from '../store/appStore';

import SettingsPage from './SettingsPage';
import Attachments from './Attachments';
import Version from './Version';
import DataManagement from './DataManagement';
import { isElectron as isElectronEnv } from '../lib/env';

const SUCCESS_SOUNDS = [
  { value: 'success-1.wav', label: '上行琶音' },
  { value: 'success-2.wav', label: '双声叮咚' },
  { value: 'success-3.wav', label: '大三和弦' },
  { value: 'success-4.wav', label: '清脆Sparkle' },
];
const WARNING_SOUNDS = [
  { value: 'warning-1.wav', label: '双声提示' },
  { value: 'warning-2.wav', label: '三连蜂鸣' },
  { value: 'warning-3.wav', label: '警示颤音' },
  { value: 'warning-4.wav', label: '中音Ping' },
];
const FAILURE_SOUNDS = [
  { value: 'failure-1.wav', label: '下行失落' },
  { value: 'failure-2.wav', label: '低音蜂鸣' },
  { value: 'failure-3.wav', label: '错误闷响' },
  { value: 'failure-4.wav', label: '低落双音' },
];

const isElectron = isElectronEnv();

type TabId = 'general' | 'modules' | 'data' | 'attachments' | 'about';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number; color?: string }>; tint: string }[] = [
  { id: 'general', label: '通用设置', icon: Settings, tint: '#6366F1' },
  { id: 'modules', label: '模块与字段', icon: Boxes, tint: '#8B5CF6' },
  { id: 'data', label: '数据管理', icon: DatabaseBackup, tint: '#10B981' },
  { id: 'attachments', label: '附件档案', icon: FileArchive, tint: '#F59E0B' },
  { id: 'about', label: '关于软件', icon: ShieldCheck, tint: '#2563EB' },
];

export default function SystemSettings() {
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);

  // 通用设置：显示密度 / 提示音 / 列表排序 / 启动行为 / 时间格式
  const uiDensity = useAppStore((s) => s.uiDensity);
  const setUiDensity = useAppStore((s) => s.setUiDensity);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const setSoundEnabled = useAppStore((s) => s.setSoundEnabled);
  const successSound = useAppStore((s) => s.successSound);
  const setSuccessSound = useAppStore((s) => s.setSuccessSound);
  const warningSound = useAppStore((s) => s.warningSound);
  const setWarningSound = useAppStore((s) => s.setWarningSound);
  const failureSound = useAppStore((s) => s.failureSound);
  const setFailureSound = useAppStore((s) => s.setFailureSound);
  const listSort = useAppStore((s) => s.listSort);
  const setListSort = useAppStore((s) => s.setListSort);
  const startupBehavior = useAppStore((s) => s.startupBehavior);
  const setStartupBehavior = useAppStore((s) => s.setStartupBehavior);
  const timeFormat = useAppStore((s) => s.timeFormat);
  const setTimeFormat = useAppStore((s) => s.setTimeFormat);

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [autoStart, setAutoStart] = useState(false);
  const [closeBehavior, setCloseBehavior] = useState<'exit' | 'tray' | 'ask'>(() => {
    try {
      const v = localStorage.getItem('jingzong.closeBehavior');
      if (v === 'exit' || v === 'tray' || v === 'ask') return v;
      // 兼容旧版 closeToTray 开关
      return localStorage.getItem('jingzong.closeToTray') === 'false' ? 'exit' : 'tray';
    } catch { return 'ask'; }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.getAutoStart().then((v: boolean) => setAutoStart(v)).catch(() => {});
    }
  }, []);

  const handleAutoStart = async (checked: boolean) => {
    setLoading(true);
    try {
      if (isElectron) {
        const result = await window.electronAPI.setAutoStart(checked);
        setAutoStart(result);
      }
    } catch {}
    setLoading(false);
  };

  const handleCloseBehavior = (value: 'exit' | 'tray' | 'ask') => {
    setCloseBehavior(value);
    try {
      localStorage.setItem('jingzong.closeBehavior', value);
      localStorage.removeItem('jingzong.closeToTray');
    } catch {}
    if (isElectron && window.electronAPI?.setCloseBehavior) {
      window.electronAPI.setCloseBehavior(value);
    }
  };

  const textColor = darkMode ? '#E6EAF2' : '#1F2937';
  const textMuted = darkMode ? '#8A94A6' : '#6B7280';
  const borderColor = darkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const railBg = darkMode ? '#11161d' : '#F8FAFC';
  const contentBg = darkMode ? '#0E131A' : '#FFFFFF';

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
            <Section title="系统外观与行为" icon={<Power size={16} />}>
              <SettingRow
                title="开机自动启动"
                desc="系统启动时自动运行程序"
                extra={
                  isElectron ? (
                    <Switch checked={autoStart} onChange={handleAutoStart} loading={loading} />
                  ) : (
                    <span style={{ fontSize: 11, color: textMuted }}>仅桌面版</span>
                  )
                }
              />
              {isElectron && (
                <SettingRow
                  title="关闭窗口时的行为"
                  desc="决定点击标题栏关闭按钮后程序如何响应"
                  extra={
                    <Select
                      value={closeBehavior}
                      onChange={(v) => handleCloseBehavior(v as 'exit' | 'tray' | 'ask')}
                      style={{ width: 180, height: 36 }}
                      options={[
                        { label: '直接退出软件', value: 'exit' },
                        { label: '最小化到系统托盘', value: 'tray' },
                        { label: '每次询问我', value: 'ask' },
                      ]}
                    />
                  }
                />
              )}
              <SettingRow
                title="深色模式"
                desc="切换浅色/深色界面主题"
                extra={<Switch checked={darkMode} onChange={toggleDarkMode} />}
              />
              <SettingRow
                title="显示密度"
                desc="宽松更适合年长同事阅读；紧凑可一屏显示更多内容"
                extra={
                  <Select
                    value={uiDensity}
                    onChange={(v) => setUiDensity(v as "standard" | "comfortable" | "compact")}
                    style={{ width: 140, height: 36 }}
                    options={[
                      { label: '标准', value: 'standard' },
                      { label: '宽松（大字号）', value: 'comfortable' },
                      { label: '紧凑', value: 'compact' },
                    ]}
                  />
                }
              />
            </Section>
            <Section title="声音与提示" icon={<Volume2 size={16} />}>
              <SettingRow
                title="操作提示音"
                desc="操作成功 / 警告 / 失败时分别播放对应的提示音"
                extra={<Switch checked={soundEnabled} onChange={(v) => setSoundEnabled(v)} />}
              />
              <SettingRow
                title="成功提示音"
                desc="操作成功时播放"
                extra={
                  <Select
                    value={successSound}
                    onChange={(v) => setSuccessSound(v as string)}
                    disabled={!soundEnabled}
                    style={{ width: 160, height: 36 }}
                    options={SUCCESS_SOUNDS}
                  />
                }
              />
              <SettingRow
                title="警告提示音"
                desc="出现警告时播放"
                extra={
                  <Select
                    value={warningSound}
                    onChange={(v) => setWarningSound(v as string)}
                    disabled={!soundEnabled}
                    style={{ width: 160, height: 36 }}
                    options={WARNING_SOUNDS}
                  />
                }
              />
              <SettingRow
                title="失败提示音"
                desc="操作失败或出错时播放"
                extra={
                  <Select
                    value={failureSound}
                    onChange={(v) => setFailureSound(v as string)}
                    disabled={!soundEnabled}
                    style={{ width: 160, height: 36 }}
                    options={FAILURE_SOUNDS}
                  />
                }
              />
            </Section>
            <Section title="列表与偏好" icon={<ListOrdered size={16} />}>
              <SettingRow
                title="列表默认排序"
                desc="各模块记录列表的默认排列顺序"
                extra={
                  <Select
                    value={listSort}
                    onChange={(v) => setListSort(v as "updatedDesc" | "updatedAsc" | "createdDesc" | "createdAsc" | "module")}
                    style={{ width: 160, height: 36 }}
                    options={[
                      { label: '更新时间（新→旧）', value: 'updatedDesc' },
                      { label: '更新时间（旧→新）', value: 'updatedAsc' },
                      { label: '创建时间（新→旧）', value: 'createdDesc' },
                      { label: '创建时间（旧→新）', value: 'createdAsc' },
                      { label: '按模块分组', value: 'module' },
                    ]}
                  />
                }
              />
              <SettingRow
                title="启动打开"
                desc="打开软件时默认进入的页面"
                extra={
                  <Select
                    value={startupBehavior}
                    onChange={(v) => setStartupBehavior(v as "dashboard" | "last")}
                    style={{ width: 160, height: 36 }}
                    options={[
                      { label: '工作台', value: 'dashboard' },
                      { label: '上次所在模块', value: 'last' },
                    ]}
                  />
                }
              />
              <SettingRow
                title="日期显示格式"
                desc="列表中日期的统一展示格式"
                extra={
                  <Select
                    value={timeFormat}
                    onChange={(v) => setTimeFormat(v as "YYYY-MM-DD" | "YYYY/MM/DD")}
                    style={{ width: 160, height: 36 }}
                    options={[
                      { label: '2026-07-15', value: 'YYYY-MM-DD' },
                      { label: '2026/07/15', value: 'YYYY/MM/DD' },
                    ]}
                  />
                }
              />
            </Section>
          </div>
        );
      case 'modules': return <SettingsPage />;
      case 'data': return <DataManagement />;
      case 'attachments': return <Attachments />;
      case 'about': return <Version />;
      default: return null;
    }
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366F1, #818CF8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(99,102,241,.3)' }}>
          <Settings size={22} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: textColor }}>系统设置</div>
          <div style={{ fontSize: 12.5, color: textMuted, marginTop: 1 }}>通用 · 模块 · 数据 · 附件 · 关于</div>
        </div>
      </motion.div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        {/* 左侧标签导航 */}
        <div style={{ flexShrink: 0, width: 212, background: railBg, border: `1px solid ${borderColor}`, borderRadius: 14, padding: 10, position: 'sticky', top: 4 }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 11,
                  padding: '11px 12px', marginBottom: 4, cursor: 'pointer',
                  borderRadius: 10, border: 'none', textAlign: 'left', fontFamily: 'inherit',
                  background: active ? (darkMode ? 'rgba(99,102,241,.16)' : 'rgba(99,102,241,.10)') : 'transparent',
                  transition: 'background .15s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,.05)' : '#EEF2F8'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? tab.tint : (darkMode ? 'rgba(255,255,255,.06)' : '#EEF2F8'), boxShadow: active ? `0 4px 12px ${tab.tint}55` : 'none' }}>
                  <Icon size={18} color={active ? '#fff' : textMuted} />
                </span>
                <span style={{ fontSize: 14.5, fontWeight: active ? 700 : 500, color: active ? (darkMode ? '#C7D2FE' : '#4338CA') : textColor, whiteSpace: 'nowrap' }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 右侧内容 */}
        <div style={{ flex: 1, minWidth: 0, background: contentBg, border: `1px solid ${borderColor}`, borderRadius: 14, padding: 20, overflow: 'auto' }}>
          {renderTab()}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const darkMode = useAppStore((s) => s.darkMode);
  const borderColor = darkMode ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  return (
    <div style={{ background: 'var(--color-surface, #fff)', border: `1px solid ${borderColor}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${borderColor}` }}>
        <span style={{ color: 'var(--pri)' }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{title}</span>
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
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{desc}</div>
      </div>
      {extra}
    </div>
  );
}
