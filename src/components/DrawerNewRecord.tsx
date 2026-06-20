import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, DatePicker, Form, Input, InputNumber,
  Modal, Select, Space, Upload,
} from 'antd';
import dayjs from 'dayjs';
import { InboxOutlined, PlusOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';

import { useUnsavedChanges } from '../utils/useUnsavedChanges';
import { useAppStore } from '../store/appStore';
import { findModule, filterVisibleFields, type FieldDefinition } from '../moduleConfig';
import { useCustomModules } from '../customModules';
import { saveMassRecord, updateMassRecord, getMassRecords } from '../store/massStore';
import ErrorBoundary from './ErrorBoundary';
import { recordFormFields, rebuildCaseIndex, rebuildSuspectIndex, getFieldHistory } from '../store/inputHistoryStore';
import {
  GlobalCaseNameField, GlobalCaseNoField, GlobalSuspectField,
  InputWithHistory,
  MultiPersonField, PersistedSelect, DeviceBrandField, HolderAutoComplete,
  IdNoField,
} from './SharedFormFields';
import { saveAttachment, relinkAttachment, getAttachment } from '../store/attachmentStore';
import { saveDraft, getDraft, deleteDraft } from '../store/draftStore';

interface Props { onClose: () => void; editRecord?: import('../store/massStore').MassRecord | null; }

export default function DrawerNewRecord({ onClose, editRecord }: Props) {
  useUnsavedChanges(true);
  
    const currentPage = useAppStore((s) => s.currentPage);
  const showToast = useAppStore((s) => s.showToast);
  const currentTabId = useAppStore((s) => s.currentTabId);
  const userRole = useAppStore((s) => s.userRole);
  const { allModules } = useCustomModules();
  const currentModule = useMemo(() => findModule(currentPage, allModules), [allModules, currentPage]);
  const [selectedModuleId, setSelectedModuleId] = useState(
    editRecord?.moduleId || currentModule?.id || allModules[0]?.id || ''
  );
  const [selectedTabId, setSelectedTabId] = useState(() => {
    // 优先使用编辑记录中的 tabId，其次用 store 记录的当前标签，最后才落到第一个 tab
    if (editRecord?.tabId) return editRecord.tabId;
    // 检查 currentTabId 是否属于当前模块
    if (currentTabId && currentModule?.tabs.some((t) => t.id === currentTabId)) return currentTabId;
    return currentModule?.tabs[0]?.id || allModules[0]?.tabs[0]?.id || '';
  });
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  // 组件挂载跟踪，防止卸载后 setState
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const safeSetSaving = (v: boolean) => { if (mountedRef.current) setSaving(v); };
  const safeSetDirty = (v: boolean) => { if (mountedRef.current) setIsDirty(v); };

  const selectedModule = findModule(selectedModuleId, allModules) || allModules[0];
  const selectedTab = selectedModule?.tabs.find((tab) => tab.id === selectedTabId) || selectedModule?.tabs[0];
  const allFields = useMemo(() => filterVisibleFields(selectedTab?.fields ?? [], userRole), [selectedTab, userRole]);

  // Build steps from section fields
  const steps = useMemo(() => {
    const sections: { label: string; fields: FieldDefinition[]; repeatable?: boolean; listName?: string }[] = [];
    let buffer: FieldDefinition[] = [];
    let label = '基本信息';
    let repeatable = false;
    let listName: string | undefined;
    for (const f of allFields) {
      if (f.type === 'section') {
        if (buffer.length > 0) sections.push({ label, fields: buffer, repeatable, listName });
        label = f.label;
        repeatable = f.repeatable ?? false;
        listName = f.listName;
        buffer = [];
      } else {
        buffer.push(f);
      }
    }
    if (buffer.length > 0) sections.push({ label, fields: buffer, repeatable, listName });
    return sections;
  }, [allFields]);

  // flatMode：基本信息 + 一个 repeatable section 不分步，内容同时渲染在同一页
  // 排除中队案件管理（squad-case），它需要明确的步骤1/步骤2分隔
  const isSquadCase = currentPage === 'squad-case';
  const flatMode = steps.length === 2 && steps[1].repeatable && !isSquadCase;
  const hasSections = flatMode ? false : steps.length > 1;
  const totalSteps = steps.length;
  const currentStepMeta = steps[currentStep];
  const stepFields = currentStepMeta?.fields || [];
  const stepRepeatable = currentStepMeta?.repeatable ?? false;
  const stepListName = currentStepMeta?.listName || 'items';

  const handleClose = () => {
    if (isDirty) {
      Modal.confirm({
        title: '信息未保存',
        content: '您填写的记录信息尚未保存，确定要退出吗？',
        okText: '确定退出',
        cancelText: '继续填写',
        onOk: () => { safeSetDirty(false); onClose(); },
      });
    } else {
      onClose();
    }
  };

  // 收集待关联的附件 ID（beforeUpload 中存入，handleSubmit 后关联到真实记录）
  const pendingAttachments = useRef<Set<string>>(new Set());

  const handleModuleChange = (value: string) => {
    const nextModule = findModule(value, allModules);
    setSelectedModuleId(value);
    setSelectedTabId(nextModule?.tabs[0]?.id || '');
    form.resetFields();
    safeSetDirty(false);
    setCurrentStep(0);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 序列化 dayjs 对象为 ISO 字符串，避免传入 IndexedDB 后触发 antd clone 崩溃
      for (const key of Object.keys(values)) {
        const v = values[key];
        if (v && typeof v === 'object' && v.$L !== undefined && v.$d !== undefined) {
          values[key] = (typeof v.isValid === 'function' && v.isValid()) ? v.toISOString() : String(v.$d);
        }
        // 处理 repeatable section 中的 dayjs 对象
        if (Array.isArray(v)) {
          v.forEach((item: any) => {
            if (item && typeof item === 'object') {
              for (const k of Object.keys(item)) {
                const val = item[k];
                if (val && typeof val === 'object' && val.$L !== undefined && val.$d !== undefined) {
                  item[k] = (typeof val.isValid === 'function' && val.isValid()) ? val.toISOString() : String(val.$d);
                }
              }
            }
          });
        }
      }

      // 清理附件字段：删除 originFileObj
      for (const key of Object.keys(values)) {
        if (Array.isArray(values[key]) && values[key].length > 0 && values[key][0]?.originFileObj) {
          values[key] = (values[key] as Record<string, unknown>[]).map((f) => {
            const { originFileObj, ...rest } = f;
            return rest;
          });
        }
      }

      setSaving(true);
      try {
        // ─── 记录输入历史 ────────────────────
        const allFieldIds = allFields.filter((f) => f.type !== 'section' && f.type !== 'attachment').map((f) => f.id);
        recordFormFields(allFieldIds, values);

        if (isEditing && editRecord) {
          updateMassRecord(editRecord.id, values);
          for (const attId of pendingAttachments.current) {
            relinkAttachment(attId, editRecord.id).catch(() => {});
          }
          pendingAttachments.current.clear();
          setTimeout(() => {
            safeSetSaving(false);
            safeSetDirty(false);
            deleteDraft(selectedModuleId, selectedTabId);
            showToast(`${selectedModule?.label} · ${selectedTab?.label || '记录'} 已更新`, 'success');
            // 重建案件索引
            rebuildCaseIndex(getMassRecords());
            rebuildSuspectIndex(getMassRecords());
            onClose();
          }, 300);
        } else {
          const newRecord = saveMassRecord(selectedModuleId, selectedTabId, values);
          for (const attId of pendingAttachments.current) {
            relinkAttachment(attId, newRecord.id).catch(() => {});
          }
          pendingAttachments.current.clear();
          setTimeout(() => {
            safeSetSaving(false);
            safeSetDirty(false);
            deleteDraft(selectedModuleId, selectedTabId);
            showToast(`${selectedModule?.label} · ${selectedTab?.label || '记录'} 已创建`, 'success');
            // 重建案件索引
            rebuildCaseIndex(getMassRecords());
            rebuildSuspectIndex(getMassRecords());
            onClose();
          }, 300);
        }
      } catch (err) {
        safeSetSaving(false);
        showToast('提交失败: ' + (err instanceof Error ? err.message : '未知错误'), 'error');
      }
    } catch {
      showToast('请补充必填字段', 'warning');
    }
  };

  // Unused variable removed — field visibility filtering not needed for step wizard
  // 编辑模式：预填表单 + 新建模式：自动展开 repeatable section
  const isEditing = !!editRecord;
  useEffect(() => {
    if (allFields.length === 0) return;
    const timer = setTimeout(() => {
      try {
        if (editRecord) {
          // ── 编辑模式：回填表单数据 ──
          const formData: Record<string, unknown> = {};

          // 1. 处理 repeatable section 数据
          for (const f of allFields) {
            if (f.type !== 'section' || !f.repeatable || !f.listName) continue;
            const listData = editRecord.data?.[f.listName];
            if (Array.isArray(listData) && listData.length > 0) {
              const converted = listData.map((item: Record<string, unknown>) => {
                const copy: Record<string, unknown> = { ...item };
                for (const df of allFields) {
                  if (df.type === 'date') {
                    const raw = copy[df.id];
                    if (typeof raw === 'string') {
                      const d = dayjs(raw);
                      if (d.isValid()) copy[df.id] = d;
                    } else if (raw && typeof raw === 'object' && (raw as any).$d) {
                      // dayjs 对象：转为真正 dayjs 实例
                      try {
                        const dateVal = (raw as any).$d instanceof Date ? (raw as any).$d : new Date(String((raw as any).$d));
                        if (!isNaN(dateVal.getTime())) copy[df.id] = dayjs(dateVal);
                      } catch { /* ignore */ }
                    }
                  }
                }
                return copy;
              });
              formData[f.listName] = converted;
            }
          }

          // 2. 处理普通字段
          for (const f of allFields) {
            if (f.type === 'section') continue;
            const raw = editRecord.data?.[f.id];
            if (raw === undefined || raw === null) continue;
            if (f.type === 'attachment') {
              // 附件字段：只保留 uid/name/status，避免 AntD Upload 调用 clone 报错
              const rawArr = Array.isArray(raw) ? raw : [];
              formData[f.id] = rawArr.map((item: any) => ({
                uid: item?.uid || item?.id || String(Math.random()),
                name: item?.name || item?.fileName || '附件',
                status: 'done',
              }));
              continue;
            }
            if (f.type === 'date') {
              // 统一转为 dayjs 对象供 antd DatePicker 使用
              if (typeof raw === 'string') {
                const d = dayjs(raw);
                if (d.isValid()) formData[f.id] = d;
              } else if (raw && typeof raw === 'object') {
                const obj = raw as Record<string, unknown>;
                if (obj.$d !== undefined) {
                  // dayjs 对象：转为 ISO 字符串再转 dayjs，确保是真正的 dayjs 实例
                  try {
                    const dateVal = obj.$d instanceof Date ? obj.$d : new Date(String(obj.$d));
                    if (!isNaN(dateVal.getTime())) {
                      formData[f.id] = dayjs(dateVal);
                    }
                  } catch { /* ignore */ }
                } else if (raw instanceof Date) {
                  formData[f.id] = dayjs(raw);
                }
              }
              continue;
            }
            if (f.multiple && typeof raw === 'string') {
              formData[f.id] = [raw];
              continue;
            }
            formData[f.id] = raw;
          }

          // 过滤：只设置表单识别的字段
          const validFieldIds = new Set(
            allFields.filter(f => f.type !== 'section').map(f => f.id)
          );
          const sectionListNames = new Set(
            allFields.filter(f => f.type === 'section' && f.repeatable && f.listName).map(f => f.listName!)
          );
          const safeData: Record<string, unknown> = {};
          for (const key of Object.keys(formData)) {
            if (validFieldIds.has(key) || sectionListNames.has(key)) {
              safeData[key] = formData[key];
            }
          }
          form.setFieldsValue(safeData);
        } else {
          // ── 新建模式：repeatable section 自动展开第一行 ──
          for (const step of steps) {
            if (step.repeatable && step.listName) {
              const existing = form.getFieldValue(step.listName);
              if (!existing || existing.length === 0) {
                form.setFieldsValue({ [step.listName]: [{}] });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[DrawerNewRecord] init error:', err);
        if (editRecord) showToast('加载记录数据失败', 'warning');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [allFields, editRecord, form, showToast]);

  // 再次展开：切换模块或模板时，新建模式下自动展开 repeatable section
  useEffect(() => {
    if (editRecord) return;
    const timer = setTimeout(() => {
      for (const step of steps) {
        if (step.repeatable && step.listName) {
          const existing = form.getFieldValue(step.listName);
          if (!existing || existing.length === 0) {
            form.setFieldsValue({ [step.listName]: [{}] });
          }
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [selectedModuleId, selectedTabId, editRecord]);

  // 自动保存草稿：表单变化后 2 秒自动保存到 IndexedDB
  const draftTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const changeCountRef = useRef(0);
  useEffect(() => {
    if (isEditing) return;
    const count = changeCountRef.current;
    if (count === 0) return;
    const checkAndSave = () => {
      if (!mountedRef.current) return;
      const values = form.getFieldsValue();
      const hasContent = Object.values(values).some((v) =>
        v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
      );
      if (hasContent) {
        saveDraft(selectedModuleId, selectedTabId, currentStep, values);
      }
    };
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(checkAndSave, 2000);
    return () => clearTimeout(draftTimerRef.current);
  }, [changeCountRef.current, selectedModuleId, selectedTabId, currentStep, isEditing, form]);

  // 恢复草稿提示
  useEffect(() => {
    if (isEditing) return;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      const draft = getDraft(selectedModuleId, selectedTabId);
      if (draft && Object.keys(draft.data).length > 0) {
        Modal.confirm({
          title: '发现未保存的草稿',
          content: `上次在 ${new Date(draft.savedAt).toLocaleString('zh-CN')} 自动保存了草稿，是否恢复？`,
          okText: '恢复草稿',
          cancelText: '新建空白',
          onOk: () => {
            form.setFieldsValue(draft.data);
            if (draft.step > 0 && draft.step < totalSteps) {
              setCurrentStep(draft.step);
            }
            showToast('已恢复草稿', 'success');
          },
          onCancel: () => {
            deleteDraft(selectedModuleId, selectedTabId);
          },
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedModuleId, selectedTabId, isEditing]);

  const showTemplateSelector = Boolean(selectedModule && !selectedModule.hideTemplateSelector && selectedModule.tabs.length > 1);
  const scopedModules = currentModule
    ? allModules.filter((m) => m.departmentId === currentModule.departmentId)
    : allModules;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <ErrorBoundary>
    <Modal
      open
      width={960}
      closable
      maskClosable={false}
      onCancel={handleClose}
      centered
      title={
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          {isEditing ? '编辑工作记录' : '新建工作记录'} · {selectedModule?.label}
        </span>
      }
      styles={{ body: { height: '72vh', overflow: 'auto', padding: 0 } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button onClick={handleClose} style={{ height: 36, paddingInline: 18 }}>取消</Button>
          </Space>
          <Space>
            {!flatMode && !isFirstStep && (
              <Button icon={<LeftOutlined />} onClick={() => setCurrentStep((s) => s - 1)} style={{ height: 36, paddingInline: 18 }}>
                上一步
              </Button>
            )}
            {(flatMode || isLastStep) ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                loading={saving}
                onClick={handleSubmit}
                style={{ height: 36, paddingInline: 20 }}
              >
                创建记录
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<RightOutlined />}
                onClick={() => setCurrentStep((s) => s + 1)}
                style={{ height: 36, paddingInline: 20 }}
              >
                下一步
              </Button>
            )}
          </Space>
        </div>
      }
    >
      {/* ===== Top step indicator ===== */}
      {hasSections && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {steps.map((step, i) => {
            const active = i === currentStep;
            const done = i < currentStep;
            return (
              <div
                key={i}
                onClick={() => setCurrentStep(i)}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  textAlign: 'center', fontSize: 13,
                  background: active ? '#E6F1F8' : done ? '#E8F5E9' : '#F8FAFC',
                  color: active ? '#155A8A' : done ? '#138A63' : '#94A3B8',
                  fontWeight: active ? 700 : 400,
                  border: active ? '1px solid #155A8A' : '1px solid transparent',
                  transition: 'all .15s',
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {done ? '✓ ' : ''}步骤 {i + 1}
                </div>
                <div style={{ marginTop: 2 }}>{step.label}</div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ overflow: 'auto', padding: '0 24px 16px' }}>
        {/* Module/Template selector */}
            <div style={{
              background: '#F6F8FB', border: '1px solid #D8E1EA', borderRadius: 8,
              padding: 14, marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 6 }}>
                {selectedModule?.departmentLabel} · {selectedModule?.label} · {selectedTab?.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#172033', marginBottom: 8 }}>
                {flatMode ? `${steps[0]?.label} · ${steps[1]?.label}` : (hasSections ? steps[currentStep]?.label : '基本信息')}
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <Form.Item label="所属模块" style={{ marginBottom: 0 }}>
                  <Select value={selectedModuleId} onChange={handleModuleChange} showSearch optionFilterProp="label" style={{ width: 280 }}>
                    {scopedModules.map((mod) => (
                      <Select.Option key={mod.id} value={mod.id} label={`${mod.departmentLabel} ${mod.label}`}>
                        {mod.departmentLabel} · {mod.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                {showTemplateSelector && (
                  <Form.Item label="记录模板" style={{ marginBottom: 0 }}>
                    <Select value={selectedTabId} onChange={(value) => { setSelectedTabId(value); form.resetFields(); setCurrentStep(0); }} style={{ width: 220 }}>
                      {selectedModule?.tabs.map((tab) => (
                        <Select.Option key={tab.id} value={tab.id}>{tab.label}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                )}
                {hasSections && !flatMode && (
                  <div style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8', alignSelf: 'flex-end', paddingBottom: 4 }}>
                    {stepFields.length} 个字段 · 第 {currentStep + 1}/{totalSteps} 步
                  </div>
                )}
              </div>
            </div>

            {/* Fields for current step */}
            <Form
              form={form}
              layout="vertical"
              requiredMark="optional"
              onValuesChange={() => { if (mountedRef.current) { setIsDirty(true); changeCountRef.current++; } }}
            >
              {/* 所有步骤字段同时渲染、用 display 切换可见性，保证 antd Form.Item / Form.List 永不卸载 */}
              {steps.map((step, si) => {
                const isVisible = flatMode ? true : (si === currentStep);
                return (
                  <div key={si} style={{ display: isVisible ? '' : 'none' }}>
                    {step.repeatable ? (
                      <Form.List name={step.listName || 'items'}>
                        {(subFields, { add, remove }) => (
                          <>
                            {subFields.length === 0 && (
                              <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />} style={{ height: 40, marginBottom: 16 }}>
                                添加{step.label}
                              </Button>
                            )}
                            {subFields.map(({ key, name: idx }) => (
                              <div key={key} style={{
                                border: '1px solid #E2E8F0', borderRadius: 8, padding: 16,
                                marginBottom: 16, background: '#FAFBFC',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: '#155A8A' }}>
                                    {step.label} #{idx + 1}
                                  </span>
                                  {subFields.length > 1 && (
                                    <Button type="text" danger size="small" onClick={() => remove(idx)}>删除</Button>
                                  )}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
                                  {step.fields.map((field) => (
                                    <div
                                      key={field.id}
                                      style={
                                        field.type === 'textarea' || field.type === 'attachment'
                                          ? { gridColumn: '1 / -1' }
                                          : { gridColumn: 'span 3' }
                                      }
                                    >
                                      <DynamicField field={field} moduleId={selectedModuleId} subName={idx} listName={step.listName} form={form} pendingAttachments={pendingAttachments} editRecord={editRecord} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {subFields.length > 0 && (
                              <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />} style={{ height: 40, marginBottom: 16 }}>
                                添加{step.label}
                              </Button>
                            )}
                          </>
                        )}
                      </Form.List>
                    ) : (
                      <div
                        style={{ opacity: isVisible ? 1 : 0, transition: 'opacity 0.15s' }}
                      >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
                      {step.fields.map((field) => (
                        <div
                          key={field.id}
                          style={
                            field.type === 'textarea' || field.type === 'attachment'
                              ? { gridColumn: '1 / -1' }
                              : (['inquiryRecord', 'interrogationRecord', 'reception'].includes(field.id)
                                ? { gridColumn: 'span 2' }
                                : { gridColumn: 'span 3' })
                          }
                        >
                          <DynamicField field={field} moduleId={selectedModuleId} form={form} pendingAttachments={pendingAttachments} editRecord={editRecord} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
            </Form>
          </div>
      </Modal>
    </ErrorBoundary>
  );
}

/* ===================== Field components ===================== */

function DynamicField({ field, moduleId, subName, form, pendingAttachments, editRecord, listName }: { 
  field: FieldDefinition; 
  moduleId: string; 
  subName?: number; 
  form: any;
  pendingAttachments: React.MutableRefObject<Set<string>>;
  editRecord?: import('../store/massStore').MassRecord | null;
  listName?: string;
}) {
  const name = subName !== undefined ? [subName, field.id] : field.id;

  // ─── 全局案件名称/编号联动 ───
  // 所有模块的 caseName/caseNo 都使用全局 AutoComplete，实现全软件数据共享
  if (field.id === 'caseName' || field.id === 'clueName') {
    return <GlobalCaseNameField field={field} subName={subName} />;
  }
  if (field.id === 'caseNo') {
    return <GlobalCaseNoField field={field} subName={subName} />;
  }

  // 设备品牌字段：联动设备类型动态切换选项
  // 全局嫌疑人联动字段
  if (field.id === 'suspect' || field.id === 'suspectName') {
    return <GlobalSuspectField field={field} subName={subName} listName={listName} />;
  }

  // 身份证号字段：自动提取出生日期
  if (field.id === 'suspectIdNo') {
    return <IdNoField field={field} subName={subName} listName={listName} />;
  }

  // 持有人字段：共享嫌疑人全局联动
  if (field.id === 'holder') {
    return <GlobalSuspectField field={field} subName={subName} />;
  }

  if (field.id === 'deviceBrand') {
    return <DeviceBrandField field={field} subName={subName} />;
  }

  const rules = field.required ? [{ required: true, message: `请填写${field.label}` }] : undefined;

  if (field.type === 'section') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 0 4px', marginTop: 8,
        borderBottom: '1px solid #D8E1EA',
      }}>
        <div style={{ width: 3, height: 18, background: '#155A8A', borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#172033' }}>{field.label}</span>
      </div>
    );
  }

  if (field.type === 'textarea') {
    // 资金分析结论字段定制提示词
    let textareaPlaceholder = `请输入${field.label}`;
    if (moduleId === 'evidence-report') {
      if (field.id === 'conclusionFlow') textareaPlaceholder = '示例：本案累计吸收资金 1.2 亿元，其中 72% 用于兑付前期投资人返利，11% 被嫌疑人用于个人挥霍购置房产，8% 用于平台运营成本，6% 通过虚拟币转移至境外，未发现资金投入真实经营项目。';
      else if (field.id === 'conclusionCaseSupport') textareaPlaceholder = '示例：资金未用于生产经营，主要用于拆东墙补西墙的返利，符合集资诈骗 “非法占有目的” 的认定标准。';
      else if (field.id === 'conclusionDeepClue') textareaPlaceholder = '发现 3 个跑分账户，需进一步追查上游卡农；境外转移的 200 万 USDT，需对接跨境资金追查机制';
      else if (field.id === 'conclusionNextStep') textareaPlaceholder = '请明确下一步工作计划和具体措施';
    }
    return (
      <Form.Item name={name} label={field.label} rules={rules}>
        <Input.TextArea rows={4} placeholder={textareaPlaceholder} />
      </Form.Item>
    );
  }

  if (field.type === 'date') {
    return (
      <Form.Item name={name} label={field.label} rules={rules}>
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
    );
  }

  if (field.type === 'number') {
    return (
      <Form.Item name={name} label={field.label} rules={rules}>
        <InputNumber style={{ width: '100%' }} placeholder={`请输入${field.label}`} />
      </Form.Item>
    );
  }

  if (field.type === 'select') {
    return (
      <Form.Item name={name} label={field.label} rules={rules}>
        <PersistedSelect field={field} />
      </Form.Item>
    );
  }

  if (field.type === 'attachment') {
    return (
      <AttachmentField
        field={field}
        name={name}
        moduleId={moduleId}
        form={form}
        pendingAttachments={pendingAttachments}
        editRecord={editRecord}
      />
    );
  }

  // 多人输入字段（对应 moduleConfig 中 squad-daily 模块的特定字段）
  // 这些字段在设计上允许多个姓名/值，以"、"分隔存储
  const MULTI_PERSON_FIELDS = new Set([
    'inquiryRecord', 'interrogationRecord', 'reception',
    'evidenceObtained', 'fundFlowAnalysis', 'documentPreparation',
    'coerciveMeasuresResult', 'closedClues', 'clueCheck',
    'legalCoordination', 'stabilityWork', 'specialAction',
    'publicityWork', 'otherWork', 'seizedProperty', 'seizedVehicle',
    'seizedEquity', 'otherAssets', 'companyAccount', 'bankAccount',
    'personalBank', 'personalBalance',
  ]);
  if (MULTI_PERSON_FIELDS.has(field.id)) {
    return <MultiPersonField field={field} />;
  }

  // 特定字段的自定义 placeholder 提示
  const PLACEHOLDER_MAP: Record<string, Record<string, string>> = {
    caseNo: { _: 'A3703231200002026******' },
    'evidence-freeze': {
      suspect: '批量冻结可填写：***等**人',
      bankAccount: '批量冻结可填写：***等**个账号，详见附件',
    },
    'evidence-report': {
      investigateAccount: '***等***个',
    },
  };
  const customPlaceholder = PLACEHOLDER_MAP[field.id]?.[moduleId]
    || PLACEHOLDER_MAP[field.id]?.['_']
    || PLACEHOLDER_MAP[moduleId]?.[field.id]
    || `请输入${field.label}`;
  return (
    <Form.Item name={name} label={field.label} rules={rules}>
      <InputWithHistory field={field} placeholder={customPlaceholder} />
    </Form.Item>
  );
}

/* ===================== 独立附件字段组件 ===================== */

/** 附件上传字段 — 独立组件以合法使用 Form.useWatch Hook */
function AttachmentField({ field, name, moduleId, form, pendingAttachments, editRecord }: {
  field: FieldDefinition;
  name: string | (string | number)[];
  moduleId: string;
  form: any;
  pendingAttachments: React.MutableRefObject<Set<string>>;
  editRecord?: import('../store/massStore').MassRecord | null;
}) {
  const fieldName = typeof name === 'string' ? name : name[1];
  // 优先从 editRecord 原始数据初始化（不受 form.setFieldsValue 时序影响）
  const [fileList, setFileListState] = useState<any[]>(() => {
    if (editRecord) {
      // 从原始记录数据中直接读取附件列表
      const raw = editRecord.data?.[field.id];
      if (Array.isArray(raw)) return raw;
    }
    return [];
  });
  // 同步本地 state ← form 值变化
  const syncFileList = useCallback(() => {
    const v = form.getFieldValue(fieldName);
    setFileListState(Array.isArray(v) ? v : []);
  }, [form, fieldName]);
  // 初次装载后同步一次，兼顾 form.setFieldsValue（150ms 略长于 populate 的 100ms）
  useEffect(() => {
    const id = setTimeout(syncFileList, 150);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRemove = (uid: string) => {
    const next = fileList.filter((f: any) => f.uid !== uid);
    form.setFieldsValue({ [fieldName]: next });
    syncFileList();
  };

  const handlePreview = async (uid: string, fileName: string) => {
    // 在 await 之前打开窗口，防止浏览器阻止弹窗
    const newWin = window.open('', '_blank');
    if (!newWin) {
      // 弹窗被拦截，降级为下载
      return handleDownload(uid, fileName);
    }
    newWin.document.write('<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#999;font-family:sans-serif">加载中...</div>');
    try {
      const att = await getAttachment(uid);
      if (!att) { newWin.close(); return; }
      const blob = new Blob([att.data], { type: att.fileType });
      const url = URL.createObjectURL(blob);
      newWin.location.href = url;
      // URL.revokeObjectURL 延后回收，防止预览窗口打开后立刻断链
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      newWin.close();
      console.warn('[attachment] 预览失败:', err);
    }
  };

  const showToast = useAppStore.getState().showToast.bind(useAppStore.getState());

  const handleDownload = async (uid: string, fileName: string) => {
    try {
      const att = await getAttachment(uid);
      if (!att) throw new Error('附件数据不存在');
      const buf = Array.from(new Uint8Array(att.data));
      // Electron 模式：始终弹出原生保存对话框
      if ((window as any).electronAPI?.showSaveDialog) {
        const result = await (window as any).electronAPI.showSaveDialog(fileName, buf);
        if (!result.success && !result.canceled) {
          throw new Error(result.error || '保存失败');
        }
      } else {
        // 浏览器兜底
        const blob = new Blob([att.data], { type: att.fileType });
        if (blob.size === 0) throw new Error('附件文件数据为空');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      console.warn('[attachment] 下载失败:', err);
      showToast('下载失败: ' + msg, 'error');
    }
  };

  return (
    <Form.Item label={field.label}>
      <Form.Item name={name} valuePropName="fileList" getValueFromEvent={(info: any) => info?.fileList || []} noStyle>
        <Upload.Dragger
          beforeUpload={async (file) => {
            try {
              const record = await saveAttachment('pending', moduleId, field.id, file);
              pendingAttachments.current.add(record.id);
              const prev: any[] = form.getFieldValue(fieldName) || [];
              const newFile = {
                uid: record.id,
                name: file.name,
                status: 'done' as const,
                size: file.size,
                type: file.type,
              };
              const next = [...prev, newFile];
              form.setFieldsValue({ [fieldName]: next });
              setFileListState(next);
            } catch (err) {
              console.warn('[attachment] 保存失败:', err);
            }
            return false;
          }}
          showUploadList={false}
          multiple
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽附件到此处</p>
          <p className="ant-upload-hint">支持 PDF、Word、图片、压缩包等材料，文件存储于浏览器本地 IndexedDB。</p>
        </Upload.Dragger>
      </Form.Item>

      {fileList.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {fileList.map((file: any) => (
            <div key={file.uid} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 6,
              background: '#F9FAFB', border: '1px solid #E5E7EB',
            }}>
              <span style={{ flex: 1, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📎 {file.name}
              </span>
              <span onClick={() => handleDownload(file.uid, file.name)}
                style={{ fontSize: 12, color: '#155A8A', cursor: 'pointer', flexShrink: 0 }}>
                下载
              </span>
              <span onClick={() => handleRemove(file.uid)}
                style={{ fontSize: 12, color: '#DC2626', cursor: 'pointer', flexShrink: 0 }}>
                删除
              </span>
            </div>
          ))}
        </div>
      )}
    </Form.Item>
  );
}
