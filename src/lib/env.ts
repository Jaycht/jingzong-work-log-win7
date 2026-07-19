// 运行环境判断（M-14：收敛散落的 (window as any).electronAPI?.isElectron 判断）

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
}
