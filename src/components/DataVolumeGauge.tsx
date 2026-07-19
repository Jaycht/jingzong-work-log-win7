/**
 * 数据量可视化仪表
 * 展示 localStorage 存储空间使用情况和各模块记录数
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Database, FileArchive, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';
import { useDataChanged } from '../store/dataEvents';
import { MODULE_NAMES } from '../moduleConfig';

export default function DataVolumeGauge() {
  const darkMode = useAppStore((s) => s.darkMode);
  // 依赖数据版本号：IndexedDB 就绪 / 数据变更后自动重读（H-3）
  const dataVersion = useDataChanged();

  const stats = useMemo(() => {
    const records = getMassRecords();
    const totalRecords = records.length;

    // 按模块计数
    const moduleCounts: Record<string, number> = {};
    for (const r of records) {
      moduleCounts[r.moduleId] = (moduleCounts[r.moduleId] || 0) + 1;
    }

    // 估算 localStorage 用量
    let totalBytes = 0;
    const recordBytes = new Blob([JSON.stringify(records)]).size;
    totalBytes += recordBytes;

    // 附件数据估计（IndexedDB，取 localStorage 中的文件引用数量）
    let attachmentCount = 0;
    for (const r of records) {
      for (const [, val] of Object.entries(r.data || {})) {
        if (Array.isArray(val) && val.length > 0 && val[0]?.uid?.startsWith('att-')) {
          attachmentCount += val.length;
        }
      }
    }

    const topModules = Object.entries(moduleCounts)
      .map(([id, count]) => ({ id, label: MODULE_NAMES[id] || id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { totalRecords, totalBytes, attachmentCount, topModules };
  }, [dataVersion]);

  // 格式化字节
  const fmtBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // localStorage 一般可用空间 5MB
  const MAX_LOCALSTORAGE = 5 * 1024 * 1024;
  const usagePercent = Math.min(100, (stats.totalBytes / MAX_LOCALSTORAGE) * 100);
  const isNearLimit = usagePercent > 70;

  // 真正无记录时才隐藏；IndexedDB 未就绪时先渲染占位，待就绪后自动重读（H-3）
  if (stats.totalRecords === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        style={{
          background: darkMode ? 'rgba(28, 31, 38, 0.75)' : '#fff',
          borderRadius: 12,
          border: darkMode ? '1px solid rgba(163, 201, 255, 0.12)' : '1px solid #E5E7EB',
          padding: '14px 18px', fontSize: 13, color: darkMode ? '#8c919a' : '#9CA3AF',
        }}
      >
        数据概览 · 暂无记录
      </motion.div>
    );
  }

  // 颜色
  const getBarColor = () => {
    if (usagePercent > 85) return '#DC2626';
    if (usagePercent > 70) return '#EA580C';
    if (usagePercent > 50) return '#CA8A04';
    return darkMode ? '#4B9EFF' : '#2563EB';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      style={{
        background: darkMode ? 'rgba(28, 31, 38, 0.75)' : '#fff',
        borderRadius: 12,
        border: darkMode ? '1px solid rgba(163, 201, 255, 0.12)' : '1px solid #E5E7EB',
        boxShadow: darkMode ? '0 2px 12px rgba(0,0,0,.25)' : '0 1px 4px rgba(0,0,0,.04)',
        backdropFilter: darkMode ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: darkMode ? 'blur(14px)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* 标题 */}
      <div style={{
        padding: '14px 18px',
        borderBottom: darkMode ? '1px solid rgba(66, 71, 79, 0.4)' : '1px solid #F3F4F6',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <HardDrive size={15} color={darkMode ? '#a3c9ff' : '#2E7DCA'} />
        <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#e2e2e6' : '#1F2937' }}>
          数据概览
        </span>
        {isNearLimit && (
          <span style={{
            fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: darkMode ? 'rgba(220,38,38,0.15)' : '#FEE2E2',
            color: '#DC2626', marginLeft: 'auto',
          }}>
            存储空间即将不足
          </span>
        )}
      </div>

      <div style={{ padding: '16px 18px 18px' }}>
        {/* 存储环形进度 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            {/* 背景圆 */}
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke={darkMode ? 'rgba(66,71,79,0.4)' : '#F3F4F6'}
                strokeWidth="6"
              />
              <motion.circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke={getBarColor()}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 34 * (1 - usagePercent / 100),
                }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                transform="rotate(-90 40 40)"
              />
            </svg>
            {/* 中间文字 */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 16, fontWeight: 800,
                color: getBarColor(),
                lineHeight: 1,
              }}>
                {usagePercent.toFixed(0)}%
              </span>
              <span style={{
                fontSize: 8, color: darkMode ? '#8c919a' : '#9CA3AF',
                marginTop: 1,
              }}>
                已用
              </span>
            </div>
          </div>

          {/* 统计数据 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <Database size={13} color={darkMode ? '#8c919a' : '#6B7280'} style={{ flexShrink: 0 }} />
              <span style={{ color: darkMode ? '#8c919a' : '#6B7280' }}>记录总数</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: darkMode ? '#e2e2e6' : '#1F2937' }}>
                {stats.totalRecords} 条
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <FileArchive size={13} color={darkMode ? '#8c919a' : '#6B7280'} style={{ flexShrink: 0 }} />
              <span style={{ color: darkMode ? '#8c919a' : '#6B7280' }}>附件引用</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: darkMode ? '#e2e2e6' : '#1F2937' }}>
                {stats.attachmentCount} 个
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <FileText size={13} color={darkMode ? '#8c919a' : '#6B7280'} style={{ flexShrink: 0 }} />
              <span style={{ color: darkMode ? '#8c919a' : '#6B7280' }}>数据量</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: darkMode ? '#e2e2e6' : '#1F2937' }}>
                {fmtBytes(stats.totalBytes)} / 5 MB
              </span>
            </div>
          </div>
        </div>

        {/* 存储进度条 */}
        <div style={{
          height: 6, borderRadius: 3,
          background: darkMode ? 'rgba(66,71,79,0.3)' : '#F3F4F6',
          marginBottom: 14, overflow: 'hidden',
        }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usagePercent}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            style={{
              height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${getBarColor()}, ${getBarColor()}88)`,
            }}
          />
        </div>

        {/* 模块排行（前 5） */}
        {stats.topModules.length > 0 && (
          <div>
            <div style={{
              fontSize: 10.5, fontWeight: 600,
              color: darkMode ? '#8c919a' : '#9CA3AF',
              marginBottom: 8,
            }}>
              记录最多模块 TOP5
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stats.topModules.map((mod, i) => {
                const maxCount = stats.topModules[0]?.count || 1;
                const pct = (mod.count / maxCount) * 100;
                const colors = ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706'];
                return (
                  <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 16, textAlign: 'center', fontSize: 10,
                      color: darkMode ? '#8c919a' : '#9CA3AF',
                      fontWeight: 600, flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: darkMode ? '#c8ccd4' : '#6B7280',
                      width: 56, flexShrink: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {mod.label}
                    </span>
                    <div style={{
                      flex: 1, height: 10, borderRadius: 5,
                      background: darkMode ? 'rgba(66,71,79,0.2)' : '#F3F4F6',
                      overflow: 'hidden',
                    }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.05 }}
                        style={{
                          height: '100%', borderRadius: 5,
                          background: colors[i],
                        }}
                      />
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: darkMode ? '#e2e2e6' : '#374151',
                      width: 24, textAlign: 'right', flexShrink: 0,
                    }}>
                      {mod.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
