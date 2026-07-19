import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 典法查阅：用户收藏与条文笔记（纯本地离线，持久化到 localStorage）
// - favorites: 收藏的法规 id 集合（值为 true 表示收藏）
// - notes: 条文级笔记，key = `${lawId}#${articleNum}`（如 "刑事/刑法#第1条之一"）
interface LawPrefsState {
  favorites: Record<string, true>;
  notes: Record<string, string>;
  toggleFavorite: (lawId: string) => void;
  setNote: (key: string, text: string) => void;
}

export const useLawPrefsStore = create<LawPrefsState>()(
  persist(
    (set) => ({
      favorites: {},
      notes: {},
      toggleFavorite: (lawId) =>
        set((s) => {
          const f = { ...s.favorites };
          if (f[lawId]) delete f[lawId];
          else f[lawId] = true;
          return { favorites: f };
        }),
      setNote: (key, text) =>
        set((s) => {
          const n = { ...s.notes };
          if (text.trim()) n[key] = text;
          else delete n[key];
          return { notes: n };
        }),
    }),
    { name: 'jingzong.lawPrefs' }
  )
);

// 笔记 key 生成：法规 id + 条号
export const noteKey = (lawId: string, articleNum: string) => `${lawId}#${articleNum}`;
