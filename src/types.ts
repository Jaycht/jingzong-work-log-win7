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

export const POSITIONS = [
  '法制室', '涉众办', '资金分析小组', '办公室', '内勤',
  '分管控领导', '各中队长', '办案民警', '中队内勤',
];

