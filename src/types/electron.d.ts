// Electron 主进程预加载脚本暴露的 API 类型（M-14：从 App.tsx 收敛到单一声明）
// 任何对 electron/preload.cjs 的签名改动都应同步更新此处，否则编译期即可发现。
// 注意：本文件必须与 src 内所有 window.electronAPI.* 的实际调用保持一致，
// 缺失的方法会导致去除 `as any` 后编译报错。当前已覆盖全部被调用的 API。

export {};

declare global {
  interface Window {
    // M-15：收敛 (window as any).electronAPI 后，此处声明为非可选。
    // 本应用为 Electron 主场景，preload 在 renderer 加载前必挂载 electronAPI；
    // 纯浏览器/jsdom 下虽运行时可能为 undefined，但所有调用点均由 isElectron() 守卫，
    // 故按 as any 时代相同的"始终存在"语义声明，避免去 any 后引入额外的严格空值报错。
    electronAPI: {
      resizeToMain: () => void;
      resizeToLogin: () => void;
      isElectron: boolean;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      saveAttachmentFile: (buffer: number[], fileName: string, moduleId: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      readAttachmentFile: (filePath: string) => Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>;
      deleteAttachmentFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      checkAttachmentFile: (filePath: string) => Promise<{ success: boolean; exists: boolean; error?: string }>;
      getAttachmentsDir: () => Promise<string>;
      showSaveDialog: (defaultName: string, buffer: number[]) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }>;
      // 以下为 M-15 补全：此前未在 d.ts 声明，导致 Backup/SystemSettings/DailyNotes/
      // useReminderService 等处的直接调用（及去除 as any 后）编译报错。
      getDocumentsDir: () => Promise<string>;
      showDirectoryDialog: () => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
      setAttachmentsPath: (newPath: string) => Promise<{ success: boolean; error?: string }>;
      onTriggerQuitBackup: (callback: () => void) => () => void;
      getAutoStart: () => Promise<boolean>;
      setAutoStart: (enabled: boolean) => Promise<boolean>;
      setCloseBehavior: (behavior: 'exit' | 'tray' | 'ask') => void;
      createNoteWindow: (noteData: { id: string; title: string; text: string; date: string; type?: string; priority?: string }) => Promise<{ success: boolean; error?: string }>;
      // 提醒系统（M-15：去除 as any 后 useReminderService/DailyNotes 的调用需要真实签名）
      showReminder: (title: string, body: string, soundFile: string, noteId: string, extra?: { type?: string; priority?: string; date?: string }) => Promise<{ success: boolean; error?: string }>;
      cancelReminder: (id: string) => Promise<{ success: boolean; error?: string }>;
      onNoteContentChanged: (callback: (data: { id: string; text: string }) => void) => () => void;
      // 文件导出（M-15：Backup.tsx 调用，去除 as any 后需声明）
      saveJsonFile: (json: string, fileName: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      onReminderSnoozed: (callback: (data: { minutes: number; noteId: string }) => void) => () => void;
      onReminderDismissed: (callback: (data: { noteId: string }) => void) => () => void;
    };
  }
}

// Electron 专用 CSS 属性（无头窗体拖拽区），@types/react 未包含，这里增强 CSSProperties。
declare module "react" {
  interface CSSProperties {
    WebkitAppRegion?: "drag" | "no-drag";
  }
}
