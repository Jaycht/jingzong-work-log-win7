import { motion } from 'framer-motion';
import { UserCog, Plus, UserCheck, UserX, Edit, Trash2 } from 'lucide-react';
import { useAppStore } from "../store/appStore"
import { MOCK_USERS } from '../data';

const ROLE_MAP: Record<string, { bg: string; color: string }> = {
  admin: { bg: '#EBF5FF', color: '#1B5E9B' },
  supervisor: { bg: '#FFF3E0', color: '#E67E22' },
  user: { bg: '#E8F5E9', color: '#388E3C' },
};

const STATUS_MAP: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: '#E8F5E9', color: '#388E3C', label: '正常' },
  maintenance: { bg: '#FFF3E0', color: '#E67E22', label: '维护中' },
  disabled: { bg: '#FFEBEE', color: '#D32F2F', label: '已禁用' },
};

export default function UserManage() {
    const openModal = useAppStore((s) => s.openModal);
  const showToast = useAppStore((s) => s.showToast);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            style={{ width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(135deg, #1B5E9B, #2E7DCA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(27,94,155,.3)' }}>
            <UserCog size={20} color="#fff" />
          </motion.div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>用户管理</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>系统用户账号管理 · 权限分配 · 状态控制</div>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.04, boxShadow: '0 4px 14px rgba(27,94,155,.3)' }} whileTap={{ scale: 0.97 }}
          onClick={() => openModal('newUser')}
          style={{ height: 34, padding: '0 18px', background: '#2E7DCA', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
          <Plus size={15} />新建用户
        </motion.button>
      </motion.div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {[
          { label: '总用户数', value: '48', color: '#1B5E9B', sub: '本月新增 3 人' },
          { label: '在线用户', value: '32', color: '#38A169', sub: '当前活跃' },
          { label: '维护中', value: '1', color: '#E67E22', sub: '需关注' },
          { label: '已禁用', value: '2', color: '#D32F2F', sub: '已停用' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}
            whileHover={{ y: -3 }}
            className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: s.color + '1A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {i === 0 && <UserCog size={19} color={s.color} />}
              {i === 1 && <UserCheck size={19} color={s.color} />}
              {i === 2 && <UserCog size={19} color={s.color} />}
              {i === 3 && <UserX size={19} color={s.color} />}
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)' }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>{s.value}</div>
              <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>{s.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="panel" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>共 <strong style={{ color: 'var(--color-text)' }}>48</strong> 个用户</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['全部', '正常', '维护中', '已禁用'].map((f, i) => (
              <button key={f} style={{ height: 28, padding: '0 12px', border: '1.5px solid ' + (i === 0 ? 'var(--color-primary)' : 'var(--color-border)'), background: i === 0 ? '#EBF5FF' : 'var(--color-surface)', color: i === 0 ? 'var(--color-primary)' : 'var(--color-text-secondary)', borderRadius: 6, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit' }}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-hover)' }}>
              {['姓名', '警号', '岗位', '角色', '账号状态', '最后登录', '操作'].map((h, i) => (
                <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_USERS.map((u, i) => (
              <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.06 }}
                whileHover={{ background: 'var(--color-surface-hover)' }} style={{ borderBottom: '1px solid var(--color-surface-hover)' }}>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: ROLE_MAP[u.role].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: ROLE_MAP[u.role].color }}>
                      {u.name[0]}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '11px 14px', fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{u.badge}</td>
                <td style={{ padding: '11px 14px', fontSize: 12.5 }}>{u.position}</td>
                <td style={{ padding: '11px 14px', fontSize: 12 }}>
                  <span style={{ padding: '2px 9px', borderRadius: 9, fontSize: 10.5, fontWeight: 600, background: ROLE_MAP[u.role].bg, color: ROLE_MAP[u.role].color }}>{u.roleName}</span>
                </td>
                <td style={{ padding: '11px 14px', fontSize: 12 }}>
                  <span style={{ padding: '2px 9px', borderRadius: 9, fontSize: 10.5, fontWeight: 600, background: STATUS_MAP[u.status].bg, color: STATUS_MAP[u.status].color }}>{STATUS_MAP[u.status].label}</span>
                </td>
                <td style={{ padding: '11px 14px', fontSize: 11.5, color: 'var(--color-text-muted)' }}>{u.lastLogin}</td>
                <td style={{ padding: '11px 14px' }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {[Edit, Trash2].map((Icon, i) => (
                      <motion.button key={i} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => i === 0 ? openModal('newUser') : showToast('确认删除该用户？', 'warning')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 4, color: i === 1 ? '#D32F2F' : 'var(--color-text-muted)', fontSize: 12.5 }}>
                        <Icon size={13} />
                      </motion.button>
                    ))}
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
