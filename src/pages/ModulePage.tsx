import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, DatePicker, Descriptions, Dropdown, Empty, Input, Modal, Select, Space, Table, Tabs, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Download, Eye, FileText, Pen, Plus, Search, Trash2, Upload, Filter, LayoutGrid, List } from 'lucide-react';
import { useAppStore } from "../store/appStore"
import { findModule, filterVisibleFields, type FieldDefinition } from '../moduleConfig';
import { useCustomModules } from '../customModules';
import { deleteMassRecord, deleteMassRecords, getMassRecords } from '../store/massStore';
import { getAttachment, downloadAttachment } from '../store/attachmentStore';
import type { MassRecord } from '../store/massStore';
import { exportModuleToExcel, exportSelectedRecords, importExcelToModule } from '../utils/excelUtils';
import { exportModuleReport } from '../utils/reportGenerator';
import { generateFundReport } from '../utils/reportUtils';
import CaseDetail from './CaseDetail';

type FieldValue = string | number | boolean | null | undefined | string[] | Record<string, unknown>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败';
}

/** 判断模块是否有 repeatable section */

/** 获取第一个 repeatable section 的字段列表 */
function getRepeatableSectionFields(fields: FieldDefinition[]): FieldDefinition[] {
  // 遍历找第一个 repeatable section 之后直到下一个 section 的字段
  const result: FieldDefinition[] = [];
  let inSection = false;
  for (const f of fields) {
    if (f.type === 'section' && f.repeatable) { inSection = true; continue; }
    if (f.type === 'section' && !f.repeatable && inSection) break;
    if (inSection && f.type !== 'section' && f.type !== 'attachment') result.push(f);
  }
  return result;
}

/** 取字段定义中前 N 个数据字段（跳过 section / attachment） */
function getDataFields(fields: FieldDefinition[], n = 6): FieldDefinition[] {
  const dataFields = fields.filter((f) => f.type !== 'section' && f.type !== 'attachment');
  // 如果是 repeatable section 模块，从 section 内的字段取
  if (dataFields.length === 0) {
    const sectionFields = getRepeatableSectionFields(fields);
    return sectionFields.slice(0, n);
  }
  return dataFields.slice(0, n);
}

/** 从记录中获取值，支持 repeatable section 嵌套取值 */
function getFieldValue(rec: MassRecord, fieldId: string, fields: FieldDefinition[]): FieldValue {
  const val = rec.data?.[fieldId];
  if (val !== undefined && val !== null) return val as FieldValue;

  // 尝试从 repeatable section 数组中取值
  for (const f of fields) {
    if (f.type === 'section' && f.repeatable) {
      const listName = f.listName || 'items';
      const arr = rec.data?.[listName];
      if (Array.isArray(arr) && arr.length > 0) {
        const itemVal = arr[0][fieldId];
        if (itemVal !== undefined && itemVal !== null) return itemVal;
      }
    }
  }
  return undefined;
}

/** 格式化显示值：如果是ISO日期字符串则格式化为 YYYY-MM-DD */
function displayValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (Array.isArray(val)) return val.join('、');
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 30);
  // 检测 ISO 日期字符串 (如 2026-05-23T10:29:07.100Z) 并格式化
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
    const d = new Date(val); const pad = (n: number) => String(n).padStart(2,'0'); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());
  }
  return String(val);
}

/** 时间戳截取到分钟：2026-05-23 09:41 */
function fmtTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

