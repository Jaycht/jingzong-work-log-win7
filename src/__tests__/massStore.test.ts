import { describe, it, expect, beforeEach } from 'vitest';
import { indexedDBAdapter } from '../store/adapter';
import { getMassRecords, removeAttachmentRefsFromAllRecords } from '../store/massStore';

const KEY = 'jingzong.mass.records';

function seed(records: unknown[]): void {
  indexedDBAdapter.setItem(KEY, records);
}

describe('removeAttachmentRefsFromAllRecords (M-12 结构化遍历)', () => {
  beforeEach(() => {
    indexedDBAdapter.clear();
  });

  it('移除各级嵌套中的附件引用对象，且不破坏其它字段', () => {
    seed([
      {
        id: 'r1',
        moduleId: 'm',
        tabId: 't',
        createdAt: '',
        updatedAt: '',
        data: {
          title: '案子',
          attachments: [
            { uid: 'att-1', name: 'a.pdf' },
            { uid: 'att-2', name: 'b.pdf' },
            { uid: 'att-keep', name: 'keep.pdf' },
          ],
          nested: { files: [{ uid: 'att-1', name: 'x' }] },
          refObj: { name: 'y', uid: 'att-2' },
          note: '保留',
        },
      },
    ]);

    const removed = removeAttachmentRefsFromAllRecords(new Set(['att-1', 'att-2']));

    // att-1 出现 2 次（attachments + nested.files），att-2 出现 2 次（attachments + refObj）
    expect(removed).toBe(4);

    const data = getMassRecords()[0].data as Record<string, unknown>;
    expect(JSON.stringify(data)).not.toContain('att-1');
    expect(JSON.stringify(data)).not.toContain('att-2');
    expect(JSON.stringify(data)).toContain('att-keep');
    expect(data.title).toBe('案子');
    expect(data.note).toBe('保留');
    // attachments 数组应只剩 att-keep（尾逗号不破坏结构）
    expect(data.attachments).toEqual([{ uid: 'att-keep', name: 'keep.pdf' }]);
    // nested.files 应为空数组（整段移除后仍是合法数组）
    expect((data.nested as Record<string, unknown>).files).toEqual([]);
    // 作为对象属性值的引用对象，整段被移除
    expect(data.refObj).toBeUndefined();
  });

  it('空附件 ID 集合直接返回 0 且不改动任何数据', () => {
    seed([{ id: 'r', moduleId: 'm', tabId: 't', createdAt: '', updatedAt: '', data: { uid: 'att-x' } }]);
    expect(removeAttachmentRefsFromAllRecords(new Set())).toBe(0);
    expect(getMassRecords()[0].data).toEqual({ uid: 'att-x' });
  });

  it('uid 不存在的对象不会被误删', () => {
    seed([{ id: 'r', moduleId: 'm', tabId: 't', createdAt: '', updatedAt: '', data: { uid: 'att-other', name: 'safe' } }]);
    expect(removeAttachmentRefsFromAllRecords(new Set(['att-1']))).toBe(0);
    expect(getMassRecords()[0].data).toEqual({ uid: 'att-other', name: 'safe' });
  });

  it('多记录批量移除，仅匹配的记录被改动', () => {
    seed([
      { id: 'r1', moduleId: 'm', tabId: 't', createdAt: '', updatedAt: '', data: { f: [{ uid: 'att-1' }] } },
      { id: 'r2', moduleId: 'm', tabId: 't', createdAt: '', updatedAt: '', data: { keep: 'yes' } },
    ]);
    const removed = removeAttachmentRefsFromAllRecords(new Set(['att-1']));
    expect(removed).toBe(1);
    const recs = getMassRecords();
    expect((recs[0].data as Record<string, unknown>).f).toEqual([]);
    expect((recs[1].data as Record<string, unknown>).keep).toBe('yes');
  });
});
