import type { StateCreator } from "zustand";
import type { AppState, EditSlice } from "./types";

export const createEditSlice: StateCreator<AppState, [], [], EditSlice> = (set) => ({
  // Current active tab (synced from ModulePage for DrawerNewRecord)
  currentTabId: "",
  setCurrentTabId: (currentTabId) => set({ currentTabId }),

  // Edit
  editRecord: null,
  setEditRecord: (editRecord) => set({ editRecord }),
});
