/**
 * 法定办案时限规则 —— 单一数据源（C-M2）
 * 解决 useReminderService / DeadlineWarning / Dashboard 三处规则重复且已出现分歧的问题。
 * 例如"侦查羁押（2个月）"此前在 useReminderService 错用 filingDate 计算，
 * 而 DeadlineWarning / Dashboard 使用 arrestDate，本文件统一以 arrestDate 为准（符合刑诉法）。
 */

import { addDays, addMonths, toDateStr } from '../utils/format';

export interface LegalDeadlineRule {
  /** 稳定 ID，用于提醒去重 / 缓存键 */
  id: string;
  /** 该规则适用的模块 ID 列表 */
  moduleIds: string[];
  /** 触发规则所需的日期字段名 */
  dateField: string;
  /** 到期事项中文名 */
  label: string;
  /** 计算到期日（ISO 字符串，仅日期部分） */
  calcDeadline: (dateStr: string) => string;
}

export const LEGAL_DEADLINE_RULES: LegalDeadlineRule[] = [
  {
    id: 'receive-to-filing',
    moduleIds: ['legal-report-case', 'legal-case-ledger', 'squad-case'],
    dateField: 'receiveDate',
    label: '受案→立案（7日）',
    calcDeadline: (d) => toDateStr(addDays(new Date(d), 7)),
  },
  {
    id: 'criminal-detention',
    moduleIds: ['squad-coercive', 'legal-case-ledger'],
    dateField: 'criminalDetentionDate',
    label: '刑事拘留（30日）',
    calcDeadline: (d) => toDateStr(addDays(new Date(d), 30)),
  },
  {
    id: 'arrest-review',
    moduleIds: ['squad-coercive'],
    dateField: 'criminalDetentionDate',
    label: '提请逮捕审查（7日）',
    calcDeadline: (d) => toDateStr(addDays(new Date(d), 23)),
  },
  {
    id: 'detention-arrest',
    moduleIds: ['squad-coercive', 'legal-case-ledger', 'squad-case'],
    dateField: 'arrestDate',
    label: '侦查羁押（2个月）',
    calcDeadline: (d) => toDateStr(addMonths(new Date(d), 2)),
  },
  {
    id: 'bail',
    moduleIds: ['squad-coercive', 'legal-case-ledger'],
    dateField: 'bailDate',
    label: '取保候审（12个月）',
    calcDeadline: (d) => toDateStr(addMonths(new Date(d), 12)),
  },
  {
    id: 'residential-surveillance',
    moduleIds: ['squad-coercive', 'legal-case-ledger'],
    dateField: 'residentialSurveillanceDate',
    label: '监视居住（6个月）',
    calcDeadline: (d) => toDateStr(addMonths(new Date(d), 6)),
  },
  {
    id: 'investigation-filing',
    moduleIds: ['squad-case', 'legal-case-ledger'],
    dateField: 'filingDate',
    label: '立案侦查（2个月）',
    calcDeadline: (d) => toDateStr(addMonths(new Date(d), 2)),
  },
  {
    id: 'petition-legal-deadline',
    moduleIds: ['mass-petition'],
    dateField: 'legalDeadline',
    label: '信访法定办结（60日）',
    calcDeadline: (d) => toDateStr(addDays(new Date(d), 60)),
  },
  {
    id: 'freeze-expire',
    moduleIds: ['evidence-freeze'],
    dateField: 'expireDate',
    label: '冻结到期',
    calcDeadline: (d) => toDateStr(new Date(d)),
  },
  {
    id: 'report-submit-deadline',
    moduleIds: ['office-doc-report'],
    dateField: 'deadline',
    label: '报表报送时限',
    calcDeadline: (d) => toDateStr(new Date(d)),
  },
];

export type DeadlineSeverity = 'overdue' | 'critical' | 'warning' | 'normal';

/** 统一剩余天数的严重度分级（C-M2）：≤0 逾期、≤3 紧急、≤7 预警、其余正常 */
export function getDeadlineSeverity(remainingDays: number): DeadlineSeverity {
  if (remainingDays <= 0) return 'overdue';
  if (remainingDays <= 3) return 'critical';
  if (remainingDays <= 7) return 'warning';
  return 'normal';
}
