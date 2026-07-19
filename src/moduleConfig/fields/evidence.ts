import type { FieldDefinition } from '../types';
import { f, commonTail, section } from '../fieldHelpers';
import { CASE_TYPES_FULL, CASE_TYPES_BASIC } from '../caseTypes';

// 调证登记首段：案件调证 / 线索调证 两套字段（由 DrawerNewRecord 按 requestMode 切换）
// 默认（列表/报表/其它消费方）使用案件调证版，保持向后兼容
export const REQUEST_CASE_INFO: FieldDefinition[] = [
  f('caseNo', '案件编号'),
  f('caseName', '案件名称', 'text', false),
  f('caseSource', '案件来源', 'select', false, ['群众报案', '举报', '上级交办', '部门移送', '工作发现', '自首'], 'evidence.request.caseSource'),
  f('caseType', '案件类型', 'select', false, CASE_TYPES_FULL, 'evidence.request.caseType'),
];
export const REQUEST_CLUE_INFO: FieldDefinition[] = [
  f('clueNo', '线索编号', 'text', true),
  f('clueName', '线索名称', 'text', false),
  f('clueSource', '线索来源'),
  f('clueType', '线索类型', 'select', false, CASE_TYPES_FULL, 'evidence.request.clueType'),
];

export function evidenceFields(moduleId: string, _tab: string): FieldDefinition[] | undefined {
  if (moduleId === 'evidence-clue') {
    return [
      f('clueName', '交办线索名称', 'text', false),
      f('assignDate', '交办时间', 'date'),
      f('assigner', '交办人'),
      f('assignMatter', '交办事项', 'textarea', false),
      f('feedbackResult', '反馈结果', 'textarea'),
      f('clueDetail', '线索详情', 'textarea'),
      f('filingDocNo', '受/立案文书号'),
      ...commonTail,
    ];
  }

  if (moduleId === 'evidence-request') {
    return [
      // 第一阶段：线索/案件信息（案件调证默认；线索调证由 DrawerNewRecord 切换首段字段）
      section('线索/案件信息'),
      ...REQUEST_CASE_INFO,

      // 第二阶段：调证信息（可重复添加多条）
      section('调证信息', true, 'requestItems'),
      f('cooperateUnit', '协查单位', 'select', false, ['一中队', '二中队', '三中队', '涉众办', '法制室', '大队领导', '刑警大队', '治安大队', '直属大队', '政保大队', '城区派出所', '南麻派出所', '东里派出所', '悦庄派出所', '西里派出所', '大张庄派出所', '中庄派出所', '张家坡派出所', '鲁村派出所', '南鲁山派出所', '燕崖派出所', '石桥派出所', '开发区派出所'], 'evidence.request.cooperateUnit'),
      f('target', '调证对象', 'text', false),
      f('accountNo', '调证账号'),
      f('platform', '调证平台', 'select', false, ['经侦云', '警综平台', '微信', '支付宝', '第三方支付平台'], 'evidence.request.platform'),
      f('requestNo', '调证编号'),
      f('timeRange', '调证时间范围'),
      f('requestDate', '调证日期', 'date', false),

      // 第三阶段：反馈结果
      section('反馈结果'),
      f('feedbackDate', '反馈时间', 'date', false),
      f('feedbackSuccess', '反馈成功数', 'number'),
      f('feedbackFail', '反馈失败数', 'number'),
      f('deliveredToUnit', '是否交付协查单位', 'select', false, ['是', '否']),
      f('deliveryStatus', '交付情况'),
      f('attachment', '附件材料', 'attachment'),
    ];
  }

  if (moduleId === 'evidence-freeze') {
    return [
      f('caseName', '案件名称', 'text', false),
      f('suspect', '嫌疑人姓名', 'text', false), // 提示：批量冻结可填写：***等**人
      f('bankAccount', '银行账号', 'text', false), // 提示：批量冻结可填写：***等**个账号，详见附件
      f('bank', '归属行'),
      f('actionType', '措施类型', 'select', false, ['冻结', '续冻', '解冻']),
      f('docNo', '文书号'),
      f('freezeAmount', '冻结/解冻金额', 'number'),
      f('freezeDate', '冻结/解冻时间', 'date', false),
      f('expireDate', '到期时间', 'date'),
      f('executeAmount', '执行金额', 'number'),
      f('handler', '经办人', 'text', false),
      f('attachment', '附件材料', 'attachment'),
    ];
  }

  if (moduleId === 'evidence-phone-collection') {
    return [
      f('caseNo', '案件编号', 'text', false),
      f('caseName', '案件名称', 'text', false),
      f('holder', '持有人', 'text', false),
      f('holderIdentity', '持有人身份', 'select', false, [
        '报案人', '证人', '嫌疑人', '其他',
      ], 'phone.holderIdentity'),
      f('idNo', '身份证号码', 'text', false),
      f('phone', '手机号', 'text', false),
      f('deviceType', '设备类型', 'select', false, [
        '硬盘', '手机',
      ], 'phone.deviceType'),
      f('deviceBrand', '设备品牌', 'select', false, [], 'phone.deviceBrand'),
      f('deviceModel', '具体型号', 'text', false),
      f('collectDate', '采集时间', 'date', false),
      f('collectContent', '采集内容', 'select', false, [
        '全部采集', '图像视频', '微信QQ', '全量采集', '部分采集', '其他',
      ], 'phone.collectContent'),
      f('squad', '采集单位', 'select', false, [
        '涉众办', '法制室', '一中队', '二中队', '三中队', '线索登记', '外单位协助',
      ], 'phone.squad'),
    ];
  }

  if (moduleId === 'evidence-report') {
    return [
      // 步骤1：线索/案件基本信息
      section('线索/案件基本信息'),
      f('caseNo', '线索/案件编号'),
      f('caseName', '线索/案件名称', 'text', false),
      f('caseSource', '线索/案件来源', 'select', false, ['群众报案', '举报', '上级交办', '部门移送', '工作发现', '自首']),
      f('caseType', '线索/案件类型', 'select', false, CASE_TYPES_BASIC, 'evidence.report.caseType'),
      f('totalAmount', '涉案总金额（万元）', 'number'),
      f('victimCount', '受害人数', 'number'),
      f('receiveDate', '受案日期', 'date'),
      f('filingDate', '立案日期', 'date'),
      f('caseSummary', '简要案情', 'textarea'),
      f('leadOfficer', '主办民警'),
      f('assistOfficer', '协办民警'),

      // 步骤2a：涉案企业情况（可重复）
      section('涉案企业情况', true, 'enterpriseSubjects'),
      f('enterprise', '涉案企业', 'text', false),
      f('creditCode', '统一社会信用代码'),
      f('legalRep', '法人'),
      f('address', '单位地址'),
      f('companyAccount', '公司公户'),
      f('bank', '归属行'),
      f('balance', '账户余额'),

      // 步骤2b：涉案个人情况（可重复）
      section('涉案个人情况', true, 'personalSubjects'),
      f('person', '涉案个人', 'text', false),
      f('idNo', '身份证号码'),
      f('phone', '联系方式'),
      f('homeAddress', '家庭地址'),
      f('bankAccount', '银行账户'),
      f('personalBank', '归属行'),
      f('personalBalance', '账户余额'),

      // 步骤3：调证情况（可重复）
      section('调证情况', true, 'investigationItems'),
      f('investigateCount', '调证数量', 'number'),
      f('investigateAccount', '调证账号'),
      f('investigatePlatform', '调证平台', 'select', false, ['经侦云', '警综平台', '微信', '支付宝', '第三方支付平台'], 'evidence.report.investigatePlatform'),

      // 步骤4：资金来源分析（可重复）
      section('资金来源分析', true, 'fundSources'),
      f('fundUpstream', '资金上游'),
      f('fundAccount', '资金账号'),
      f('fundLink', '资金链路'),
      f('tradeTime', '交易时间', 'date'),
      f('tradePlatform', '交易平台'),
      f('attachSources', '附件材料（资金来源）', 'attachment'),

      // 步骤5：资金去向分析（可重复）
      section('资金去向分析', true, 'penetrationItems'),
      f('penetrationLevel', '层级'),
      f('penetrationAccount', '账户名称/账号'),
      f('penetrationType', '账户类型'),
      f('penetrationReceived', '接收资金总额', 'number'),
      f('penetrationTransferred', '转出资金总额', 'number'),
      f('penetrationBalance', '账户余额', 'number'),
      f('penetrationFrozen', '账户冻结状态', 'select', false, ['已冻结', '未冻结', '部分冻结']),
      f('penetrationAttr', '账户属性'),
      f('attachOutflow', '附件材料（资金去向）', 'attachment'),

      // 步骤6：资金流出分类统计
      section('资金流出分类统计'),
      f('personalWaste', '嫌疑人个人挥霍', 'number'),
      f('fixedAssets', '购置固定资产（房/车/股权）', 'number'),
      f('fakeInvestment', '对外虚假项目投资', 'number'),
      f('operatingCosts', '运营成本（房租/工资/宣传）', 'number'),
      f('dailyExpenses', '日常开销', 'number'),
      f('moneyTransfer', '资金转移/洗白（跑分账户）', 'number'),
      f('crossBorderTransfer', '转移境外/虚拟币兑换', 'number'),
      f('crossBorder', '跨境转移', 'number'),
      f('usdtExchange', 'USDT兑换', 'number'),
      f('withdraw', '提现', 'number'),
      f('otherOutflow', '其他'),
      f('customOutflow', '用户自定义'),
      f('attachOutflowStats', '附件材料（流出分类）', 'attachment'),

      // 步骤7：资金分析结论
      section('资金分析结论'),
      f('conclusionFlow', '资金流向总结', 'textarea'),
      f('conclusionCaseSupport', '案件定性支撑', 'textarea'),
      f('conclusionDeepClue', '待深挖线索', 'textarea'),
      f('conclusionNextStep', '下一步工作', 'textarea'),
      f('attachConclusion', '附件材料（分析结论）', 'attachment'),
      f('handleStatus', '办理状态', 'select', false, ['已办结', '办理中', '待补充']),
      f('filingDocNo', '受/立案文书号'),
    ];
  }

  return undefined;
}
