import type { FieldDefinition } from './types';
import { f, commonTail } from './fieldHelpers';
import { officeFields } from './fields/office';
import { legalFields } from './fields/legal';
import { massFields } from './fields/mass';
import { evidenceFields } from './fields/evidence';
import { squadFields } from './fields/squad';

export function fieldsFor(moduleId: string, tab: string): FieldDefinition[] {
  const byDepartment: Array<(moduleId: string, tab: string) => FieldDefinition[] | undefined> = [
    officeFields, legalFields, massFields, evidenceFields, squadFields,
  ];
  for (const get of byDepartment) {
    const fields = get(moduleId, tab);
    if (fields) return fields;
  }


  if (moduleId.includes('case') || tab.includes('案件')) {
    return [f('caseNo', '案件编号'), f('caseName', '案件名称', 'text', false), f('caseType', '案件类型'), f('caseSource', '案件来源'), f('amount', '涉案金额（万元）', 'number'), f('undertaker', '承办人'), f('progress', '当前进展', 'textarea'), ...commonTail];
  }

  if (tab.includes('会议') || tab.includes('学习') || tab.includes('培训')) {
    return [f('meetingName', '会议/学习/培训名称', 'text', false), f('meetingDate', '时间', 'date', false), f('place', '地点'), f('participants', '参会人员', 'textarea'), f('spirit', '会议精神/学习内容', 'textarea', false), f('implementation', '落实要求', 'textarea'), ...commonTail];
  }

  return [
    f('matterName', `${tab}事项`, 'text', false),
    f('recordDate', '记录日期', 'date', false),
    f('relatedPeople', '相关人员'),
    f('details', '具体内容', 'textarea', false),
    f('implementation', '落实情况', 'textarea'),
    ...commonTail,
  ];
}
