import { motion } from "framer-motion";
import type React from "react";

interface Props {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "60px 20px", gap: 12,
      }}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        style={{ color: "#D1D5DB", marginBottom: 4 }}
      >
        {icon || (
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="12" y="8" width="40" height="48" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="#F9FAFB" />
            <line x1="20" y1="22" x2="44" y2="22" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="30" x2="38" y2="30" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
            <line x1="20" y1="38" x2="42" y2="38" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </motion.div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#6B7280" }}>{title || "暂无数据"}</div>
      {description && <div style={{ fontSize: 12.5, color: "#9CA3AF", textAlign: "center", maxWidth: 300 }}>{description}</div>}
      {action && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={action.onClick}
          style={{
            marginTop: 8, padding: "8px 20px", background: "#155A8A", color: "#fff",
            border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}
