import type { FieldDefinition } from '../types';
import { f, commonTail, section } from '../fieldHelpers';
import { CASE_TYPES_FULL } from '../caseTypes';

export function legalFields(moduleId: string, _tab: string): FieldDefinition[] | undefined {
  if (moduleId === 'legal-report-case') {
    return [
      // 一、基础登记信息
      section('基础登记信息'),
      f('caseNo', '接报案编号'),
      f('reportMatter', '接报事项', 'text', false),
      f('receiveDate', '接报日期', 'date', false),
      f('reportMethod', '接报方式', 'select', false, [
        '上门报案', '电话', '邮寄', '网络', '12345转办',
      ]),
      f('reportLocation', '接报地点'),
      f('receivingOfficer', '接报民警', 'text', false),
      f('caseSource', '案件来源', 'select', false, [
        '群众报案', '控告', '举报', '上级交办', '部门移送', '工作发现', '自首',
      ]),
      f('massCase', '是否涉众案件', 'select', false, ['是', '否']),
      f('caseType', '案件类型', 'select', false, CASE_TYPES_FULL, 'report.caseType'),

      // 二、报案人信息
      section('报案人信息', true, 'reporters'),
      f('reporterName', '姓名', 'text', false),
      f('reporterGender', '性别', 'select', false, ['男', '女']),
      f('reporterBirth', '出生日期', 'date'),
      f('reporterIdNo', '身份证号'),
      f('reporterPhone', '联系电话', 'text', false),
      f('reporterAddress', '现住址'),
      f('reporterRegisteredAddr', '户籍地'),
      f('reporterIdentity', '身份', 'select', false, [
        '受害人', '证人/举报人', '企业法人', '员工', '其他',
      ]),

      // 三、涉案主体信息（经侦专属）
      section('涉案主体信息', true, 'involvedEntities'),
      f('involvedEntity', '涉案公司/平台/个人'),
      f('involvedPhone', '联系电话'),
      f('creditCode', '统一社会信用代码'),
      f('businessAddress', '实际经营地址'),
      f('legalRep', '法定代表人'),
      f('actualController', '实际控制人'),
      f('wechat', '微信'),
      f('bankCard', '银行卡'),
      f('involvedRegion', '涉案地域', 'select', false, ['本地', '跨省市', '全国性']),

      // 四、案件事实与报案诉求
      section('案件事实与报案诉求'),
      f('crimeDate', '案发时间', 'date'),
      f('participateDate', '参与时间', 'date'),
      f('stopPayDate', '停止兑付/案发节点', 'date'),
      f('crimeMode', '作案模式', 'select', false, [
        '线上APP', '微信群', '线下门店', '会议营销', '养老投资', '商铺返租等',
      ], undefined, true),
      f('caseSummary', '简要案情', 'textarea', false),
      f('reportAppeal', '报案诉求', 'select', false, [
        '立案侦查', '追赃挽损', '资产查封', '信息登记', '案件进展告知', '信访相关诉求',
      ]),

      // 五、资金与证据信息
      section('资金与证据信息'),
      f('totalInvestment', '总投入本金（元）', 'number'),
      f('recoveredAmount', '已收回金额（元）', 'number'),
      f('actualLoss', '实际损失金额（元）', 'number'),
      f('selfAccount', '本人账户'),
      f('counterpartyAccount', '对方收款账户'),
      f('transferMethod', '交易方式', 'select', false, ['银行卡', '微信', '支付宝'], undefined, true),
      f('evidenceMaterial', '提供证据材料', 'select', false, [
        '合同', '收据', '流水', '聊天记录', '宣传资料', 'APP截图', '录音视频',
      ], undefined, true),
      f('evidenceDetail', '证据材料说明', 'textarea'),

      // 六、法制室处置流程
      section('法制室处置流程'),
      f('preliminaryOpinion', '初查意见', 'select', false, [
        '属经侦管辖', '不属于管辖', '移送其他单位', '不予受理/告知其他途径',
      ]),
      f('preliminaryDetail', '初查意见说明', 'textarea'),
      f('transferDestination', '流转去向', 'select', false, [
        '资金初查', '移交办案中队', '暂缓受理',
      ]),
      f('transferDetail', '流转去向说明', 'textarea'),
      f('briefCase', '简要案情', 'textarea'),

      ...commonTail,
    ];
  }

  if (moduleId === 'legal-special-action') {
    return [
      // 一、基础信息
      section('基础信息'),
      f('actionName', '专项行动名称', 'text', false),
      f('initiator', '行动发起单位', 'select', false, ['公安部', '省厅', '市局', '县局']),
      f('startDate', '启动时间', 'date', false),
      f('endDate', '结束时间', 'date'),
      f('leadDept', '牵头部门'),
      f('cooperateDept', '配合部门'),
      f('leadOfficer', '大队责任领导'),
      f('legalReviewer', '法制室审核人'),
      f('statistician', '内勤统计人'),

      // 二、部署落实情况
      section('部署落实情况'),
      f('deployDate', '大队部署时间', 'date'),
      f('meetingInfo', '动员会议开展情况', 'textarea'),
      f('planInfo', '制定方案', 'textarea'),
      f('ledgerInfo', '台账建立', 'textarea'),
      f('dutyDivision', '责任分工情况', 'textarea'),
      f('submitMaterial', '报送材料情况', 'textarea'),

      // 三、案件打击类核心统计
      section('案件打击类核心统计'),
      f('acceptedCaseCount', '专项内受理案件数', 'number'),
      f('filedCaseCount', '立案案件数', 'number'),
      f('noFileCaseInfo', '不予立案数、不予立案理由', 'textarea'),
      f('arrestedTotal', '抓获犯罪嫌疑人数', 'number'),
      f('criminalDetentionCount', '刑拘', 'number'),
      f('arrestCount', '逮捕', 'number'),
      f('bailCount', '取保', 'number'),
      f('prosecutionCount', '移送起诉', 'number'),
      f('solvedCaseCount', '破案数', 'number'),
      f('caseType', '涉案类型', 'select', false, CASE_TYPES_FULL, 'special.caseType'),
      f('totalAmount', '涉案总金额（万元）', 'number'),
      f('recoveredAmount', '挽损金额（万元）', 'number'),
      f('seizureInfo', '查封情况', 'textarea'),
      f('confiscationInfo', '扣押情况', 'textarea'),
      f('frozenAssetValue', '冻结资产价值（万元）', 'number'),

      // 四、线索排查与管控
      section('线索排查与管控'),
      f('superiorClueCount', '上级交办线索数', 'number'),
      f('selfClueCount', '自行摸排线索数', 'number'),
      f('checkedClueCount', '核查办结线索数', 'number'),
      f('uncheckedClueCount', '未办结线索数', 'number'),
      f('enterpriseCheckCount', '企业排查数', 'number'),
      f('keyPersonCheckCount', '重点人排查数', 'number'),
      f('warningEnterpriseCount', '约谈警示企业数', 'number'),
      f('keyPersonControl', '重点人员稳控', 'textarea'),
      f('petitionRiskInfo', '信访隐患排查情况', 'textarea'),

      // 五、法制监督与执法质效
      section('法制监督与执法质效'),
      f('legalReviewCaseCount', '法制审核案件数', 'number'),
      f('reviewProblemCount', '审核问题数', 'number'),
      f('rectificationCount', '整改数', 'number'),
      f('enforcementDefect', '执法瑕疵', 'textarea'),
      f('problemRectification', '问题整改', 'textarea'),
      f('standardImprovement', '规范提升情况', 'textarea'),
      f('involvedPropertyMgmt', '涉案财物管理', 'textarea'),
      f('filingStandardization', '受立案规范化检查情况', 'textarea'),
      f('involvedLawsuit', '涉法涉诉', 'textarea'),
      f('petitionResolve', '信访问题化解情况', 'textarea'),

      // 六、成效、亮点与问题
      section('成效、亮点与问题'),
      f('typicalCase', '典型案例', 'textarea'),
      f('achievementHighlight', '战果亮点', 'textarea'),
      f('existingShortcomings', '存在短板', 'textarea'),
      f('difficultProblems', '难点问题', 'textarea'),
      f('nextSteps', '下一步工作措施', 'textarea'),
      f('supervisorFeedback', '上级督导反馈', 'textarea'),
      f('rectificationStatus', '整改落实情况', 'textarea'),

      ...commonTail,
    ];
  }

  if (moduleId === 'legal-process') {
    return [f('caseNo', '案件编号'), f('caseName', '案件名称', 'text', false), f('node', '流程节点', 'select', false, ['受案立案', '强制措施', '侦查期限', '逮捕起诉', '移送审查', '超期预警']), f('nodeDate', '节点时间', 'date', false), f('handlerPolice', '承办民警'), f('deadline', '期限届满时间', 'date'), f('risk', '风险/异常情况', 'textarea'), f('supervision', '督促整改情况', 'textarea'), ...commonTail];
  }

  if (moduleId === 'legal-assessment') {
    const map: Record<string, FieldDefinition[]> = {
      考核标准: [
        f('assessmentYear', '考核年度', 'select', false, ['2024', '2025', '2026', '2027'], 'legal.assessment.year'),
        f('assessmentName', '考核方案名称', 'text', false),
        f('scope', '考核范围', 'textarea'),
        f('criteria', '考核指标及标准', 'textarea', false),
        f('weight', '权重说明', 'textarea'),
        ...commonTail,
      ],
      考核对象: [
        f('objectName', '被考核单位/个人', 'text', false),
        f('objectType', '对象类型', 'select', false, ['中队', '内设机构', '个人'], 'legal.assessment.objectType'),
        f('responsible', '责任人'),
        f('baseScore', '基础分', 'number'),
        f('deductItem', '扣分项', 'textarea'),
        ...commonTail,
      ],
      结果登记: [
        f('objectName', '被考核对象', 'text', false),
        f('score', '考核得分', 'number'),
        f('grade', '等次', 'select', false, ['优秀', '称职', '基本称职', '不称职'], 'legal.assessment.grade'),
        f('result', '考核结果', 'select', false, ['已公示', '待公示'], 'legal.assessment.result'),
        f('remark', '评语', 'textarea'),
        ...commonTail,
      ],
      整改建议: [
        f('objectName', '整改对象', 'text', false),
        f('problem', '存在问题', 'textarea', false),
        f('suggestion', '整改建议', 'textarea', false),
        f('rectificationStatus', '整改状态', 'select', false, ['未整改', '整改中', '已整改'], 'legal.assessment.rectification'),
        f('deadline', '整改时限', 'date'),
        f('verifyResult', '验收结果', 'textarea'),
        ...commonTail,
      ],
    };
    return map[_tab] || map['考核标准'];
  }

  if (moduleId === 'legal-case-ledger') {
    return [
      // 一、案件基础信息
      section('案件基础信息'),
      f('caseNo', '案件编号', 'text', false),
      f('caseName', '案件名称', 'text', false),
      f('receiveDate', '受案时间', 'date', false),
      f('filingDate', '立案时间', 'date'),
      f('noFilingDate', '不予立案时间', 'date'),
      f('noFilingReason', '不予立案理由', 'text'),
      f('briefCase', '简要案情', 'textarea'),
      f('caseSource', '案件来源', 'select', false, [
        '群众报案', '举报', '上级交办', '部门移送', '工作发现', '12345转办', '自首',
      ], 'legal.caseSource'),
      f('caseType', '案件类型', 'select', false, CASE_TYPES_FULL, 'legal.caseType'),
      f('massType', '是否涉众型案件', 'select', false, ['是', '否']),
      f('massCategory', '涉众类别'),
      f('massScale', '涉众规模'),
      f('crimeLocation', '案发地'),
      f('handlingSquad', '办案中队'),
      f('leadOfficer', '主办民警', 'text', false),
      f('assistOfficer', '协办民警'),
      f('legalReviewer', '法制审核人'),

      // 二、嫌疑人信息（可重复录入多人）
      section('嫌疑人信息', true, 'suspects'),
      f('suspectName', '姓名', 'text', false),
      f('suspectIdNo', '身份证号码'),
      f('suspectPhone', '手机号'),
      f('suspectAddress', '地址'),
      f('criminalDetentionDate', '刑事拘留', 'date'),
      f('residentialSurveillanceDate', '监视居住', 'date'),
      f('bailDate', '取保候审', 'date'),
      f('arrestDate', '逮捕', 'date'),

      // 三、案件节点
      section('案件节点'),
      f('investEndDate', '侦查终结', 'date'),
      f('prosecutionDate', '移送审查起诉', 'date'),
      f('procuratorateReturnDate', '检察院退查', 'date'),
      f('procuratorateProsecuteDate', '检察院起诉', 'date'),
      f('courtJudgmentDate', '法院判决', 'date'),
      f('caseCloseDate', '结案时间', 'date'),

      // 四、涉案主体情况
      section('涉案主体情况', true, 'involvedParties'),
      f('involvedEntity', '涉案企业 / 个人'),
      f('arrestedTotal', '抓获嫌疑人总数', 'number'),
      f('criminalDetentionCount', '刑拘数', 'number'),
      f('arrestCount', '逮捕数', 'number'),
      f('bailCount', '取保数', 'number'),
      f('fugitiveCount', '在逃数', 'number'),
      f('victimRegisteredCount', '受害人登记人数', 'number'),
      f('victimEstimatedCount', '预估受害人数', 'number'),

      // 五、涉案资金、资产、挽损情况
      section('涉案资金、资产、挽损情况'),
      f('totalInvolvedAmount', '涉案总金额（万元）', 'number', false),
      f('victimActualLoss', '受害人实际损失总额（万元）', 'number'),
      f('frozenFunds', '冻结资金（万元）', 'number'),
      f('seizedProperty', '查封房产'),
      f('seizedVehicle', '车辆'),
      f('seizedEquity', '股权'),
      f('confiscatedValue', '扣押财物价值（万元）', 'number'),
      f('otherAssets', '其他类'),
      f('recoveredAmount', '已挽损金额（万元）', 'number'),
      f('recoveryRate', '挽损率'),
      f('compensatedCount', '已退赔人数', 'number'),
      f('compensatedAmount', '退赔金额（万元）', 'number'),
      f('uncompensatedInfo', '未退赔情况', 'textarea'),

      // 六、法制审核与执法流程
      section('法制审核与执法流程'),
      f('preliminaryReviewOpinion', '初查审核意见', 'textarea'),
      f('filingReviewOpinion', '立案 / 不予立案审核意见', 'textarea'),
      f('coerciveReview', '强制措施审核情况', 'textarea'),
      f('evidenceReview', '侦查取证合规性审核', 'textarea'),
      f('preProsecutionReview', '移送起诉前法制审核意见', 'textarea'),
      f('lawEnforcementDefects', '是否存在执法瑕疵、整改情况', 'textarea'),

      // 七、案件当前办理进度
      section('案件当前办理进度'),
      f('progressStatus', '案件当前办理进度', 'select', false, [
        '初查中', '已立案侦查', '强制措施阶段', '侦查终结',
        '移送起诉', '法院审理', '已判决', '已结案',
      ]),
      f('progressNote', '进度说明（当前节点、下一步计划、存在难点）', 'textarea'),

      // 八、归档及备注
      section('归档及备注'),
      f('archiveStatus', '案卷归档情况', 'textarea'),
      f('superiorSupervision', '上级督办情况', 'textarea'),
      f('supervisionCase', '是否挂牌案件', 'select', false, ['是', '否']),
      f('filingDocNo', '受、立案决定书编号'),

      ...commonTail,
    ];
  }

  return undefined;
}
