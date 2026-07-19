import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDailyNotes,
  createDailyNote,
  updateDailyNote,
  deleteDailyNote,
} from '../store/dailyNotesStore';

/**
 * #1 回归测试：随手记的"建库即见"同步读写语义。
 * 根因是 UI 层保存后未刷新列表（已用 try/finally 修复），
 * 这里锁定底层前提——createDailyNote 后 getDailyNotes 必须立即包含新记录，
 * 否则即便列表刷新也读不到带提醒的新记录。
 */
describe('dailyNotesStore — 随手记同步读写（#1 回归）', () => {
  beforeEach(() => {
    for (const n of getDailyNotes()) deleteDailyNote(n.id);
  });

  it('带提醒新建记录后，getDailyNotes 立即包含该记录（同步缓存）', () => {
    const before = getDailyNotes().length;
    const note = createDailyNote({
      title: '带提醒的备忘',
      date: '2026-07-19',
      type: '一般工作',
      reminder: { enabled: true, time: new Date(Date.now() + 60000).toISOString(), repeat: 'none', sound: 'QQ消息.wav' },
    });
    const after = getDailyNotes();
    expect(after.length).toBe(before + 1);
    expect(after.some((n) => n.id === note.id && n.reminder?.enabled)).toBe(true);
  });

  it('updateDailyNote 立即反映在读取结果中', () => {
    const note = createDailyNote({ title: '原', date: '2026-07-19' });
    updateDailyNote(note.id, { title: '改后' });
    const found = getDailyNotes().find((n) => n.id === note.id);
    expect(found?.title).toBe('改后');
  });

  it('deleteDailyNote 立即移除记录', () => {
    const note = createDailyNote({ title: '删', date: '2026-07-19' });
    const before = getDailyNotes().length;
    deleteDailyNote(note.id);
    expect(getDailyNotes().length).toBe(before - 1);
    expect(getDailyNotes().some((n) => n.id === note.id)).toBe(false);
  });
});

/**
 * #2 回归测试：getDailyNotes 必须返回「副本」而非适配器内存缓存的同一引用。
 * 根因是 indexedDBAdapter.getItem 返回缓存同一引用，而 createDailyNote 用 notes.unshift(note)
 * 原地修改该数组；若 getDailyNotes 也返回同一引用，则 UI 的 setAllNotes(getDailyNotes())
 * 拿到同引用 → React 跳过重渲染、useMemo 不重算 → 卡片不刷新（重启才显示）。
 * 这里锁定「返回新引用 + 不污染后续读取」两条契约，防止 #2 回退。
 */
describe('dailyNotesStore — getDailyNotes 返回副本（#2 回归）', () => {
  beforeEach(() => {
    for (const n of getDailyNotes()) deleteDailyNote(n.id);
  });

  it('每次调用返回新数组引用（强制 React 重渲染，杜绝同引用跳过更新）', () => {
    createDailyNote({ title: 'A', date: '2026-07-19' });
    const a = getDailyNotes();
    const b = getDailyNotes();
    expect(a).not.toBe(b); // 不同引用 → setAllNotes 触发刷新
    expect(a.length).toBe(b.length);
  });

  it('原地修改返回数组不影响下一次读取（防止 unshift 污染 UI 持有的引用）', () => {
    createDailyNote({ title: 'B', date: '2026-07-19' });
    const a = getDailyNotes();
    // 模拟 createDailyNote 的 unshift 行为：若返回的是缓存同引用，UI 持有的数组也会被污染
    a.unshift({ id: 'fake-pollution', title: '污染项', date: '', type: '', priority: 'normal', contents: [], reminder: { enabled: false, time: '', repeat: 'none' }, notes: '', attachments: [], createdAt: '', updatedAt: '' } as any);
    const b = getDailyNotes();
    expect(b.some((n) => n.id === 'fake-pollution')).toBe(false); // 下一次读取不含污染项
    expect(b.length).toBe(a.length - 1);
  });
});
