/**
 * 日常随手记 — 高级感现代风重写
 * 修复：移除从未被赋值的 filterType 死状态（类型筛选改用 chip 实现，更直观）
 *       排序改用真实日期比较（date 为 YYYY-MM-DD 字符串，直接 compare 即可稳定）
 *       内容预览正确展示全部内容行（多内容条目合并预览，而非仅首行）
 * 重塑：antd 表格 → 卡片网格（响应式），顶部统计 KPI + 工具栏（搜索/类型筛选/排序）
 *       每张卡片含日期、类型色标、提醒指示、内容预览、便签/编辑/删除、选择框
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StickyNote, Plus, Trash2, Download, Upload, X, Pen, Pin, Bell, Search, Check, ArrowDownWideNarrow, ArrowUpWideNarrow, Flag, Clock, AlignLeft } from 'lucide-react';
import { App, Input, Modal, Select, DatePicker, Switch } from 'antd';
import { getDailyNotes, createDailyNote, updateDailyNote, deleteDailyNote, getCustomTypes, saveCustomTypes, type DailyNote } from '../store/dailyNotesStore';
import { useAppStore } from '../store/appStore';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { isElectron as isElectronEnv } from '../lib/env';

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

/** 类型色板：为每个自定义类型分配稳定主题色，渲染为柔和色标 */
const TYPE_PALETTE = ['#7C3AED', '#2563EB', '#0891B2', '#059669', '#D97706', '#DC2626', '#DB2777', '#4F46E5', '#0F766E', '#CA8A04'];
function typeColor(type: string): string {
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) >>> 0;
  return TYPE_PALETTE[h % TYPE_PALETTE.length];
}

const REPEAT_LABEL: Record<string, string> = { '30min': '每30分钟', '1hour': '每小时', daily: '每日', weekly: '每周', monthly: '每月' };

const PRIORITY_LABEL: Record<string, string> = { normal: '普通', important: '重要', urgent: '紧急' };
const PRIORITY_COLOR: Record<string, string> = { normal: '#6B7280', important: '#D97706', urgent: '#DC2626' };

