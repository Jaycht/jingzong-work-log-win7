import { useState, useRef } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { useAppStore } from "../store/appStore"

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProfileModal({ open, onClose }: Props) {
    const userName = useAppStore((s) => s.userName);
  const showToast = useAppStore((s) => s.showToast);
  const setUser = useAppStore((s) => s.setUser);
  const [form] = Form.useForm();
  const [avatar, setAvatar] = useState<string | null>(() => {
    try { return localStorage.getItem("jingzong.avatar"); } catch { return null; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("请选择图片文件", "error"); return; }
    if (file.size > 2 * 1024 * 1024) { showToast("图片大小不能超过 2MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatar(dataUrl);
      try {
        localStorage.setItem("jingzong.avatar", dataUrl);
      } catch {
        // Ignore storage write failures and keep the preview visible.
      }
      showToast("头像已更新", "success");
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal title="个人信息" open={open} onCancel={onClose} footer={null} width={460} destroyOnClose>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, marginTop: 8 }}>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: 80, height: 80, borderRadius: "50%", cursor: "pointer", overflow: "hidden",
            background: avatar ? "none" : "linear-gradient(135deg,#4B9EFF,#2563EB)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "3px solid #E5E7EB", transition: "border-color .2s",
            position: "relative",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "#155A8A"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
        >
          {avatar ? (
            <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 28, fontWeight: 700, color: "#fff" }}>{(userName || "用")[0]}</span>
          )}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 24,
            background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, color: "#fff", cursor: "pointer",
          }}>
            编辑
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>点击头像上传照片</div>
      </div>
      <Form form={form} layout="vertical">
        <Form.Item label="姓名" name="name" initialValue={userName}>
          <Input />
        </Form.Item>
        <Form.Item label="警号" name="badge">
          <Input placeholder="请输入警号" />
        </Form.Item>
        <Form.Item label="手机号" name="phone">
          <Input placeholder="请输入手机号" />
        </Form.Item>
        <Form.Item label="所属科室" name="department">
          <Select
            placeholder="请选择所属科室"
            options={[
              { label: '大队领导', value: '大队领导' },
              { label: '办公室', value: '办公室' },
              { label: '涉众办', value: '涉众办' },
              { label: '法制室', value: '法制室' },
              { label: '一中队', value: '一中队' },
              { label: '二中队', value: '二中队' },
              { label: '三中队', value: '三中队' },
              { label: '资金组', value: '资金组' },
            ]}
          />
        </Form.Item>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={onClose}
            style={{ height: 34, padding: '0 16px', background: '#fff', border: '1px solid #D8E1EA', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            取消
          </button>
          <button onClick={() => { const values = form.getFieldsValue();
          if (values.name && values.name !== userName) {
            setUser(values.name, useAppStore.getState().userRole);
          }
          showToast('个人信息已保存', 'success');
          onClose(); }}
            style={{ height: 34, padding: '0 16px', background: '#155A8A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            保存
          </button>
        </div>
      </Form>
    </Modal>
  );
}
