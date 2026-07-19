/**
 * 全局搜索组件
 * 搜遍所有模块的所有字段 + 附件名，结果按模块分组展示，命中关键词高亮
 */
import { useMemo, useState, useRef, useCallback, useEffect, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronRight, FileText } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getMassRecords } from '../store/massStore';
import type { MassRecord } from '../store/massStore';
import { getAllAttachments } from '../store/attachmentStore';
import { MODULE_INFO } from '../moduleConfig';
import { FIELD_LABELS as SHARED_FIELD_LABELS } from '../constants/fieldLabels';

interface SearchResult {
  moduleId: string;
  moduleLabel: string;
  moduleDept: string;
  records: Array<{
    record: MassRecord;
    matchFields: Array<{ label: string; value: string }>;
  }>;
}

/** 优先展示的字段（匹配到这些字段时排前面） */
const PRIORITY_FIELDS = new Set([
  'caseName', 'caseNo', 'suspect', 'suspectName', 'holder', 'person',
  'enterprise', 'reportMatter', 'projectName', 'clueName',
  'idNo', 'phone', 'leadOfficer', 'assistOfficer',
]);

/** 完整字段标签映射：以统一映射为基准，叠加搜索场景的特化标签（H-8 去重） */
const FIELD_LABELS: Record<string, string> = {
  ...SHARED_FIELD_LABELS,
  suspectIdNo: '嫌疑人身份证号',
  suspectPhone: '嫌疑人手机号',
  receiveDate: '受案时间',
  filingDate: '立案时间',
  deadline: '期限届满时间',
  notifyDate: '告知时间',
  totalAmount: '涉案金额',
  executeResult: '执行情况',
  summary: '用途摘要',
};

