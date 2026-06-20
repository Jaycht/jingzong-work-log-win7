/**
 * 共享表单字段组件
 * 消除 DrawerNewRecord.tsx 中多份重复的 AutoComplete/MultiPerson 组件
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AutoComplete, Button, Divider, Form, Input, Select, Space } from 'antd';
import dayjs from 'dayjs';
import { localStorageAdapter } from "../store/adapter";
import type { FieldDefinition } from '../moduleConfig';
import { MODULE_NAMES } from '../moduleConfig';
import { getClueProjectNames, getLegalReportMatters, getEvidenceClueNames, getSquadCaseNames, getSquadCaseNos, getMassRecords } from '../store/massStore';
import { getFieldHistory, getAllCaseNames, getAllCaseNos, getCaseNamesByNo, getCaseNosByName, getCaseDetail, type CaseDetail, getAllSuspectNames, getSuspectInfo, deleteFieldHistoryEntry, getHiddenSuggestions, hideFieldSuggestion, recordFieldValue } from '../store/inputHistoryStore';

type SelectValue = string | string[] | undefined;

/* ===================== 通用 AutoComplete 字段 ===================== */

interface AutoCompleteFieldProps {
  field: FieldDefinition;
  /** 获取选项列表的函数（每次调用重新读取数据） */
  getOptions: () => string[];
  placeholder?: string;
  subName?: number;
}

