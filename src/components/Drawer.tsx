import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import { useAppStore } from "../store/appStore"
import EmptyState from "./EmptyState";

interface Props { onClose: () => void; }

export default function Drawer({ onClose }: Props) {
  const showToast = useAppStore((s) => s.showToast);

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(2px)', zIndex: 500 }}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 38 }}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(480px, 95vw)',
          background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
          zIndex: 501, display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>详情面板</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>选中一条记录以查看详情</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Content - Empty State */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState
            icon={<FileText size={40} color="#D1D5DB" />}
            title="暂无详情"
            description="在列表中点击「查看」按钮可浏览完整的记录详情、时间线和操作历史。"
          />
        </div>

        {/* Footer actions - placeholder */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8 }}>
          <button
            onClick={() => showToast('请先选择一条记录', 'info')}
            style={{
              flex: 1, height: 38, borderRadius: 8, border: '1.5px solid #E5E7EB',
              background: '#fff', color: '#6B7280',
              fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            查看
          </button>
          <button
            onClick={() => showToast('请先选择一条记录', 'info')}
            style={{
              flex: 1, height: 38, borderRadius: 8, border: '1.5px solid #E5E7EB',
              background: '#fff', color: '#6B7280',
              fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            编辑
          </button>
        </div>
      </motion.div>
    </>
  );
}
