import type { FieldDefinition, FieldType } from './types';

export const f = (id: string, label: string, type: FieldType = 'text', required = false, options?: string[], customOptionKey?: string, multiple?: boolean): FieldDefinition => ({
  id,
  label,
  type,
  required,
  options,
  customOptionKey,
  multiple,
});

export const section = (label: string, repeatable = false, listName?: string): FieldDefinition => ({
  id: `__section_${label}`,
  label,
  type: 'section',
  repeatable,
  listName,
});

export const commonTail = [
  f('handler', '经办人', 'text', false),
  f('attachment', '附件材料', 'attachment'),
];
