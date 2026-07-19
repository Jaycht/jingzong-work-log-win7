import { useState, useRef, useEffect } from "react";
import { Modal, Form, Input, Select, Divider, App } from "antd";
import { UserCog, Lock, Camera, X, ShieldCheck, Trash2 } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { hashPassword, verifyPassword } from "../utils/crypto";
import badgeIcon from '../assets/badge-icon.png';

interface Props {
  open: boolean;
  onClose: () => void;
}

const DEPT_OPTIONS = [
  "大队领导", "办公室", "涉众办", "法制室",
  "一中队", "二中队", "三中队", "资金组",
];

const fieldLabel: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6, display: "block",
};

export default function ProfileModal({ open, onClose }: Props) {
  const { modal } = App.useApp();
  const userName = useAppStore((s) => s.userName);
  const userBadge = useAppStore((s) => s.userBadge);
  const userPhone = useAppStore((s) => s.userPhone);
  const userDepartment = useAppStore((s) => s.userDepartment);
  const setUserProfile = useAppStore((s) => s.setUserProfile);
  const showToast = useAppStore((s) => s.showToast);
  const darkMode = useAppStore((s) => s.darkMode);

  const [infoForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [avatar, setAvatar] = useState<string | null>(() => {
    try { return localStorage.getItem("jingzong.avatar"); } catch { return null; }
  });
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 打开时回填会话中的档案（修复：注册信息此前不显示）
  useEffect(() => {
    if (!open) return;
    infoForm.setFieldsValue({
      name: userName || "",
      badge: userBadge || "",
      phone: userPhone || "",
      department: userDepartment || "",
    });
    pwdForm.resetFields();
    setDirty(false);
  }, [open, userName, userBadge, userPhone, userDepartment, infoForm, pwdForm]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("请选择图片文件", "error"); return; }
    if (file.size > 2 * 1024 * 1024) { showToast("图片大小不能超过 2MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatar(dataUrl);
      setDirty(true);
      try { localStorage.setItem("jingzong.avatar", dataUrl); } catch { /* ignore */ }
      showToast("头像已更新", "success");
    };
    reader.readAsDataURL(file);
  };

  // 删除自定义头像：清除 localStorage，回退默认警徽；仅在已设自定义头像时可点
  const handleDeleteAvatar = () => {
    if (!avatar) return;
    modal.confirm({
      title: "恢复默认头像",
      content: "将删除自定义头像，恢复为默认警徽头像。确定继续吗？",
      okText: "恢复默认",
      cancelText: "取消",
      centered: true,
      onOk: () => {
        try { localStorage.removeItem("jingzong.avatar"); } catch { /* ignore */ }
        setAvatar(null);
        setDirty(true);
        showToast("已恢复默认头像（警徽）", "success");
      },
    });
  };

  // 修改密码：校验原密码并更新到对应存储（注册用户→jingzong.users.v1；内置账号→登录凭据）
  const doPasswordChange = async (oldP: string, newP: string): Promise<boolean> => {
    const loginRaw = localStorage.getItem("jingzong.login.v1");
    const account = loginRaw ? (JSON.parse(loginRaw).account as string) : "";
    try {
      const usersRaw = localStorage.getItem("jingzong.users.v1");
      const users: Array<Record<string, unknown>> = usersRaw ? JSON.parse(usersRaw) : [];
      const idx = users.findIndex((u) => u.account === account);
      if (idx >= 0) {
        const ok = await verifyPassword(oldP, String(users[idx].password ?? ""));
        if (!ok) { showToast("原密码不正确", "error"); return false; }
        const hashed = await hashPassword(newP);
        users[idx] = { ...users[idx], password: hashed };
        localStorage.setItem("jingzong.users.v1", JSON.stringify(users));
      } else {
        const loginData = loginRaw ? JSON.parse(loginRaw) : {};
        const ok = await verifyPassword(oldP, String(loginData.password ?? ""));
        if (!ok) { showToast("原密码不正确", "error"); return false; }
        loginData.password = newP;
        localStorage.setItem("jingzong.login.v1", JSON.stringify(loginData));
        const pwdsRaw = localStorage.getItem("jingzong.accountPasswords.v1");
        const pwds = pwdsRaw ? JSON.parse(pwdsRaw) : {};
        if (account) { pwds[account] = newP; localStorage.setItem("jingzong.accountPasswords.v1", JSON.stringify(pwds)); }
      }
      return true;
    } catch {
      showToast("密码修改失败", "error");
      return false;
    }
  };

  const handleSave = async () => {
    let info: { name?: string; badge?: string; phone?: string; department?: string };
    try {
      info = (await infoForm.validateFields()) as typeof info;
    } catch {
      return;
    }
    const pwdVals = pwdForm.getFieldsValue() as { oldPassword?: string; newPassword?: string; confirmPassword?: string };
    const wantPwd = !!(pwdVals.oldPassword || pwdVals.newPassword || pwdVals.confirmPassword);
    if (wantPwd) {
      if (!pwdVals.oldPassword) { showToast("请输入原密码", "error"); return; }
      if (!pwdVals.newPassword || pwdVals.newPassword.length < 6) { showToast("新密码至少 6 位", "error"); return; }
      if (pwdVals.newPassword !== pwdVals.confirmPassword) { showToast("两次输入的新密码不一致", "error"); return; }
      const ok = await doPasswordChange(pwdVals.oldPassword, pwdVals.newPassword);
      if (!ok) return;
    }

    setUserProfile({
      name: info.name?.trim() || userName,
      badge: info.badge?.trim() || "",
      phone: info.phone?.trim() || "",
      department: info.department?.trim() || "",
    });
    setDirty(false);
    showToast(wantPwd ? "资料已保存，密码已更新" : "资料已保存", "success");
    onClose();
  };

  const handleClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    modal.confirm({
      title: "未保存的修改",
      content: "资料页面有未保存的内容，确定要退出吗？",
      okText: "退出",
      cancelText: "继续编辑",
      centered: true,
      onOk: () => {
        setDirty(false);
        onClose();
      },
    });
  };

  const bannerBg = darkMode
    ? "linear-gradient(135deg,#13325c,#1d4ed8)"
    : "linear-gradient(135deg,#155A8A,#2563EB)";
  const account = (() => {
    try { return JSON.parse(localStorage.getItem("jingzong.login.v1") || "{}").account || ""; } catch { return ""; }
  })();

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={null}
      footer={null}
      closable={false}
      width={520}
      destroyOnHidden
      rootClassName="profile-modal-root"
      modalRender={(node) => (
        <div className="profile-modal-shell">{node}</div>
      )}
      styles={{
        body: { padding: 0 },
      }}
    >
      {/* 顶部横幅：背景完整覆盖头像、姓名、账号行 */}
      <div
        style={{
          position: "relative",
          background: bannerBg,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: "hidden",
          paddingTop: 24,
          paddingBottom: 18,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.18,
            background: "radial-gradient(circle at 80% 20%, #fff 0, transparent 45%)",
          }}
        />
        <button
          onClick={handleClose}
          title="关闭"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: "rgba(255,255,255,0.18)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <X size={16} />
        </button>

        {/* 头像 + 姓名 + 账号，全部位于背景区内 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: "relative",
              width: 84,
              height: 84,
              borderRadius: "50%",
              cursor: "pointer",
              overflow: "hidden",
              background: "#fff",
              border: "3px solid #fff",
              boxShadow: "0 8px 22px rgba(0,0,0,0.22)",
            }}
          >
            <img
              src={avatar || badgeIcon}
              alt="avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 24,
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color: "#fff",
                gap: 4,
              }}
            >
              <Camera size={12} /> 更换
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarChange}
          />
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              marginTop: 10,
              textAlign: "center",
              textShadow: "0 1px 2px rgba(0,0,0,0.2)",
            }}
          >
            {userName || "用户"}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "rgba(255,255,255,0.9)",
              marginTop: 3,
              textAlign: "center",
            }}
          >
            {account ? `账号：${account}` : "本地账户"}
          </div>

          {/* 头像操作：更换 / 删除（默认头像时删除禁用） */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: 30, padding: "0 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                border: "1px solid rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.16)", color: "#fff",
                fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              <Camera size={13} /> 更换头像
            </button>
            <button
              onClick={handleDeleteAvatar}
              disabled={!avatar}
              title={avatar ? "删除自定义头像，恢复默认警徽" : "当前为默认头像，无需删除"}
              style={{
                height: 30, padding: "0 14px", borderRadius: 8, cursor: avatar ? "pointer" : "not-allowed", fontFamily: "inherit",
                border: "1px solid rgba(255,255,255,0.35)", background: "transparent", color: "#fff",
                fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5, opacity: avatar ? 1 : 0.55,
              }}
            >
              <Trash2 size={13} /> 删除头像
            </button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ padding: "18px 24px 8px" }}>
        {/* 基本信息 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ width: 4, height: 16, borderRadius: 2, background: "var(--color-primary, #2563EB)" }} />
          <UserCog size={16} color="var(--color-primary, #2563EB)" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>基本信息</span>
        </div>
        <Form
          form={infoForm}
          layout="vertical"
          requiredMark={false}
          onValuesChange={() => setDirty(true)}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <Form.Item label={<span style={fieldLabel}>姓名</span>} name="name" rules={[{ required: true, message: "请输入姓名" }]} style={{ gridColumn: "1 / -1" }}>
              <Input size="middle" placeholder="真实姓名" />
            </Form.Item>
            <Form.Item label={<span style={fieldLabel}>警号</span>} name="badge">
              <Input placeholder="警号" />
            </Form.Item>
            <Form.Item label={<span style={fieldLabel}>手机号</span>} name="phone">
              <Input placeholder="手机号" />
            </Form.Item>
            <Form.Item label={<span style={fieldLabel}>所属科室</span>} name="department" style={{ gridColumn: "1 / -1" }}>
              <Select
                placeholder="请选择所属科室"
                options={DEPT_OPTIONS.map((d) => ({ label: d, value: d }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </div>
        </Form>

        <Divider style={{ margin: "18px 0 16px" }} />

        {/* 安全设置（底部） */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ width: 4, height: 16, borderRadius: 2, background: "#D97706" }} />
          <Lock size={16} color="#D97706" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>安全设置</span>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
            <ShieldCheck size={12} /> 留空则不修改密码
          </span>
        </div>
        <Form
          form={pwdForm}
          layout="vertical"
          requiredMark={false}
          onValuesChange={() => setDirty(true)}
        >
          <Form.Item label={<span style={fieldLabel}>原密码</span>} name="oldPassword">
            <Input.Password placeholder="请输入当前密码" autoComplete="current-password" />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <Form.Item label={<span style={fieldLabel}>新密码</span>} name="newPassword">
              <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
            </Form.Item>
            <Form.Item label={<span style={fieldLabel}>确认新密码</span>} name="confirmPassword">
              <Input.Password placeholder="再次输入" autoComplete="new-password" />
            </Form.Item>
          </div>
        </Form>
      </div>

      {/* 底部操作 */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 24px 20px", borderTop: "1px solid var(--color-border, #E5E7EB)" }}>
        <button
          onClick={handleClose}
          style={{ height: 36, padding: "0 18px", background: "transparent", border: "1px solid var(--color-border, #D8E1EA)", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "var(--color-text-secondary)" }}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          style={{ height: 36, padding: "0 22px", background: "linear-gradient(135deg,#155A8A,#2563EB)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", boxShadow: "0 4px 14px rgba(37,99,235,0.28)" }}
        >
          保存
        </button>
      </div>
    </Modal>
  );
}
