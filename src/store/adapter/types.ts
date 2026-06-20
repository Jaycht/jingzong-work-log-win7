/**
 * 存储适配器接口
 * 抽象 localStorage/IndexedDB/后端 API 的统一读写操作
 */

export interface StorageAdapter {
  /** 读取 JSON 数据，解析失败返回 fallback */
  getItem<T>(key: string, fallback: T): T;

  /** 写入 JSON 数据 */
  setItem(key: string, value: unknown): void;

  /** 删除键 */
  removeItem(key: string): void;

  /** 获取所有匹配前缀的键 */
  keys(prefix?: string): string[];

  /** 估算数据大小（字节） */
  estimateSize(prefix?: string): number;

  /** 清除所有匹配前缀的数据 */
  clear(prefix?: string): void;
}
