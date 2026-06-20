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

function loadVersion(): VersionInfo {
  const parsed = localStorageAdapter.getItem<VersionInfo>(STORAGE_KEY, DEFAULT_VERSION);

  // 确保 changelog 存在且有效
  if (!parsed.changelog || !Array.isArray(parsed.changelog)) {
    parsed.changelog = [...CHANGELOG];
  }

  // 强制同步：如果版本号不匹配 或 changelog 条目数量不匹配，都更新
  const versionMismatch = parsed.version !== APP_VERSION;
  const changelogMismatch = parsed.changelog.length !== CHANGELOG.length;

  if (versionMismatch || changelogMismatch) {
    parsed.version = APP_VERSION;
    parsed.major = VERSION_MAJOR;
    parsed.minor = VERSION_MINOR;
    parsed.patch = VERSION_PATCH;
    parsed.updatedAt = new Date().toISOString().slice(0, 10);
    parsed.changelog = [...CHANGELOG];
    localStorageAdapter.setItem(STORAGE_KEY, parsed);
  }

  return parsed;
}

function saveVersion(v: VersionInfo): void {
  localStorageAdapter.setItem(STORAGE_KEY, v);
}

let _versionCache: VersionInfo | null = null;

/** 获取当前版本信息 */
export function getCurrentVersion(): VersionInfo {
  // 每次都重新检查版本号，确保 changelog 始终与源码同步
  return loadVersion();
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
  _versionCache = v;
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
  _versionCache = v;
  return { ...v };
}

/** 设置版本说明并保存 */
export function setVersionChangelog(entry: string): void {
  const v = getCurrentVersion();
  v.changelog.push(entry);
  saveVersion(v);
  _versionCache = v;
}
