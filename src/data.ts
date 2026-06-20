import type { User } from './types';

export const CURRENT_USER: User = {
  id: '1',
  name: '当前用户',
  account: '',
  badge: '',
  role: 'user',
  roleName: '用户',
  position: '',
  status: 'active',
};

export const MOCK_USERS: User[] = [];

export const CASE_STATS = [
  { label: '案件总数', value: '0', change: '-', up: true, color: '#1B5E9B' },
  { label: '已结案', value: '0', change: '-', up: true, color: '#38A169' },
  { label: '侦办中', value: '0', change: '-', up: false, color: '#E67E22' },
  { label: '超期未结', value: '0', change: '-', up: false, color: '#D32F2F' },
];

export const KANBAN_COLUMNS = [
  { id: 'pending', label: '待受理', color: '#9CA3AF', count: 0 },
  { id: 'investigating', label: '侦办中', color: '#1B5E9B', count: 0 },
  { id: 'legal', label: '法制审核', color: '#E67E22', count: 0 },
  { id: 'transfer', label: '待移交', color: '#9C27B0', count: 0 },
  { id: 'closed', label: '已结案', color: '#38A169', count: 0 },
];
