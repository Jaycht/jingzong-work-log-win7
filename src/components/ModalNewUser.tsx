import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, UserPlus, CheckCircle } from 'lucide-react';
import { useAppStore } from "../store/appStore"

const POSITIONS = ['法制室', '涉众办', '资金分析小组', '办公室', '内勤', '分管控领导', '各中队长', '办案民警', '中队内勤'];
const ROLES = ['管理员', '部门主管', '普通用户'];

interface Props { onClose: () => void; }

export default function ModalNewUser({ onClose }: Props) {
    const showToast = useAppStore((s) => s.showToast);
  const [form, setForm] = useState({ name: '', badge: '', position: '', role: '', account: '', pwd: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handle = () => {
    if (!form.name || !form.badge || !form.position || !form.role || !form.account || !form.pwd) {
      showToast('请填写所有必填项', 'warning'); return;
    }
    if (form.badge.length !== 8) { showToast('警号必须为8位', 'warning'); return; }
    if (form.pwd.length < 6) { showToast('密码需6位以上', 'warning'); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); }, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, width: 'min(480px, 95vw)', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}
      >
        {!done ? (
          <>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>新建用户</div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9CA3AF' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="姓名 *" value={form.name} onChange={v => set('name', v)} placeholder="真实姓名" />
                <Field label="警号 *" value={form.badge} onChange={v => set('badge', v)} placeholder="8位警号" maxLen={8} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FieldSelect label="岗位 *" value={form.position} onChange={v => set('position', v)} options={POSITIONS} placeholder="请选择岗位" />
                <FieldSelect label="角色 *" value={form.role} onChange={v => set('role', v)} options={ROLES} placeholder="请选择角色" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="登录账号 *" value={form.account} onChange={v => set('account', v)} placeholder="设置账号" />
                <Field label="登录密码 *" value={form.pwd} onChange={v => set('pwd', v)} placeholder="6位以上" type="password" />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onClose}
                style={{ height: 36, padding: '0 20px', background: '#fff', color: '#6B7280', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>取消</motion.button>
              <motion.button whileHover={{ scale: 1.02, boxShadow: '0 4px 14px rgba(27,94,155,.3)' }} whileTap={{ scale: 0.97 }}
                onClick={handle} disabled={loading}
                style={{ height: 36, padding: '0 24px', background: '#2E7DCA', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.8 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserPlus size={14} />{loading ? '创建中...' : '创建用户'}
              </motion.button>
            </div>
          </>
        ) : (
          <div style={{ padding: '40px 22px', textAlign: 'center' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ width: 72, height: 72, borderRadius: '50%', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle size={36} color="#388E3C" />
            </motion.div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1F2937', marginBottom: 8 }}>用户创建成功！</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 28 }}>账号已创建，请告知用户登录使用</div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={onClose}
              style={{ height: 38, padding: '0 32px', background: '#2E7DCA', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              完成
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLen }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; maxLen?: number }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} maxLength={maxLen} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', height: 38, padding: '0 10px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', display: 'block', marginBottom: 5 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', height: 38, padding: '0 10px', border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}>
        <option value="">{placeholder}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}
