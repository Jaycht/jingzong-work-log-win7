import type { StateCreator } from "zustand";
import type { AppState, SessionSlice } from "./types";

const USER_STORAGE_KEY = "jingzong.currentUser.v1";

export interface StoredProfile {
  name: string;
  role: string;
  badge?: string;
  phone?: string;
  department?: string;
}

export function saveUserToStorage(profile: StoredProfile): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function loadUserFromStorage(): StoredProfile | null {
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
  } catch {
    /* ignore */
  }
}

export const createSessionSlice: StateCreator<AppState, [], [], SessionSlice> = (set, get) => ({
  view: "login",
  setView: (view) => set({ view }),

  userName: "",
  userRole: "",
  userBadge: "",
  userPhone: "",
  userDepartment: "",
  setUser: (userName, userRole, extra) => {
    const profile: StoredProfile = {
      name: userName,
      role: userRole,
      badge: extra?.badge ?? get().userBadge,
      phone: extra?.phone ?? get().userPhone,
      department: extra?.department ?? get().userDepartment,
    };
    if (userName) {
      // 有有效用户名时才持久化，避免空值覆盖
      saveUserToStorage(profile);
    } else {
      clearUserFromStorage();
    }
    set({
      userName,
      userRole,
      userBadge: profile.badge ?? "",
      userPhone: profile.phone ?? "",
      userDepartment: profile.department ?? "",
    });
  },
  setUserProfile: (p) => {
    const profile: StoredProfile = {
      name: p.name ?? get().userName,
      role: get().userRole,
      badge: p.badge ?? get().userBadge,
      phone: p.phone ?? get().userPhone,
      department: p.department ?? get().userDepartment,
    };
    saveUserToStorage(profile);
    set({
      userName: profile.name,
      userBadge: profile.badge ?? "",
      userPhone: profile.phone ?? "",
      userDepartment: profile.department ?? "",
    });
  },

  currentPage: "dashboard",
  setCurrentPage: (currentPage) => set({ currentPage }),
});
