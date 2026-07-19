import type React from 'react';

export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'attachment' | 'section';

export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  customOptionKey?: string;
  repeatable?: boolean;
  listName?: string;
  multiple?: boolean;
  /** 对指定角色隐藏此字段（角色名称数组，如 ['普通用户']） */
  hiddenForRoles?: string[];
}

export interface WorkTab {
  id: string;
  label: string;
  fields?: FieldDefinition[];
}

export interface WorkModule {
  id: string;
  label: string;
  departmentId: string;
  departmentLabel: string;
  description: string;
  iconName?: string;
  /** 小项目独立图标，未设置时回退到大项目（部门）图标 */
  icon?: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  hideTemplateSelector?: boolean;
  tabs: WorkTab[];
}

export interface NavDepartment {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  modules: WorkModule[];
}
