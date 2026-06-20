import { motion } from 'framer-motion';
import { FileText, Plus } from 'lucide-react';
import { useAppStore } from "../store/appStore"

export default function PlaceholderPage() {
    const openModal = useAppStore((s) => s.openModal);
  const showToast = useAppStore((s) => s.showToast);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #EBF5FF, #E8F5E9)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}
      >
        <FileText size={36} color="#1B5E9B" style={{ opacity: 0.6 }} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1F2937', marginBottom: 8 }}>功能模块开发中</div>
        <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24, maxWidth: 360, lineHeight: 1.7 }}>
          此模块正在紧张开发中，即将上线。<br />您可以先在「工作台」新建记录，或联系管理员。
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 4px 14px rgba(27,94,155,.3)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => openModal('newRecord')}
            style={{ height: 38, padding: '0 20px', background: '#2E7DCA', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
          >
            <Plus size={15} />新建工作记录
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => showToast('感谢您的耐心等待！', 'info')}
            style={{ height: 38, padding: '0 20px', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            返回工作台
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
