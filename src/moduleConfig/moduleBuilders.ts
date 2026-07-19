import type React from 'react';
import type { WorkModule } from './types';
import { fieldsFor } from './fieldSchemas';

type IconComponent = React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;

export const module = (
  departmentId: string,
  departmentLabel: string,
  id: string,
  label: string,
  description: string,
  tabs: string[],
  icon?: IconComponent,
): WorkModule => ({
  id,
  label,
  departmentId,
  departmentLabel,
  description,
  icon,
  tabs: tabs.map((tab, index) => ({
    id: `${id}-${index + 1}`,
    label: tab,
    fields: fieldsFor(id, tab),
  })),
});

export const singleModule = (
  departmentId: string,
  departmentLabel: string,
  id: string,
  label: string,
  description: string,
  tab: string,
  hideTemplateSelector = true,
  icon?: IconComponent,
): WorkModule => ({
  id,
  label,
  departmentId,
  departmentLabel,
  description,
  hideTemplateSelector,
  icon,
  tabs: [{ id: `${id}-1`, label: tab, fields: fieldsFor(id, tab) }],
});
