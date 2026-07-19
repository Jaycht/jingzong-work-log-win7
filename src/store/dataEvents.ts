import { useEffect, useState } from 'react';
import { indexedDBAdapter } from './adapter';

const DATA_CHANGED_EVENT = 'jingzong:data-changed';

/**
 * 通知各页面“底层业务数据已变更”。
 * 在新建 / 更新 / 删除记录，或恢复备份后调用，
 * 让依赖 getMassRecords() 的组件重新读取最新数据。
 */
export function notifyDataChanged(): void {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
}

/**
 * 返回一个在以下情况会自增的“数据版本号”：
 *  - IndexedDB 就绪（首屏业务数据变为可读）
 *  - 收到 notifyDataChanged 事件（数据被改动 / 备份恢复）
 *
 * 组件可将其作为 useMemo 的依赖，确保挂载时若 IndexedDB 尚未就绪、
 * 一旦就绪（或数据被改动）即重新读取，避免“首页统计/预警永远为 0”的问题。
 */
export function useDataChanged(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const bump = () => {
      if (active) setVersion((v) => v + 1);
    };
    window.addEventListener(DATA_CHANGED_EVENT, bump);
    indexedDBAdapter.whenReady().then(bump);
    return () => {
      active = false;
      window.removeEventListener(DATA_CHANGED_EVENT, bump);
    };
  }, []);

  return version;
}
