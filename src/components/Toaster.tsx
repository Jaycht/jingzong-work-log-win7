import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import type { Toast, ToastType } from '../types';

const iconMap: Record<ToastType, React.FC<{ size?: number; color?: string }>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: '#388E3C', error: '#D32F2F', warning: '#E67E22', info: '#1B5E9B',
};

const bgMap: Record<ToastType, string> = {
  success: '#E8F5E9', error: '#FFEBEE', warning: '#FFF3E0', info: '#EBF5FF',
};

const borderMap: Record<ToastType, string> = {
  success: '#A5D6A7', error: '#FFCDD2', warning: '#FFE0B2', info: '#BBDEFB',
};

interface Props {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export function Toaster({ toasts, removeToast }: Props) {
  return (
    <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 7 }}>
      <AnimatePresence>
        {toasts.map(toast => {
          const Icon = iconMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 120, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 120, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                background: bgMap[toast.type],
                border: `1.5px solid ${borderMap[toast.type]}`,
                borderLeft: `4px solid ${colorMap[toast.type]}`,
                borderRadius: 8,
                padding: '11px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                boxShadow: '0 4px 16px rgba(0,0,0,.12)',
                minWidth: 280,
                maxWidth: 360,
                cursor: 'pointer',
              }}
              onClick={() => removeToast(toast.id)}
            >
              <Icon size={18} color={colorMap[toast.type]} />
              <span style={{ fontSize: 13, color: '#1F2937', flex: 1 }}>{toast.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
