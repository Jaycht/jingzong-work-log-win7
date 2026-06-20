/**
 * 日常随手记存储
 */
import { indexedDBAdapter, localStorageAdapter } from './adapter';
import { addOperationLog } from './operationLogStore';
import { useAppStore } from './appStore';

const STORAGE_KEY = 'jingzong.dailyNotes';

export interface DailyNote {
  id: string;
  date: string;
  title: string;
  type: string;
  contents: string[];
  reminder: { enabled: boolean; time: string; repeat: string; sound?: string };
  notes: string;
  attachments: any[];
  createdAt: string;
  updatedAt: string;
}

function currentUser(): string {
  try { return useAppStore.getState().userName || 'system'; } catch { return 'system'; }
}

export function getDailyNotes(): DailyNote[] {
  return indexedDBAdapter.getItem<DailyNote[]>(STORAGE_KEY, []);
}

export function getCustomTypes(): string[] {
  return localStorageAdapter.getItem<string[]>('jingzong.dailyNoteTypes', ['一般工作', '调查取证', '会议', '其他']);
}

export function saveCustomTypes(types: string[]): void {
  localStorageAdapter.setItem('jingzong.dailyNoteTypes', types);
}

export function createDailyNote(data: Partial<DailyNote>): DailyNote {
  const notes = getDailyNotes();
  const now = new Date().toISOString();
  const note: DailyNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: data.date || now.slice(0, 10),
    title: data.title || '',
    type: data.type || '一般工作',
    contents: data.contents || [''],
    reminder: data.reminder || { enabled: false, time: '', repeat: 'none', sound: 'QQ消息.wav' },
    notes: data.notes || '',
    attachments: data.attachments || [],
    createdAt: now,
    updatedAt: now,
  };
  notes.unshift(note);
  indexedDBAdapter.setItem(STORAGE_KEY, notes);
  addOperationLog({ user: currentUser(), action: '新建', detail: `新建随手记 "${note.title}"`, ip: 'local', type: 'create' });
  return note;
}

export function updateDailyNote(id: string, data: Partial<DailyNote>): DailyNote | null {
  const notes = getDailyNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  notes[idx] = { ...notes[idx], ...data, updatedAt: new Date().toISOString() };
  indexedDBAdapter.setItem(STORAGE_KEY, notes);
  addOperationLog({ user: currentUser(), action: '更新', detail: `更新随手记 "${notes[idx].title}"`, ip: 'local', type: 'edit' });
  return notes[idx];
}

export function deleteDailyNote(id: string): void {
  const notes = getDailyNotes().filter((n) => n.id !== id);
  indexedDBAdapter.setItem(STORAGE_KEY, notes);
  addOperationLog({ user: currentUser(), action: '删除', detail: `删除随手记 ${id}`, ip: 'local', type: 'delete' });
  // 清理该记录在 localStorage 中残留的提醒状态
  try {
    ['jingzong.reminder.dismissed', 'jingzong.reminder.triggered', 'jingzong.reminder.snoozed'].forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        const filtered = data.filter((v: string) => v !== id);
        localStorage.setItem(key, JSON.stringify(filtered));
      } else if (typeof data === 'object' && data[id] !== undefined) {
        delete data[id];
        localStorage.setItem(key, JSON.stringify(data));
      }
    });
  } catch {}
}
