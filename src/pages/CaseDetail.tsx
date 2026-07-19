/**
 * 案件查看弹窗（只读）
 * 复用编辑页 DrawerNewRecord 的 antd Modal 弹窗风格（居中、标题栏、可滚动 body、底部按钮），
 * 只做信息展示：基本信息（表格行式）+ repeatable 段落 + 附件；
 * 不展示关联记录、时间线（按需求移除）。
 */
import { useEffect, useMemo, useState } from 'react';
import { Collapse, Modal } from 'antd';
import { FileText, Paperclip, Pen, Download } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { downloadAttachment, getAttachmentPreview } from '../store/attachmentStore';
import { getMassRecords, updateMassRecord } from '../store/massStore';
import { MODULE_NAMES, findModule } from '../moduleConfig';
import { useCustomModules } from '../customModules';
import { FIELD_LABELS } from '../constants/fieldLabels';

type MassRecord = import('../store/massStore').MassRecord;

interface Props {
  record: MassRecord;
  onClose: () => void;
  onOpenRelated?: (rec: MassRecord) => void;
}

// 字段中文标签统一引用 src/constants/fieldLabels

function fmtDate(iso: string | Date): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 日期时间（保留到秒，去掉毫秒与时区后缀），本地时区展示 */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 将任意值转为安全的字符串显示 */
function fmtValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  // Date 对象：保留到秒
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '—';
    const p = (n: number) => String(n).padStart(2, '0');
    return `${val.getFullYear()}-${p(val.getMonth() + 1)}-${p(val.getDate())} ${p(val.getHours())}:${p(val.getMinutes())}:${p(val.getSeconds())}`;
  }
  if (Array.isArray(val)) {
    // 附件数组：只显示文件名（详情里不在此展示）
    const first = val[0] as Record<string, unknown>;
    if (val.length > 0 && first && typeof first === 'object' && first.uid) {
      return val
        .map((f: Record<string, unknown>) => String(f.name ?? '附件'))
        .join('、');
    }
    return val.map(v => fmtValue(v)).join('、');
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // dayjs 对象
    if (obj.$L !== undefined && obj.$d !== undefined) {
      try {
        const dateVal = obj.$d instanceof Date ? obj.$d : new Date(String(obj.$d));
        if (!isNaN(dateVal.getTime())) {
          return `${dateVal.getFullYear()}年${dateVal.getMonth() + 1}月${dateVal.getDate()}日`;
        }
      } catch {}
      return '—';
    }
    // 附件对象：只显示文件名
    if (obj.name && obj.uid) return String(obj.name);
    // 其他对象
    return JSON.stringify(val).slice(0, 30);
  }
  if (typeof val === 'string') {
    // 含秒的 ISO 日期时间：保留到秒
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return fmtDateTime(val);
    // 仅到分钟 / 纯日期
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return fmtDate(val);
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return fmtDate(val);
  }
  return String(val);
}

/** 派生记录标题：兼容各模块主键字段，回退到首个有值文本字段 */
function deriveRecordTitle(d: Record<string, unknown>): string {
  const cands = [d.caseName, d.suspect, d.subjectName, d.projectName, d.reporterName, d.name, d.title];
  for (const c of cands) {
    if (c != null && String(c).trim() !== '') return String(c).trim();
  }
  for (const [k, v] of Object.entries(d)) {
    if (!k.startsWith('__') && typeof v === 'string' && v.trim() !== '') return v.trim().slice(0, 40);
  }
  return '未命名';
}

type CdStatusKind = 'done' | 'warning' | 'danger' | 'info';
const CD_STATUS_HINTS = ['状态', '进度', '结案', '归档', '报销', '反馈', '整改', '结果'];
function deriveCdStatus(rec: MassRecord, fields: { type: string; label: string; id: string }[]): { label: string; kind: CdStatusKind } | null {
  const sf = fields.find((f) => f.type === 'select' && CD_STATUS_HINTS.some((h) => f.label.includes(h)));
  if (!sf) return null;
  const v = rec.data?.[sf.id];
  if (v == null || String(v).trim() === '') return null;
  const s = String(v);
  const done = ['已结案', '已办结', '已完成', '已反馈', '已报销', '息诉罢访', '化解', '通过', '合格', '归档', '无需整改', '已整改', '正常'];
  const danger = ['超期', '逾期', '已过期', '异常', '退回', '不通过', '不合格', '未化解', '仍有越级上访苗头', '重点管控'];
  const warning = ['待补充', '待报销', '未反馈', '未结案', '未办结', '整改中', '初查中', '办理中', '进行中', '调查中', '迟到', '缺勤', '待公示', '未整改'];
  let kind: CdStatusKind = 'info';
  if (done.includes(s)) kind = 'done';
  else if (danger.includes(s)) kind = 'danger';
  else if (warning.includes(s)) kind = 'warning';
  return { label: s, kind };
}