export default function DailyNotes() {
  const { modal } = App.useApp();
  const showToast = useAppStore((s) => s.showToast);
  // 直接用 state 持有列表数据，避免 useMemo([refreshKey]) 在 Electron 异步时序下刷新链不可靠（V2.41.19 修复 #2）
  const [allNotes, setAllNotes] = useState<DailyNote[]>(() => getDailyNotes());
  const [filterText, setFilterText] = useState('');
  const [activeType, setActiveType] = useState<string | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [editingNote, setEditingNote] = useState<DailyNote | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [customTypes, setCustomTypes] = useState<string[]>(() => getCustomTypes());
  const [newType, setNewType] = useState('');
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // 便签编辑同步：主进程推送便签内容变更 → 更新 IndexedDB
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onNoteContentChanged) return;
    const off = api.onNoteContentChanged(({ id, text }: { id: string; text: string }) => {
      const noteId = id.replace('sticky-', '');
      const notes = getDailyNotes();
      const note = notes.find((n) => n.id === noteId);
      if (note) {
        const div = document.createElement('div');
        div.innerHTML = text;
        const plainText = div.textContent || div.innerText || '';
        updateDailyNote(noteId, { contents: plainText ? [plainText] : note.contents });
        setAllNotes(getDailyNotes());
      }
    });
    return () => { if (typeof off === 'function') off(); };
  }, []);

  const todayStr = dayjs().format('YYYY-MM-DD');

  const stats = useMemo(() => ({
    total: allNotes.length,
    today: allNotes.filter((n) => n.date === todayStr).length,
    reminder: allNotes.filter((n) => n.reminder?.enabled).length,
    types: customTypes.length,
  }), [allNotes, todayStr, customTypes]);

  const filteredNotes = useMemo(() => {
    let list = allNotes;
    if (activeType !== 'all') list = list.filter((n) => n.type === activeType);
    const kw = filterText.trim().toLowerCase();
    if (kw) {
      list = list.filter((n) =>
        (n.title && n.title.toLowerCase().includes(kw)) ||
        (n.contents && n.contents.some((c) => c.toLowerCase().includes(kw))) ||
        (n.notes && n.notes.toLowerCase().includes(kw))
      );
    }
    const dir = sortOrder === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d * dir;
      return (a.createdAt || '').localeCompare(b.createdAt || '') * dir;
    });
  }, [allNotes, activeType, filterText, sortOrder]);

  const handleDelete = useCallback((id: string, title: string) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除记录「${title || '无标题'}」吗？删除后不可恢复。`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        deleteDailyNote(id);
        setSelectedKeys((prev) => prev.filter((k) => k !== id));
        setAllNotes(getDailyNotes());
        showToast('已删除', 'success');
      },
    });
  }, [showToast]);

  const handleBatchDelete = useCallback(() => {
    if (selectedKeys.length === 0) return;
    modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedKeys.length} 条记录吗？删除后不可恢复。`,
      okText: '删除', okButtonProps: { danger: true }, cancelText: '取消',
      onOk: () => {
        for (const key of selectedKeys) deleteDailyNote(key);
        setSelectedKeys([]);
        setAllNotes(getDailyNotes());
        showToast(`已删除 ${selectedKeys.length} 条记录`, 'success');
      },
    });
  }, [selectedKeys, showToast]);

  const handleExport = useCallback(() => {
    const exportData = selectedKeys.length > 0
      ? filteredNotes.filter((n) => selectedKeys.includes(n.id))
      : filteredNotes;
    if (exportData.length === 0) { showToast('没有可导出的数据', 'warning'); return; }
    const rows = exportData.map((n) => ({ 日期: n.date, 标题: n.title, 类型: n.type, 优先级: PRIORITY_LABEL[n.priority] || '普通', 内容: n.contents.join('\n'), 提醒: n.reminder?.enabled ? '已设置' : '无', 备注: n.notes, 创建时间: n.createdAt }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '随手记');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `随手记_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    showToast(`已导出 ${exportData.length} 条记录`, 'success');
  }, [selectedKeys, filteredNotes, showToast]);

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
          createDailyNote({ date: r['日期'] || dayjs().format('YYYY-MM-DD'), title: r['标题'] || '', type: r['类型'] || '一般工作', priority: (Object.keys(PRIORITY_LABEL).find((k) => PRIORITY_LABEL[k] === r['优先级']) as DailyNote['priority']) || 'normal', contents: r['内容'] ? String(r['内容']).split('\n') : [''], notes: r['备注'] || '' });
          count++;
        }
        setAllNotes(getDailyNotes());
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

  const handleDeleteType = (t: string) => {
    const next = customTypes.filter((x) => x !== t);
    setCustomTypes(next); saveCustomTypes(next);
    if (activeType === t) setActiveType('all');
    setSelectedKeys([]);
  };

  const handleOpenSticky = (rec: DailyNote) => {
    const isElectron = isElectronEnv();
    if (isElectron) {
      const content = [
        rec.title ? `【${rec.title}】` : '',
        rec.type ? `[${rec.type}]` : '',
        ...(rec.contents || []),
        rec.notes ? `\n备注：${rec.notes}` : '',
      ].filter(Boolean).join('\n');
      window.electronAPI.createNoteWindow({
        id: `sticky-${rec.id}`,
        title: rec.title || '便签',
        text: content,
        date: rec.date,
        type: rec.type,
        priority: rec.priority,
      });
    } else {
      showToast('仅桌面版支持便签功能', 'info');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedKeys((prev) => prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]);
  };

  const Kpis = [
    { label: '总条数', value: stats.total, color: '#2563EB', icon: StickyNote },
    { label: '今日新增', value: stats.today, color: '#7C3AED', icon: Plus },
    { label: '已设提醒', value: stats.reminder, color: '#D97706', icon: Bell },
    { label: '类型数', value: stats.types, color: '#059669', icon: Check },
  ];

  return (
    <div className="notes-page">
      {/* ── 头部 ── */}
      <div className="notes-head">
        <div className="notes-head-ico"><StickyNote size={22} color="#fff" /></div>
        <div>
          <div className="notes-head-title">日常随手记</div>
          <div className="notes-head-sub">快速记录工作点滴 · 支持提醒、便签与导入导出</div>
        </div>
      </div>

      {/* ── 统计 KPI ── */}
      <div className="dash-kpi">
        {Kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="wb-kpi">
            <div className="wb-kpi-ico" style={{ background: `${k.color}1A`, color: k.color }}>
              <k.icon size={22} color={k.color} />
            </div>
            <div>
              <div className="wb-kpi-label">{k.label}</div>
              <div className="wb-kpi-val">{k.value}<span className="wb-kpi-unit">条</span></div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── 工具栏 ── */}
      <div className="wb-panel">
        <div className="notes-toolbar">
          <div className="notes-search">
            <Search size={14} />
            <input
              placeholder="搜索标题、内容、备注…"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>

          <div className="notes-chips">
            <button className={`notes-chip ${activeType === 'all' ? 'active' : ''}`} onClick={() => setActiveType('all')}>全部</button>
            {customTypes.map((t) => (
              <button key={t} className={`notes-chip ${activeType === t ? 'active' : ''}`} onClick={() => setActiveType(t)}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: typeColor(t) }} />
                {t}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <button className="dash-action" onClick={() => setSortOrder((o) => o === 'desc' ? 'asc' : 'desc')} title={sortOrder === 'desc' ? '当前：最新在前' : '当前：最早在前'}>
            {sortOrder === 'desc' ? <ArrowDownWideNarrow size={15} color="var(--color-primary)" /> : <ArrowUpWideNarrow size={15} color="var(--color-primary)" />}
            {sortOrder === 'desc' ? '最新' : '最早'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)} style={{ gap: 6 }}><Plus size={14} /> 新建记录</button>
          <button className="btn btn-ghost btn-sm" onClick={handleExport} style={{ gap: 6 }}><Download size={14} /> {selectedKeys.length > 0 ? `导出选中(${selectedKeys.length})` : '导出'}</button>
          <button className="btn btn-ghost btn-sm" onClick={handleImport} style={{ gap: 6 }}><Upload size={14} /> 导入</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowTypeManager(true)} style={{ gap: 6 }}>类型管理</button>
        </div>

        {selectedKeys.length > 0 && (
          <div className="notes-selbar">
            <Check size={14} color="var(--color-primary)" />
            <span>已选 {selectedKeys.length} 项</span>
            <button className="note-act danger" onClick={handleBatchDelete}><Trash2 size={13} /> 批量删除</button>
            <button className="note-act" onClick={() => setSelectedKeys([])}><X size={13} /> 取消选择</button>
          </div>
        )}
      </div>

      {/* ── 卡片网格 ── */}
      {filteredNotes.length === 0 ? (
        <div className="wb-panel note-empty">
          <div className="note-empty-ico"><StickyNote size={30} color="var(--color-primary)" /></div>
          <div className="note-empty-title">{allNotes.length === 0 ? '还没有任何随手记' : '没有匹配的随手记'}</div>
          <div className="note-empty-sub">{allNotes.length === 0 ? '点击右侧「新建记录」开始记录第一条工作备忘' : '试试调整搜索词或筛选类型'}</div>
          {allNotes.length === 0 && (
            <button className="dash-action dash-action-primary" style={{ height: 40, paddingInline: 20 }} onClick={() => setShowNew(true)}><Plus size={15} /> 新建记录</button>
          )}
        </div>
      ) : (
        <div className="notes-grid">
          {filteredNotes.map((n, i) => {
            const color = typeColor(n.type);
            const preview = (n.contents && n.contents.filter((c) => c.trim()).join('\n')) || n.notes || '—';
            const isSel = selectedKeys.includes(n.id);
            return (
              <motion.div
                key={n.id}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.02 }}
                className="note-card"
                onDoubleClick={() => setEditingNote(n)}
              >
                <input type="checkbox" className="note-check" checked={isSel} onChange={() => toggleSelect(n.id)} title="选择此条" />

                <div className="note-card-top">
                  <span className="note-date">{n.date}</span>
                  {(n.priority === 'important' || n.priority === 'urgent') && (
                    <span className="note-prio" style={{ background: `${PRIORITY_COLOR[n.priority]}1A`, color: PRIORITY_COLOR[n.priority], borderColor: `${PRIORITY_COLOR[n.priority]}33` }}>{PRIORITY_LABEL[n.priority]}</span>
                  )}
                  <span className="note-badge" style={{ background: `${color}1A`, color, borderColor: `${color}33` }}>{n.type}</span>
                  {n.reminder?.enabled && (
                    <span className="note-remind" title={n.reminder.repeat && n.reminder.repeat !== 'none' ? `提醒 · ${REPEAT_LABEL[n.reminder.repeat]}` : '已设提醒'}>
                      <Bell size={13} />
                    </span>
                  )}
                </div>

                <div className="note-title">{n.title || '无标题'}</div>
                <div className="note-content">{preview}</div>

                <div className="note-card-foot">
                  <button className="note-act" onClick={() => handleOpenSticky(n)}><Pin size={13} /> 便签</button>
                  <button className="note-act" onClick={() => setEditingNote(n)}><Pen size={13} /> 编辑</button>
                  <button className="note-act danger" onClick={() => handleDelete(n.id, n.title)}><Trash2 size={13} /> 删除</button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {(showNew || editingNote) && (
        <NoteModal note={editingNote} customTypes={customTypes}
          onClose={() => { setShowNew(false); setEditingNote(null); }}
          onSaved={() => { setAllNotes(getDailyNotes()); setShowNew(false); setEditingNote(null); }} />
      )}

      {showTypeManager && (
        <Modal open title="类型管理" onCancel={() => setShowTypeManager(false)} footer={null} width={400} maskClosable={false}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="输入新类型名称" onPressEnter={handleAddType} style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={handleAddType}>添加</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {customTypes.map((t) => {
              const c = typeColor(t);
              return (
                <span key={t} className="notes-type-tag" style={{ background: `${c}1A`, color: c, borderColor: `${c}40` }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                  {t}
                  <button className="notes-type-del" onClick={() => handleDeleteType(t)}><X size={11} /></button>
                </span>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

function NoteModal({ note, customTypes, onClose, onSaved }: { note: DailyNote | null; customTypes: string[]; onClose: () => void; onSaved: () => void }) {
  const showToast = useAppStore((s) => s.showToast);
  const [date, setDate] = useState(dayjs(note?.date ? note.date : undefined));
  const [title, setTitle] = useState(note?.title || '');
  const [type, setType] = useState(note?.type || customTypes[0] || '一般工作');
  const [priority, setPriority] = useState<DailyNote['priority']>(note?.priority || 'normal');
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

  // 提醒快捷预设：相对当前时间的可点选项
  const reminderPresets = useMemo(() => {
    const now = dayjs();
    const today1800 = now.hour(18).minute(0).second(0);
    const fri = now.day() >= 5 ? now.add(7 - now.day() + 5, 'day') : now.add(5 - now.day(), 'day');
    return [
      { label: '30分钟后', time: now.add(30, 'minute') },
      { label: '1小时后', time: now.add(1, 'hour') },
      { label: '今天 18:00', time: today1800.isAfter(now) ? today1800 : today1800.add(1, 'day') },
      { label: '明天 09:00', time: now.add(1, 'day').hour(9).minute(0).second(0) },
      { label: '本周五 18:00', time: fri.hour(18).minute(0).second(0) },
      { label: '1周后', time: now.add(7, 'day') },
    ];
  }, []);

  const handleSave = () => {
    if (!title.trim()) { showToast('请输入标题', 'warning'); return; }
    try {
      // 数据构造与落库一起放在 try 内：即便 reminderTime.toISOString() 等构造异常，
      // 也会被 catch 捕获，finally 中的 onSaved() 仍会执行，保证列表刷新（V2.41.17 修复 #1）
      const reminderData = reminderEnabled
        ? { enabled: true, time: reminderTime.toISOString(), repeat: reminderRepeat, sound: reminderSound }
        : { enabled: false, time: '', repeat: 'none', sound: reminderSound };
      const data = {
        date: date.format('YYYY-MM-DD'),
        title: title.trim(),
        type,
        priority,
        contents: contents.filter((c) => c.trim()),
        reminder: reminderData,
        notes: notesText,
      };
      if (note) { updateDailyNote(note.id, data); showToast('已更新', 'success'); }
      else { createDailyNote(data); showToast('已创建', 'success'); }
    } catch (err) {
      console.error('[DailyNotes] 保存随手记失败：', err);
      showToast('保存失败，请重试', 'error');
    } finally {
      // 无论保存或数据构造是否抛错都刷新列表，确保新建/编辑后卡片立即出现（V2.41.17 修复 #1）
      onSaved();
    }
  };

  const summary = reminderEnabled
    ? `将于 ${reminderTime.format('M月D日 HH:mm')} 提醒${reminderRepeat !== 'none' ? `（${REPEAT_LABEL[reminderRepeat]}）` : ''}`
    : '';

  return (
    <Modal open title={note ? '编辑记录' : '新建记录'} onCancel={onClose} width={620} footer={null} maskClosable={false}>
      <div className="notes-modal">
        {/* 日期 + 类型 */}
        <div className="notes-modal-row">
          <DatePicker value={date} onChange={(d) => d && setDate(d)} style={{ flex: 1 }} />
          <Select value={type} onChange={setType} style={{ flex: 1 }} options={customTypes.map((t) => ({ label: t, value: t }))} />
        </div>

        {/* 优先级 */}
        <div className="nm-field">
          <div className="nm-field-head"><Flag size={13} /><span>优先级</span></div>
          <div className="nm-prio">
            {(['normal', 'important', 'urgent'] as const).map((p) => (
              <button key={p} className={`nm-prio-chip ${priority === p ? 'on' : ''}`} style={priority === p ? { background: `${PRIORITY_COLOR[p]}1A`, color: PRIORITY_COLOR[p], borderColor: `${PRIORITY_COLOR[p]}55` } : undefined} onClick={() => setPriority(p)}>
                <span className="nm-dot" style={{ background: PRIORITY_COLOR[p] }} />
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        {/* 标题 */}
        <div className="nm-field">
          <div className="nm-field-head"><AlignLeft size={13} /><span>标题</span><span className="nm-count">{title.length}/50</span></div>
          <Input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 50))} placeholder="一句话概括这条记录，例如：报送XX案件周报" maxLength={50} />
        </div>

        {/* 具体内容 */}
        <div className="nm-field">
          <div className="nm-field-head"><AlignLeft size={13} /><span>具体内容</span><span className="nm-sub">可分多条记录要点</span></div>
          {contents.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <Input.TextArea value={c} onChange={(e) => { const next = [...contents]; next[i] = e.target.value; setContents(next); }} placeholder={`要点 ${i + 1}`} autoSize={{ minRows: 1, maxRows: 3 }} style={{ flex: 1 }} />
              {contents.length > 1 && (<button className="btn btn-sm btn-ghost" onClick={() => setContents(contents.filter((_, idx) => idx !== i))}><X size={12} /></button>)}
            </div>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={() => setContents([...contents, ''])} style={{ gap: 4, alignSelf: 'flex-start' }}><Plus size={12} /> 添加要点</button>
        </div>

        {/* 提醒 */}
        <div className="nm-field">
          <div className="nm-field-head"><Bell size={13} /><span>提醒</span>
            <Switch size="small" checked={reminderEnabled} onChange={(v) => { setReminderEnabled(v); if (v && !reminderTime.isValid()) setReminderTime(dayjs().add(30, 'minute')); }} />
          </div>
          {reminderEnabled && (
            <div className="nm-remind">
              <div className="nm-preset">
                {reminderPresets.map((p) => {
                  const active = reminderTime.isSame(p.time, 'minute');
                  return (
                    <button key={p.label} className={`nm-preset-chip ${active ? 'on' : ''}`} onClick={() => setReminderTime(p.time)}>{p.label}</button>
                  );
                })}
              </div>
              <div className="notes-modal-row notes-remind-row">
                <DatePicker showTime value={reminderTime} onChange={(d) => d && setReminderTime(d)} style={{ flex: 1 }} />
                <Select value={reminderRepeat} onChange={setReminderRepeat} style={{ width: 120 }} options={REPEAT_OPTIONS} />
              </div>
              <div className="notes-modal-row">
                <span className="notes-modal-label" style={{ marginBottom: 0, minWidth: 64 }}>提醒声音</span>
                <Select value={reminderSound} onChange={setReminderSound} style={{ width: 200 }} options={SOUND_OPTIONS} />
              </div>
              {summary && <div className="nm-summary"><Clock size={13} /><span>{summary}</span></div>}
            </div>
          )}
        </div>

        {/* 备注 */}
        <div className="nm-field">
          <div className="nm-field-head"><AlignLeft size={13} /><span>备注</span><span className="nm-sub">可选</span></div>
          <Input.TextArea value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder="补充背景、联系人、待办等" autoSize={{ minRows: 2, maxRows: 4 }} />
        </div>

        <div className="nm-hint"><Pin size={12} /> 保存后，可在列表卡片点「便签」一键生成桌面便签（桌面版）。</div>
      </div>

      <div className="nm-footer">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} style={{ gap: 6 }}><Check size={14} /> {note ? '更新' : '保存'}</button>
      </div>
    </Modal>
  );
}