/** 通用 AutoComplete 字段组件，消除 5 份重复的 AutoComplete 组件 */
export function AutoCompleteField({ field, getOptions, placeholder, subName }: AutoCompleteFieldProps) {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const options = useMemo(() => {
    // refreshKey 变化时重新读取数据
    void refreshKey;
    const items = getOptions();
    return items.map((item) => ({ value: item, label: item }));
  }, [getOptions, refreshKey]);

  const rules = field.required
    ? [{ required: true, message: `请填写${field.label}` }]
    : undefined;
  const fieldName = subName !== undefined ? [subName, field.id] : field.id;

  return (
    <Form.Item name={fieldName} label={field.label} rules={rules}>
      <AutoComplete
        open={open}
        onFocus={() => { setOpen(true); setRefreshKey((k) => k + 1); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        options={options}
        placeholder={placeholder || `请输入${field.label}`}
        filterOption={(inputValue, option) =>
          (option?.value?.toUpperCase() ?? '').includes(inputValue.toUpperCase())
        }
        style={{ width: '100%' }}
      />
    </Form.Item>
  );
}

/** 涉众数据统计 - 案件名称自动匹配涉众线索 */
export function CaseNameAutoComplete({ field, subName }: { field: FieldDefinition; subName?: number }) {
  return (
    <AutoCompleteField
      field={field}
      subName={subName}
      getOptions={getClueProjectNames}
      placeholder="请输入案件名称，可匹配涉众项目"
    />
  );
}

/** 法制室·案件总台账 - 匹配接报事项 */
export function CaseNameMatchReport({ field, subName }: { field: FieldDefinition; subName?: number }) {
  return (
    <AutoCompleteField
      field={field}
      subName={subName}
      getOptions={getLegalReportMatters}
      placeholder="请输入案件名称，可匹配接报事项"
    />
  );
}

/** 调证/资金分析 - 匹配线索名称 */
export function CaseNameMatchClue({ field, subName }: { field: FieldDefinition; subName?: number }) {
  return (
    <AutoCompleteField
      field={field}
      subName={subName}
      getOptions={getEvidenceClueNames}
      placeholder="请输入案件名称，可匹配线索登记中的交办线索名称"
    />
  );
}

/** 每日工作记录 - 案件编号匹配中队案件 */
export function CaseNoMatchSquad({ field, subName }: { field: FieldDefinition; subName?: number }) {
  const getCaseNos = useMemo(() => () => getSquadCaseNos(), []);
  return (
    <AutoCompleteField
      field={field}
      subName={subName}
      getOptions={getCaseNos}
      placeholder="A3703231200002026******"
    />
  );
}

/** 每日工作记录/强制措施 - 案件名称匹配中队案件 */
export function CaseNameMatchSquad({ field, subName }: { field: FieldDefinition; subName?: number }) {
  const getCaseNames = useMemo(() => () => getSquadCaseNames(), []);
  return (
    <AutoCompleteField
      field={field}
      subName={subName}
      getOptions={getCaseNames}
      placeholder="请输入案件名称，可匹配中队案件"
    />
  );
}

/* ===================== 多人输入字段 ===================== */

/** 姓名类字段(询问笔录/讯问笔录/接待报案/信访人)用compact横向排列 */
const NAME_FIELDS = ['inquiryRecord', 'interrogationRecord', 'reception'];

function MultiPersonInput({ value, onChange, compact }: { value?: string; onChange?: (val: string) => void; compact?: boolean }) {
  const [items, setItems] = useState<string[]>(() => {
    if (!value) return [''];
    return value.split('、').filter(Boolean);
  });

  // 同步外部 value（编辑时 Form 异步设值后 state 不会被重新初始化）
  if (value !== undefined) {
    const expected = value.split('、').filter(Boolean);
    if (expected.length > 0 && (expected.length !== items.length || expected.some((v, i) => v !== items[i]))) {
      setItems(expected);
    } else if (expected.length === 0 && items.length === 1 && items[0] !== '') {
      setItems(['']);
    }
  }

  const sync = (next: string[]) => {
    setItems(next);
    onChange?.(next.filter(Boolean).join('、'));
  };

  const addItem = () => sync([...items, '']);
  const removeItem = (i: number) => {
    const next = items.filter((_, idx) => idx !== i);
    sync(next.length === 0 ? [''] : next);
  };
  const updateItem = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    sync(next);
  };

  const itemStyle: React.CSSProperties = compact
    ? { display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }
    : { display: 'flex', alignItems: 'center', gap: 2, width: '100%' };

  const inputStyle: React.CSSProperties = compact
    ? { width: 80, textAlign: 'center' as const }
    : { flex: 1, minWidth: 80 };

  return (
    <div style={{
      display: 'flex',
      flexDirection: compact ? 'row' : 'column',
      flexWrap: compact ? 'wrap' : undefined,
      gap: 8,
      alignItems: compact ? 'center' : 'stretch',
    }}>
      {items.map((item, i) => (
        <div key={i} style={itemStyle}>
          <Input value={item} onChange={(e) => updateItem(i, e.target.value)} style={inputStyle} />
          {items.length > 1 && (
            <div
              onClick={() => removeItem(i)}
              style={{
                width: 20, height: 20, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#FEE2E2', color: '#DC2626',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                lineHeight: 1, flexShrink: 0,
              }}
              title="移除"
            >
              ×
            </div>
          )}
        </div>
      ))}
      <div
        onClick={addItem}
        style={{
          width: 32, height: 32, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px dashed #CBD5E1', color: '#64748B',
          fontSize: 20, fontWeight: 400, cursor: 'pointer',
          transition: 'all .15s', userSelect: 'none', flexShrink: 0,
          alignSelf: compact ? 'center' : 'flex-start',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#155A8A'; (e.currentTarget as HTMLDivElement).style.color = '#155A8A'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLDivElement).style.color = '#64748B'; }}
        title="添加一项"
      >
        +
      </div>
    </div>
  );
}

export function MultiPersonField({ field }: { field: FieldDefinition }) {
  const rules = field.required
    ? [{ required: true, message: `请填写${field.label}` }]
    : undefined;
  return (
    <Form.Item name={field.id} label={field.label} rules={rules}>
      <MultiPersonInput compact={NAME_FIELDS.includes(field.id)} />
    </Form.Item>
  );
}

/* ===================== 持久化 Select（支持自定义选项） ===================== */

export function PersistedSelect({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value?: SelectValue;
  onChange?: (value: SelectValue) => void;
}) {
  const multiple = field.multiple ?? false;
  const storageKey = field.customOptionKey ? `jingzong.selectOptions.${field.customOptionKey}` : '';
  const [newOption, setNewOption] = useState('');
  const [customOptions, setCustomOptions] = useState<string[]>(() => {
    if (!storageKey) return [];
    try {
      const stored = localStorageAdapter.getItem<string[]>(storageKey, []);
      return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });
  const options = Array.from(new Set([...(field.options || []), ...customOptions]));

  const saveCustomValue = (value: string) => {
    if (!storageKey) return;
    const normalized = value.trim();
    if (!normalized || options.includes(normalized)) return;
    setCustomOptions((prev) => {
      const next = Array.from(new Set([...prev, normalized]));
      localStorageAdapter.setItem(storageKey, next);
      return next;
    });
    setNewOption('');
  };

  if (field.customOptionKey) {
    return (
      <Select
        value={value}
        onChange={onChange}
        mode={multiple ? 'multiple' : undefined}
        showSearch
        placeholder={`请选择${field.label}`}
        options={options.map((o) => ({ label: o, value: o }))}
        dropdownRender={(menu) => (
          <>
            {menu}
            <Divider style={{ margin: '8px 0' }} />
            <Space style={{ padding: '0 8px 8px', width: '100%' }}>
              <Input
                value={newOption}
                placeholder={`新增${field.label}`}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button type="primary" onClick={() => saveCustomValue(newOption)}>
                添加
              </Button>
            </Space>
          </>
        )}
      />
    );
  }

  return (
    <Select value={value} onChange={onChange} mode={multiple ? 'multiple' : undefined} showSearch placeholder={`请选择${field.label}`} options={options.map((o) => ({ label: o, value: o }))} />
  );
}

/* ===================== 输入历史 AutoComplete ===================== */

interface InputWithHistoryProps {
  field: FieldDefinition;
  placeholder?: string;
  /** 额外选项，合并到历史记录中一起展示 */
  extraOptions?: string[];
  /** 选择时的回调 */
  onSelect?: (value: string) => void;
  /** Form.Item 注入的值与变更回调 */
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * 带输入历史自动补全的文本输入框
 * 在已有 AutoComplete 匹配的基础上，额外展示该字段的历史输入记录
 */
export function InputWithHistory({ field, placeholder, extraOptions, onSelect, value, onChange }: InputWithHistoryProps) {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // 直接用 prop value（来自 Form.Item 注入），不维护内部状态——编辑时才能正确显示已存数据
  const displayValue = value || '';

  const allOptions = useMemo(() => {
    void refreshKey;
    const history = getFieldHistory(field.id);
    const merged = [
      ...(extraOptions || []),
      ...history,
    ];
    return Array.from(new Set(merged));
  }, [field.id, extraOptions, refreshKey]);

  const filteredOptions = useMemo(() => {
    if (!displayValue) return allOptions;
    const q = displayValue.toUpperCase();
    return allOptions.filter((item) => item.toUpperCase().includes(q));
  }, [allOptions, displayValue]);

  const handleInputChange = (val: string) => {
    onChange?.(val);
  };

  const handleSelect = (val: string) => {
    onChange?.(val);
    onSelect?.(val);
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={displayValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => { setOpen(true); setRefreshKey((k) => k + 1); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder || `请输入${field.label}`}
        style={{
          width: '100%', height: 32, padding: '0 11px',
          border: '1px solid #D9D9D9', borderRadius: 6,
          fontSize: 14, color: '#333', outline: 'none',
          fontFamily: 'inherit', boxSizing: 'border-box',
          transition: 'border-color .2s, box-shadow .2s',
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = '#1677ff';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(22,119,255,0.1)';
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = '#D9D9D9';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {open && filteredOptions.length > 0 && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
            marginTop: 2, background: '#fff', borderRadius: 6,
            border: '1px solid #E5E7EB', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
            maxHeight: 240, overflow: 'auto',
          }}
        >
          {filteredOptions.map((item) => {
            const isHistory = getFieldHistory(field.id).includes(item);
            return (
              <div
                key={item}
                style={{
                  display: 'flex', alignItems: 'center', padding: '6px 12px',
                  fontSize: 13, color: '#1F2937',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  onMouseDown={() => { handleSelect(item); }}
                  style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}
                >
                  {item}
                </span>
                {isHistory && (
                  <span
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      deleteFieldHistoryEntry(field.id, item);
                      setRefreshKey((k) => k + 1);
                    }}
                    style={{
                      cursor: 'pointer', padding: '2px 6px', marginLeft: 4,
                      fontSize: 14, lineHeight: 1, color: '#D1D5DB',
                      borderRadius: 3, userSelect: 'none', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEE2E2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; e.currentTarget.style.background = 'transparent'; }}
                  >×</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===================== 身份证号字段（自动提取出生日期） ===================== */

/** 从身份证号提取出生日期，支持18位和15位 */
function parseBirthFromIdNo(idNo: string): string | null {
  let birth: string | null = null;
  if (idNo.length === 18) {
    const s = idNo.substring(6, 14);
    birth = s.substring(0, 4) + '-' + s.substring(4, 6) + '-' + s.substring(6, 8);
  } else if (idNo.length === 15) {
    const s = idNo.substring(6, 12);
    birth = '19' + s.substring(0, 2) + '-' + s.substring(2, 4) + '-' + s.substring(4, 6);
  }
  if (birth) {
    const d = dayjs(birth);
    return d.isValid() ? birth : null;
  }
  return null;
}

/**
 * 身份证号输入框
 * 输入18位/15位身份证号后自动提取出生日期填入 birthDate 字段
 */
export function IdNoField({ field, subName, listName }: {
  field: FieldDefinition;
  subName?: number;
  listName?: string;
}) {
  const form = Form.useFormInstance();
  const fieldName = subName !== undefined ? [subName, field.id] : field.id;
  const birthDateName = (subName !== undefined && listName)
    ? [listName, subName, 'birthDate']
    : 'birthDate';

  const rules = field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined;

  const handleIdNoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    form.setFieldsValue({ [fieldName as any]: val });
    // 身份证号达到15位或18位时自动提取出生日期
    if (val.length === 18 || val.length === 15) {
      const birth = parseBirthFromIdNo(val);
      if (birth) {
        form.setFieldsValue({ [birthDateName as any]: dayjs(birth) });
      }
    }
  };

  const watchedValue: unknown = Form.useWatch(fieldName as any, form);
  const currentValue: string = (typeof watchedValue === 'string' ? watchedValue : '') || '';

  return (
    <Form.Item name={fieldName} label={field.label} rules={rules}>
      <input
        value={currentValue}
        onChange={handleIdNoChange}
        placeholder="请输入身份证号（自动提取出生日期）"
        style={{
          width: '100%', height: 32, padding: '0 11px',
          border: '1px solid #D9D9D9', borderRadius: 6,
          fontSize: 14, color: '#333', outline: 'none',
          fontFamily: 'inherit', boxSizing: 'border-box',
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = '#1677ff';
          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(22,119,255,0.1)';
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = '#D9D9D9';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </Form.Item>
  );
}

/* ===================== 全局案件名称/编号联动 ===================== */

/**
 * 从 CaseDetail 中提取字段填入表单
 * 仅填充表单中实际存在的字段，不抛出未定义字段的错误
 */
function fillCaseDetail(form: any, detail: CaseDetail): void {
  const kv: Record<string, unknown> = {};
  if (detail.leadOfficer) kv.leadOfficer = detail.leadOfficer;
  if (detail.assistOfficer) kv.assistOfficer = detail.assistOfficer;
  if (detail.receiveDate) kv.receiveDate = dayjs(detail.receiveDate);
  if (detail.filingDate) kv.filingDate = dayjs(detail.filingDate);
  if (detail.caseType) kv.caseType = detail.caseType;
  if (detail.caseSource) kv.caseSource = detail.caseSource;
  if (detail.totalAmount !== undefined) kv.totalAmount = detail.totalAmount;
  if (detail.caseSummary) kv.caseSummary = detail.caseSummary;
  if (detail.filingDocNo) kv.filingDocNo = detail.filingDocNo;
  if (Object.keys(kv).length > 0) {
    form.setFieldsValue(kv);
  }
}

/**
 * 全局案件名称字段
 * 展示所有模块中已保存的案件名称，选择后自动填充案件编号
 *
 * 使用 Form.useWatch 响应式读取（联动赋值后自动触发对面字段重渲染）
 * + native <input> 显式绑定 value（避免 antd Form.Item 包裹 div 时注入不到 Input 的问题）
 */
export function GlobalCaseNameField({ field, subName }: {
  field: FieldDefinition;
  subName?: number;
}) {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const form = Form.useFormInstance();

  const fieldName = subName !== undefined ? [subName, field.id] : field.id;
  const nameKey = typeof fieldName === 'string' ? fieldName : fieldName[1];

  // 本地 state 管理输入值，避免每次输入触发重渲染打断 IME
  const formValue: unknown = Form.useWatch(nameKey, form);
  const syncedValue: string = (typeof formValue === 'string' ? formValue : '') || '';
  const [localValue, setLocalValue] = useState(syncedValue);
  useEffect(() => { setLocalValue(syncedValue); }, [syncedValue]);

  const allOptions = useMemo(() => {
    void refreshKey;
    const hidden = new Set(getHiddenSuggestions('caseName'));
    return getAllCaseNames().filter((item) => !hidden.has(item));
  }, [refreshKey]);

  const filteredOptions = useMemo(() => {
    if (!syncedValue) return allOptions;
    const q = syncedValue.toUpperCase();
    return allOptions.filter((item) => item.toUpperCase().includes(q));
  }, [allOptions, syncedValue]);

  const history = [...new Set([...getFieldHistory('caseName'), ...getFieldHistory('caseNo')])];

  const rules = field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined;

  // 输入时只更新本地 state
  const handleChange = (val: string) => {
    setLocalValue(val);
  };

  // 失焦时同步到 form + 关闭下拉
  const handleBlurSync = () => {
    setTimeout(() => {
      setOpen(false);
      if (!form) return;
      const current = form.getFieldValue(nameKey);
      if (String(current || '') !== localValue) {
        form.setFieldsValue({ [nameKey]: localValue });
      }
    }, 200);
  };

  const handleSelect = (val: string) => {
    if (!form) return;
    form.setFieldsValue({ [nameKey]: val });
    setLocalValue(val);
    const relatedNos = getCaseNosByName(val);
    if (relatedNos.length > 0) {
      form.setFieldsValue({ caseNo: relatedNos[0] });
      const detail = getCaseDetail(relatedNos[0]);
      if (detail) fillCaseDetail(form, detail);
    }
    setOpen(false);
  };

  return (
    <Form.Item name={fieldName} label={field.label} rules={rules}>
      <div style={{ position: 'relative' }}>
        <input
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setOpen(true); setRefreshKey((k) => k + 1); }}
          onBlur={handleBlurSync}
          placeholder="请输入案件名称（全软件数据共享）"
          style={{
            width: '100%', height: 32, padding: '0 11px',
            border: '1px solid #D9D9D9', borderRadius: 6,
            fontSize: 14, color: '#333', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
            transition: 'border-color .2s, box-shadow .2s',
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = '#1677ff';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(22,119,255,0.1)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = '#D9D9D9';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {open && filteredOptions.length > 0 && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
              marginTop: 2, background: '#fff', borderRadius: 6,
              border: '1px solid #E5E7EB', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              maxHeight: 240, overflow: 'auto',
            }}
          >
            {filteredOptions.map((item) => {
              const isHistory = history.includes(item);
              return (
                <div
                  key={item}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '6px 12px',
                    fontSize: 13, color: '#1F2937',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}
                  >
                    {item}
                  </span>
                  {isHistory && (
                    <span
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        hideFieldSuggestion('caseName', item);
                        hideFieldSuggestion('caseNo', item);
                        setRefreshKey((k) => k + 1);
                      }}
                      style={{
                        cursor: 'pointer', padding: '2px 6px', marginLeft: 4,
                        fontSize: 14, lineHeight: 1, color: '#D1D5DB',
                        borderRadius: 3, userSelect: 'none', flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEE2E2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; e.currentTarget.style.background = 'transparent'; }}
                    >×</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Form.Item>
  );
}

/**
 * 全局案件编号字段
 * 展示所有模块中已保存的案件编号，选择后自动填充案件名称
 *
 * 同 GlobalCaseNameField，使用 Form.useWatch + native <input> 模式
 */
export function GlobalCaseNoField({ field, subName }: {
  field: FieldDefinition;
  subName?: number;
}) {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const form = Form.useFormInstance();

  const fieldName = subName !== undefined ? [subName, field.id] : field.id;
  const nameKey = typeof fieldName === 'string' ? fieldName : fieldName[1];

  const formValue: unknown = Form.useWatch(nameKey, form);
  const syncedValue: string = (typeof formValue === 'string' ? formValue : '') || '';
  const [localValue, setLocalValue] = useState(syncedValue);
  useEffect(() => { setLocalValue(syncedValue); }, [syncedValue]);

  const allOptions = useMemo(() => {
    void refreshKey;
    const hidden = new Set(getHiddenSuggestions('caseNo'));
    return getAllCaseNos().filter((item) => !hidden.has(item));
  }, [refreshKey]);

  const filteredOptions = useMemo(() => {
    if (!syncedValue) return allOptions;
    const q = syncedValue.toUpperCase();
    return allOptions.filter((item) => item.toUpperCase().includes(q));
  }, [allOptions, syncedValue]);

  const history = [...new Set([...getFieldHistory('caseNo'), ...getFieldHistory('caseName')])];

  const rules = field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined;

  const handleChange = (val: string) => {
    setLocalValue(val);
  };

  const handleBlurSync = () => {
    setTimeout(() => {
      setOpen(false);
      if (!form) return;
      const current = form.getFieldValue(nameKey);
      if (String(current || '') !== localValue) {
        form.setFieldsValue({ [nameKey]: localValue });
      }
    }, 200);
  };

  const handleSelect = (val: string) => {
    if (!form) return;
    form.setFieldsValue({ [nameKey]: val });
    setLocalValue(val);
    const relatedNames = getCaseNamesByNo(val);
    if (relatedNames.length > 0) {
      form.setFieldsValue({ caseName: relatedNames[0] });
      const detail = getCaseDetail(val);
      if (detail) fillCaseDetail(form, detail);
    }
    setOpen(false);
  };

  return (
    <Form.Item name={fieldName} label={field.label} rules={rules}>
      <div style={{ position: 'relative' }}>
        <input
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setOpen(true); setRefreshKey((k) => k + 1); }}
          onBlur={handleBlurSync}
          placeholder="请输入案件编号（全软件数据共享）"
          style={{
            width: '100%', height: 32, padding: '0 11px',
            border: '1px solid #D9D9D9', borderRadius: 6,
            fontSize: 14, color: '#333', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
            transition: 'border-color .2s, box-shadow .2s',
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = '#1677ff';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(22,119,255,0.1)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = '#D9D9D9';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {open && filteredOptions.length > 0 && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
              marginTop: 2, background: '#fff', borderRadius: 6,
              border: '1px solid #E5E7EB', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              maxHeight: 240, overflow: 'auto',
            }}
          >
            {filteredOptions.map((item) => {
              const isHistory = history.includes(item);
              return (
                <div
                  key={item}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '6px 12px',
                    fontSize: 13, color: '#1F2937',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                    style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}
                  >
                    {item}
                  </span>
                  {isHistory && (
                    <span
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        hideFieldSuggestion('caseNo', item);
                        hideFieldSuggestion('caseName', item);
                        setRefreshKey((k) => k + 1);
                      }}
                      style={{
                        cursor: 'pointer', padding: '2px 6px', marginLeft: 4,
                        fontSize: 14, lineHeight: 1, color: '#D1D5DB',
                        borderRadius: 3, userSelect: 'none', flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEE2E2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; e.currentTarget.style.background = 'transparent'; }}
                    >×</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Form.Item>
  );
}
/* ===================== 设备品牌字段（联动设备类型） ===================== */

const HARDDRIVE_BRANDS = ['三星', '希捷', '西部数据', '铠侠', '东芝', '金士顿', '致钛', '英睿达', '闪迪', '威刚', '联想'];
const PHONE_BRANDS = ['华为', '苹果', '小米', 'VIVO', 'OPPO', '三星', '荣耀', '中兴', '联想', '魅族', '红米', '一加', '真我', 'iQOO', '摩托罗拉'];

/** 设备品牌字段：根据设备类型动态切换下拉选项 */
export function DeviceBrandField({ field, subName }: { field: FieldDefinition; subName?: number }) {
  const form = Form.useFormInstance();
  const deviceType = Form.useWatch('deviceType', form);
  const [newOption, setNewOption] = useState('');
  const storageKey = 'jingzong.selectOptions.phone.deviceBrand';
  const [customOptions, setCustomOptions] = useState<string[]>(() => {
    try { const stored = localStorageAdapter.getItem<string[]>(storageKey, []); return Array.isArray(stored) ? stored : []; } catch { return []; }
  });

  const brands = deviceType === '硬盘' ? HARDDRIVE_BRANDS : deviceType === '手机' ? PHONE_BRANDS : [];
  const allOptions = Array.from(new Set([...brands, ...customOptions]));

  const saveCustom = (val: string) => {
    const v = val.trim();
    if (!v || allOptions.includes(v)) return;
    setCustomOptions(prev => {
      const next = Array.from(new Set([...prev, v]));
      localStorageAdapter.setItem(storageKey, next);
      return next;
    });
    setNewOption('');
  };

  const rules = field.required ? [{ required: true, message: `请选择${field.label}` }] : undefined;
  const fieldName = subName !== undefined ? [subName, field.id] : field.id;

  return (
    <Form.Item name={fieldName} label={field.label} rules={rules}>
      <Select
        showSearch
        placeholder={deviceType ? `请选择${field.label}` : '请先选择设备类型'}
        disabled={!deviceType}
        options={allOptions.map(o => ({ label: o, value: o }))}
        dropdownRender={(menu) => (
          <>
            {menu}
            <Divider style={{ margin: '8px 0' }} />
            <Space style={{ padding: '0 8px 8px', width: '100%' }}>
              <Input
                value={newOption}
                placeholder={`新增${field.label}`}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button type="primary" onClick={() => saveCustom(newOption)}>添加</Button>
            </Space>
          </>
        )}
      />
    </Form.Item>
  );
}

/* ===================== 全局嫌疑人联动字段 ===================== */

/**
 * 全局嫌疑人姓名字段
 * 展示所有模块中已保存的嫌疑人，选择/填写后自动填充身份证号、手机号、地址
 */
export function GlobalSuspectField({ field, subName, listName }: {
  field: FieldDefinition;
  subName?: number;
  listName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const form = Form.useFormInstance();

  const rules = field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined;
  const fieldName = subName !== undefined ? [subName, field.id] : field.id;
  const fullName = (subName !== undefined && listName)
    ? [listName, subName, field.id]
    : fieldName;

  // 本地 state 管理输入值，避免每次输入都触发 form.setFieldValue 重渲染打断 IME
  const formValue: unknown = Form.useWatch(fullName, form);
  const syncedValue: string = (typeof formValue === 'string' ? formValue : '') || '';
  const [localValue, setLocalValue] = useState(syncedValue);

  // 联动/外部修改时同步到本地
  useEffect(() => {
    setLocalValue(syncedValue);
  }, [syncedValue]);

  /** 填充关联的嫌疑人信息 */
  const fillSuspectRelated = (suspectName: string) => {
    if (!form) return;
    const info = getSuspectInfo(suspectName);
    if (!info) return;

    const thisFieldId = typeof fieldName === 'string' ? fieldName : fieldName[1];
    const isInSuspectsSection = thisFieldId === 'suspectName';

    if (isInSuspectsSection && subName !== undefined && listName) {
      if (info.idNo)   form.setFieldValue([listName, subName, 'suspectIdNo'], info.idNo);
      if (info.phone)  form.setFieldValue([listName, subName, 'suspectPhone'], info.phone);
      if (info.address) form.setFieldValue([listName, subName, 'suspectAddress'], info.address);
    } else {
      const kv: Record<string, string> = {};
      if (info.idNo)   kv.idNo = info.idNo;
      if (info.phone)  kv.phone = info.phone;
      if (Object.keys(kv).length > 0) form.setFieldsValue(kv);
    }
  };

  // 输入时只更新本地 state，不写 form（避免 IME 中断）
  const handleChange = (val: string) => {
    setLocalValue(val);
  };

  // 失焦时同步到 form，并关闭下拉
  const handleBlurSync = () => {
    setTimeout(() => {
      setOpen(false);
      if (!form) return;
      const current = form.getFieldValue(fullName);
      if (String(current || '') !== localValue) {
        form.setFieldValue(fullName, localValue);
      }
      if (localValue.trim()) {
        recordFieldValue('suspect', localValue);
        recordFieldValue('suspectName', localValue);
      }
      fillSuspectRelated(localValue);
    }, 200);
  };

  const handleSelect = (selectedValue: string) => {
    if (form) {
      form.setFieldValue(fullName, selectedValue);
      setLocalValue(selectedValue);
    }
    fillSuspectRelated(selectedValue);
    setOpen(false);
    recordFieldValue('suspect', selectedValue);
    recordFieldValue('suspectName', selectedValue);
    queryRelatedRecords(selectedValue);
  };

  // 关联记录查询状态
  const [relatedRecords, setRelatedRecords] = useState<Array<{ moduleName: string; title: string; date: string }>>([]);

  const queryRelatedRecords = useCallback((suspectName: string) => {
    if (!suspectName || suspectName.trim().length < 2) {
      setRelatedRecords([]);
      return;
    }
    const all = getMassRecords();
    const kw = suspectName.trim().toLowerCase();
    const matches: Array<{ moduleName: string; title: string; date: string }> = [];
    for (const rec of all) {
      const d = rec.data || {};
      // 检查所有字段值是否包含嫌疑人姓名
      const found = Object.values(d).some(v => {
        if (typeof v === 'string') return v.toLowerCase().includes(kw);
        if (Array.isArray(v)) return v.some(item => typeof item === 'object' && item !== null && Object.values(item).some(sv => typeof sv === 'string' && sv.toLowerCase().includes(kw)));
        return false;
      });
      if (found) {
        const modName = MODULE_NAMES[rec.moduleId] || rec.moduleId;
        const title = String(d.caseName || d.suspect || d.title || d.projectName || '').slice(0, 16);
        const date = rec.updatedAt ? new Date(rec.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '';
        matches.push({ moduleName: modName, title, date });
      }
    }
    setRelatedRecords(matches.slice(0, 5)); // 最多显示5条
  }, []);

  // 输入变化时清除关联提示
  const handleChangeLocal = (val: string) => {
    setLocalValue(val);
    if (val.trim().length < 2) setRelatedRecords([]);
  };

  const filteredOptions = useMemo(() => {
    if (!syncedValue) return getAllSuspectNames();
    const q = syncedValue.toUpperCase();
    return getAllSuspectNames().filter((item) => item.toUpperCase().includes(q));
  }, [syncedValue]);

  const history = getFieldHistory('suspect');
  const history2 = getFieldHistory('suspectName');
  const allHistory = [...new Set([...history, ...history2])];

  return (
    <Form.Item name={fieldName} label={field.label} rules={rules}>
      <div style={{ position: 'relative' }}>
        <input
          value={localValue}
          onChange={(e) => handleChangeLocal(e.target.value)}
          onBlur={handleBlurSync}
          onFocus={() => { setOpen(true); setRefreshKey((k) => k + 1); }}
          placeholder="请输入嫌疑人姓名（可匹配历史记录）"
          style={{
            width: '100%', height: 32, padding: '0 11px',
            border: '1px solid #D9D9D9', borderRadius: 6,
            fontSize: 14, color: '#333', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
            transition: 'border-color .2s, box-shadow .2s',
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = '#1677ff';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(22,119,255,0.1)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = '#D9D9D9';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {open && filteredOptions.length > 0 && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
              marginTop: 2, background: '#fff', borderRadius: 6,
              border: '1px solid #E5E7EB', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              maxHeight: 240, overflow: 'auto',
            }}
          >
            {filteredOptions.map((item) => {
              const isHistory = allHistory.includes(item);
              return (
                <div
                  key={item}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '6px 12px',
                    fontSize: 13, color: '#1F2937',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span
                    onMouseDown={() => { handleSelect(item); }}
                    style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}
                  >
                    {item}
                  </span>
                  {isHistory && (
                    <span
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteFieldHistoryEntry('suspect', item);
                        deleteFieldHistoryEntry('suspectName', item);
                        setRefreshKey((k) => k + 1);
                      }}
                      style={{
                        cursor: 'pointer', padding: '2px 6px', marginLeft: 4,
                        fontSize: 14, lineHeight: 1, color: '#D1D5DB',
                        borderRadius: 3, userSelect: 'none', flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEE2E2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; e.currentTarget.style.background = 'transparent'; }}
                    >×</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* 智能关联提示卡片 */}
        {relatedRecords.length > 0 && !open && (
          <div style={{
            marginTop: 6, padding: '8px 10px', borderRadius: 6,
            background: 'linear-gradient(135deg, #EFF6FF, #F0F9FF)',
            border: '1px solid #BFDBFE', fontSize: 12, lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 600, color: '#1D4ED8', marginBottom: 4 }}>
              🔗 发现 {relatedRecords.length} 条关联记录
            </div>
            {relatedRecords.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', padding: '1px 0' }}>
                <span><span style={{ fontWeight: 500 }}>{r.moduleName}</span>{r.title ? ` · ${r.title}` : ''}</span>
                <span style={{ color: '#94A3B8', flexShrink: 0 }}>{r.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Form.Item>
  );
}

/* ===================== 持有人自动补全（引用嫌疑人数据池） ===================== */

/**
 * 持有人姓名字段
 * 数据源包含所有已保存的嫌疑人姓名，方便选取，但不联动填充其他字段
 */
export function HolderAutoComplete({ field, subName }: {
  field: FieldDefinition;
  subName?: number;
}) {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const form = Form.useFormInstance();

  const rules = field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined;
  const fieldName = subName !== undefined ? [subName, field.id] : field.id;
  const key = typeof fieldName === 'string' ? fieldName : fieldName[1];

  // 本地 state 管理输入值
  const formValue: unknown = Form.useWatch(key, form);
  const syncedValue: string = (typeof formValue === 'string' ? formValue : '') || '';
  const [localValue, setLocalValue] = useState(syncedValue);
  useEffect(() => { setLocalValue(syncedValue); }, [syncedValue]);

  const allOptions = useMemo(() => {
    void refreshKey;
    return getAllSuspectNames();
  }, [refreshKey]);

  const filteredOptions = useMemo(() => {
    if (!syncedValue) return allOptions;
    const q = syncedValue.toUpperCase();
    return allOptions.filter((item) => item.toUpperCase().includes(q));
  }, [allOptions, syncedValue]);

  const history = getFieldHistory('holder');

  const handleChange = (val: string) => {
    setLocalValue(val);
  };

  const handleBlurSync = () => {
    setTimeout(() => {
      setOpen(false);
      if (!form) return;
      const current = form.getFieldValue(key);
      if (String(current || '') !== localValue) {
        form.setFieldsValue({ [key]: localValue });
      }
      if (localValue.trim()) {
        recordFieldValue('holder', localValue);
      }
    }, 200);
  };

  const handleSelect = (selectedValue: string) => {
    form.setFieldsValue({ [key]: selectedValue });
    setLocalValue(selectedValue);
    setOpen(false);
    recordFieldValue('holder', selectedValue);
  };

  return (
    <Form.Item name={fieldName} label={field.label} rules={rules}>
      <div style={{ position: 'relative' }}>
        <input
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setOpen(true); setRefreshKey((k) => k + 1); }}
          onBlur={handleBlurSync}
          placeholder="请输入持有人姓名（可匹配嫌疑人）"
          style={{
            width: '100%', height: 32, padding: '0 11px',
            border: '1px solid #D9D9D9', borderRadius: 6,
            fontSize: 14, color: '#333', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
            transition: 'border-color .2s, box-shadow .2s',
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = '#1677ff';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(22,119,255,0.1)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = '#D9D9D9';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        {open && filteredOptions.length > 0 && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
              marginTop: 2, background: '#fff', borderRadius: 6,
              border: '1px solid #E5E7EB', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              maxHeight: 240, overflow: 'auto',
            }}
          >
            {filteredOptions.map((item) => {
              const isHistory = history.includes(item);
              return (
                <div
                  key={item}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '6px 12px',
                    fontSize: 13, color: '#1F2937',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span
                    onMouseDown={() => { handleSelect(item); }}
                    style={{ flex: 1, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '2px 0' }}
                  >
                    {item}
                  </span>
                  {isHistory && (
                    <span
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteFieldHistoryEntry('holder', item);
                        setRefreshKey((k) => k + 1);
                      }}
                      style={{
                        cursor: 'pointer', padding: '2px 6px', marginLeft: 4,
                        fontSize: 14, lineHeight: 1, color: '#D1D5DB',
                        borderRadius: 3, userSelect: 'none', flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEE2E2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; e.currentTarget.style.background = 'transparent'; }}
                    >×</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Form.Item>
  );
}

