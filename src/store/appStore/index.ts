import { create } from "zustand";
import type { AppState } from "./types";
import { createSessionSlice } from "./sessionSlice";
import { createUiSlice } from "./uiSlice";
import { createEditSlice } from "./editSlice";

// appStore 按领域拆为三个 slice（session / ui / edit），对外 useAppStore 及所有
// 字段、action 名称保持不变，32 个调用点无需改动。
export const useAppStore = create<AppState>()((...a) => ({
  ...createSessionSlice(...a),
  ...createUiSlice(...a),
  ...createEditSlice(...a),
}));

// 保留原具名导出，供 App.tsx 等直接使用
export {
  saveUserToStorage,
  loadUserFromStorage,
  clearUserFromStorage,
} from "./sessionSlice";
export type { AppState } from "./types";
