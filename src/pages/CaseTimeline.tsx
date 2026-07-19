/**
 * 案件时间轴
 * 选一个案件名称，按真实时间线纵向/列表展示该案件在所有模块中的记录。
 * 修复：排序改用真实时间戳（原 localeCompare 中文串跨月错位）；排序与展示共用同一时间戳函数，
 *       消除「显示 A 日期却按 B 日期排」；案件匹配优先精确匹配 caseName/caseNo 再模糊；
 *       无业务日期记录回退 createdAt 排序（不再与中文日期混排跳到最前）。
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, CalendarDays, FileText, Gavel, SearchCheck, Users, Shield, Database,
  Landmark, BriefcaseBusiness, ChevronRight, ChevronDown, List, CalendarRange,
  X, ArrowUpDown, Search,
  FileJson, Sheet, MousePointerClick,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Select } from 'antd';
import { formatChineseDate } from '../utils/format';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';
import type { MassRecord } from '../store/massStore';
import { getAllCaseNames } from '../store/inputHistoryStore';
import { FIELD_LABELS as SHARED_FIELD_LABELS } from '../constants/fieldLabels';
import { MODULE_INFO } from '../moduleConfig';

/** 字段中文标签：以统一映射为基准，叠加时间轴场景的特化标签（H-8 去重） */
const FIELD_LABELS: Record<string, string> = {
  ...SHARED_FIELD_LABELS,
  actualLoss: '实际损失金额（元）',
  amount: '报账金额（元）',
  arrestDate: '逮捕',
  attachment: '附件材料',
  bailDate: '取保候审',
  bankAccount: '银行账号',
  caseName: '经办案件',
  caseNo: '接报案编号',
  caseStage: '案件当前阶段',
  caseStatus: '结案/未结案',
  clueName: '交办线索名称',
  collectDate: '采集时间',
  companyAccount: '公司公户',
  criminalDetentionDate: '刑事拘留',
  deadline: '期限届满时间',
  details: '情况说明',
  education: '文化程度',
  emergencyContact: '紧急联系人及电话',
  executeResult: '执行情况',
  filingDocNo: '受/立案文书号',
  handlingOfficer: '主办民警',
  idNo: '身份证号',
  intervieweeAddress: '现住址',
  intervieweePhone: '联系电话',
  isHardship: '是否家庭困难人员',
  landline: '固定电话',
  legalReviewer: '法制室审核人',
  meetingName: '会议/学习/培训名称',
  nextDayPlan: '次日工作计划',
  nextInvestDirection: '下一步侦查方向',
  phone: '联系方式',
  projectName: '投资项目/平台',
  prosecutionDate: '移送审查起诉',
  receiveDate: '接报日期',
  recoveredAmount: '已收回金额（元）',
  registeredAddress: '户籍地',
  reporterAddress: '现住址',
  reporterConfidential: '是否愿意保密',
  reporterCooperate: '是否愿意配合调查',
  reporterIdentity: '身份',
  reporterName: '姓名',
  reporterPhone: '联系电话',
  reporterRelationship: '与涉案主体关系',
  reporterWechat: '微信号',
  residentialSurveillanceDate: '监视居住',
  riskLevel: '信访人风险等级',
  squad: '采集单位',
  summary: '用途摘要',
  suspect: '嫌疑人姓名',
  suspectAddress: '地址',
  suspectIdNo: '身份证号码',
  suspectName: '姓名',
  totalAmount: '涉案总金额（万元）',
  transferProsecutionDate: '移诉时间',
  visitDate: '来访时间',
  visitorName: '来访人姓名',
};

/** 模块图标映射（UI 专属，单一来源仍为 moduleConfig 的 MODULE_INFO） */
const MODULE_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  'office-finance-assets': Landmark, 'office-party-attendance': Landmark, 'office-doc-report': Landmark, 'office-cluster': Landmark,
  'mass-clue': Users, 'mass-statistics': Users, 'mass-petition': Users, 'mass-interview': Users,
  'legal-report-case': Gavel, 'legal-case-ledger': Gavel, 'legal-special-action': Gavel,
  'squad-case': BriefcaseBusiness, 'squad-daily': BriefcaseBusiness, 'squad-coercive': Shield, 'squad-property': BriefcaseBusiness,
  'evidence-clue': SearchCheck, 'evidence-request': SearchCheck, 'evidence-freeze': Database, 'evidence-phone-collection': Database, 'evidence-report': SearchCheck,
};

