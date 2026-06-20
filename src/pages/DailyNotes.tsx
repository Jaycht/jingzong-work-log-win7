import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { StickyNote, Plus, Trash2, Download, Upload, X, Pen } from 'lucide-react';
import { Modal, Input, Select, DatePicker, Switch, Tag, Button, Table, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAppStore } from '../store/appStore';
import { getDailyNotes, createDailyNote, updateDailyNote, deleteDailyNote, getCustomTypes, saveCustomTypes, type DailyNote } from '../store/dailyNotesStore';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

const REPEAT_OPTIONS = [
  { value: 'none', label: '不重复' }, { value: '30min', label: '每30分钟' },
  { value: '1hour', label: '每小时' }, { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' }, { value: 'monthly', label: '每月' },
];

const SOUND_OPTIONS = [
  { value: 'QQ消息.wav', label: 'QQ消息' },
  { value: 'QQ滴滴滴.wav', label: 'QQ滴滴滴' },
  { value: 'QQ特别关心铃声.wav', label: 'QQ特别关心铃声' },
  { value: '微信消息.wav', label: '微信消息' },
  { value: '苹果消息.wav', label: '苹果消息' },
  { value: '苹果消息提醒.wav', label: '苹果消息提醒' },
  { value: '苹果叮叮.wav', label: '苹果叮叮' },
  { value: '手机QQ消息提醒.wav', label: '手机QQ消息提醒' },
  { value: '好友上线.wav', label: '好友上线' },
  { value: '报时鸟.wav', label: '报时鸟' },
];

export default function DailyNotes() {
  const showToast = useAppStore((s) => s.showToast);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [editingNote, setEditingNote] = useState<DailyNote | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [customTypes, setCustomTypes] = useState<string[]>(() => getCustomTypes());
  const [newType, setNewType] = useState('');
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const allNotes = useMemo(() => { void refreshKey; return getDailyNotes(); }, [refreshKey]);

  const filteredNotes = useMemo(() => {
    let list = allNotes;
    if (filterType) list = list.filter((n) => n.type === filterType);
    if (filterText.trim()) {
      const kw = filterText.trim().toLowerCase();
      list = list.filter((n) =>
        (n.title && n.title.toLowerCase().includes(kw)) ||
        (n.contents && n.contents.some((c) => c.toLowerCase().includes(kw))) ||
        (n.notes && n.notes.toLowerCase().includes(kw))
      );
    }
    return list;
  }, [allNotes, filterType, filterText]);

  const handleDelete = useCallback((id: string, title: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除记录「${title || '无标题'}」吗？删除后不可恢复。`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        deleteDailyNote(id);
        setRefreshKey((k) => k + 1);
        showToast('已删除', 'success');
      },
    });
  }, [showToast]);

  const handleBatchDelete = useCallback(() => {
    if (selectedRowKeys.length === 0) return;
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？删除后不可恢复。`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        for (const key of selectedRowKeys) deleteDailyNote(String(key));
        setSelectedRowKeys([]);
        setRefreshKey((k) => k + 1);
        showToast(`已删除 ${selectedRowKeys.length} 条记录`, 'success');
      },
    });
  }, [selectedRowKeys, showToast]);

  const handleExport = () => {
    const exportData = selectedRowKeys.length > 0
      ? filteredNotes.filter((n) => selectedRowKeys.includes(n.id))
      : filteredNotes;
    if (exportData.length === 0) { showToast('没有可导出的数据', 'warning'); return; }
    const rows = exportData.map((n) => ({ 日期: n.date, 标题: n.title, 类型: n.type, 内容: n.contents.join('\n'), 提醒: n.reminder?.enabled ? '已设置' : '无', 备注: n.notes, 创建时间: n.createdAt }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '随手记');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `随手记_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    showToast(`已导出 ${exportData.length} 条记录`, 'success');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let count = 0;
        for (const row of rows) {
          const r = row as Record<string, string>;
          createDailyNote({ date: r['日期'] || dayjs().format('YYYY-MM-DD'), title: r['标题'] || '', type: r['类型'] || '一般工作', contents: r['内容'] ? String(r['内容']).split('\n') : [''], notes: r['备注'] || '' });
          count++;
        }
        setRefreshKey((k) => k + 1);
        showToast(`成功导入 ${count} 条记录`, 'success');
      } catch { showToast('导入失败', 'error'); }
    };
    input.click();
  };

  const handleAddType = () => {
    if (!newType.trim()) return;
    if (customTypes.includes(newType.trim())) { showToast('类型已存在', 'warning'); return; }
    const next = [...customTypes, newType.trim()];
    setCustomTypes(next); saveCustomTypes(next); setNewType(''); showToast('类型已添加', 'success');
  };

  const handleDeleteType = (t: string) => { const next = customTypes.filter((x) => x !== t); setCustomTypes(next); saveCustomTypes(next); };

  const columns: ColumnsType<DailyNote> = [
    {
      title: '日期', dataIndex: 'date', width: 110,
      sorter: (a, b) => a.date.localeCompare(b.date),
      defaultSortOrder: 'descend',
    },
    {
      title: '标题', dataIndex: 'title', width: 160, ellipsis: true,
      sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
    },
    {
      title: '类型', dataIndex: 'type', width: 90,
      filters: customTypes.map((t) => ({ text: t, value: t })),
      onFilter: (value, record) => record.type === value,
      render: (t: string) => <Tag color="purple">{t}</Tag>,
    },
    {
      title: '内容', dataIndex: 'contents', width: 200, ellipsis: true,
      render: (c: string[]) => c?.[0] || '—',
    },
    {
      title: '提醒时间', width: 150, align: 'center',
      sorter: (a, b) => {
        const ta = a.reminder?.enabled && a.reminder?.time ? new Date(a.reminder.time).getTime() : 0;
        const tb = b.reminder?.enabled && b.reminder?.time ? new Date(b.reminder.time).getTime() : 0;
        return ta - tb;
      },
      render: (_: unknown, rec: DailyNote) => {
        if (!rec.reminder?.enabled || !rec.reminder?.time) return <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>;
        const d = new Date(rec.reminder.time);
        const pad = (n: number) => String(n).padStart(2, '0');
        return <span style={{ fontSize: 12 }}>{d.getFullYear()}-{pad(d.getMonth()+1)}-{pad(d.getDate())} {pad(d.getHours())}:{pad(d.getMinutes())}</span>;
      },
    },
    {
      title: '重复', width: 80, align: 'center',
      render: (_: unknown, rec: DailyNote) => {
        if (!rec.reminder?.enabled || !rec.reminder?.repeat || rec.reminder.repeat === 'none') return <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>;
        const map: Record<string, string> = { '30min': '每30分钟', '1hour': '每小时', daily: '每日', weekly: '每周', monthly: '每月' };
        return <Tag color="blue" style={{ fontSize: 11 }}>{map[rec.reminder.repeat] || rec.reminder.repeat}</Tag>;
      },
    },
    {
      title: '备注', dataIndex: 'notes', width: 120, ellipsis: true,
      render: (v: string) => v || '—',
    },
    {
      title: '操作', width: 130, fixed: 'right' as const,
      render: (_: unknown, rec: DailyNote) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<Pen size={13} />} onClick={() => setEditingNote(rec)}>编辑</Button>
          <Button type="link" size="small" danger icon={<Trash2 size={13} />} onClick={() => handleDelete(rec.id, rec.title)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg, #7C3AED, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(124,58,237,.3)' }}>
          <StickyNote size={20} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 700 }}>日常随手记</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>快速记录 · 导入导出</div>
        </div>
      </motion.div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={() => setShowNew(true)} style={{ gap: 6 }}><Plus size={14} /> 新建记录</button>
        <button className="btn btn-ghost" onClick={handleExport} style={{ gap: 6 }}><Download size={14} /> {selectedRowKeys.length > 0 ? `导出选中(${selectedRowKeys.length})` : '导出'}</button>
        <button className="btn btn-ghost" onClick={handleImport} style={{ gap: 6 }}><Upload size={14} /> 导入</button>
        {selectedRowKeys.length > 0 && (
          <button className="btn btn-ghost" onClick={handleBatchDelete} style={{ gap: 6, color: '#DC2626' }}><Trash2 size={14} /> 批量删除({selectedRowKeys.length})</button>
        )}
        <button className="btn btn-ghost" onClick={() => setShowTypeManager(true)} style={{ gap: 6 }}>类型管理</button>
        <div style={{ flex: 1 }} />
        <Input.Search
          allowClear
          placeholder="搜索标题、内容..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          onSearch={(v) => setFilterText(v)}
          style={{ width: 200 }}
        />
      </div>

      <div className="panel" style={{ overflow: 'hidden', minHeight: 520 }}>
        <Table
          columns={columns}
          dataSource={filteredNotes}
          rowKey="id"
          size="middle"
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: '暂无记录' }}
          onRow={(record) => ({ onDoubleClick: () => setEditingNote(record) })}
        />
      </div>

      {(showNew || editingNote) && (
        <NoteModal note={editingNote} customTypes={customTypes}
          onClose={() => { setShowNew(false); setEditingNote(null); }}
          onSaved={() => { setRefreshKey((k) => k + 1); setShowNew(false); setEditingNote(null); }} />
      )}

      {showTypeManager && (
        <Modal open title="类型管理" onCancel={() => setShowTypeManager(false)} footer={null} width={400} maskClosable={false}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="输入新类型名称" onPressEnter={handleAddType} style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={handleAddType}>添加</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customTypes.map((t) => (<Tag key={t} closable onClose={() => handleDeleteType(t)} color="purple">{t}</Tag>))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function NoteModal({ note, customTypes, onClose, onSaved }: { note: DailyNote | null; customTypes: string[]; onClose: () => void; onSaved: () => void }) {
  const showToast = useAppStore((s) => s.showToast);
  const [date, setDate] = useState(dayjs(note?.date || undefined));
  const [title, setTitle] = useState(note?.title || '');
  const [type, setType] = useState(note?.type || customTypes[0] || '一般工作');
  const [contents, setContents] = useState<string[]>(note?.contents?.length ? note.contents : ['']);
  const [reminderEnabled, setReminderEnabled] = useState(note?.reminder?.enabled || false);
  const [reminderTime, setReminderTime] = useState(() => {
    if (note?.reminder?.time) {
      const d = dayjs(note.reminder.time);
      return d.isValid() ? d : dayjs().add(30, 'minute');
    }
    return dayjs().add(30, 'minute');
  });
  const [reminderRepeat, setReminderRepeat] = useState(note?.reminder?.repeat || 'none');
  const [reminderSound, setReminderSound] = useState(note?.reminder?.sound || 'QQ消息.wav');
  const [notesText, setNotesText] = useState(note?.notes || '');

  const handleSave = () => {
    if (!title.trim()) { showToast('请输入标题', 'warning'); return; }
    const reminderData = reminderEnabled
      ? { enabled: true, time: reminderTime.toISOString(), repeat: reminderRepeat, sound: reminderSound }
      : { enabled: false, time: '', repeat: 'none', sound: reminderSound };
    const data = {
      date: date.format('YYYY-MM-DD'),
      title: title.trim(),
      type,
      contents: contents.filter((c) => c.trim()),
      reminder: reminderData,
      notes: notesText,
    };
    if (note) { updateDailyNote(note.id, data); showToast('已更新', 'success'); } else { createDailyNote(data); showToast('已创建', 'success'); }
    onSaved();
  };

  return (
    <Modal open title={note ? '编辑记录' : '新建记录'} onCancel={onClose} width={600} onOk={handleSave} okText={note ? '更新' : '保存'} maskClosable={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <DatePicker value={date} onChange={(d) => d && setDate(d)} style={{ flex: 1 }} />
          <Select value={type} onChange={setType} style={{ flex: 1 }} options={customTypes.map((t) => ({ label: t, value: t }))} />
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6 }}>具体内容</div>
          {contents.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <Input.TextArea value={c} onChange={(e) => { const next = [...contents]; next[i] = e.target.value; setContents(next); }} placeholder={`内容 ${i + 1}`} autoSize={{ minRows: 1, maxRows: 3 }} style={{ flex: 1 }} />
              {contents.length > 1 && (<button className="btn btn-sm btn-ghost" onClick={() => setContents(contents.filter((_, idx) => idx !== i))}><X size={12} /></button>)}
            </div>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={() => setContents([...contents, ''])} style={{ gap: 4 }}><Plus size={12} /> 添加内容</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Switch checked={reminderEnabled} onChange={setReminderEnabled} />
          <span style={{ fontSize: 13 }}>设置提醒</span>
          {reminderEnabled && (<>
            <DatePicker showTime value={reminderTime} onChange={(d) => d && setReminderTime(d)} style={{ width: 180 }} />
            <Select value={reminderRepeat} onChange={setReminderRepeat} style={{ width: 120 }} options={REPEAT_OPTIONS} />
          </>)}
        </div>
        {reminderEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13 }}>提醒声音</span>
            <Select value={reminderSound} onChange={setReminderSound} style={{ width: 200 }} options={SOUND_OPTIONS} />
          </div>
        )}
        <Input.TextArea value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder="备注（可选）" autoSize={{ minRows: 2, maxRows: 4 }} />
      </div>
    </Modal>
  );
}