/** 高亮关键词，返回 JSX 片段 */
function highlightText(text: string, keyword: string): (string | ReactElement)[] {
  if (!keyword) return [text];
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  const parts: (string | ReactElement)[] = [];
  let lastIndex = 0;
  let idx = lower.indexOf(kw, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <mark key={idx} style={{
        background: '#FDE68A', color: '#92400E',
        borderRadius: 2, padding: '0 2px',
      }}>
        {text.slice(idx, idx + kw.length)}
      </mark>
    );
    lastIndex = idx + kw.length;
    idx = lower.indexOf(kw, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/**
 * 扁平化一条记录的所有文本字段，过滤出匹配关键词的字段
 */
function matchRecord(record: MassRecord, keyword: string): Array<{ label: string; value: string }> {
  const lowerKw = keyword.toLowerCase();
  const matches: Array<{ label: string; value: string }> = [];

  for (const [key, raw] of Object.entries(record.data || {})) {
    if (raw === null || raw === undefined) continue;
    // 跳过附件文件列表对象
    if (key === 'attachment' || key === 'fileList') continue;
    const str = String(raw);
    if (str.toLowerCase().includes(lowerKw)) {
      const label = FIELD_LABELS[key] || key;
      const display = str.length > 80 ? str.slice(0, 80) + '…' : str;
      matches.push({ label, value: display });
    }
  }

  // 优先级排序：优先字段在前
  matches.sort((a, b) => {
    const aP = PRIORITY_FIELDS.has(a.label) ? 0 : 1;
    const bP = PRIORITY_FIELDS.has(b.label) ? 0 : 1;
    return aP - bP;
  });

  return matches;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const openModal = useAppStore((s) => s.openModal);
  const setEditRecord = useAppStore((s) => s.setEditRecord);
  const darkMode = useAppStore((s) => s.darkMode);

  // 异步加载附件名列表
  useEffect(() => {
    getAllAttachments().then((list) => {
      const names = Array.from(new Set(list.map((a) => a.fileName)));
      setAttachmentNames(names);
    }).catch(() => {});
  }, []);

  // L-10：记录总数只读取一次（底部 JSX 不再重复调用 getMassRecords()）
  const allRecords = useMemo(() => getMassRecords(), []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim();
    if (!q) return [];

    const grouped = new Map<string, SearchResult>();
    const lowerKw = q.toLowerCase();

    for (const record of allRecords) {
      const matches = matchRecord(record, q);
      // 也搜附件名：如果记录的 data 中有附件字段，检查文件名
      if (matches.length === 0) {
        // 检查附件名索引
        for (const name of attachmentNames) {
          if (name.toLowerCase().includes(lowerKw)) {
            const data = record.data || {};
            // 检查该记录是否有附件引用
            for (const [, val] of Object.entries(data)) {
              if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0]?.name) {
                const fileItems = val as Array<{ name?: string }>;
                for (const item of fileItems) {
                  if (item.name && item.name.toLowerCase().includes(lowerKw)) {
                    matches.push({ label: '附件名称', value: item.name });
                  }
                }
              }
            }
            break;
          }
        }
      }
      if (matches.length === 0) continue;

      const info = MODULE_INFO[record.moduleId] || { label: record.moduleId, dept: '' };
      if (!grouped.has(record.moduleId)) {
        grouped.set(record.moduleId, {
          moduleId: record.moduleId,
          moduleLabel: info.label,
          moduleDept: info.dept,
          records: [],
        });
      }
      grouped.get(record.moduleId)!.records.push({ record, matchFields: matches });
    }

    // 按匹配数量降序排列模块
    return Array.from(grouped.values()).sort((a, b) => b.records.length - a.records.length);
  }, [query, attachmentNames, allRecords]);

  const totalMatches = useMemo(() => results.reduce((s, g) => s + g.records.length, 0), [results]);

  const handleNavigate = useCallback((moduleId: string, record: MassRecord) => {
    setEditRecord(record);
    setCurrentPage(moduleId);
    openModal('newRecord');
    setQuery('');
    setFocused(false);
  }, [setCurrentPage, setEditRecord, openModal]);

  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  const isOpen = focused && query.trim().length > 0;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* 搜索输入框 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          position: 'relative',
          borderRadius: 14,
          background: darkMode ? 'rgba(28, 31, 38, 0.85)' : '#fff',
          border: focused
            ? `2px solid ${darkMode ? '#4B9EFF' : '#2563EB'}`
            : `2px solid ${darkMode ? 'rgba(163, 201, 255, 0.15)' : '#E5E7EB'}`,
          boxShadow: focused
            ? darkMode
              ? '0 8px 24px rgba(0, 100, 200, 0.25), 0 2px 8px rgba(0,0,0,0.2)'
              : '0 8px 24px rgba(37, 99, 235, 0.15), 0 2px 4px rgba(0,0,0,0.04)'
            : '0 2px 8px rgba(0,0,0,0.04)',
          transition: 'all 0.2s',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 18px',
        }}>
          <Search size={20} color={focused ? (darkMode ? '#4B9EFF' : '#2563EB') : '#9CA3AF'} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 250)}
            placeholder="全局搜索：案件编号/姓名/手机号/身份证号/附件名..."
            style={{
              flex: 1, marginLeft: 12,
              border: 'none', outline: 'none',
              fontSize: 16, fontWeight: 500,
              background: 'transparent',
              color: darkMode ? '#e2e2e6' : '#1F2937',
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={handleClear}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                background: darkMode ? 'rgba(66,71,79,0.4)' : '#F3F4F6',
                color: darkMode ? '#8c919a' : '#6B7280',
                flexShrink: 0,
              }}
            >
              <X size={16} />
            </motion.div>
          )}
          {focused && query && (
            <span style={{
              marginLeft: 10, fontSize: 12, color: '#9CA3AF',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              共 {totalMatches} 条匹配
            </span>
          )}
        </div>
      </motion.div>

      {/* 搜索结果下拉 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.97, transformOrigin: 'top' }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
              background: darkMode ? '#1a1d25' : '#fff',
              borderRadius: 14,
              border: darkMode ? '1px solid rgba(163, 201, 255, 0.12)' : '1px solid #E5E7EB',
              boxShadow: darkMode
                ? '0 12px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)'
                : '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)',
              maxHeight: '60vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ overflow: 'auto', flex: 1 }}>
              {results.length === 0 ? (
                <div style={{
                  padding: '24px 20px', textAlign: 'center',
                  color: darkMode ? '#8c919a' : '#9CA3AF', fontSize: 13,
                }}>
                  未找到匹配 "{query}" 的记录
                </div>
              ) : (
                results.map((group) => (
                  <div key={group.moduleId}>
                    {/* 模块分组标题 */}
                    <div style={{
                      padding: '10px 18px 6px',
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: darkMode ? '1px solid rgba(66,71,79,0.3)' : '1px solid #F3F4F6',
                    }}>
                      <FileText size={13} color={darkMode ? '#4B9EFF' : '#2563EB'} />
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: darkMode ? '#e2e2e6' : '#374151',
                      }}>
                        {group.moduleDept ? `${group.moduleDept} · ` : ''}{group.moduleLabel}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: darkMode ? '#8c919a' : '#9CA3AF',
                        marginLeft: 'auto',
                      }}>
                        {group.records.length} 条
                      </span>
                    </div>

                    {/* 该模块下的匹配记录 */}
                    {group.records.map((item, ri) => (
                      <motion.div
                        key={item.record.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: ri * 0.02 }}
                        onClick={() => handleNavigate(group.moduleId, item.record)}
                        style={{
                          padding: '9px 18px',
                          cursor: 'pointer',
                          borderBottom: ri < group.records.length - 1
                            ? (darkMode ? '1px solid rgba(66,71,79,0.15)' : '1px solid #F9FAFB')
                            : 'none',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(46,125,202,0.08)' : 'rgba(37,99,235,0.04)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 4, height: 4, borderRadius: '50%',
                            background: darkMode ? '#4B9EFF' : '#2563EB',
                            flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* 匹配字段列表 */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                              {item.matchFields.slice(0, 4).map((mf, fi) => (
                                <span key={fi} style={{ fontSize: 12, color: darkMode ? '#c8ccd4' : '#4B5563', lineHeight: 1.6 }}>
                                  <span style={{ color: darkMode ? '#8c919a' : '#9CA3AF' }}>{mf.label}: </span>
                                  <span style={{
                                    color: darkMode ? '#4B9EFF' : '#2563EB',
                                    fontWeight: 500,
                                  }}>
                                    {highlightText(mf.value, query)}
                                  </span>
                                </span>
                              ))}
                              {item.matchFields.length > 4 && (
                                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                                  +{item.matchFields.length - 4} 项
                                </span>
                              )}
                            </div>
                            {/* 时间 */}
                            <div style={{ fontSize: 10, color: darkMode ? '#8c919a' : '#D1D5DB', marginTop: 2 }}>
                              {item.record.createdAt?.slice(0, 10) || ''}
                            </div>
                          </div>
                          <ChevronRight size={13} color={darkMode ? '#42474f' : '#D1D5DB'} style={{ flexShrink: 0 }} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* 底部提示 */}
            <div style={{
              padding: '8px 18px',
              borderTop: darkMode ? '1px solid rgba(66,71,79,0.3)' : '1px solid #F3F4F6',
              fontSize: 11, color: darkMode ? '#8c919a' : '#9CA3AF',
              textAlign: 'center',
              background: darkMode ? 'rgba(28,31,38,0.6)' : '#FAFBFC',
            }}>
              共搜索 {allRecords.length} 条记录 · 搜附件名 {attachmentNames.length} 个 · 点击结果打开编辑
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
