/**
 * 页面级骨架屏（L-14）
 * 复用 index.css 中已定义但此前未使用的 .skeleton / .skeleton-title /
 * .skeleton-text / .skeleton-card 工具类，作为路由懒加载时的占位反馈，
 * 替代原先的 Spin 加载态，提升首屏/路由切换时的感知性能。
 */
export default function PageSkeleton() {
  return (
    <div style={{ padding: 4 }}>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-card" style={{ marginBottom: 16 }} />
      <div className="skeleton skeleton-card" style={{ marginBottom: 16, height: 160 }} />
      <div className="skeleton skeleton-text" style={{ width: "92%" }} />
      <div className="skeleton skeleton-text" style={{ width: "84%" }} />
      <div className="skeleton skeleton-text" style={{ width: "70%" }} />
    </div>
  );
}
