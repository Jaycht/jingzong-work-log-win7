import type { FieldDefinition } from './types';
import { DEPARTMENTS } from './departments';

export type { FieldType, FieldDefinition, WorkTab, WorkModule, NavDepartment } from './types';
export { DEPARTMENTS, PLATFORM_NAV, ICONS } from './departments';

export const getBaseModules = () => DEPARTMENTS.flatMap((dept) => dept.modules);

export const findModule = (id: string, modules = getBaseModules()) => modules.find((item) => item.id === id);

/** 检查字段对当前用户是否可见 */
export function isFieldVisible(field: FieldDefinition, userRole: string): boolean {
  if (!field.hiddenForRoles || field.hiddenForRoles.length === 0) return true;
  return !field.hiddenForRoles.includes(userRole);
}

/** 过滤出当前用户可见的字段列表 */
export function filterVisibleFields(fields: FieldDefinition[], userRole: string): FieldDefinition[] {
  return fields.filter((f) => isFieldVisible(f, userRole));
}

/** 模块ID → { label, dept }，从 DEPARTMENTS 自动派生，单一数据源 */
export const MODULE_INFO: Record<string, { label: string; dept: string }> = (() => {
  const map: Record<string, { label: string; dept: string }> = {};
  for (const dept of DEPARTMENTS) {
    for (const mod of dept.modules) {
      map[mod.id] = { label: mod.label, dept: dept.label };
    }
  }
  return map;
})();

/** 模块ID → 简短中文名（如 "经费保障"、"涉众线索"），用于 Dashboard/Statistics 等场景 */
export const MODULE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_INFO).map(([id, info]) => [id, info.label])
);