/** 模块主题色映射（UI 专属） */
const MODULE_COLOR: Record<string, string> = {
  'office-finance-assets': '#6D28D9', 'office-party-attendance': '#6D28D9', 'office-doc-report': '#6D28D9', 'office-cluster': '#6D28D9',
  'mass-clue': '#2563EB', 'mass-statistics': '#2563EB', 'mass-petition': '#2563EB', 'mass-interview': '#2563EB',
  'legal-report-case': '#D97706', 'legal-case-ledger': '#D97706', 'legal-special-action': '#D97706',
  'squad-case': '#7C3AED', 'squad-daily': '#7C3AED', 'squad-coercive': '#DC2626', 'squad-property': '#7C3AED',
  'evidence-clue': '#2563EB', 'evidence-request': '#0891B2', 'evidence-freeze': '#059669', 'evidence-phone-collection': '#0F766E', 'evidence-report': '#2563EB',
};

/** 模块元信息：label/dept 统一取自 MODULE_INFO（M-10 单一数据源），icon/color 取自本地映射 */
const MODULE_META: Record<string, { label: string; dept: string; icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = Object.fromEntries(
  Object.keys(MODULE_INFO).map((id) => [
    id,
    {
      label: MODULE_INFO[id]?.label ?? id,
      dept: MODULE_INFO[id]?.dept ?? '',
      icon: MODULE_ICON[id] ?? FileText,
      color: MODULE_COLOR[id] ?? '#6B7280',
    },
  ]),
);

/** 分类（按 moduleId 前缀聚合，用于筛选 chip 与概览统计） */
const CAT_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ size?: number; color?: string }> }> = {
  office: { label: '经侦业务', color: '#6D28D9', icon: Landmark },
  mass: { label: '涉众处置', color: '#2563EB', icon: Users },
  legal: { label: '法制审核', color: '#D97706', icon: Gavel },
  squad: { label: '侦查中队', color: '#7C3AED', icon: Shield },
  evidence: { label: '证据管理', color: '#059669', icon: Database },
};
const CAT_ALL = ['office', 'mass', 'legal', 'squad', 'evidence'] as const;
type CatKey = typeof CAT_ALL[number];
function catOf(moduleId: string): CatKey | 'other' {
  const p = moduleId.split('-')[0];
  return (CAT_ALL as readonly string[]).includes(p) ? (p as CatKey) : 'other';
}

/** 从记录中提取最佳展示标题 */
function recordTitle(rec: MassRecord): string {
  const d = rec.data || {};
  return String(d.caseName || d.suspect || d.reportMatter || d.projectName || d.clueName || d.title || d.matterName || '未命名');
}

/** 跳过不展示的字段名 */
const SKIP_FIELDS = new Set([
  'attachment', 'fileList', 'status',
  'caseName', 'caseNo', 'title', 'matterName',
]);

/** repeatable section 的 listName 集合（字段数据在数组内） */
const SECTION_LIST_NAMES = new Set([
  'coerciveMeasures', 'reporters', 'involvedEntities',
  'suspects', 'clueSources', 'involvedSubjects',
  'interviewees', 'requestItems', 'enterpriseSubjects',
  'personalSubjects', 'investigationItems', 'fundSources',
  'penetrationItems', 'properties', 'involvedParties',
]);

/** 任意值 → 时间戳（毫秒）；非法返回 0。容错：字符串/Date/dayjs/ISO 均识别 */
function toTs(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (v instanceof Date) return isNaN(v.getTime()) ? 0 : v.getTime();
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (obj.$d !== undefined) {
      const dv = obj.$d instanceof Date ? obj.$d : new Date(String(obj.$d));
      if (!isNaN(dv.getTime())) return dv.getTime();
    }
    if (typeof (obj as { toJSON?: unknown }).toJSON === 'function') {
      const s = String((obj as { toJSON: () => unknown }).toJSON());
      const m = s.match(/^\d{4}-\d{2}-\d{2}/);
      if (m) { const t = Date.parse(m[0]); if (!isNaN(t)) return t; }
    }
    return 0;
  }
  if (typeof v === 'string') {
    if (v === '—' || v === '暂无' || v === '未知') return 0;
    const m = v.match(/^\d{4}-\d{2}-\d{2}/);
    if (m) { const t = Date.parse(m[0]); return isNaN(t) ? 0 : t; }
  }
  return 0;
}

