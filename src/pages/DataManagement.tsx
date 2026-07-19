import { motion } from 'framer-motion';
import { DatabaseBackup } from 'lucide-react';
import ImportExport from './ImportExport';
import Backup from './Backup';
import AutoBackupPanel from '../components/AutoBackupPanel';

export default function DataManagement() {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          style={{
            width: 42,
            height: 42,
            borderRadius: 11,
            background: 'linear-gradient(135deg, #1B5E9B, #2E7DCA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(27,94,155,.3)',
          }}
        >
          <DatabaseBackup size={20} color="#fff" />
        </motion.div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>数据管理</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>
            导入导出、备份恢复与自动备份
          </div>
        </div>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <ImportExport noHeader />
        <AutoBackupPanel />
        <Backup noHeader />
      </div>
    </div>
  );
}
