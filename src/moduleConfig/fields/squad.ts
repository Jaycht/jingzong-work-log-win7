import type { FieldDefinition } from '../types';
import { f, commonTail, section } from '../fieldHelpers';
import { CASE_TYPES_FULL } from '../caseTypes';

export function squadFields(moduleId: string, _tab: string): FieldDefinition[] | undefined {
  if (moduleId === 'squad-daily') {
    return [
      section('案件基本信息'),
      f('caseNo', '案件编号'),
      f('caseName', '案件名称', 'text', false),
      f('caseType', '案件类型', 'select', false, CASE_TYPES_FULL, 'daily.caseType'),
      f('caseStage', '案件当前阶段', 'select', false, [
        '初查', '立案', '侦查', '强制措施', '移送起诉',
      ]),

      section('工作成果 / 完成事项'),
      f('inquiryRecord', '询问笔录'),
      f('interrogationRecord', '讯问笔录'),
      f('reception', '接待报案/信访人'),
      f('evidenceObtained', '调取证据'),
      f('fundFlowAnalysis', '梳理资金流水'),
      f('documentPreparation', '制作文书'),
      f('coerciveMeasuresResult', '采取强制措施情况'),
      f('closedClues', '当日办结线索'),
      f('clueCheck', '线索核查'),
      f('legalCoordination', '法制对接'),
      f('stabilityWork', '维稳工作'),
      f('specialAction', '专项行动'),
      f('publicityWork', '宣传工作'),
      f('otherWork', '其他'),
      f('nextDayPlan', '次日工作计划', 'textarea', false),
      f('nextInvestDirection', '下一步侦查方向', 'textarea'),
      f('handler', '经办人', 'text', false),
      f('attachment', '附件材料', 'attachment'),
    ];
  }

  if (moduleId === 'squad-coercive') {
    return [
      f('caseNo', '案件编号', 'text', false),
      f('caseName', '案件名称', 'text', false),
      section('强制措施明细', true, 'coerciveMeasures'),
      f('suspect', '嫌疑人姓名', 'text', false),
      f('measure', '强制措施类型', 'select', false, ['刑事拘留', '取保候审', '监视居住', '逮捕', '变更措施'], 'squad.coercive.measure'),
      f('isNotified', '是否告知/通知', 'select', false, ['是', '否']),
      f('notifyDate', '告知/通知时间', 'date'),
      f('approvalDate', '审批时间', 'date'),
      f('executeDate', '执行时间', 'date', false),
      f('deadline', '期限届满时间', 'date'),
      f('approver', '审批人'),
      f('executeResult', '执行情况', 'textarea'),
      ...commonTail,
    ];
  }

  if (moduleId === 'squad-property') {
    return [
      section('基本信息', true, 'properties'),
      f('propertyName', '财物名称', 'text', false),
      f('recordDate', '记录日期', 'date', false),
      f('holder', '持有人'),
      f('handlingOfficer', '经办民警'),
      f('returnDate', '返还时间', 'date'),
      f('returnStatus', '返还情况', 'textarea'),
      f('details', '具体内容', 'textarea', false),
      f('implementation', '落实情况', 'textarea'),
      f('handler', '经办人', 'text', false),
      f('custodian', '保管人'),
      f('attachment', '附件材料', 'attachment'),
    ];
  }

  if (moduleId === 'squad-case') {
    return [
      // ═══ 步骤1：案件基本信息 ═══
      section('案件基本信息'),
      f('caseNo', '案件编号'),
      f('caseName', '案件名称', 'text', false),
      f('caseSource', '案件来源', 'select', false, [
        '群众报案', '举报', '上级交办', '部门移送', '专项行动', '工作发现', '自首',
      ]),
      f('caseType', '案件类型', 'select', false, CASE_TYPES_FULL),
      // 原步骤2涉案信息的两个项目移到这里
      f('totalAmount', '涉案总金额（万元）', 'number'),
      f('victimCount', '受害人数', 'number'),
      f('leadOfficer', '主办民警', 'text', false),
      f('assistOfficer', '协办民警'),
      // 原步骤3日期节点按法律办案时间顺序排列
      f('receiveDate', '受案日期', 'date'),
      f('filingDate', '立案日期', 'date'),
      f('noFilingDate', '不予立案日期', 'date'),
      f('investEndDate', '侦查终结日期', 'date'),
      f('prosecutionDate', '移送审查起诉日期', 'date'),
      f('caseCloseDate', '结案日期', 'date'),

      // ═══ 步骤2：嫌疑人信息（repeatable，全局联动）═══
      section('嫌疑人信息', true, 'suspects'),
      // 【基本信息】
      f('suspectName', '姓名', 'text', false),
      f('formerName', '曾用名'),
      f('gender', '性别', 'select', false, ['男', '女']),
      f('ethnicity', '民族', 'select', false, [
        '汉族', '蒙古族', '回族', '藏族', '维吾尔族',
        '苗族', '彝族', '壮族', '布依族', '朝鲜族',
        '满族', '侗族', '瑶族', '白族', '土家族',
        '哈尼族', '哈萨克族', '傣族', '黎族', '傈僳族',
        '佤族', '畲族', '高山族', '拉祜族', '水族',
        '东乡族', '纳西族', '景颇族', '柯尔克孜族', '土族',
        '达斡尔族', '仫佬族', '羌族', '布朗族', '撒拉族',
        '毛南族', '仡佬族', '锡伯族', '阿昌族', '普米族',
        '塔吉克族', '怒族', '乌孜别克族', '俄罗斯族', '鄂温克族',
        '德昂族', '保安族', '裕固族', '京族', '塔塔尔族',
        '独龙族', '鄂伦春族', '赫哲族', '门巴族', '珞巴族',
        '基诺族',
      ]),
      f('birthDate', '出生日期', 'date'),
      f('suspectIdNo', '身份证号'),
      f('registeredAddress', '户籍地'),
      f('currentAddress', '现住址'),
      f('education', '文化程度', 'select', false, ['小学', '初中', '高中/中专', '大专', '本科', '硕士', '博士']),
      f('occupation', '职业'),
      // 【联络信息】
      f('suspectPhone', '手机号'),
      f('landline', '固定电话'),
      f('socialAccount', '社交账号'),
      f('emergencyContact', '紧急联系人及电话'),
      // 【前科状态】
      f('hasCriminalRecord', '有无前科', 'select', false, ['是', '否']),
      f('criminalRecordDetail', '前科详情', 'textarea'),
      f('isFugitive', '是否在逃', 'select', false, ['是', '否']),
      f('captureDate', '抓获时间', 'date'),
      // 【涉案信息】
      f('suspectRole', '涉案身份', 'select', false, ['主犯', '从犯', '骨干人员', '业务员', '财务', '客服', '一般参与者']),
      f('personalIllegalIncome', '个人违法所得'),
      f('arrestMethod', '归案方式', 'select', false, ['群众扭送', '主动投案', '传唤到案', '抓捕归案']),
      // 【强制措施】
      f('summonDate', '传唤时间', 'date'),
      f('interrogationDate', '询问时间', 'date'),
      f('measureStatus', '措施状态', 'select', false, ['刑事拘留', '取保候审', '监视居住', '逮捕', '移诉']),
      f('detentionDate', '拘留时间', 'date'),
      f('arrestDate', '逮捕时间', 'date'),
      f('bailDate', '取保时间', 'date'),
      f('residentialSurveillanceDate', '监视居住时间', 'date'),
      f('transferProsecutionDate', '移诉时间', 'date'),
      // 【资金资产】
      f('bankCardNo', '银行卡号'),
      f('ownedVehiclesProperties', '名下车辆/房产'),
      f('frozenAssetsInfo', '已冻结资产信息', 'textarea'),
      f('investmentFinance', '投资理财'),
      f('insuranceStatus', '参保情况'),
      // 【补充信息】
      f('accomplice', '同案人员'),
      f('appearance', '体貌特征'),
      f('healthStatus', '健康状况'),
      f('remarks', '备注', 'textarea'),

      ...commonTail,
    ];
  }

  return undefined;
}
