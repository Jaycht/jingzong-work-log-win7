/**
 * 到期预警组件
 * 扫描各模块中涉及法定期限的日期字段，自动计算剩余天数并分级展示
 * 依据：刑事诉讼法、公安机关办理经济犯罪案件的若干规定
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CalendarClock } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';

/* ===================== 类型定义 ===================== */

interface WarningItem {
  id: string;
  recordId: string;
  moduleId: string;
  caseName: string;
  /** 到期事项中文描述 */
  type: string;
  /** 到期日期（ISO 字符串，仅日期部分） */
  deadline: string;
  /** 剩余天数 */
  remainingDays: number;
  /** 严重等级 */
  severity: 'overdue' | 'critical' | 'warning' | 'normal';
}

/* ===================== 工具函数 ===================== */

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function toDateStr(date: Date): string {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function calcRemaining(deadline: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = deadline.getTime() - today.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/* ===================== 法定期限规则 ===================== */

interface DeadlineRule {
  /** 该规则适用的模块ID */
  moduleIds: string[];
  /** 触发规则所需的日期字段名 */
  dateField: string;
  /** 到期事项中文名 */
  type: string;
  /** 计算到期日的函数 */
  calcDeadline: (dateStr: string) => string;
}

const DEADLINE_RULES: DeadlineRule[] = [
  // 一、受案→立案（经济犯罪：7日，重大复杂可延长）
  // 用基础7天做预警，如果超期会提示
  {
    moduleIds: ['legal-report-case', 'legal-case-ledger', 'squad-case'],
    dateField: 'receiveDate',
    type: '受案→立案（7日）',
    calcDeadline: (d) => toDateStr(addDays(new Date(d), 7)),
  },
  // 二、刑事拘留期限（流窜/多次/结伙作案最长30日）
  {
    moduleIds: ['squad-coercive', 'legal-case-ledger'],
    dateField: 'criminalDetentionDate',
    type: '刑事拘留（30日）',
    calcDeadline: (d) => toDateStr(addDays(new Date(d), 30)),
  },
  // 三、提请逮捕审查（7日）
  {
    moduleIds: ['squad-coercive'],
    dateField: 'criminalDetentionDate',
    type: '提请逮捕审查（7日）',
    calcDeadline: (d) => toDateStr(addDays(new Date(d), 23)), // 30日后需要报捕，但在23日时提醒7日审查期
  },
  // 四、逮捕后侦查羁押（一般2个月）
  {
    moduleIds: ['squad-coercive', 'legal-case-ledger', 'squad-case'],
    dateField: 'arrestDate',
    type: '侦查羁押到期（2个月）',
    calcDeadline: (d) => toDateStr(addMonths(new Date(d), 2)),
  },
  // 五、取保候审（最长12个月）
  {
    moduleIds: ['squad-coercive', 'legal-case-ledger'],
    dateField: 'bailDate',
    type: '取保候审到期（12个月）',
    calcDeadline: (d) => toDateStr(addMonths(new Date(d), 12)),
  },
  // 六、监视居住（最长6个月）
  {
    moduleIds: ['squad-coercive', 'legal-case-ledger'],
    dateField: 'residentialSurveillanceDate',
    type: '监视居住到期（6个月）',
    calcDeadline: (d) => toDateStr(addMonths(new Date(d), 6)),
  },
  // 七、立案后侦查期限（一般2个月，不考虑延长）
  {
    moduleIds: ['squad-case', 'legal-case-ledger'],
    dateField: 'filingDate',
    type: '立案后侦查期限（2个月）',
    calcDeadline: (d) => toDateStr(addMonths(new Date(d), 2)),
  },
];

/* ===================== 主组件 ===================== */

export default function DeadlineWarning() {
  const darkMode = useAppStore((s) => s.darkMode);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const setEditRecord = useAppStore((s) => s.setEditRecord);

  const warnings = useMemo<WarningItem[]>(() => {
    const allRecords = getMassRecords();
    const items: WarningItem[] = [];

    for (const rule of DEADLINE_RULES) {
      const targetRecords = allRecords.filter((r) => rule.moduleIds.includes(r.moduleId));
      for (const rec of targetRecords) {
        const rawDate = rec.data?.[rule.dateField];
        if (!rawDate || typeof rawDate !== 'string') continue;
        try {
          const deadline = rule.calcDeadline(rawDate);
          const remaining = calcRemaining(new Date(deadline));
          // 只展示 30 天内的预警（如果已过期也展示）
          if (remaining > 30) continue;

          const severity: WarningItem['severity'] =
            remaining <= 0 ? 'overdue'
            : remaining <= 3 ? 'critical'
            : remaining <= 7 ? 'warning'
            : 'normal';

          const caseName = String(rec.data?.caseName || rec.data?.suspect || rec.data?.person || '未命名案件');

          items.push({
            id: `${rec.id}-${rule.dateField}-${rule.type}`,
            recordId: rec.id,
            moduleId: rec.moduleId,
            caseName: caseName.length > 16 ? caseName.slice(0, 16) + '…' : caseName,
            type: rule.type,
            deadline,
            remainingDays: remaining,
            severity,
          });
        } catch {
          // 跳过无效日期
        }
      }
    }

    // 按紧急程度排序：过期→紧急→警告→正常→剩余天数
    const ORDER: Record<string, number> = { overdue: 0, critical: 1, warning: 2, normal: 3 };
    items.sort((a, b) => {
      const sa = ORDER[a.severity] - ORDER[b.severity];
      if (sa !== 0) return sa;
      return a.remainingDays - b.remainingDays;
    });

    return items;
  }, []);

  const handleClick = (item: WarningItem) => {
    const record = getMassRecords().find((r) => r.id === item.recordId);
    if (!record) return;
    setEditRecord(record);
    setCurrentPage(item.moduleId);
    openModal('newRecord');
  };

  // 分类计数
  const countBySeverity = useMemo(() => ({
    overdue: warnings.filter((w) => w.severity === 'overdue').length,
    critical: warnings.filter((w) => w.severity === 'critical').length,
    warning: warnings.filter((w) => w.severity === 'warning').length,
  }), [warnings]);

  const totalAlerts = countBySeverity.overdue + countBySeverity.critical + countBySeverity.warning;

  if (warnings.length === 0) {
    return null; // 无可展示预警时隐藏整个板块
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.32 }}
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
      {/* 标题栏 */}
      <div style={{
        padding: '14px 18px',
        borderBottom: darkMode ? '1px solid rgba(66, 71, 79, 0.4)' : '1px solid #F3F4F6',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <AlertTriangle size={15} color={totalAlerts > 0 ? '#DC2626' : (darkMode ? '#a3c9ff' : '#2563EB')} />
        <span style={{ fontSize: 13, fontWeight: 600, color: darkMode ? '#e2e2e6' : '#1F2937' }}>
          到期预警
        </span>
        {/* 小统计 */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {countBySeverity.overdue > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: darkMode ? 'rgba(220,38,38,0.15)' : '#FEE2E2',
              color: '#DC2626',
            }}>
              已过期 {countBySeverity.overdue}
            </span>
          )}
          {countBySeverity.critical > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: darkMode ? 'rgba(234,88,12,0.15)' : '#FFEDD5',
              color: '#EA580C',
            }}>
              紧急 {countBySeverity.critical}
            </span>
          )}
          {countBySeverity.warning > 0 && (
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: darkMode ? 'rgba(234,179,8,0.15)' : '#FEF9C3',
              color: '#CA8A04',
            }}>
              将到期 {countBySeverity.warning}
            </span>
          )}
        </div>
      </div>

      {/* 预警列表 */}
      <div style={{ maxHeight: 340, overflow: 'auto' }}>
        {warnings.map((item, i) => {
          const severityColors = {
            overdue: { bg: darkMode ? 'rgba(220,38,38,0.08)' : '#FEF2F2', dot: '#DC2626', text: '#DC2626', label: '已过期' },
            critical: { bg: darkMode ? 'rgba(234,88,12,0.08)' : '#FFF7ED', dot: '#EA580C', text: '#EA580C', label: `剩余 ${item.remainingDays} 天` },
            warning: { bg: darkMode ? 'rgba(234,179,8,0.08)' : '#FFFBEB', dot: '#CA8A04', text: '#CA8A04', label: `剩余 ${item.remainingDays} 天` },
            normal: { bg: 'transparent', dot: darkMode ? '#8c919a' : '#9CA3AF', text: darkMode ? '#8c919a' : '#9CA3AF', label: `剩余 ${item.remainingDays} 天` },
          };
          const c = severityColors[item.severity];

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => handleClick(item)}
              style={{
                padding: '10px 18px',
                cursor: 'pointer',
                background: c.bg,
                borderBottom: i < warnings.length - 1
                  ? (darkMode ? '1px solid rgba(66,71,79,0.15)' : '1px solid #F9FAFB')
                  : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (item.severity === 'normal') e.currentTarget.style.background = darkMode ? 'rgba(46,125,202,0.05)' : '#FAFBFC'; }}
              onMouseLeave={(e) => { if (item.severity === 'normal') e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* 状态指示点 */}
                <motion.div
                  animate={item.severity === 'overdue' ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: c.dot,
                    boxShadow: item.severity === 'overdue' ? `0 0 8px ${c.dot}` : 'none',
                    flexShrink: 0,
                  }}
                />
                {/* 内容 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 500,
                    color: darkMode ? '#e2e2e6' : '#374151',
                    lineHeight: 1.4,
                  }}>
                    {item.caseName}
                    <span style={{
                      fontSize: 11, fontWeight: 400,
                      color: darkMode ? '#8c919a' : '#6B7280',
                      marginLeft: 6,
                    }}>
                      {item.type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 10, color: c.text, fontWeight: 600 }}>
                      {c.label}
                    </span>
                    <span style={{ fontSize: 10, color: darkMode ? '#42474f' : '#D1D5DB' }}>·</span>
                    <span style={{ fontSize: 10, color: darkMode ? '#8c919a' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <CalendarClock size={10} />
                      {item.deadline}
                    </span>
                  </div>
                </div>
                {/* 右侧图标 */}
                <Clock size={13} color={c.dot} style={{ flexShrink: 0, opacity: 0.6 }} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