export default function ModulePage() {
  const currentPage = useAppStore((s) => s.currentPage);
  const openModal = useAppStore((s) => s.openModal);
  const showToast = useAppStore((s) => s.showToast);
  const modalId = useAppStore((s) => s.modalId);
  const editRecord = useAppStore((s) => s.editRecord);
  const setEditRecord = useAppStore((s) => s.setEditRecord);
  const setCurrentTabId = useAppStore((s) => s.setCurrentTabId);
  const userRole = useAppStore((s) => s.userRole);
  const { allModules } = useCustomModules();
  const module = useMemo(() => findModule(currentPage, allModules), [allModules, currentPage]);
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 详情弹窗
  const [viewRecord, setViewRecord] = useState<MassRecord | null>(null);
  // 案件360°全屏视图
  const [caseDetail, setCaseDetail] = useState<MassRecord | null>(null);
  // 多选
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [reporting, setReporting] = useState(false);

  // ─── 筛选状态 ───
  const [filterText, setFilterText] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterHandler, setFilterHandler] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  const activeTab = module
    ? activeTabs[module.id] && module.tabs.some((tab) => tab.id === activeTabs[module.id])
      ? activeTabs[module.id]
      : module.tabs[0]?.id || ''
    : '';

  // 从 localStorage 读取真实数据
  const [refreshKey, setRefreshKey] = useState(0);
  const realRecords = useMemo(() => {
    if (!module) return [];
    void refreshKey;
    return getMassRecords(module.id);
  }, [module, refreshKey]);

  // 编辑/新建保存后刷新列表
  const prevEditRef = useRef(editRecord);
  useEffect(() => {
    // editRecord 从有值变为 null → 编辑完成，刷新
    if (prevEditRef.current && !editRecord) {
      setRefreshKey(k => k + 1);
    }
    prevEditRef.current = editRecord;
  }, [editRecord]);

  // 新建弹窗关闭后（无 editRecord）也刷新
  const prevModalRef = useRef(modalId);
  useEffect(() => {
    if (prevModalRef.current === 'newRecord' && modalId === null) {
      setRefreshKey(k => k + 1);
    }
    prevModalRef.current = modalId;
  }, [modalId]);

  if (!module) {
    return (
      <div className="panel" style={{ minHeight: 420, display: 'grid', placeItems: 'center' }}>
        <Empty description="当前模块不存在或已被删除" />
      </div>
    );
  }

  const active = module.tabs.find((tab) => tab.id === activeTab) || module.tabs[0];
  const activeRecords = realRecords.filter((r) => r.tabId === activeTab).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  // ─── 筛选逻辑 ────────────────────────────────
  const filteredRecords = useMemo(() => {
    let list = activeRecords;
    if (filterText.trim()) {
      const kw = filterText.trim().toLowerCase();
      list = list.filter((r) =>
        Object.values(r.data || {}).some((v) =>
          v != null && String(v).toLowerCase().includes(kw)
        )
      );
    }
    if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
      const start = filterDateRange[0].valueOf();
      const end = filterDateRange[1].valueOf();
      list = list.filter((r) => {
        const t = new Date(r.createdAt).getTime();
        return t >= start && t <= end;
      });
    }
    if (filterStatus) {
      list = list.filter((r) => {
        const s = r.data?.status;
        if (filterStatus === '办理中') return s !== '已完成' && s !== '待补充';
        return s === filterStatus;
      });
    }
    if (filterHandler) {
      list = list.filter((r) => {
        const h = String(r.data?.handler || r.data?.handlerName || '');
        return h === filterHandler;
      });
    }
    return list;
  }, [activeRecords, filterText, filterDateRange, filterStatus, filterHandler]);

  // ─── 动态生成列 ──────────────────────────────
  const fields = active?.fields || [];
  const visibleFields = useMemo(() => filterVisibleFields(fields, userRole), [fields, userRole]);
  const dataFields = getDataFields(visibleFields, 6);

  interface DynamicRow {
    key: string;
    code: string;
    [fieldId: string]: unknown;
    _handler: string;
    _status: string;
    _updatedAt: string;
    _record: MassRecord;
  }

  const rows: DynamicRow[] = filteredRecords.map((rec, index) => {
    const row: DynamicRow = {
      key: rec.id,
      code: String(index + 1).padStart(4, '0'),
      _handler: String(rec.data?.handler || rec.data?.handlerName || '—'),
      _status: rec.data?.status === '已完成' ? '已完成' : rec.data?.status === '待补充' ? '待补充' : '办理中',
      _updatedAt: fmtTime(rec.updatedAt),
      _record: rec,
    };
    for (const f of dataFields) {
      row[f.id] = displayValue(getFieldValue(rec, f.id, fields));
    }
    return row;
  });

  const dynamicColumns: ColumnsType<DynamicRow> = [
    { title: '编号', dataIndex: 'code', width: 60, fixed: 'left' as const, sorter: (a: DynamicRow, b: DynamicRow) => Number(a.code) - Number(b.code) },
    ...dataFields.map((f) => ({
      title: f.label,
      dataIndex: f.id,
      width: 120,
      ellipsis: true,
      sorter: (a: DynamicRow, b: DynamicRow) => {
        const va = a[f.id];
        const vb = b[f.id];
        if (va == null && vb == null) return 0;
        if (va == null) return -1;
        if (vb == null) return 1;
        if (f.type === 'number') return Number(va) - Number(vb);
        return String(va).localeCompare(String(vb));
      },
      defaultSortOrder: f.type === 'date' ? ('descend' as const) : undefined,
    })),
    // 除大队办公室（office）外，涉众办、法制室、案件中队、调证分析不显示经办人列
    ...(module.departmentId === 'office'
      ? [{ title: '经办人' as const, dataIndex: '_handler' as const, width: 80, ellipsis: true,
          sorter: (a: DynamicRow, b: DynamicRow) => a._handler.localeCompare(b._handler) }]
      : []),
    { title: '更新时间', dataIndex: '_updatedAt', width: 130, sorter: (a: DynamicRow, b: DynamicRow) => a._updatedAt.localeCompare(b._updatedAt), defaultSortOrder: 'descend' as const },
    {
      title: '操作',
      dataIndex: '_action',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, record: DynamicRow) => (
        <Space size={4}>
          <Button
            type="link" size="small"
            icon={<Eye size={13} />}
            onClick={() => setCaseDetail(record._record)}
          >
            查看
          </Button>
          <Button
            type="link" size="small"
            icon={<Pen size={13} />}
            onClick={() => {
              setEditRecord(record._record);
              openModal('newRecord');
            }}
          >
            编辑
          </Button>
          <Button
            type="link" size="small"
            danger
            icon={<Trash2 size={13} />}
            onClick={() => handleDeleteSingle(record._record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // ─── 导入处理 ─────────────────────────────────
  const handleImport = async (file: File) => {
    try {
      const result = await importExcelToModule(file, module.id, activeTab);
      if (result.success > 0) {
        showToast(`成功导入 ${result.success} 条记录${result.failed > 0 ? `，${result.failed} 条失败` : ''}`, result.failed > 0 ? 'warning' : 'success');
        setRefreshKey(k => k + 1);
      } else {
        showToast(result.errors[0] || '导入失败', 'error');
      }
      } catch (err) {
        showToast(`导入出错: ${getErrorMessage(err)}`, 'error');
    }
  };

  // ─── 删除处理 ─────────────────────────────────
  const handleDeleteSingle = (record: MassRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除该记录吗？删除后不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        deleteMassRecord(record.id);
        setRefreshKey(k => k + 1);
        showToast('记录已删除', 'success');
      },
    });
  };

  const handleBatchDelete = () => {
    const ids = selectedRowKeys as string[];
    if (ids.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${ids.length} 条记录吗？删除后不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        deleteMassRecords(ids);
        setSelectedRowKeys([]);
        setRefreshKey(k => k + 1);
        showToast(`已删除 ${ids.length} 条记录`, 'success');
      },
    });
  };

  const handleExportSelected = () => {
    const ids = selectedRowKeys as string[];
    if (ids.length === 0) {
      showToast('请先勾选要导出的记录', 'warning');
      return;
    }
    exportSelectedRecords(ids, module.id, activeTab);
    showToast(`正在导出 ${ids.length} 条记录...`, 'info');
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 8, background: 'linear-gradient(135deg, #0F3A5F, #155A8A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(15,58,95,.24)' }}>
            <FileText size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#172033' }}>{module.label}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{module.departmentLabel} · {module.description}</div>
          </div>
        </div>
        <Space>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = '';
            }}
          />
          <Button icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()}>导入</Button>
          <Button
            icon={<Download size={14} />}
            onClick={() => {
              exportModuleToExcel(module.id, activeTab);
              showToast('正在生成 Excel...', 'info');
            }}
          >导出</Button>
        </Space>
      </motion.div>

      {/* 新建提示条 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          background: 'var(--color-primary-bg)',
          border: '1px solid var(--color-primary-border)',
          borderLeft: '4px solid var(--color-primary)',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 6px 18px rgba(21,90,138,.08)',
        }}
      >
        <Button
          type="primary"
          size="large"
          icon={<Plus size={16} />}
          onClick={() => {
            if (module && activeTab) setCurrentTabId(activeTab);
            openModal('newRecord');
          }}
          style={{ height: 42, paddingInline: 22, boxShadow: '0 8px 20px rgba(21,90,138,.25)', flexShrink: 0 }}
        >
          新建{active?.label || module.label}
        </Button>
          {module.id === 'evidence-report' ? (
            <Button
              type="primary"
              icon={<FileText size={16} />}
              onClick={() => {
                try {
                  generateFundReport();
                  showToast('正在生成资金分析报告...', 'info');
                } catch (err) {
                  showToast(getErrorMessage(err), 'error');
                }
              }}
              style={{ height: 42, paddingInline: 18, background: '#7C3AED', borderColor: '#7C3AED', flexShrink: 0 }}
            >
              资金分析报告
            </Button>
          ) : (
            <Dropdown
              menu={{
                items: [
                  { key: 'daily', icon: <FileText size={13} />, label: '生成日报' },
                  { key: 'weekly', icon: <FileText size={13} />, label: '生成周报' },
                  { key: 'monthly', icon: <FileText size={13} />, label: '生成月报' },
                ],
                onClick: ({ key }) => {
                  if (!module) return;
                  setReporting(true);
                  try {
                    exportModuleReport(module, key as 'daily' | 'weekly' | 'monthly');
                    showToast('正在导出' + module.label + '的' + (key === 'daily' ? '日报' : key === 'weekly' ? '周报' : '月报'));
                   } catch (err) {
                     showToast(getErrorMessage(err), 'error');
                  } finally {
                    setReporting(false);
                  }
                },
              }}
              placement="bottomLeft"
            >
              <Button
                type="primary"
                icon={<FileText size={16} />}
                loading={reporting}
                style={{ height: 42, paddingInline: 18, background: '#0F766E', borderColor: '#0F766E', flexShrink: 0 }}
              >
                生成报告
              </Button>
            </Dropdown>
          )}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#123852' }}>当前可新建：{active?.label || module.label}</div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>点击左侧按钮进入登记窗口，系统会自动带出当前类目的字段模板。</div>
        </div>
      </motion.div>

      {/* 统计卡片 */}
      {(() => {
        const total = realRecords.length;
        const thisMonth = realRecords.filter((r) => r.createdAt && (()=>{const d=new Date();const pad=(n:number)=>String(n).padStart(2,"0");return d.getFullYear()+"-"+pad(d.getMonth()+1);})() === (()=>{const d=new Date(r.createdAt);const pad=(n:number)=>String(n).padStart(2,"0");return d.getFullYear()+"-"+pad(d.getMonth()+1);})()).length;
        const ongoing = realRecords.filter((r) => r.data?.status !== '已完成' && r.data?.status !== '待补充').length;
        const pending = realRecords.filter((r) => r.data?.status === '待补充').length;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              ['全部记录', String(total), '#155A8A'],
              ['本月新增', String(thisMonth), '#0F766E'],
              ['办理中', String(ongoing), '#D97706'],
              ['待补充', String(pending), '#DC2626'],
            ].map(([label, value, color]) => (
              <div key={label} className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* 筛选栏 */}
      <div className="panel" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Filter size={15} color="#64748B" style={{ flexShrink: 0 }} />
        <Input
          allowClear
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="关键词搜索..."
          prefix={<Search size={14} color="#94A3B8" />}
          style={{ width: 220, height: 34 }}
        />
        <DatePicker.RangePicker
          value={filterDateRange as any}
          onChange={(dates) => setFilterDateRange(dates as any)}
          placeholder={['开始日期', '结束日期']}
          style={{ width: 250, height: 34 }}
        />
        <Select
          value={filterStatus}
          onChange={(v) => setFilterStatus(v)}
          allowClear
          placeholder="状态筛选"
          style={{ width: 130, height: 34 }}
          options={[
            { label: '办理中', value: '办理中' },
            { label: '待补充', value: '待补充' },
            { label: '已完成', value: '已完成' },
          ]}
        />
        {(() => {
          const handlers = Array.from(new Set(
            activeRecords
              .map((r) => String(r.data?.handler || r.data?.handlerName || '').trim())
              .filter(Boolean)
          )).sort();
          return handlers.length > 0 ? (
            <Select
              value={filterHandler}
              onChange={(v) => setFilterHandler(v)}
              allowClear
              placeholder="经办人筛选"
              style={{ width: 130, height: 34 }}
              options={handlers.map((h) => ({ label: h, value: h }))}
            />
          ) : null;
        })()}
        {(filterText || filterDateRange || filterStatus || filterHandler) && (
          <Button size="small" onClick={() => { setFilterText(''); setFilterDateRange(null); setFilterStatus(null); setFilterHandler(null); }}>
            清除筛选
          </Button>
        )}
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        {module.tabs.length > 1 && (
          <div style={{ padding: '14px 16px 0', background: 'var(--color-surface-hover)', borderBottom: '1px solid var(--color-border-light)' }}>
            <style>{`
              .work-template-tabs .ant-tabs-nav { margin: 0; }
              .work-template-tabs .ant-tabs-tab {
                border-radius: 7px 7px 0 0 !important;
                background: var(--color-surface-hover) !important;
                border-color: var(--color-border) !important;
                padding: 8px 16px !important;
                font-weight: 700;
                color: var(--color-text-secondary) !important;
              }
              .work-template-tabs .ant-tabs-tab-active {
                background: var(--color-primary-bg) !important;
                border-color: var(--color-primary) !important;
                box-shadow: 0 -2px 10px rgba(21,90,138,.16);
              }
              .work-template-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: var(--color-primary) !important; }
              .dark .work-template-tabs .ant-tabs-tab { color: var(--color-text-secondary) !important; }
              .dark .work-template-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: var(--color-primary) !important; }
            `}</style>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, marginBottom: 8 }}>请选择记录类型</div>
            <Tabs
              className="work-template-tabs"
              type="card"
              activeKey={active?.id}
               onChange={(tabId) => {
                 setActiveTabs((prev) => (module ? { ...prev, [module.id]: tabId } : prev));
                 if (module) setCurrentTabId(tabId);
               }}
              items={module.tabs.map((tab) => ({ key: tab.id, label: tab.label }))}
            />
          </div>
        )}
        <div style={{ padding: 16, borderTop: '1px solid #EDF2F7' }}>
          {/* 视图切换 + 字段数 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  height: 32, paddingInline: 14, borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: 'none', fontFamily: 'inherit',
                  background: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  color: viewMode === 'table' ? '#fff' : 'var(--color-text-secondary)',
                  boxShadow: viewMode === 'table' ? '0 2px 8px rgba(21,90,138,0.25)' : 'none',
                  transition: 'all 0.2s var(--ease-out)',
                }}
              >
                <List size={14} /> 表格
              </button>
              <button
                onClick={() => setViewMode('card')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  height: 32, paddingInline: 14, borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: 'none', fontFamily: 'inherit',
                  background: viewMode === 'card' ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  color: viewMode === 'card' ? '#fff' : 'var(--color-text-secondary)',
                  boxShadow: viewMode === 'card' ? '0 2px 8px rgba(21,90,138,0.25)' : 'none',
                  transition: 'all 0.2s var(--ease-out)',
                }}
              >
                <LayoutGrid size={14} /> 卡片
              </button>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                共 {rows.length} 条
              </span>
            </div>
            <Tag color="blue">{dataFields.length} 个字段</Tag>
          </div>
          {/* 批量操作栏 */}
          {selectedRowKeys.length > 0 && (
            <div style={{
              background: '#F0F7FF', border: '1px solid #B9D4E6', borderRadius: 8,
              padding: '8px 16px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 13, color: '#155A8A', fontWeight: 600 }}>
                已选 {selectedRowKeys.length} 项
              </span>
              <Button size="small" icon={<Trash2 size={13} />} danger onClick={handleBatchDelete}>
                批量删除
              </Button>
              <Button size="small" icon={<Download size={13} />} onClick={handleExportSelected}>
                导出选中
              </Button>
              <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>
                取消选择
              </Button>
            </div>
          )}
          {/* 空状态引导 */}
          {rows.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>暂无数据</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
                点击上方「新建{active?.label || module.label}」开始录入
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (module && activeTab) setCurrentTabId(activeTab);
                  openModal('newRecord');
                }}
                style={{ height: 40, paddingInline: 20 }}
              >
                <Plus size={15} /> 立即新建
              </button>
            </div>
          ) : viewMode === 'card' ? (
            /* 卡片视图 */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {rows.map((row) => (
                <motion.div
                  key={row.key}
                  className="card hover-lift"
                  style={{ padding: 16, cursor: 'pointer' }}
                  onClick={() => setCaseDetail(row._record)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', flex: 1, minWidth: 0 }} className="truncate">
                      {dataFields.slice(0, 2).map(f => row[f.id]).filter(Boolean).join(' · ') || `#${row.code}`}
                    </div>
                    <span className={`badge ${row._status === '已完成' ? 'badge-success' : row._status === '待补充' ? 'badge-warning' : 'badge-info'}`}>
                      {row._status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                    {dataFields.slice(0, 4).map(f => (
                      <div key={f.id} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                        <span className="text-muted flex-shrink-0" style={{ width: 60 }}>{f.label}</span>
                        <span className="truncate" style={{ color: 'var(--color-text)' }}>{row[f.id] || '—'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border-light)', paddingTop: 8 }}>
                    <span className="text-sm text-muted">{row._updatedAt}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setCaseDetail(row._record); }}>查看</button>
                      <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setEditRecord(row._record); openModal('newRecord'); }}>编辑</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            /* 表格视图 */
            <Table<DynamicRow>
              size="middle"
              columns={dynamicColumns}
              dataSource={rows}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
            />
          )}
        </div>
      </div>

      {/* 查看/编辑详情弹窗 */}
      <Modal
        title="记录详情"
        open={!!viewRecord}
        onCancel={() => setViewRecord(null)}
        footer={
          <Space>
            <Button onClick={() => setViewRecord(null)}>关闭</Button>
            {viewRecord && (
              <Button type="primary" onClick={() => {
                setEditRecord(viewRecord);
                setViewRecord(null);
                openModal('newRecord');
              }}>
                编辑
              </Button>
            )}
          </Space>
        }
        width={700}
        destroyOnClose
      >
        {viewRecord && (
          <>
            <Descriptions column={2} size="small" bordered style={{ marginTop: 16 }}>
              {fields.filter((f) => f.type !== 'section' && f.type !== 'attachment').map((f) => {
                let val = viewRecord.data?.[f.id];
                return (
                  <Descriptions.Item key={f.id} label={f.label} span={f.type === 'textarea' ? 2 : 1}>
                    {displayValue(val)}
                  </Descriptions.Item>
                );
              })}
              {/* 附件字段 */}
              {fields.filter((f) => f.type === 'attachment').map((f) => {
                const fileData = viewRecord.data?.[f.id];
                const fileList = Array.isArray(fileData)
                  ? fileData
                  : (fileData?.fileList as any[]) || [];
                const fileRefs: { uid: string; name: string }[] = fileList
                  .map((fl: any) => ({ uid: fl.uid || fl.id, name: fl.name || fl.fileName }))
                  .filter((x: any) => x.uid && x.name);
                return fileRefs.length > 0 ? (
                  <Descriptions.Item key={f.id} label={f.label} span={2}>
                    {fileRefs.map((ref: { uid: string; name: string }) => (
                      <div key={ref.uid} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#155A8A', marginBottom: 4 }}>
                        <span>📎 {ref.name}</span>
                        <span onClick={async () => {
                          try { await downloadAttachment(ref.uid); }
                          catch (err) {
                            const msg = err instanceof Error ? err.message : '未知错误';
                            showToast('下载失败: ' + msg, 'error');
                          }
                        }} style={{ cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}>下载</span>
                      </div>
                    ))}
                  </Descriptions.Item>
                ) : null;
              })}
              <Descriptions.Item label="创建时间">{fmtTime(viewRecord.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{fmtTime(viewRecord.updatedAt)}</Descriptions.Item>
            </Descriptions>
            {/* 重复 section 数据：每个条目一张独立卡片 */}
            {fields.filter((sf) => sf.type === 'section' && sf.repeatable && sf.listName).map((sf) => {
              const listData: Record<string, unknown>[] = (viewRecord.data?.[sf.listName!] as Record<string, unknown>[]) || [];
              if (listData.length === 0) return null;
              const sectionFields = fields.filter((f) => f.id !== sf.id && fields.indexOf(sf) < fields.indexOf(f) && (fields.indexOf(f) < fields.findIndex((x) => x.type === 'section' && x.id !== sf.id) || -1 === -1));
              // 获取属于这个 section 的字段：介于当前 section 和下一个 section 之间
              const allSecIdx = fields.reduce((acc: number[], f, i) => { if (f.type === 'section') acc.push(i); return acc; }, []);
              const secPos = allSecIdx.indexOf(fields.indexOf(sf));
              const startPos = fields.indexOf(sf) + 1;
              const endPos = secPos < allSecIdx.length - 1 ? allSecIdx[secPos + 1] : fields.length;
              const childFields = fields.slice(startPos, endPos).filter((f) => f.type !== 'attachment');
              return (
                <div key={sf.id} style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#155A8A', marginBottom: 10, borderBottom: '2px solid #155A8A', paddingBottom: 4 }}>{sf.label}</div>
                  {listData.map((item, idx) => (
                    <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: 8, padding: 12, marginBottom: 10, background: '#FAFBFC' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>{sf.label} #{idx + 1}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                        {childFields.map((cf) => (
                          <div key={cf.id} style={{ fontSize: 12, lineHeight: 1.8 }}>
                            <span style={{ color: '#6B7280' }}>{cf.label}：</span>
                            <span style={{ color: '#1F2937' }}>{displayValue(item[cf.id])}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </Modal>

      {/* 案件 360° 全屏视图 */}
      {caseDetail && (
        <CaseDetail record={caseDetail} onClose={() => setCaseDetail(null)} />
      )}
    </div>
  );
}
