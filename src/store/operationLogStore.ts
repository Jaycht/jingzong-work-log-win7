/**
 * 操作日志存储
 * 自动记录所有重要操作，存储在 localStorage 中
 */

import { localStorageAdapter } from './adapter';

const STORAGE_KEY = 'jingzong.operation.logs.v1';

export interface OperationLog {
  id: string;
  time: string;
  user: string;
  action: string;
  detail: string;
  ip: string;
  type: 'create' | 'edit' | 'delete' | 'export' | 'login' | 'logout' | 'system' | 'import' | 'backup';
}

export function getOperationLogs(): OperationLog[] {
  return localStorageAdapter.getItem<OperationLog[]>(STORAGE_KEY, []);
}

export function addOperationLog(log: Omit<OperationLog, 'id' | 'time'>): OperationLog {
  const logs = getOperationLogs();
  const newLog: OperationLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
  logs.unshift(newLog);
  // 保留最近 5000 条
  while (logs.length > 5000) logs.pop();
  localStorageAdapter.setItem(STORAGE_KEY, logs);
  return newLog;
}

export function clearOperationLogs(): void {
  localStorageAdapter.removeItem(STORAGE_KEY);
}
