import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, DatePicker, Form, Input, InputNumber,
  Modal, Radio, Select, Space, Tag, Upload, App,
  type FormInstance, type UploadFile,
} from 'antd';
import dayjs from 'dayjs';
import { InboxOutlined, PlusOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';

import { useUnsavedChanges } from '../utils/useUnsavedChanges';
import badgeIcon from '../assets/badge-icon.png';
import { useAppStore } from '../store/appStore';
import { findModule, filterVisibleFields, type FieldDefinition } from '../moduleConfig';
import { REQUEST_CASE_INFO, REQUEST_CLUE_INFO } from '../moduleConfig/fields/evidence';
import { useCustomModules } from '../customModules';
import { saveMassRecord, updateMassRecord, getMassRecords } from '../store/massStore';
import ErrorBoundary from './ErrorBoundary';
import { recordFormFields, rebuildCaseIndex, rebuildSuspectIndex } from '../store/inputHistoryStore';
import {
  GlobalCaseNameField, GlobalCaseNoField, GlobalSuspectField,
  GlobalHistoryField, GlobalClueNoField,
  InputWithHistory,
  MultiPersonField, PersistedSelect, DeviceBrandField,
  IdNoField,
} from './SharedFormFields';
import { saveAttachment, relinkAttachment, getAttachment } from '../store/attachmentStore';
import { ATTACHMENT_CATEGORIES } from '../constants/attachmentCategories';
import { saveDraft, getDraft, deleteDraft } from '../store/draftStore';

interface Props { onClose: () => void; editRecord?: import('../store/massStore').MassRecord | null; }

export default function DrawerNewRecord({ onClose, editRecord }: Props) {
  const { modal } = App.useApp();
  useUnsavedChanges(true);
  
    const currentPage = useAppStore((s) => s.currentPage);
  const showToast = useAppStore((s) => s.showToast);
  const currentTabId = useAppStore((s) => s.currentTabId);
  const userRole = useAppStore((s) => s.userRole);
  const darkMode = useAppStore((s) => s.darkMode);
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
  const [formKey, setFormKey] = useState(0);
  // 调证登记：案件调证 / 线索调证 模式（仅 evidence-request 生效）
  const [requestMode, setRequestMode] = useState<'case' | 'clue'>(() =>
    editRecord?.data?.clueNo ? 'clue' : 'case'
  );
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
  const allFields = useMemo(() => {
    const base = filterVisibleFields(selectedTab?.fields ?? [], userRole);
    if (selectedModuleId !== 'evidence-request') return base;
    // 按调证模式替换首段（线索/案件信息）字段
    const firstIdx = base.findIndex((f) => f.type === 'section');
    if (firstIdx === -1) return base;
    const nextIdx = base.findIndex((f, i) => i > firstIdx && f.type === 'section');
    const before = base.slice(0, firstIdx + 1);
    const after = nextIdx === -1 ? [] : base.slice(nextIdx);
    const info = requestMode === 'clue' ? REQUEST_CLUE_INFO : REQUEST_CASE_INFO;
    return [...before, ...info, ...after];
  }, [selectedTab, userRole, selectedModuleId, requestMode]);

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
  const isEvidenceRequest = selectedModuleId === 'evidence-request';
  const flatMode = steps.length === 2 && steps[1].repeatable && !isSquadCase;
  const hasSections = flatMode ? false : steps.length > 1;
  const totalSteps = steps.length;
  const currentStepMeta = steps[currentStep];
  const stepFields = currentStepMeta?.fields || [];

  const handleClose = () => {
    if (isDirty) {
      modal.confirm({
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
    setRequestMode('case');
    setCurrentStep(0);
  };

  // 调证登记：案件调证 / 线索调证 切换
  const handleModeChange = (mode: 'case' | 'clue') => {
    if (mode === requestMode) return;
    // 切换模式不再清空已填值：两侧字段在表单中保留（编辑体验），仅确保进入线索模式时编号有 XS- 默认前缀
    const patch: Record<string, unknown> = {};
    if (mode === 'clue' && !form.getFieldValue('clueNo')) patch.clueNo = 'XS-';
    form.setFieldsValue(patch);
    setRequestMode(mode);
    safeSetDirty(true);
  };

  const handleSubmit = async (keepOpen = false) => {
    try {
      const values = await form.validateFields();

      // 调证登记：仅保留当前模式的前四项，避免案件/线索两套字段同时入库（切换不清空只影响编辑体验）
      if (isEvidenceRequest) {
        const inactiveModeKeys = requestMode === 'case'
          ? ['clueNo', 'clueName', 'clueSource', 'clueType']
          : ['caseNo', 'caseName', 'caseSource', 'caseType'];
        for (const k of inactiveModeKeys) delete values[k];
      }

      // 序列化 dayjs 对象为 ISO 字符串，避免传入 IndexedDB 后触发 antd clone 崩溃
      for (const key of Object.keys(values)) {
        const v = values[key];
        if (v && typeof v === 'object' && v.$L !== undefined && v.$d !== undefined) {
          values[key] = (typeof v.isValid === 'function' && v.isValid()) ? v.toISOString() : String(v.$d);
        }
        // 处理 repeatable section 中的 dayjs 对象
        if (Array.isArray(v)) {
          v.forEach((item: Record<string, unknown>) => {
            if (item && typeof item === 'object') {
              for (const k of Object.keys(item)) {
                const val = item[k];
                if (val && typeof val === 'object') {
                  const dv = val as { $L?: unknown; $d?: unknown; isValid?: () => boolean; toISOString?: () => string };
                  if (dv.$L !== undefined && dv.$d !== undefined) {
                    item[k] = (dv.isValid && dv.isValid()) ? dv.toISOString!() : String(dv.$d);
                  }
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
            // 重建案件索引
            rebuildCaseIndex(getMassRecords());
            rebuildSuspectIndex(getMassRecords());
            if (keepOpen) {
              // 再建一条：重置为新空白表单，留在弹窗内继续录入
              safeSetDirty(false);
              deleteDraft(selectedModuleId, selectedTabId);
              form.resetFields();
              setCurrentStep(0);
              pendingAttachments.current.clear();
              setFormKey((k) => k + 1); // 重挂表单，重置附件子组件状态
              showToast('已创建，可继续录入下一条', 'success');
              return;
            }
            safeSetDirty(false);
            deleteDraft(selectedModuleId, selectedTabId);
            showToast(`${selectedModule?.label} · ${selectedTab?.label || '记录'} 已创建`, 'success');
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
                    } else if (raw && typeof raw === 'object') {
                      // dayjs 对象（含 $d）或 { $d: ... } 形状：转为真正 dayjs 实例
                      const maybeDayjs = raw as { $d?: unknown };
                      if (maybeDayjs.$d != null) {
                        const dateVal = maybeDayjs.$d instanceof Date ? maybeDayjs.$d : new Date(String(maybeDayjs.$d));
                        if (!isNaN(dateVal.getTime())) copy[df.id] = dayjs(dateVal);
                      }
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
              formData[f.id] = rawArr.map((item: { uid?: string | number; id?: string | number; name?: string; fileName?: string }) => ({
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
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 用 state 计数器（而非 ref）作为 effect 依赖，确保每次表单变化都能触发自动保存
  const [changeCount, setChangeCount] = useState(0);
  useEffect(() => {
    if (isEditing) return;
    if (changeCount === 0) return;
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
  }, [changeCount, selectedModuleId, selectedTabId, currentStep, isEditing, form]);

  // 恢复草稿提示
  useEffect(() => {
    if (isEditing) return;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      const draft = getDraft(selectedModuleId, selectedTabId);
      if (draft && Object.keys(draft.data).length > 0) {
        modal.confirm({
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
      closable={false}
      maskClosable={false}
      onCancel={handleClose}
      centered
      title={null}
      className="drawer-new-record-modal"
      classNames={{ container: 'dnr-modal-container' }}
      styles={{
        body: { height: '72vh', overflow: 'hidden', padding: 0, display: 'flex', flexDirection: 'column' },
        footer: { padding: '12px 24px 24px', margin: 0 },
      }}
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
              <>
                {!isEditing && (
                  <Button
                    icon={<PlusOutlined />}
                    loading={saving}
                    onClick={() => handleSubmit(true)}
                    style={{ height: 36, paddingInline: 16 }}
                  >
                    再建一条
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  loading={saving}
                  onClick={() => handleSubmit(false)}
                  style={{ height: 36, paddingInline: 20 }}
                >
                  {isEditing ? '保存修改' : '创建记录'}
                </Button>
              </>
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
      {/* ===== 蓝渐变头部横幅（铺满标题到基本信息上方） ===== */}
      <div style={{ flexShrink: 0, borderRadius: '8px 8px 0 0', background: darkMode ? 'linear-gradient(to bottom,#13325c,#1d4ed8)' : 'linear-gradient(to bottom,#155A8A,#2563EB)', padding: '16px 24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>
            <img src={badgeIcon} alt="" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }} />
            {isEditing ? '编辑工作记录' : '新建工作记录'} · {selectedModule?.label}
          </div>
          <button
            type="button"
            onClick={handleClose}
            title="关闭"
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', fontSize: 18, lineHeight: 1, flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.26)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
          >
            ×
          </button>
        </div>

        {hasSections && (
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
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
                    background: active ? '#fff' : 'rgba(255,255,255,0.16)',
                    color: active ? '#155A8A' : 'rgba(255,255,255,0.92)',
                    fontWeight: active ? 700 : 400,
                    border: active ? '1px solid #fff' : '1px solid transparent',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontSize: 11, opacity: 0.8 }}>
                    {done ? '✓ ' : ''}步骤 {i + 1}
                  </div>
                  <div style={{ marginTop: 2 }}>{step.label}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Module/Template selector（放在蓝头内，像资料弹窗一样铺满） */}
        <div style={{
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10,
          padding: 14, marginTop: 16,
        }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', marginBottom: 6 }}>
            {selectedModule?.departmentLabel} · {selectedModule?.label} · {selectedTab?.label}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            {flatMode ? `${steps[0]?.label} · ${steps[1]?.label}` : (hasSections ? steps[currentStep]?.label : '基本信息')}
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>所属模块</label>
              <Select value={selectedModuleId} onChange={handleModuleChange} showSearch optionFilterProp="label" style={{ width: 280 }}>
                {scopedModules.map((mod) => (
                  <Select.Option key={mod.id} value={mod.id} label={`${mod.departmentLabel} ${mod.label}`}>
                    {mod.departmentLabel} · {mod.label}
                  </Select.Option>
                ))}
              </Select>
            </div>
            {showTemplateSelector && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>记录模板</label>
                <Select value={selectedTabId} onChange={(value) => { setSelectedTabId(value); form.resetFields(); setRequestMode('case'); setCurrentStep(0); }} style={{ width: 220 }}>
                  {selectedModule?.tabs.map((tab) => (
                    <Select.Option key={tab.id} value={tab.id}>{tab.label}</Select.Option>
                  ))}
                </Select>
              </div>
            )}
            {hasSections && !flatMode && (
              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.7)', paddingBottom: 6 }}>
                {stepFields.length} 个字段 · 第 {currentStep + 1}/{totalSteps} 步
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px 16px' }}>
        <Form
          key={formKey}
          form={form}
          layout="vertical"
          requiredMark="optional"
          onValuesChange={() => { if (mountedRef.current) { setIsDirty(true); setChangeCount((c) => c + 1); } }}
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
                                border: '1px solid var(--color-border-light)', borderRadius: 8, padding: 16,
                                marginBottom: 16, background: 'var(--color-surface-hover)',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>
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
                      {si === 0 && isEvidenceRequest && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 22, padding: '16px 20px', background: 'var(--color-surface-hover)', border: '2px solid var(--color-primary)', borderRadius: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)' }}>请选择调证类型</span>
                          <Radio.Group
                            value={requestMode}
                            onChange={(e) => handleModeChange(e.target.value as 'case' | 'clue')}
                            buttonStyle="solid"
                            size="large"
                          >
                            <Radio.Button value="case">案件调证</Radio.Button>
                            <Radio.Button value="clue">线索调证</Radio.Button>
                          </Radio.Group>
                          <Tag color={requestMode === 'clue' ? 'blue' : 'default'} style={{ fontSize: 13, padding: '4px 10px', marginInlineEnd: 0 }}>
                            {requestMode === 'clue' ? '已选「线索调证」· 编号自动以 XS- 开头' : '已选「案件调证」'}
                          </Tag>
                        </div>
                      )}
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
                          {field.id === 'clueNo' && requestMode === 'clue' ? (
                            <GlobalClueNoField field={field} />
                          ) : (
                            <DynamicField field={field} moduleId={selectedModuleId} form={form} pendingAttachments={pendingAttachments} editRecord={editRecord} />
                          )}
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
  form: FormInstance;
  pendingAttachments: React.MutableRefObject<Set<string>>;
  editRecord?: import('../store/massStore').MassRecord | null;
  listName?: string;
}) {
  const name = subName !== undefined ? [subName, field.id] : field.id;

  // ─── 全局案件名称/编号联动 ───
  // 所有模块的 caseName/caseNo 都使用全局 AutoComplete，实现全软件数据共享
  if (field.id === 'caseName') {
    return <GlobalCaseNameField field={field} subName={subName} />;
  }
  if (field.id === 'clueName') {
    // 线索名称使用独立全局池（与案件名称池互不干扰，各自全局共享）
    return <GlobalHistoryField field={field} subName={subName} />;
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
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ width: 3, height: 18, background: 'var(--color-primary)', borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{field.label}</span>
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
  form: FormInstance;
  pendingAttachments: React.MutableRefObject<Set<string>>;
  editRecord?: import('../store/massStore').MassRecord | null;
}) {
  const fieldName = typeof name === 'string' ? name : name[1];
  const [category, setCategory] = useState('其他');
  // 优先从 editRecord 原始数据初始化（不受 form.setFieldsValue 时序影响）
  const [fileList, setFileListState] = useState<UploadFile[]>(() => {
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
    const next = fileList.filter((f: UploadFile) => f.uid !== uid);
    form.setFieldsValue({ [fieldName]: next });
    syncFileList();
  };

  const showToast = useAppStore.getState().showToast.bind(useAppStore.getState());

  const handleDownload = async (uid: string, fileName: string) => {
    try {
      const att = await getAttachment(uid);
      if (!att) throw new Error('附件数据不存在');
      const buf = Array.from(new Uint8Array(att.data));
      // Electron 模式：始终弹出原生保存对话框
      if (window.electronAPI?.showSaveDialog) {
        const result = await window.electronAPI.showSaveDialog(fileName, buf);
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>附件分类</span>
        <Select
          value={category}
          onChange={(v: string) => setCategory(v)}
          style={{ width: 160 }}
          options={ATTACHMENT_CATEGORIES.map((c) => ({ label: c, value: c }))}
        />
      </div>
      <Form.Item name={name} valuePropName="fileList" getValueFromEvent={(info: { fileList?: UploadFile[] }) => info?.fileList ?? []} noStyle>
        <Upload.Dragger
          beforeUpload={async (file) => {
            try {
              const record = await saveAttachment('pending', moduleId, field.id, file, category);
              pendingAttachments.current.add(record.id);
              const prev: UploadFile[] = (form.getFieldValue(fieldName) as UploadFile[]) || [];
              const newFile = {
                uid: record.id,
                name: file.name,
                status: 'done' as const,
                size: file.size,
                type: file.type,
                category,
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
          {fileList.map((file: UploadFile) => (
            <div key={file.uid} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 6,
              background: 'var(--color-surface-hover)', border: '1px solid var(--color-border-light)',
            }}>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📎 {file.name}
              </span>
              <span onClick={() => handleDownload(file.uid, file.name)}
                style={{ fontSize: 12, color: 'var(--color-primary)', cursor: 'pointer', flexShrink: 0 }}>
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
