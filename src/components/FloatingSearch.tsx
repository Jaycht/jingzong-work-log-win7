/**
 * 可拖动全局搜索按钮
 * 支持拖拽定位 + 点击打开命令面板
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Search } from 'lucide-react';

interface Props {
  onClick: () => void;
}

export default function FloatingSearch({ onClick }: Props) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [initialized, setInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMoved = useRef(false);

  // 初始化位置（右下角）
  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
    setInitialized(true);
    const onResize = () => {
      setPos(p => ({
        x: Math.min(p.x, window.innerWidth - 70),
        y: Math.min(p.y, window.innerHeight - 70),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    hasMoved.current = false;
    startRef.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, startRef.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, startRef.current.posY + dy)),
      });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      if (!hasMoved.current) onClick();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onClick]);

  if (!initialized) return null;

  return (
    <div
      ref={dragRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        width: 56,
        height: 56,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #A78BFA)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: '0 8px 32px rgba(99,102,241,0.4), 0 0 0 3px rgba(99,102,241,0.15)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s, transform 0.2s',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.5), 0 0 0 4px rgba(99,102,241,0.2)';
          e.currentTarget.style.transform = 'scale(1.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.4), 0 0 0 3px rgba(99,102,241,0.15)';
          e.currentTarget.style.transform = 'scale(1)';
        }
      }}
    >
      <Search size={22} strokeWidth={2.5} />
    </div>
  );
}
