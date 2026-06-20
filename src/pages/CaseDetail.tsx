/**
 * 案件 360° 全屏视图
 * 左侧 tab 切换维度，右侧展示内容
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Link2, Clock, Paperclip, Pen, Download } from 'lucide-react';
import { Descriptions, Tag, Button, Empty } from 'antd';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';
import { downloadAttachment } from '../store/attachmentStore';
import { MODULE_NAMES, findModule } from '../moduleConfig';
import { useCustomModules } from '../customModules';

type MassRecord = import('../store/massStore').MassRecord;

interface Props {
  record: MassRecord;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  caseName: '案件名称', caseNo: '案件编号', caseType: '案件类型', caseSource: '案件来源',
  suspect: '嫌疑人', suspectName: '嫌疑人姓名', caseStatus: '案件状态',
  status: '状态', handler: '经办人', handlerName: '经办人',
  briefCase: '简要案情', briefDescription: '简要说明', summary: '摘要',
  filingDate: '立案日期', receiveDate: '受理日期', crimeDate: '案发时间',
  caseLocation: '案发地', crimeLocation: '案发地',
  leadOfficer: '主办民警', assistOfficer: '协办民警',
  formerName: '曾用名', gender: '性别', ethnicity: '民族',
  birthDate: '出生日期', suspectIdNo: '身份证号', registeredAddress: '户籍地址',
  currentAddress: '现住址', education: '学历', occupation: '职业',
  suspectPhone: '手机号', landline: '座机', socialAccount: '社交账号',
  emergencyContact: '紧急联系人', hasCriminalRecord: '有无前科', isFugitive: '是否在逃',
  captureDate: '抓获时间', suspectRole: '涉案身份', personalIllegalIncome: '个人违法所得',
  arrestMethod: '归案方式', summonDate: '传唤时间',
  reporterName: '报案人', reporterGender: '性别', reporterIdNo: '身份证号',
  reporterPhone: '电话', reporterWechat: '微信', reporterAddress: '地址',
  reporterWorkplace: '工作单位', reporterRelationship: '与案件关系',
  reporterConfidential: '是否保密', reporterCooperate: '是否配合',
  reporterIdentity: '报案人身份', reporters: '报案人',
  measure: '强制措施类型', isNotified: '是否告知/通知', notifyDate: '告知/通知时间',
  approvalDate: '审批时间', executeDate: '执行时间', deadline: '期限',
  approver: '审批人', executeResult: '执行结果',
  clueSources: '线索来源', interviewees: '约谈对象',
  intervieweeName: '姓名', intervieweeGender: '性别', intervieweeAge: '年龄',
  intervieweeIdNo: '身份证号', intervieweePhone: '电话', intervieweeAddress: '地址',
  intervieweeIdentity: '身份', riskLevel: '风险等级',
  isElderly: '是否老年人', isHardship: '是否困难户',
  involvedEntities: '涉案主体', attachment: '附件',
  // 附件字段
  name: '文件名', lastModifiedDate: '最后修改时间', size: '文件大小',
  type: '文件类型', percent: '进度', uid: '附件ID',
  // 其他常见字段
  totalAmount: '涉案总金额', victimCount: '受害人数',
  amount: '金额', projectName: '项目名称', clueName: '线索名称',
  collectDate: '采集日期', visitDate: '走访日期', visitPurpose: '走访目的',
  visitResult: '走访结果', targetUnit: '走访对象',
  recordDate: '记录日期', criminalDetentionDate: '刑事拘留日期',
  bailDate: '取保日期', arrestDate: '逮捕日期',
  residentialSurveillanceDate: '监视居住日期', transferProsecutionDate: '移诉日期',
  interrogationDate: '询问时间', detentionDate: '拘留时间',
  punishment: '处罚结果', rewardStatus: '奖励状态',
  documentType: '文件类型', documentTitle: '文件标题',
  relatedCases: '关联案件', evidenceType: '证据类型',
  involvedEntities: '涉案主体', crimeAmount: '涉案金额',
};

function fmtDate(iso: string | Date): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 将任意值转为安全的字符串显示 */
function fmtValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) {
    // 附件数组：只显示文件名
    if (val.length > 0 && val[0] && typeof val[0] === 'object' && (val[0] as any).uid) {
      return val.map((f: any) => f.name || '附件').join('、');
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
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return fmtDate(val);
  return String(val);
}

const TABS = [
  { id: 'info', label: '基本信息', icon: FileText },
  { id: 'related', label: '关联记录', icon: Link2 },
  { id: 'timeline', label: '时间线', icon: Clock },
  { id: 'attachments', label: '附件', icon: Paperclip },
];

export default function CaseDetail({ record, onClose }: Props) {
  const darkMode = useAppStore((s) => s.darkMode);
  const setEditRecord = useAppStore((s) => s.setEditRecord);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const { allModules } = useCustomModules();
  const [activeTab, setActiveTab] = useState('info');

  const caseName = String(record.data?.caseName || record.data?.suspect || '未命名');
  const moduleName = MODULE_NAMES[record.moduleId] || record.moduleId;

  // 查找关联记录
  const relatedRecords = useMemo(() => {
    const all = getMassRecords();
    const kw = caseName.toLowerCase();
    return all.filter(r => {
      if (r.id === record.id) return false;
      const d = r.data || {};
      return Object.values(d).some(v => {
        if (typeof v === 'string') return v.toLowerCase().includes(kw);
        return false;
      });
    }).slice(0, 10);
  }, [record, caseName]);

  // 时间线
  const timeline = useMemo(() => {
    const all = getMassRecords();
    const kw = caseName.toLowerCase();
    return all
      .filter(r => {
        const d = r.data || {};
        return Object.values(d).some(v => typeof v === 'string' && v.toLowerCase().includes(kw));
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 20);
  }, [record, caseName]);

  // 附件
  const attachments = useMemo(() => {
    const d = record.data || {};
    const files: Array<{ uid: string; name: string }> = [];
    for (const [key, val] of Object.entries(d)) {
      if (key === 'attachment' || key === 'fileList') continue;
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === 'object' && item.uid && item.name) {
            files.push({ uid: item.uid, name: item.name });
          }
        }
      }
    }
    return files;
  }, [record]);

  // 表单字段（排除 section/attachment）
  const fields = useMemo(() => {
    const mod = findModule(record.moduleId, allModules);
    const tab = mod?.tabs.find(t => t.id === record.tabId) || mod?.tabs[0];
    return (tab?.fields || []).filter(f => f.type !== 'section' && f.type !== 'attachment');
  }, [record, allModules]);

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

  const textColor = 'var(--color-text)';
  const mutedColor = 'var(--color-text-secondary)';

  const handleRelatedClick = (rec: MassRecord) => {
    setEditRecord(rec);
    setCurrentPage(rec.moduleId);
    openModal('newRecord');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: darkMode ? '#0f1114' : '#F8FAFC',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* 顶栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        background: darkMode ? '#1a1d25' : '#fff',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{caseName}</div>
          <div style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>{moduleName} · {fmtDate(record.updatedAt)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
            style={{
              height: 40, paddingInline: 20, borderRadius: 8,
              background: darkMode ? '#374151' : '#F3F4F6',
              color: darkMode ? '#e2e2e6' : '#374151',
              border: `1px solid ${darkMode ? '#4b5563' : '#D1D5DB'}`,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            <ArrowLeft size={16} /> 返回
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setEditRecord(record); setCurrentPage(record.moduleId); openModal('newRecord'); onClose(); }}
            style={{
              height: 40, paddingInline: 20, borderRadius: 8,
              background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
              color: '#fff',
              border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              transition: 'all 0.15s',
            }}
          >
            <Pen size={16} /> 编辑
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧 tab */}
        <div style={{
          width: 180, flexShrink: 0,
          background: darkMode ? '#1a1d25' : '#fff',
          borderRight: '1px solid var(--color-border)',
          padding: '12px 0',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', cursor: 'pointer',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                  borderRight: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={16} />
                <span style={{ fontSize: 13 }}>{tab.label}</span>
              </div>
            );
          })}
          {/* 统计快览 */}
          <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--color-border-light)' }}>
            <div style={{ fontSize: 11, color: mutedColor, marginBottom: 6, fontWeight: 600 }}>📊 关联统计</div>
            <div style={{ fontSize: 12, color: textColor }}>
              <div>关联记录 <b>{relatedRecords.length}</b> 条</div>
              <div>附件 <b>{attachments.length}</b> 个</div>
              <div>时间线 <b>{timeline.length}</b> 项</div>
            </div>
          </div>
        </div>

        {/* 右侧内容 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {/* 基本信息 */}
          {activeTab === 'info' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Descriptions bordered column={2} size="small">
                {fields.map(f => (
                  <Descriptions.Item key={f.id} label={fieldLabelMap[f.id] || f.label} span={f.type === 'textarea' ? 2 : 1}>
                    {fmtValue(record.data?.[f.id])}
                  </Descriptions.Item>
                ))}
              </Descriptions>
              {/* 显示 repeatable section 数据（如嫌疑人信息） */}
              {Object.entries(record.data || {}).map(([key, val]) => {
                if (!Array.isArray(val) || val.length === 0 || typeof val[0] !== 'object') return null;
                const sectionLabel = key === 'suspects' ? '嫌疑人信息' : key === 'coerciveMeasures' ? '强制措施' : key === 'items' ? '详细信息' : key;
                return (
                  <div key={key} style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10, borderBottom: '2px solid var(--color-primary)', paddingBottom: 4 }}>
                      {sectionLabel}（{val.length} 条）
                    </div>
                    {val.map((item: Record<string, unknown>, idx: number) => (
                      <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--color-surface-hover)' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: mutedColor, marginBottom: 8 }}>#{idx + 1}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                          {Object.entries(item).map(([k, v]) => {
                            if (v === null || v === undefined || v === '') return null;
                            // 跳过内部字段
                            if (k.startsWith('__') || k === 'uid' || k === 'lastModified' || k === 'percent' || k === 'status' || k === 'size') return null;
                            return (
                              <div key={k} style={{ fontSize: 12, lineHeight: 1.8 }}>
                                <span style={{ color: mutedColor }}>{fieldLabelMap[k] || k}：</span>
                                <span style={{ color: textColor, fontWeight: 500 }}>{fmtValue(v)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* 关联记录 */}
          {activeTab === 'related' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {relatedRecords.length === 0 ? (
                <Empty description="暂无关联记录" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {relatedRecords.map(rec => (
                    <div
                      key={rec.id}
                      className="card hover-lift"
                      style={{ padding: 14, cursor: 'pointer' }}
                      onClick={() => handleRelatedClick(rec)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Tag color="blue" style={{ fontSize: 11 }}>{MODULE_NAMES[rec.moduleId] || rec.moduleId}</Tag>
                          <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 8, color: textColor }}>
                            {String(rec.data?.caseName || rec.data?.suspect || rec.data?.title || '').slice(0, 24)}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: mutedColor }}>{fmtDate(rec.updatedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 时间线 */}
          {activeTab === 'timeline' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {timeline.length === 0 ? (
                <Empty description="暂无时间线" />
              ) : (
                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  <div style={{ position: 'absolute', left: 8, top: 8, bottom: 8, width: 2, background: 'var(--color-primary)', opacity: 0.2 }} />
                  {timeline.map((rec, i) => (
                    <div key={rec.id} style={{ position: 'relative', paddingBottom: 16 }}>
                      <div style={{ position: 'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: '50%', background: i === 0 ? 'var(--color-primary)' : 'var(--color-border)', border: '2px solid var(--color-surface)' }} />
                      <div style={{ fontSize: 12, color: mutedColor, marginBottom: 4 }}>
                        <Tag color="blue" style={{ fontSize: 10 }}>{MODULE_NAMES[rec.moduleId] || rec.moduleId}</Tag>
                        <span style={{ marginLeft: 8 }}>{fmtDate(rec.updatedAt)}</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: textColor, cursor: 'pointer' }}
                        onClick={() => handleRelatedClick(rec)}>
                        {String(rec.data?.caseName || rec.data?.title || '').slice(0, 30) || '无标题'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 附件 */}
          {activeTab === 'attachments' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {attachments.length === 0 ? (
                <Empty description="暂无附件" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attachments.map(att => (
                    <div key={att.uid} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: textColor }}>📎 {att.name}</span>
                      <button className="btn btn-sm btn-ghost" onClick={async () => {
                        try { await downloadAttachment(att.uid); } catch { /* ignore */ }
                      }}>
                        <Download size={12} /> 下载
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