/** 顶层业务日期字段优先级（排序与展示共用此顺序，消除错位） */
const TOP_DATE_FIELDS = [
  'collectDate', 'receiveDate', 'filingDate', 'recordDate',
  'criminalDetentionDate', 'arrestDate', 'bailDate', 'visitDate', 'createdAt',
];
const SECTION_DATE_FIELDS = [
  'criminalDetentionDate', 'bailDate', 'arrestDate', 'residentialSurveillanceDate',
  'notifyDate', 'approvalDate', 'executeDate', 'summonDate', 'detentionDate',
  'transferProsecutionDate', 'interrogationDate', 'captureDate',
];

/** 记录 → 真实时间戳（统一排序/展示键）；无业务日期回退 createdAt */
function recordTimestamp(rec: MassRecord): number {
  const d = rec.data || {};
  for (const f of TOP_DATE_FIELDS) {
    const t = toTs(d[f]);
    if (t) return t;
  }
  for (const key of Object.keys(d)) {
    const val = d[key];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      for (const item of val) {
        for (const df of SECTION_DATE_FIELDS) {
          const t = toTs((item as Record<string, unknown>)?.[df]);
          if (t) return t;
        }
      }
    }
  }
  return toTs(rec.createdAt) || 0;
}

/** 时间戳 → 中文日期显示；0 → 未标注 */
function tsToChinese(ts: number): string {
  if (!ts) return '未标注日期';
  return formatChineseDate(new Date(ts)) || '未标注日期';
}

