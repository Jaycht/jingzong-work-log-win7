export const APP_VERSION = "V2.41.22";
export const VERSION_MAJOR = 2;
export const VERSION_MINOR = 41;
export const VERSION_PATCH = 22;

export const CHANGELOG: string[] = [
  "V2.41.22 新增 - 从 Win10 版 V2.41.22 同步衍生 Win7 兼容版（锁定 Electron 22 / Chromium 108），一次性继承其全部功能与新改动：① 文书库模块（79 份公安行政/刑事法律文书式样空白模板，支持分类/搜索/预览/下载）；② 串并案自动识别（CaseLinkage 分析页 + 工作台线索面板）；③ 趋势与绩效分析（办案趋势双轴图 + 经办人绩效）；④ 受害人信息 CSV 导出（格式修复：表头与每条信息分行、落入对应表头列）；⑤ 附件保存路径自定义（运行时可变目录 + 保留旧目录可读，UI 显示当前真实路径）；⑥ 系统托盘图标内联 base64（彻底摆脱打包后路径错乱）；⑦ 随手记卡片保存后即时刷新（返回副本强制重渲染）；⑧ 桌面便签直角处理、全局搜索框最大化居中、关闭窗口行为默认「每次询问」；⑨ UI 大厂风格（飞书/Notion/Linear 式）高级感重设计；⑩ 同步移除自动更新（离线项目不应联网检查/下载/安装更新）",
  "V2.41.22 修复 - Win7 专属适配（不影响 Win10 版）：① vite 构建目标显式降级 chrome108，否则默认 esnext 输出在 Chromium 108 解析失败导致白屏；② 桌面便签与提醒浮窗移除半透明磨砂效果（窗口 transparent:false + 不透明实色背景，去除 backdrop-filter），避免 Win7 Basic/经典主题下透明窗口出现黑底、文字不可读；③ 保留 Electron 22 与 electron-builder 24.13.3 以兼容 Win7，且不引入 electron-updater",
];