/** 是否为附件型值（数组且元素为带 uid 的附件对象） */
function isAttachmentValue(v: unknown): boolean {
  if (!Array.isArray(v) || v.length === 0) return false;
  return v.every(item => item && typeof item === 'object' && !!(item as Record<string, unknown>).uid);
}

/** 图片附件缩略图：懒加载预览图（仅图片类型） */
function ImageThumb({ uid }: { uid: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getAttachmentPreview(uid).then((p) => { if (alive && p) setUrl(p.url); }).catch(() => {});
    return () => { alive = false; };
  }, [uid]);
  if (!url) return <div className="cd-thumb cd-thumb-ph" />;
  return <img className="cd-thumb" src={url} alt="" />;
}

export default function CaseDetail({ record, onClose, onOpenRelated }: Props) {
  const setEditRecord = useAppStore((s) => s.setEditRecord);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const showToast = useAppStore((s) => s.showToast);
  const { allModules } = useCustomModules();

  const caseName = useMemo(() => {
    const d = record.data || {};
    // 优先业务主键字段（兼容各模块：案件/嫌疑人/涉众主体/项目/举报人等）
    const cands = [d.caseName, d.suspect, d.subjectName, d.projectName, d.reporterName, d.name, d.title];
    for (const c of cands) {
      if (c != null && String(c).trim() !== '') return String(c).trim();
    }
    // 回退：第一个有值的文本字段
    for (const [k, v] of Object.entries(d)) {
      if (!k.startsWith('__') && typeof v === 'string' && v.trim() !== '') return v.trim().slice(0, 40);
    }
    return '未命名';
  }, [record]);
  const moduleName = MODULE_NAMES[record.moduleId] || record.moduleId;

  // 关联记录 + 时间线：用「多条关键身份词(姓名/身份证/电话/案件名/项目名/主体名等)」匹配，比单标题串鲁棒
  const { relatedRecords, timeline } = useMemo(() => {
    const all = getMassRecords();
    const d = record.data || {};
    const IDENTITY_KEYS = ['caseName', 'suspect', 'subjectName', 'projectName', 'reporterName', 'name', 'title', 'caseNo', 'idCard', 'phone', 'mobile', 'company', 'unit', 'orgName', 'legalName', 'personName', 'suspectName'];
    const kws = new Set<string>();
    for (const k of IDENTITY_KEYS) {
      const v = d[k];
      if (typeof v === 'string' && v.trim().length >= 2) kws.add(v.trim().toLowerCase());
    }
    for (const v of Object.values(d)) {
      if (typeof v === 'string' && /[\d]{4,}/.test(v)) kws.add(v.trim().toLowerCase());
    }
    const matchAny = (data: Record<string, unknown>, kw: string) =>
      Object.values(data).some(v =>
        (typeof v === 'string' && v.toLowerCase().includes(kw)) ||
        (Array.isArray(v) && v.some(x => typeof x === 'string' && x.toLowerCase().includes(kw)))
      );
    const kwArr = [...kws];
    const rel = all.filter(r => r.id !== record.id && kwArr.some(kw => matchAny(r.data || {}, kw))).slice(0, 12);
    const tl = [...rel].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 20);
    return { relatedRecords: rel, timeline: tl };
  }, [record]);

  // 结构化关联：手动「钉选」的关联记录 id（与启发式匹配互补，双向持久化到 record.data.linkedRecordIds）
  const [linkedIds, setLinkedIds] = useState<string[]>(() =>
    Array.isArray(record.data?.linkedRecordIds) ? (record.data!.linkedRecordIds as string[]) : []
  );
  const linkedSet = useMemo(() => new Set(linkedIds), [linkedIds]);
  // 展示用关联集合 = 启发式匹配 ∪ 手动关联（去重，手动关联项补充进列表）
  const displayedRelated = useMemo(() => {
    const all = getMassRecords();
    const map = new Map<string, MassRecord>();
    for (const r of relatedRecords) map.set(r.id, r);
    for (const id of linkedIds) {
      if (!map.has(id)) {
        const rec = all.find((x) => x.id === id);
        if (rec) map.set(id, rec);
      }
    }
    return [...map.values()];
  }, [relatedRecords, linkedIds]);

  /** 切换与某条记录的关联（双向持久化；updateMassRecord 为整对象替换 data，必须展开旧 data 后再写入） */
  const toggleLink = (other: MassRecord) => {
    const isLinked = linkedIds.includes(other.id);
    const newCurrent = isLinked ? linkedIds.filter((id) => id !== other.id) : [...linkedIds, other.id];
    setLinkedIds(newCurrent);
    updateMassRecord(record.id, { ...(record.data || {}), linkedRecordIds: newCurrent });
    const otherLinked: string[] = Array.isArray(other.data?.linkedRecordIds) ? (other.data!.linkedRecordIds as string[]) : [];
    const newOther = isLinked ? otherLinked.filter((id) => id !== record.id) : [...otherLinked, record.id];
    updateMassRecord(other.id, { ...(other.data || {}), linkedRecordIds: newOther });
    showToast(isLinked ? '已取消关联' : '已关联该记录', 'success');
  };

  // 附件：收集所有附件数组（包括 attachment / fileList 等字段），同时取出上传时间与分类
  const attachments = useMemo(() => {
    const d = record.data || {};
    const files: Array<{ uid: string; name: string; time?: string; category?: string; type?: string }> = [];
    for (const [, val] of Object.entries(d)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0].uid && val[0].name) {
        for (const item of val) {
          if (item && typeof item === 'object' && item.uid && item.name) {
            const obj = item as Record<string, unknown>;
            const rawTime = obj.uploadedAt ?? obj.lastModifiedDate ?? obj.lastModified;
            let time: string | undefined;
            if (typeof rawTime === 'string') time = rawTime;
            else if (rawTime instanceof Date) time = rawTime.toISOString();
            const cat = typeof obj.category === 'string' && obj.category.trim() ? obj.category : '其他';
            files.push({ uid: item.uid as string, name: item.name as string, time, category: cat, type: typeof obj.type === 'string' ? obj.type : undefined });
          }
        }
      }
    }
    // 按分类分组（保持出现顺序）
    const groups: Array<{ category: string; items: typeof files }> = [];
    const idxMap = new Map<string, number>();
    for (const f of files) {
      const c = f.category || '其他';
      if (!idxMap.has(c)) { idxMap.set(c, groups.length); groups.push({ category: c, items: [] }); }
      groups[idxMap.get(c)!].items.push(f);
    }
    return groups;
  }, [record]);

  // 附件预览（图片/PDF 点击放大）
  const [preview, setPreview] = useState<{ url: string; name: string; mime?: string } | null>(null);
  const openPreview = async (uid: string, name: string) => {
    const p = await getAttachmentPreview(uid);
    if (p) setPreview({ url: p.url, name, mime: p.mime });
    else showToast('无法预览该附件', 'warning');
  };

  // 收集"属于 repeatable 段"的字段 id：这些字段的值存在数组（listName）里，
  // 不应在顶层基本信息里以空值重复出现（如"报案人：—"），避免用户误以为个人信息未保存。
  const repeatableFieldIds = useMemo(() => {
    const ids = new Set<string>();
    const mod = findModule(record.moduleId, allModules);
    for (const tab of mod?.tabs || []) {
      let inRepeatable = false;
      for (const f of tab.fields || []) {
        if (f.type === 'section') {
          inRepeatable = !!f.repeatable;
          continue;
        }
        if (inRepeatable) ids.add(f.id);
      }
    }
    return ids;
  }, [record.moduleId, allModules]);

  // 表单字段（排除 section/attachment、属于 repeatable 段的字段、附件内部字段、以及 id 含 attach 的附件类字段；避免英文 "attachment" 字样出现在基本信息）
  const fields = useMemo(() => {
    const mod = findModule(record.moduleId, allModules);
    const tab = mod?.tabs.find(t => t.id === record.tabId) || mod?.tabs[0];
    return (tab?.fields || []).filter(
      f => f.type !== 'section'
        && f.type !== 'attachment'
        && !repeatableFieldIds.has(f.id)
        && !/^(lastModifiedDate|lastModified|originFileObj|response|xhr|thumbUrl)$/.test(f.id)
        && !/attach/i.test(f.id)
        && !isAttachmentValue(record.data?.[f.id])
    );
  }, [record, allModules, repeatableFieldIds]);

  const cdStatus = useMemo(() => deriveCdStatus(record, fields), [record, fields]);

  // repeatable 段标题映射：listName → 段中文名（如 reporters → 报案人信息）
  const sectionLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    const mod = findModule(record.moduleId, allModules);
    for (const tab of mod?.tabs || []) {
      for (const f of tab.fields || []) {
        if (f.type === 'section' && f.listName) map[f.listName] = f.label;
      }
    }
    return map;
  }, [record.moduleId, allModules]);

  // 从字段定义构建中文标签映射
  const fieldLabelMap = useMemo(() => {
    const map: Record<string, string> = { ...FIELD_LABELS };
    for (const f of fields) {
      if (!map[f.id]) map[f.id] = f.label;
    }
    // 也处理 repeatable section 中的字段
    const mod = findModule(record.moduleId, allModules);
    for (const tab of mod?.tabs || []) {
      for (const f of tab.fields || []) {
        if (f.type !== 'section' && f.type !== 'attachment' && !map[f.id]) {
          map[f.id] = f.label;
        }
      }
    }
    return map;
  }, [fields, record.moduleId, allModules]);

  const handleEdit = () => {
    setEditRecord(record);
    setCurrentPage(record.moduleId);
    openModal('newRecord');
    onClose();
  };

  return (
    <Modal
      open
      width={860}
      onCancel={onClose}
      maskClosable
      title={<span style={{ fontWeight: 700, fontSize: 16 }}>查看详情 · {moduleName}</span>}
      styles={{ body: { maxHeight: '72vh', overflow: 'auto', padding: '20px 24px' } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="cd-btn" onClick={onClose}>关闭</button>
          <button type="button" className="cd-btn primary" onClick={handleEdit}>
            <Pen size={16} /> 编辑
          </button>
        </div>
      }
    >
      {/* 头部 */}
      <div className="cd-view-head">
        <div className={`cd-view-ico ${cdStatus ? 'cd-st-' + cdStatus.kind : ''}`}><FileText size={24} /></div>
        <div className="cd-view-main">
          <div className="cd-view-title">{caseName}</div>
          <div className="cd-view-sub">
            更新于 {fmtDate(record.updatedAt)}
            {cdStatus ? (
              <span className={`badge ${cdStatus.kind === 'done' ? 'badge-success' : cdStatus.kind === 'warning' ? 'badge-warning' : cdStatus.kind === 'danger' ? 'badge-danger' : 'badge-info'}`} style={{ marginLeft: 10 }}>
                {cdStatus.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 基本信息（表格行式：标签 | 值） */}
      <div className="cd-content-title" style={{ marginTop: 18 }}>基本信息</div>
      {fields.length === 0 ? (
        <div className="cd-empty">该记录暂无可展示的基本信息字段</div>
      ) : (
        <div className="cd-table">
          {fields.map(f => (
            <div key={f.id} className="cd-tr">
              <div className="cd-td-label">{fieldLabelMap[f.id] || f.label}</div>
              <div className="cd-td-val">{fmtValue(record.data?.[f.id])}</div>
            </div>
          ))}
        </div>
      )}

      {/* repeatable 段（如嫌疑人信息 / 报案人信息），排除附件数组 */}
      {Object.entries(record.data || {}).map(([key, val]) => {
        if (!Array.isArray(val) || val.length === 0 || typeof val[0] !== 'object') return null;
        if (isAttachmentValue(val)) return null; // 附件数组统一在「附件」区展示
        const sectionLabel = sectionLabelMap[key]
          || FIELD_LABELS[key as keyof typeof FIELD_LABELS]
          || (key === 'suspects' ? '嫌疑人信息' : key === 'coerciveMeasures' ? '强制措施' : key === 'items' ? '详细信息' : key);
        return (
          <div key={key} className="cd-sec">
            <div className="cd-sec-title">{sectionLabel}（{val.length} 条）</div>
            {val.map((item: Record<string, unknown>, idx: number) => (
              <div key={idx} className="cd-sec-card">
                <div className="cd-sec-card-idx">#{idx + 1}</div>
                <div className="cd-sec-grid">
                  {Object.entries(item).map(([k, v]) => {
                    if (v === null || v === undefined || v === '') return null;
                    // 附件内部字段：不在 repeatable 段里展示
                    if (k.startsWith('__') || k === 'uid' || k === 'lastModified' || k === 'lastModifiedDate' || k === 'percent' || k === 'status' || k === 'size' || k === 'originFileObj' || k === 'response' || k === 'xhr' || k === 'thumbUrl') return null;
                    if (/attach/i.test(k)) return null;
                    if (isAttachmentValue(v)) return null;
                    return (
                      <div key={k} className="cd-sec-kv">
                        <span className="cd-sec-k">{fieldLabelMap[k] || FIELD_LABELS[k as keyof typeof FIELD_LABELS] || k}：</span>
                        <span className="cd-sec-v">{fmtValue(v)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* 附件（按分类分组） */}
      <div className="cd-content-title" style={{ marginTop: 18 }}>附件</div>
      {attachments.length === 0 ? (
        <div className="cd-empty">暂无附件</div>
      ) : (
        <div className="cd-att-groups">
          {attachments.map((g) => (
            <div key={g.category} className="cd-att-group">
              <div className="cd-att-group-head">
                <span className="cd-att-cat">{g.category}</span>
                <span className="cd-att-cat-count">{g.items.length}</span>
              </div>
              {g.items.map((att) => {
                const isImage = att.type?.startsWith('image/');
                const isPdf = att.type === 'application/pdf';
                return (
                  <div key={att.uid} className="cd-att">
                    {isImage ? (
                      <button className="cd-att-thumb-btn" title="点击放大" onClick={() => openPreview(att.uid, att.name)}>
                        <ImageThumb uid={att.uid} />
                      </button>
                    ) : isPdf ? (
                      <span className="cd-att-icon pdf"><FileText size={15} /></span>
                    ) : (
                      <span className="cd-att-icon"><Paperclip size={15} /></span>
                    )}
                    <div className="cd-att-main">
                      <span className="cd-att-name">{att.name}</span>
                      {att.time ? <span className="cd-att-time">上传时间：{fmtValue(att.time)}</span> : null}
                    </div>
                    <div className="cd-att-acts">
                      {(isImage || isPdf) && (
                        <button className="cd-att-btn sm" onClick={() => openPreview(att.uid, att.name)}>预览</button>
                      )}
                      <button className="cd-att-btn" onClick={async () => {
                        try { await downloadAttachment(att.uid); } catch { /* ignore */ }
                      }}>
                        <Download size={15} /> 下载
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* 附件预览弹窗：图片直接展示，PDF 内嵌 iframe 浏览 */}
      <Modal open={!!preview} footer={null} onCancel={() => setPreview(null)} width={preview?.mime === 'application/pdf' ? 860 : 720} title={preview?.name || '预览'} styles={{ body: { padding: 12 } }}>
        {preview ? (
          preview.mime === 'application/pdf' ? (
            <iframe src={preview.url} title={preview.name} style={{ width: '100%', height: '70vh', border: 0, borderRadius: 8 }} />
          ) : (
            <img src={preview.url} alt={preview.name} style={{ width: '100%', borderRadius: 8 }} />
          )
        ) : null}
      </Modal>

      {/* 关联与脉络：默认收起，点击展开（经侦高价值关联能力，但不默认铺开） */}
      <div className="cd-content-title" style={{ marginTop: 18 }}>关联与脉络</div>
      <Collapse
        ghost
        size="small"
        defaultActiveKey={[]}
        items={[
          {
            key: 'rel',
            label: `关联记录（${displayedRelated.length}）`,
            children: displayedRelated.length === 0 ? (
              <div className="cd-empty">暂无关联记录（可在右侧点「关联」手动建立）</div>
            ) : (
              <div className="cd-rel-list">
                {displayedRelated.map((r) => (
                  <div key={r.id} className="cd-rel-item">
                    <div className="cd-rel-main" onClick={() => onOpenRelated?.(r)}>
                      <span className="cd-rel-title">{deriveRecordTitle(r.data || {})}</span>
                      <span className="cd-rel-meta">{MODULE_NAMES[r.moduleId] || r.moduleId}</span>
                    </div>
                    <button
                      className={`cd-rel-link-btn ${linkedSet.has(r.id) ? 'on' : ''}`}
                      title={linkedSet.has(r.id) ? '点击取消关联' : '关联此记录'}
                      onClick={(e) => { e.stopPropagation(); toggleLink(r); }}
                    >
                      {linkedSet.has(r.id) ? '已关联' : '关联'}
                    </button>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'tl',
            label: `时间线（${timeline.length}）`,
            children: timeline.length === 0 ? (
              <div className="cd-empty">暂无时间线</div>
            ) : (
              <div className="cd-tl-list">
                {timeline.map(r => (
                  <div key={r.id} className="cd-tl-item" onClick={() => onOpenRelated?.(r)}>
                    <span className="cd-tl-dot" />
                    <span className="cd-tl-title">{deriveRecordTitle(r.data || {})}</span>
                    <span className="cd-tl-time">{fmtDateTime(String(r.updatedAt))}</span>
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
}
