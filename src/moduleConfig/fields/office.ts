import type { FieldDefinition } from '../types';
import { f, commonTail } from '../fieldHelpers';

export function officeFields(moduleId: string, tab: string): FieldDefinition[] | undefined {
  if (moduleId === 'office-finance-assets') {
    const map: Record<string, FieldDefinition[]> = {
      经费报账: [
        f('expenseCategory', '报账类目', 'select', false, [
          '办公经费',
          '差旅费',
          '业务经费',
          '其他经费',
        ], 'office.expenseCategory'),
        f('handler', '经办人', 'text', false),
        f('traveler', '出差人'),
        f('caseName', '经办案件'),
        f('fundCategory', '经费类目', 'select', false, ['案件办理', '外调取证', '研判分析', '宣传防范', '其他'], 'office.fundCategory'),
        f('expenseDate', '报账日期', 'date', false),
        f('amount', '报账金额（元）', 'number', false),
        f('summary', '用途摘要', 'textarea', false),
        f('reimburseStatus', '报销状态', 'select', false, ['已报销', '待报销']),
        f('attachment', '附件材料', 'attachment'),
      ],
      党费管理: [f('partyMember', '党员姓名', 'text', false), f('period', '缴纳月份', 'select', false, ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']), f('amount', '缴纳金额（元）', 'number', false), f('payMethod', '缴纳方式', 'select', false, ['现金', '转账', '代扣']), f('publicity', '公示情况', 'textarea'), ...commonTail],
      公务往来: [f('contactObject', '往来对象', 'text', false), f('matterDate', '发生时间', 'date', false), f('reason', '往来事由', 'textarea', false), f('standard', '执行标准'), f('participants', '相关人员'), ...commonTail],
      福利发放: [f('benefitName', '福利名称', 'text', false), f('standard', '发放标准'), f('grantDate', '发放时间', 'date', false), f('recipients', '发放名单', 'textarea', false), f('signStatus', '领取签字情况'), ...commonTail],
      物资采购: [f('itemName', '物资名称', 'text', false), f('spec', '规格型号'), f('quantity', '数量', 'number', false), f('unitPrice', '单价（元）', 'number'), f('supplier', '供应商'), f('acceptance', '验收情况', 'textarea'), ...commonTail],
      固定资产: [f('assetName', '资产名称', 'text', false), f('assetNo', '资产编号'), f('actionType', '登记类型', 'select', false, ['购置', '领用', '维修', '报废']), f('responsiblePerson', '责任人'), f('actionDate', '发生日期', 'date', false), f('details', '情况说明', 'textarea'), ...commonTail],
    };
    return map[tab] || map.经费报账;
  }

  if (moduleId === 'office-cluster') {
    return [
      f('battleName', '战役名称', 'text', false),
      f('battleNo', '战役编号', 'text', false),
      f('battleType', '战役类型', 'select', false, ['集群', '协同', '协查']),
      f('issueDate', '下发日期', 'date', false),
      f('distribution', '分发情况', 'textarea', false),
      f('result', '战果', 'textarea'),
      f('feedbackStatus', '是否反馈', 'select', false, ['已反馈', '未反馈']),
      f('feedbackDate', '反馈日期', 'date'),
      f('feedbackResult', '反馈结果', 'textarea'),
      f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充']),
      ...commonTail,
    ];
  }

  if (moduleId === 'office-other') {
    return [
      f('matterName', '事项名称', 'text', false),
      f('recordDate', '记录日期', 'date', false),
      f('relatedPeople', '相关人员'),
      f('details', '具体内容', 'textarea', false),
      f('implementation', '落实情况', 'textarea'),
      ...commonTail,
    ];
  }

  if (moduleId === 'office-party-attendance') {
    const map: Record<string, FieldDefinition[]> = {
      三会一课: [
        f('meetingName', '会议名称', 'text', false),
        f('meetingType', '会议类别', 'select', false, ['支部党员大会', '支部委员会', '党小组会', '党课'], 'office.party.meetingType'),
        f('meetingDate', '时间', 'date', false),
        f('host', '主持人'),
        f('recorder', '记录人'),
        f('participants', '参会人员', 'textarea', false),
        f('content', '主要内容', 'textarea'),
        f('attendance', '出勤情况', 'textarea'),
        ...commonTail,
      ],
      主题党日: [
        f('themeName', '活动主题', 'text', false),
        f('activityDate', '活动时间', 'date', false),
        f('location', '活动地点'),
        f('organizer', '组织人'),
        f('participants', '参与人员', 'textarea', false),
        f('content', '活动内容', 'textarea'),
        f('summary', '活动总结', 'textarea'),
        ...commonTail,
      ],
      组织生活: [
        f('lifeName', '组织生活名称', 'text', false),
        f('lifeDate', '时间', 'date', false),
        f('lifeType', '类型', 'select', false, ['民主生活会', '组织生活会', '民主评议党员'], 'office.party.lifeType'),
        f('participants', '参会人员', 'textarea', false),
        f('opinions', '批评与自我批评意见', 'textarea'),
        f('rectification', '整改承诺', 'textarea'),
        ...commonTail,
      ],
      党员管理: [
        f('memberName', '党员姓名', 'text', false),
        f('gender', '性别', 'select', false, ['男', '女']),
        f('partyPosition', '党内职务', 'select', false, ['书记', '副书记', '委员', '党员'], 'office.party.position'),
        f('joinDate', '入党时间', 'date'),
        f('partyStatus', '党员状态', 'select', false, ['在岗', '借调', '退休', '离职'], 'office.party.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      考勤登记: [
        f('attendanceDate', '考勤日期', 'date', false),
        f('attendanceType', '考勤类型', 'select', false, ['上班考勤', '会议考勤', '学习考勤', '值班考勤'], 'office.attendance.type'),
        f('personnel', '出勤人员', 'textarea', false),
        f('absentPersonnel', '缺勤人员', 'textarea'),
        f('attendanceResult', '出勤状态', 'select', false, ['正常', '迟到', '缺勤', '请假'], 'office.attendance.result'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      值班加班: [
        f('dutyDate', '值班/加班日期', 'date', false),
        f('dutyType', '类型', 'select', false, ['值班', '加班']),
        f('dutyPerson', '值班人/加班人', 'textarea', false),
        f('dutyPeriod', '时段', 'textarea'),
        f('dutyContent', '值班/加班事项', 'textarea'),
        f('handover', '交接情况', 'textarea'),
        ...commonTail,
      ],
    };
    return map[tab] || map['三会一课'];
  }

  if (moduleId === 'office-doc-report') {
    const map: Record<string, FieldDefinition[]> = {
      涉密文件: [
        f('docTitle', '文件标题', 'text', false),
        f('docNo', '文号'),
        f('secrecyLevel', '密级', 'select', false, ['绝密', '机密', '秘密'], 'office.doc.secrecy'),
        f('receiveDate', '接收日期', 'date', false),
        f('fromUnit', '来文单位'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      非涉密文件: [
        f('docTitle', '文件标题', 'text', false),
        f('docNo', '文号'),
        f('receiveDate', '接收日期', 'date', false),
        f('fromUnit', '来文单位'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      报表上报: [
        f('reportName', '报表名称', 'text', false),
        f('reportPeriod', '报送周期', 'select', false, ['日报', '周报', '月报', '季报', '年报'], 'office.doc.period'),
        f('deadline', '上报截止日期', 'date'),
        f('submitDate', '实际报送日期', 'date'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      材料归档: [
        f('materialName', '材料名称', 'text', false),
        f('archiveNo', '归档编号'),
        f('archiveDate', '归档日期', 'date', false),
        f('category', '类别', 'select', false, ['案卷', '文书', '声像', '电子'], 'office.doc.category'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      公文处理: [
        f('docTitle', '公文标题', 'text', false),
        f('docNo', '文号'),
        f('docType', '公文种类', 'select', false, ['请示', '报告', '通知', '通报', '函', '纪要'], 'office.doc.kind'),
        f('urgentLevel', '紧急程度', 'select', false, ['特急', '加急', '平急', '普通'], 'office.doc.urgent'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      通知传达: [
        f('noticeTitle', '通知标题', 'text', false),
        f('noticeDate', '传达日期', 'date', false),
        f('fromUnit', '下发单位'),
        f('receiveUnit', '接收单位', 'textarea'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      会议精神: [
        f('meetingName', '会议名称', 'text', false),
        f('meetingDate', '时间', 'date', false),
        f('spirit', '会议精神', 'textarea', false),
        f('implement', '落实要求', 'textarea'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      工作反馈: [
        f('feedbackTitle', '反馈事项', 'text', false),
        f('feedbackDate', '反馈日期', 'date', false),
        f('feedbackUnit', '反馈单位'),
        f('content', '反馈内容', 'textarea'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
      落实跟踪: [
        f('trackItem', '跟踪事项', 'text', false),
        f('trackDate', '跟踪日期', 'date', false),
        f('progress', '落实进度', 'select', false, ['未启动', '进行中', '已完成'], 'office.track.progress'),
        f('result', '落实结果', 'textarea'),
        f('handler', '承办人'),
        f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充'], 'office.doc.status'),
        f('remark', '备注', 'textarea'),
        ...commonTail,
      ],
    };
    return map[tab] || map['涉密文件'];
  }

  return undefined;
}
