// 经侦大队工作记录系统 - 类型定义

export type UserRole = 'admin' | 'supervisor' | 'user';

export interface User {
  id: string;
  name: string;
  account: string;
  badge: string;
  role: UserRole;
  roleName: string;
  position: string;
  phone?: string;
  status: 'active' | 'maintenance' | 'disabled';
  lastLogin?: string;
  avatar?: string;
}

export type RecordModule =
  | 'case' | 'interview' | 'meeting' | 'victim' | 'clue' | 'fund'
  | 'daily' | 'party' | 'report' | 'dispatch' | 'check' | 'finance'
  | 'logistics' | 'doc' | 'secret' | 'attendance' | 'alert';

export interface WorkRecord {
  id: string;
  type: RecordModule;
  title: string;
  date: string;
  status: 'ongoing' | 'completed' | 'overdue';
  creator: string;
  updater?: string;
  description?: string;
  tags?: string[];
  amount?: number;
}

export type NotificationType = 'warning' | 'danger' | 'info' | 'success';
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  time: string;
  read: boolean;
  source: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export type PageId = string;

export const MODULE_LABELS: Record<RecordModule, string> = {
  case: '案件管理', interview: '约谈管理', meeting: '会议记录',
  victim: '受害人管理', clue: '线索登记', fund: '资金分析',
  daily: '每日工作', party: '党建工作', report: '报表管理',
  dispatch: '工作部署传达', check: '考核管理', finance: '财务工作',
  logistics: '后勤管理', doc: '公文处理', secret: '保密工作',
  attendance: '考勤管理', alert: '应急处置',
};

export const POSITIONS = [
  '法制室', '涉众办', '资金分析小组', '办公室', '内勤',
  '分管控领导', '各中队长', '办案民警', '中队内勤',
];

