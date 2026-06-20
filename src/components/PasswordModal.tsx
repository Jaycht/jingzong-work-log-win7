import { Modal, Form, Input } from 'antd';
import { useAppStore } from "../store/appStore"

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PasswordModal({ open, onClose }: Props) {
    const showToast = useAppStore((s) => s.showToast);
  const [form] = Form.useForm();

  const handleSubmit = () => {
    form.validateFields().then(() => {
      showToast('密码修改成功', 'success');
      form.resetFields();
      onClose();
    }).catch(() => {});
  };

  return (
    <Modal title="修改密码" open={open} onCancel={onClose} footer={null} width={420} destroyOnClose>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="原密码" name="oldPassword" rules={[{ required: true, message: '请输入原密码' }]}>
          <Input.Password placeholder="请输入原密码" />
        </Form.Item>
        <Form.Item label="新密码" name="newPassword" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少6位' }]}>
          <Input.Password placeholder="请输入新密码（至少6位）" />
        </Form.Item>
        <Form.Item
          label="确认新密码"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password placeholder="请再次输入新密码" />
        </Form.Item>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={onClose}
            style={{ height: 34, padding: '0 16px', background: '#fff', border: '1px solid #D8E1EA', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            取消
          </button>
          <button onClick={handleSubmit}
            style={{ height: 34, padding: '0 16px', background: '#155A8A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            确认修改
          </button>
        </div>
      </Form>
    </Modal>
  );
}
