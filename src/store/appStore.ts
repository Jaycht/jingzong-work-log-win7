import { create } from "zustand";
import type { PageId, Toast, ToastType } from "../types";
import type { MassRecord } from "./massStore";
import { localStorageAdapter } from "./adapter";

let toastId = 0;

interface AppState {
  // View
  view: "login" | "register" | "app";
  setView: (v: "login" | "register" | "app") => void;

  // User
  userName: string;
  userRole: string;
  setUser: (name: string, role: string) => void;

  // Page
  currentPage: PageId;
  setCurrentPage: (p: PageId) => void;

  // Toast
  toasts: Toast[];
  showToast: (msg: string, type?: ToastType) => void;
  removeToast: (id: string) => void;

  // Modal
  modalId: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;

  // Drawer
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Low Performance Mode
  lowPerfMode: boolean;
  toggleLowPerfMode: () => void;

  // Current active tab (synced from ModulePage for DrawerNewRecord)
  currentTabId: string;
  setCurrentTabId: (tabId: string) => void;

  // Edit
  editRecord: MassRecord | null;
  setEditRecord: (r: MassRecord | null) => void;
}

// 用户信息持久化
const USER_STORAGE_KEY = 'jingzong.currentUser.v1';

export function saveUserToStorage(name: string, role: string): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ name, role }));
  } catch { /* ignore */ }
}

export function loadUserFromStorage(): { name: string; role: string } | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearUserFromStorage(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch { /* ignore */ }
}

export const useAppStore = create<AppState>((set) => ({
  view: "login",
  setView: (view) => set({ view }),

  userName: "",
  userRole: "",
  setUser: (userName, userRole) => {
    if (userName) {
      // 有有效用户名时才持久化，避免空值覆盖
      saveUserToStorage(userName, userRole);
    } else {
      clearUserFromStorage();
    }
    set({ userName, userRole });
  },

  currentPage: "dashboard",
  setCurrentPage: (currentPage) => set({ currentPage }),

  toasts: [],
  showToast: (message, type = "info") => {
    const id = String(++toastId);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3200);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  modalId: null,
  openModal: (modalId) => set({ modalId }),
  closeModal: () => set({ modalId: null }),

  drawerOpen: false,
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  // 深色模式
  darkMode: localStorageAdapter.getItem("jingzong.darkMode", false),
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.darkMode;
      localStorageAdapter.setItem("jingzong.darkMode", next);
      return { darkMode: next };
    }),

  lowPerfMode: localStorageAdapter.getItem("jingzong.lowPerfMode", false),
  toggleLowPerfMode: () =>
    set((s) => {
      const next = !s.lowPerfMode;
      localStorageAdapter.setItem("jingzong.lowPerfMode", next);
      return { lowPerfMode: next };
    }),

  currentTabId: '',
  setCurrentTabId: (currentTabId) => set({ currentTabId }),

  editRecord: null,
  setEditRecord: (editRecord) => set({ editRecord }),
}));
