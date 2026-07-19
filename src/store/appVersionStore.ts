/**
 * 版本管理存储
 * 版本号从 ../version 统一读取，每次修改递增
 */

import { APP_VERSION, VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH, CHANGELOG } from '../version';
import { localStorageAdapter } from './adapter';

const STORAGE_KEY = 'jingzong.version.v1';

export interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
  updatedAt: string;
  changelog: string[];
}

const DEFAULT_VERSION: VersionInfo = {
  version: APP_VERSION,
  major: VERSION_MAJOR,
  minor: VERSION_MINOR,
  patch: VERSION_PATCH,
  updatedAt: new Date().toISOString().slice(0, 10),
  changelog: [...CHANGELOG],
};

/** 返回 DEFAULT_VERSION 的深拷贝，避免外部（含 bumpVersion）污染模块级常量（M-3） */
function cloneDefaultVersion(): VersionInfo {
  return { ...DEFAULT_VERSION, changelog: [...DEFAULT_VERSION.changelog] };
}

function loadVersion(): VersionInfo {
  // 注意：fallback 必须为 null 再克隆，绝不能把 DEFAULT_VERSION 常量本身作为返回值，
  // 否则 bumpVersion 对其 patch+=1 会污染共享常量（原 bug）。
  const stored = localStorageAdapter.getItem<VersionInfo | null>(STORAGE_KEY, null);
  const parsed: VersionInfo = stored ?? cloneDefaultVersion();

  // 确保 changelog 存在且有效
  if (!parsed.changelog || !Array.isArray(parsed.changelog)) {
    parsed.changelog = [...CHANGELOG];
  }

  // 强制同步：如果版本号不匹配 或 changelog 条目数量不匹配，都更新
  const versionMismatch = parsed.version !== APP_VERSION;
  const changelogMismatch = parsed.changelog.length !== CHANGELOG.length;

  if (versionMismatch || changelogMismatch) {
    const fixed: VersionInfo = {
      version: APP_VERSION,
      major: VERSION_MAJOR,
      minor: VERSION_MINOR,
      patch: VERSION_PATCH,
      updatedAt: new Date().toISOString().slice(0, 10),
      changelog: [...CHANGELOG],
    };
    localStorageAdapter.setItem(STORAGE_KEY, fixed);
    return fixed;
  }

  return parsed;
}

function saveVersion(v: VersionInfo): void {
  localStorageAdapter.setItem(STORAGE_KEY, v);
}

/** 获取当前版本信息 */
export function getCurrentVersion(): VersionInfo {
  // 每次都重新检查版本号，确保 changelog 始终与源码同步。
  // 返回深拷贝，避免调用方意外污染存储对象（M-3）。
  const v = loadVersion();
  return { ...v, changelog: [...v.changelog] };
}

/** 递增版本号（patch+1），并记录变更 */
export function bumpVersion(changeDescription?: string): VersionInfo {
  const v = getCurrentVersion();
  v.patch += 1;
  v.version = `V${v.major}.${v.minor}.${v.patch}`;
  v.updatedAt = new Date().toISOString().slice(0, 10);
  if (changeDescription) {
    v.changelog.push(changeDescription);
  }
  saveVersion(v);
  return { ...v };
}

/** 递增 minor 版本号 */
export function bumpMinorVersion(changeDescription?: string): VersionInfo {
  const v = getCurrentVersion();
  v.minor += 1;
  v.patch = 0;
  v.version = `V${v.major}.${v.minor}.${v.patch}`;
  v.updatedAt = new Date().toISOString().slice(0, 10);
  if (changeDescription) {
    v.changelog.push(changeDescription);
  }
  saveVersion(v);
  return { ...v };
}

/** 设置版本说明并保存 */
export function setVersionChangelog(entry: string): void {
  const v = getCurrentVersion();
  v.changelog.push(entry);
  saveVersion(v);
}
