import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Empty, Form, Input, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, Save, Settings, Trash2 } from 'lucide-react';
import { useAppStore } from "../store/appStore"
import { createCustomModule, useCustomModules } from '../customModules';
import { DEPARTMENTS, type FieldDefinition, type FieldType, type WorkModule } from '../moduleConfig';

const fieldTypeLabels: Partial<Record<FieldType, string>> = {
  text: '纯文字',
  textarea: '长文本',
  date: '日期',
  number: '数字',
  select: '下拉选择',
  attachment: '附件',
};

interface FieldDraft {
  label: string;
  type: FieldType;
  required: boolean;
  options?: string;
}

const defaultField: FieldDraft = { label: '', type: 'text', required: false, options: '' };

export default function SettingsPage() {
    const showToast = useAppStore((s) => s.showToast);
  const { customModules, addCustomModule, removeCustomModule } = useCustomModules();
  const [form] = Form.useForm();
  const [fields, setFields] = useState<FieldDraft[]>([
    { label: '记录标题', type: 'text', required: true },
    { label: '记录日期', type: 'date', required: true },
    { label: '工作内容', type: 'textarea', required: true },
  ]);

  const addField = () => setFields((prev) => [...prev, { ...defaultField }]);
  const updateField = (index: number, patch: Partial<FieldDraft>) => {
    setFields((prev) => prev.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  };
  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const usableFields = fields.filter((field) => field.label.trim());
    if (!usableFields.length) {
      showToast('请至少添加一个字段', 'warning');
      return;
    }

    const module = createCustomModule({
      departmentId: values.departmentId,
      label: values.label,
      description: values.description,
      fields: usableFields.map<FieldDefinition>((field, index) => ({
        id: `custom-field-${Date.now()}-${index}`,
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: field.type === 'select' ? field.options?.split(/[，,]/).map((item) => item.trim()).filter(Boolean) : undefined,
      })),
    });

    addCustomModule(module);
    form.resetFields();
    setFields([
      { label: '记录标题', type: 'text', required: true },
      { label: '记录日期', type: 'date', required: true },
      { label: '工作内容', type: 'textarea', required: true },
    ]);
    showToast('自定义模块已保存，下次登录仍会保留', 'success');
  };

  const columns: ColumnsType<WorkModule> = [
    { title: '所属部门', dataIndex: 'departmentLabel', width: 130 },
    { title: '模块名称', dataIndex: 'label', width: 160 },
    { title: '说明', dataIndex: 'description' },
    {
      title: '字段',
      width: 220,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.tabs[0]?.fields?.slice(0, 4).map((field) => <Tag key={field.id}>{field.label}</Tag>)}
          {(record.tabs[0]?.fields?.length || 0) > 4 && <Tag>+{(record.tabs[0]?.fields?.length || 0) - 4}</Tag>}
        </Space>
      ),
    },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Popconfirm title="删除自定义模块？" description="删除后左侧菜单将不再显示该模块。" onConfirm={() => removeCustomModule(record.id)}>
          <Button danger type="link" size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}
      >
        <div style={{ width: 42, height: 42, borderRadius: 8, background: 'linear-gradient(135deg, #0F3A5F, #155A8A)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 12px rgba(15,58,95,.24)' }}>
          <Settings size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--color-text)' }}>模板字段</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>自定义模块 · 字段类型 · 本机自动保存</div>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16, alignItems: 'start' }}>
        <div className="panel" style={{ padding: 18 }}>
          <Form form={form} layout="vertical">
            <Form.Item name="departmentId" label="所属一级菜单" rules={[{ required: true, message: '请选择所属部门' }]}>
              <Select placeholder="请选择部门">
                {DEPARTMENTS.map((dept) => <Select.Option key={dept.id} value={dept.id}>{dept.label}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="label" label="自定义模块名称" rules={[{ required: true, message: '请输入模块名称' }]}>
              <Input placeholder="如：涉案企业台账、外调走访登记" />
            </Form.Item>
            <Form.Item name="description" label="模块说明">
              <Input.TextArea rows={2} placeholder="简要说明该模块用途" />
            </Form.Item>
          </Form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>字段定义</div>
            <Button size="small" icon={<Plus size={13} />} onClick={addField}>添加字段</Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fields.map((field, index) => (
              <div key={index} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, background: 'var(--color-surface-hover)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8, marginBottom: 8 }}>
                  <Input value={field.label} placeholder="字段名称" onChange={(event) => updateField(index, { label: event.target.value })} />
                  <Select value={field.type} onChange={(value) => updateField(index, { type: value })}>
                    {Object.entries(fieldTypeLabels).map(([value, label]) => (
                      <Select.Option key={value} value={value}>{label}</Select.Option>
                    ))}
                  </Select>
                </div>
                {field.type === 'select' && (
                  <Input
                    style={{ marginBottom: 8 }}
                    value={field.options}
                    placeholder="下拉选项，用逗号分隔"
                    onChange={(event) => updateField(index, { options: event.target.value })}
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Switch size="small" checked={field.required} onChange={(checked) => updateField(index, { required: checked })} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>必填</span>
                  </Space>
                  <Button type="text" danger size="small" icon={<Trash2 size={13} />} onClick={() => removeField(index)} />
                </div>
              </div>
            ))}
          </div>

          <Button type="primary" block icon={<Save size={14} />} onClick={handleSave} style={{ marginTop: 16 }}>
            保存自定义模块
          </Button>
        </div>

        <div className="panel" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>已保存的自定义模块</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>保存在当前电脑浏览器本地存储中，刷新后仍然存在。</div>
            </div>
            <Tag color="blue">{customModules.length} 个</Tag>
          </div>
          {customModules.length ? (
            <Table<WorkModule> size="middle" rowKey="id" columns={columns} dataSource={customModules} pagination={false} />
          ) : (
            <Empty description="暂无自定义模块" style={{ padding: 50 }} />
          )}
        </div>
      </div>

    </div>
  );
}