/** 时间戳 → 年月分组键 */
function tsToMonthKey(ts: number): string {
  if (!ts) return '未标注日期';
  const dt = new Date(ts);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月`;
}

/**
 * 从记录中提取有值的字段（含 repeatable section），limit 控制条数（0 表示不限制）。
 */
function recordFields(rec: MassRecord, limit = 10): { label: string; value: string }[] {
  const d = rec.data || {};
  const items: { label: string; value: string }[] = [];

  for (const [key, raw] of Object.entries(d)) {
    if (SKIP_FIELDS.has(key)) continue;
    if (raw === null || raw === undefined) continue;
    if (SECTION_LIST_NAMES.has(key)) continue;
    const str = String(raw).trim();
    if (!str || str === '—') continue;
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) continue;
    if (Array.isArray(raw) && raw.length === 0) continue;
    if (typeof raw === 'object') continue;
    const label = FIELD_LABELS[key] || key;
    const value = str.length > 40 ? str.slice(0, 40) + '…' : str;
    items.push({ label, value });
  }

  for (const listName of SECTION_LIST_NAMES) {
    const arr = d[listName];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const first = arr[0];
    if (typeof first !== 'object' || first === null) continue;
    for (const [key, raw] of Object.entries(first)) {
      if (raw === null || raw === undefined) continue;
      const str = String(raw).trim();
      if (!str || str === '—') continue;
      if (/^\d{4}-\d{2}-\d{2}T/.test(str)) continue;
      const label = FIELD_LABELS[key] || key;
      const value = str.length > 40 ? str.slice(0, 40) + '…' : str;
      if (!items.some((i) => i.label === label && i.value === value)) {
        items.push({ label, value });
      }
    }
  }

  return limit > 0 ? items.slice(0, limit) : items;
}

/** 导出当前时间轴为 JSON 文件 */
function exportTimeline(caseName: string, records: MassRecord[]) {
  const payload = {
    caseName,
    exportedAt: new Date().toISOString(),
    count: records.length,
    records: records.map((r) => ({ id: r.id, moduleId: r.moduleId, createdAt: r.createdAt, data: r.data })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${caseName || 'timeline'}-时间轴.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导出当前时间轴为 Excel 报表（固定列，可直接打印/归档） */
function exportTimelineExcel(caseName: string, records: MassRecord[]) {
  const rows = records.map((r, i) => {
    const meta = MODULE_META[r.moduleId] || { label: r.moduleId, dept: '', icon: FileText, color: '#6B7280' };
    const ts = recordTimestamp(r);
    const d = r.data || {};
    const summary = recordFields(r, 14).map((f) => `${f.label}：${f.value}`).join('  ');
    return {
      '序号': i + 1,
      '时间': tsToChinese(ts),
      '所属部门': meta.dept,
      '模块类型': meta.label,
      '事件标题': recordTitle(r),
      '关联案件': String(d.caseName || ''),
      '关键内容': summary,
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 26 }, { wch: 20 }, { wch: 70 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '时间轴记录');
  XLSX.writeFile(wb, `${caseName || 'timeline'}-时间轴.xlsx`);
}

export default function CaseTimeline() {
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const setEditRecord = useAppStore((s) => s.setEditRecord);

  const [selectedCase, setSelectedCase] = useState<string>('');
  const [searchKw, setSearchKw] = useState('');
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set(CAT_ALL as readonly string[]));
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerRec, setDrawerRec] = useState<MassRecord | null>(null);

  // 案件名：索引 ∪ 记录提取，保证新增案件可见
  const allCaseNames = useMemo(() => {
    const set = new Set<string>(getAllCaseNames());
    for (const r of getMassRecords()) {
      const n = String(r.data?.caseName || '').trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  }, []);

  // 选中案件的基础记录（精确匹配 caseName/caseNo 优先，再模糊）
  const baseRecords = useMemo(() => {
    if (!selectedCase) return [];
    const all = getMassRecords();
    const kw = selectedCase.trim().toLowerCase();
    return all.filter((r) => {
      const d = r.data || {};
      const cn = String(d.caseName || '').toLowerCase();
      const cno = String(d.caseNo || '').toLowerCase();
      if (cn === kw || cno === kw) return true;
      return Object.values(d).some((v) => String(v || '').toLowerCase().includes(kw));
    });
  }, [selectedCase]);

  // 概览统计（按分类计数）
  const stats = useMemo(() => {
    const total = baseRecords.length;
    const byCat: Record<string, number> = { office: 0, mass: 0, legal: 0, squad: 0, evidence: 0, other: 0 };
    for (const r of baseRecords) byCat[catOf(r.moduleId)] += 1;
    return { total, byCat };
  }, [baseRecords]);

  // 过滤 + 排序（真实时间戳）
  const sorted = useMemo(() => {
    const kw = searchKw.trim().toLowerCase();
    const list = baseRecords.filter((r) => {
      if (!activeCats.has(catOf(r.moduleId))) return false;
      if (!kw) return true;
      const hay = recordTitle(r) + ' ' + recordFields(r, 0).map((f) => `${f.label}${f.value}`).join(' ');
      return hay.toLowerCase().includes(kw);
    });
    list.sort((a, b) => {
      const ta = recordTimestamp(a);
      const tb = recordTimestamp(b);
      return order === 'desc' ? tb - ta : ta - tb;
    });
    return list;
  }, [baseRecords, activeCats, searchKw, order]);

  // 时间轴分组（保留 sorted 顺序 → 正/逆序由 order 决定）
  const groups = useMemo(() => {
    const map = new Map<string, MassRecord[]>();
    for (const r of sorted) {
      const key = tsToMonthKey(recordTimestamp(r));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [sorted]);

  const toggleCat = (c: string) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) {
        if (next.size > 1) next.delete(c); // 至少保留一类
      } else {
        next.add(c);
      }
      return next;
    });
  };

  const handleOpen = (rec: MassRecord) => setDrawerRec(rec);
  const handleNavigate = (rec: MassRecord) => {
    setDrawerRec(null);
    setEditRecord(rec);
    setCurrentPage(rec.moduleId);
    openModal('newRecord');
  };

  return (
    <div className="tl-page">
      {/* 头部 */}
      <div className="tl-head">
        <div className="tl-head-ico"><Clock size={22} color="#fff" /></div>
        <div>
          <div className="tl-head-title">案件时间轴</div>
          <div className="tl-head-sub">请先在下方选择一个案件，系统将汇总该案件在各模块中的办理记录，按真实时间生成时间线</div>
        </div>
      </div>

      {/* 案件选择 + 工具栏 */}
      <div className="tl-toolbar">
        <div className={selectedCase ? 'tl-select' : 'tl-select tl-select-empty'}>
          <Select
            value={selectedCase || undefined}
            placeholder="请选择案件查看时间线…"
            onChange={(v) => { setSelectedCase(v || ''); setExpandedId(null); }}
            options={allCaseNames.map((n) => ({ value: n, label: n }))}
            style={{ minWidth: 280, maxWidth: 340, width: '100%' }}
          />
        </div>

        {!selectedCase && (
          <div className="tl-guide"><MousePointerClick size={15} />请先选择案件</div>
        )}

        <div className="tl-search">
          <Search size={14} />
          <input
            placeholder="在时间轴内搜索关键词…"
            value={searchKw}
            disabled={!selectedCase}
            onChange={(e) => setSearchKw(e.target.value)}
          />
        </div>

        <div className="tl-seg">
          <button className={viewMode === 'timeline' ? 'on' : ''} onClick={() => setViewMode('timeline')}>
            <CalendarRange size={14} /> 时间线
          </button>
          <button className={viewMode === 'list' ? 'on' : ''} onClick={() => setViewMode('list')}>
            <List size={14} /> 列表
          </button>
        </div>

        <button className="tl-btn" onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))} title="切换正序/倒序">
          <ArrowUpDown size={14} /> {order === 'desc' ? '倒序' : '正序'}
        </button>

        <button className="tl-btn" disabled={!selectedCase || sorted.length === 0} onClick={() => exportTimeline(selectedCase, sorted)} title="导出为 JSON 数据文件">
          <FileJson size={14} /> JSON
        </button>
        <button className="tl-btn" disabled={!selectedCase || sorted.length === 0} onClick={() => exportTimelineExcel(selectedCase, sorted)} title="导出为 Excel 报表（可直接打印/归档）">
          <Sheet size={14} /> Excel
        </button>
      </div>

      {/* 主体 */}
      {!selectedCase ? (
        <div className="tl-empty">
          <Clock size={40} className="tl-empty-ico" />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>请先在上方选择一个案件</div>
          <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
            系统将自动汇总该案件在「经侦业务 / 涉众处置 / 法制审核 / 侦查中队 / 证据管理」各模块中的办理记录，生成完整时间线
          </div>
        </div>
      ) : (
        <>
          {/* 概览统计 */}
          <div className="tl-stats">
            <div className="tl-stat" style={{ ['--accent' as string]: '#2563EB' }}>
              <div className="tl-stat-ico" style={{ background: '#2563EB15', color: '#2563EB' }}><FileText size={18} /></div>
              <div>
                <div className="tl-stat-val">{stats.total}</div>
                <div className="tl-stat-label">相关记录</div>
              </div>
            </div>
            {CAT_ALL.map((c) => {
              const m = CAT_META[c];
              if (stats.byCat[c] === 0) return null;
              const Icon = m.icon;
              return (
                <div className="tl-stat" key={c} style={{ ['--accent' as string]: m.color }}>
                  <div className="tl-stat-ico" style={{ background: `${m.color}15`, color: m.color }}><Icon size={18} /></div>
                  <div>
                    <div className="tl-stat-val">{stats.byCat[c]}</div>
                    <div className="tl-stat-label">{m.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 分类筛选 */}
          <div className="tl-filters">
            {CAT_ALL.map((c) => {
              const m = CAT_META[c];
              const on = activeCats.has(c);
              return (
                <div key={c} className={`tl-chip ${on ? 'on' : ''}`} onClick={() => toggleCat(c)}>
                  <span className="dot" style={{ background: m.color }} />
                  {m.label}
                </div>
              );
            })}
          </div>

          {/* 时间线 / 列表 */}
          {sorted.length === 0 ? (
            <div className="tl-empty">
              <Clock size={36} className="tl-empty-ico" />
              <div style={{ fontSize: 13 }}>该案件暂无匹配记录</div>
            </div>
          ) : viewMode === 'timeline' ? (
            <div className="tl-body">
              <div className="tl-track">
                <div className="tl-line" />
                {groups.map(([gKey, recs]) => (
                  <div className="tl-group" key={gKey}>
                    <div className="tl-group-head">
                      {gKey}
                      <span className="badge">{recs.length} 条</span>
                    </div>
                    {recs.map((rec, i) => (
                      <TimelineItem
                        key={rec.id}
                        rec={rec}
                        index={i}
                        expanded={expandedId === rec.id}
                        onToggleExpand={() => setExpandedId((p) => (p === rec.id ? null : rec.id))}
                        onOpen={() => handleOpen(rec)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="tl-list">
              {sorted.map((rec) => {
                const meta = MODULE_META[rec.moduleId] || { label: rec.moduleId, dept: '', icon: FileText, color: '#6B7280' };
                const Icon = meta.icon;
                const ts = recordTimestamp(rec);
                return (
                  <div
                    key={rec.id}
                    className="tl-list-row"
                    style={{ ['--accent' as string]: meta.color }}
                    onClick={() => handleOpen(rec)}
                  >
                    <div className="tl-ico" style={{ background: `${meta.color}15`, color: meta.color }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{recordTitle(rec)}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {meta.dept} · {meta.label}
                      </div>
                    </div>
                    <span className="tl-date"><CalendarDays size={11} />{tsToChinese(ts)}</span>
                    <ChevronRight size={15} color="var(--color-text-secondary)" />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 详情抽屉 */}
      <div className={`tl-drawer-mask ${drawerRec ? 'open' : ''}`} onClick={() => setDrawerRec(null)} />
      <div className={`tl-drawer ${drawerRec ? 'open' : ''}`}>
        {drawerRec && <DrawerContent rec={drawerRec} onClose={() => setDrawerRec(null)} onOpen={() => handleNavigate(drawerRec)} />}
      </div>
    </div>
  );
}

/** 时间线条目 */
function TimelineItem({
  rec, index, expanded, onToggleExpand, onOpen,
}: {
  rec: MassRecord;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onOpen: () => void;
}) {
  const meta = MODULE_META[rec.moduleId] || { label: rec.moduleId, dept: '', icon: FileText, color: '#6B7280' };
  const Icon = meta.icon;
  const ts = recordTimestamp(rec);
  const summary = recordFields(rec, 8);
  const full = recordFields(rec, 0);

  return (
    <motion.div
      className="tl-item"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
    >
      <div className="tl-node" style={{ background: meta.color }} />
      <div className="tl-card" style={{ ['--accent' as string]: meta.color }} onClick={onOpen}>
        <div className="tl-card-top">
          <div className="tl-ico" style={{ background: `${meta.color}15`, color: meta.color }}>
            <Icon size={16} />
          </div>
          <div className="tl-meta">
            <span className="tl-tag" style={{ background: `${meta.color}15`, color: meta.color }}>
              {meta.dept} · {meta.label}
            </span>
            <span className="tl-date"><CalendarDays size={11} />{tsToChinese(ts)}</span>
          </div>
        </div>
        <div className="tl-title">{recordTitle(rec)}</div>
        <div className="tl-summary">
          {(expanded ? full : summary).map((s, si) => (
            <span key={si}><span>{s.label}: </span><b>{s.value}</b></span>
          ))}
        </div>
        <div
          className="tl-expand"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
        >
          {expanded ? <><ChevronDown size={13} />收起</> : <><ChevronRight size={13} />展开全部字段</>}
        </div>
      </div>
    </motion.div>
  );
}

/** 详情抽屉内容 */
function DrawerContent({
  rec, onClose, onOpen,
}: {
  rec: MassRecord;
  onClose: () => void;
  onOpen: () => void;
}) {
  const meta = MODULE_META[rec.moduleId] || { label: rec.moduleId, dept: '', icon: FileText, color: '#6B7280' };
  const Icon = meta.icon;
  const ts = recordTimestamp(rec);
  const fields = recordFields(rec, 0);

  return (
    <>
      <div className="tl-drawer-head">
        <div className="tl-ico" style={{ background: `${meta.color}15`, color: meta.color, width: 40, height: 40, borderRadius: 11 }}>
          <Icon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>{recordTitle(rec)}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {meta.dept} · {meta.label} · {tsToChinese(ts)}
          </div>
        </div>
        <button className="tl-btn" style={{ height: 30, padding: '0 8px' }} onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="tl-drawer-body">
        {fields.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>该记录暂无结构化字段内容。</div>
        ) : (
          fields.map((f, i) => (
            <div className="tl-drawer-kv" key={i}>
              <span className="k">{f.label}</span>
              <span className="v">{f.value}</span>
            </div>
          ))
        )}
        <button
          className="tl-btn"
          style={{ marginTop: 18, width: '100%', height: 38, justifyContent: 'center', background: 'var(--color-primary)', color: '#fff', borderColor: 'transparent' }}
          onClick={onOpen}
        >
          打开完整记录
        </button>
      </div>
    </>
  );
}
