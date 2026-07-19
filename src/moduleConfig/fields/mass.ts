import type { FieldDefinition } from '../types';
import { f, commonTail, section } from '../fieldHelpers';
import { CASE_TYPES_FULL } from '../caseTypes';

export function massFields(moduleId: string, _tab: string): FieldDefinition[] | undefined {
  if (moduleId === 'mass-clue') {
    return [
      section('项目信息'),
      f('subjectName', '公司/个人名称', 'text', false),
      f('recordDate', '记录日期', 'date', false),
      f('projectName', '项目名称', 'text', false),
      f('projectCategory', '项目类别', 'select', false, [
        '非吸类', '传销类', '集资诈骗', '证券期货类',
        '资金盘', '杀猪盘', '互助盘', '虚拟币传销',
      ], 'mass.clue.projectCategory'),
      f('operationMode', '运营模式', 'select', false, [
        '线上APP', '微信群', '线下门店', '养老项目',
        '商铺返租', '虚拟币', '加盟', '理财返利', '保本付息等',
      ], 'mass.clue.operationMode'),
      f('promotionMethod', '宣传方式', 'select', false, [
        '朋友圈', '抖音', '短视频', '地推', '熟人介绍', '会议营销',
      ], 'mass.clue.promotionMethod', true),
      f('promisedReturns', '承诺收益', 'select', false, [
        '年化利率', '返利周期', '分红模式',
      ], 'mass.clue.promisedReturns', true),
      f('promisedReturnsDetail', '承诺收益具体说明'),
      f('involvedScale', '涉众规模'),
      f('subjectAddress', '注册/实际经营地'),
      f('subjectLegalRep', '法人/总代理'),
      f('subjectKeyPersonnel', '骨干/业务员'),
      f('subjectEstablishDate', '成立时间', 'date'),

      section('线索来源', true, 'clueSources'),
      f('reporterName', '举报人/受害人姓名', 'text', false),
      f('reporterGender', '性别', 'select', false, ['男', '女']),
      f('reporterIdNo', '身份证号'),
      f('reporterPhone', '联系电话', 'text', false),
      f('reporterWechat', '微信号'),
      f('reporterAddress', '现住址'),
      f('reporterWorkplace', '工作单位'),
      f('reporterRelationship', '与涉案主体关系', 'select', false, ['投资人', '员工', '知情群众', '竞争对手', '其他'], 'mass.clue.reporterRelationship'),
      f('reporterConfidential', '是否愿意保密', 'select', false, ['是', '否']),
      f('reporterCooperate', '是否愿意配合调查', 'select', false, ['是', '否']),

      section('资金线索'),
      f('fundAccountType', '收款账户类型', 'select', false, [
        '对公账户', '个人银行卡', '支付宝', '微信账号',
      ], 'mass.clue.fundAccountType'),
      f('fundAccountDetail', '收款账户信息'),
      f('fundTransferMethod', '转账方式', 'select', false, [
        '银行卡', '微信', '支付宝', '现金',
      ], 'mass.clue.fundTransferMethod', true),
      f('fundFlowFeature', '资金流转特点', 'select', false, [
        '层层转账', '分散收款', '虚拟货币交易',
      ], 'mass.clue.fundFlowFeature'),

      section('风险研判及备注'),
      f('riskStability', '维稳风险'),
      f('riskUrgency', '紧急程度', 'select', false, ['一般', '较大', '重大']),
      f('riskOtherClues', '其他线索', 'textarea'),
      f('riskRelatedCase', '关联案件'),
      f('riskOtherReporters', '其他举报人情况', 'textarea'),
      f('briefDescription', '简要说明', 'textarea'),

      ...commonTail,
    ];
  }

  if (moduleId === 'mass-statistics') {
    return [
      // 一、案件基础信息
      section('案件基础信息'),
      f('caseName', '案件名称', 'text', false),
      f('caseNo', '案件编号'),
      f('caseFilingDate', '立案时间', 'date', false),
      f('caseLocation', '案发地'),
      f('caseType', '案件类型', 'select', false, CASE_TYPES_FULL, 'mass.statistics.caseType'),
      f('crimeForm', '作案形式', 'select', false, [
        '线上APP', '微信群', '线下门店', '会议营销',
        '养老项目', '虚拟货币', '加盟等',
      ], 'mass.statistics.crimeForm', true),
      f('handlingUnit', '办案单位'),
      f('handlingOfficer', '主办民警'),

      // 二、涉案主体统计
      section('涉案主体统计', true, 'involvedSubjects'),
      f('involvedCompanyCount', '涉案公司数量', 'number'),
      f('companyName', '公司名称'),
      f('controllerCount', '实际控制人数量', 'number'),
      f('mainStructure', '主要架构（骨干人员、业务员）'),
      f('gangLevels', '团伙层级'),
      f('accountCount', '涉案账户数（对公、个人、第三方支付）'),
      f('crossRegion', '跨区域情况（涉及省市、是否全国性）'),

      // 三、受害人（涉众）核心统计
      section('受害人（涉众）核心统计'),
      f('totalVictims', '总受害人数', 'number', false),
      f('registeredVictims', '已登记受害人数量', 'number'),
      f('estimatedUnregistered', '未登记预估人数', 'number'),
      f('localVictimCount', '本地人数', 'number'),
      f('outsideVictimCount', '外地人数', 'number'),
      f('groupRisk', '群体性风险（抱团、上访、聚集苗头人数）'),

      // 四、资金数据统计
      section('资金数据统计'),
      f('totalInvolvedAmount', '涉案总金额（报案总额）', 'number', false),
      f('totalInvestment', '投资人总投入本金', 'number'),
      f('paidAmount', '已兑付/返利/利息金额', 'number'),
      f('actualLossAmount', '实际损失总金额', 'number'),
      f('largeLossCount', '单笔大额损失人数（50万以上）'),
      f('fundDestination', '资金去向', 'select', false, [
        '自融', '挥霍', '转移境外', '放贷', '兑付利息', '虚假项目',
      ], 'mass.statistics.fundDestination', true),
      f('frozenFunds', '冻结资金', 'number'),
      f('seizedProperties', '查封房产、车辆、股权、其他'),
      f('recoveredAmount', '挽损金额', 'number'),
      f('recoveryRate', '挽损率'),

      // 五、作案手段与证据统计
      section('作案手段与证据统计'),
      f('promotionMethod', '宣传方式', 'select', false, [
        '短视频', '朋友圈', '熟人介绍', '地推', '会议宣讲', '广告等',
      ], 'mass.statistics.promotionMethod', true),
      f('incomeModel', '收益模式', 'select', false, [
        '年化利率', '静态返利', '动态拉人头奖励',
      ], 'mass.statistics.incomeModel', true),
      f('crimeDuration', '作案周期（存续时长）'),
      f('evidenceCount', '收集证据情况'),

      // 六、刑事打击数据
      section('刑事打击数据'),
      f('arrestedCount', '抓获犯罪嫌疑人数量', 'number'),
      f('criminalDetention', '刑拘人数', 'number'),
      f('arrestApproved', '逮捕人数', 'number'),
      f('bailCount', '取保候审人数', 'number'),
      f('prosecutedCount', '移送起诉人数', 'number'),
      f('sentencedCount', '判决人数', 'number'),
      f('wantedCount', '追逃人数', 'number'),
      f('overseasCapture', '境外抓捕人数', 'number'),

      // 七、维稳及处置进展
      section('维稳及处置进展'),
      f('petitionCount', '信访、舆情、群体性事件次数', 'number'),
      f('receptionCount', '接访次数', 'number'),
      f('keyPersonnelControl', '重点人员稳控数量', 'number'),
      f('assetProgress', '资产处置进度'),
      f('compensationPlan', '退赔方案'),
      f('compensationBatch', '退赔批次'),
      f('compensatedCount', '已退赔人数', 'number'),
      f('compensatedAmount', '已退赔金额', 'number'),
      f('caseStatus', '结案/未结案', 'select', false, ['已结案', '未结案']),
      f('writeOffRisk', '挂账风险'),

      ...commonTail,
    ];
  }

  if (moduleId === 'mass-petition') {
    return [
      // 一、涉众案件信访登记统计类目（基础信息）
      section('信访登记信息'),
      f('petitionNo', '信访编号'),
      f('registerDate', '登记日期', 'date', false),
      f('receptionMethod', '接访方式', 'select', false, [
        '来访', '来电', '来信', '网上信访', '12345',
      ], 'mass.petition.receptionMethod'),
      f('petitionerName', '姓名', 'text', false),
      f('petitionerPhone', '联系电话'),
      f('petitionerRegisteredAddress', '户籍地'),
      f('petitionerResidence', '居住地'),
      f('petitionerAge', '年龄', 'number'),
      f('relatedCaseName', '对应案件名称/线索'),
      f('relatedCaseNo', '案件编号'),
      f('isVictim', '是否本案受害人'),
      f('mainAppeal', '信访主要诉求', 'select', false, [
        '登记损失', '报案受理', '追赃挽损', '资产处置',
        '退赔兑付', '案件进展查询', '嫌疑人抓捕', '判决情况',
        '维稳', '群体性诉求', '重复访/越级访', '其他',
      ], 'mass.petition.mainAppeal'),
      f('petitionNature', '信访性质', 'select', false, [
        '初次信访', '重复信访', '越级信访', '集体访（人数）', '重点人员访',
      ], 'mass.petition.petitionNature'),
      f('riskLevel', '信访人风险等级', 'select', false, [
        '一般', '关注', '重点稳控对象',
      ], 'mass.petition.riskLevel'),
      f('assignedUnit', '交办单位'),
      f('handlingOfficer', '承办民警'),
      f('isEmotional', '是否情绪激动'),
      f('hasExtremeSpeech', '有无过激言论'),
      f('publicOpinionRisk', '舆情风险'),

      // 二、信访处理及反馈统计类目（核心处置数据）
      section('信访处理及反馈'),
      f('isAccepted', '是否受理', 'select', false, ['是', '否']),
      f('acceptDate', '受理日期', 'date'),
      f('rejectReason', '不予受理理由'),
      f('legalDeadline', '法定办结日期', 'date'),
      f('actualDeadline', '实际办结日期', 'date'),
      f('investigationMeasures', '调查处置措施', 'select', false, [
        '告知案件进展', '资金核查情况', '开展释法明理',
        '政策解释', '稳控约谈', '上门走访',
        '帮扶疏导', '资产处置', '退赔对接情况',
      ], 'mass.petition.investigationMeasures'),
      f('feedbackMethod', '反馈方式', 'select', false, [
        '当面反馈', '电话反馈', '书面反馈', '线上反馈',
      ], 'mass.petition.feedbackMethod'),
      f('feedbackCount', '反馈次数', 'number'),
      f('feedbackDate', '反馈日期', 'date'),
      f('satisfaction', '信访人对反馈结果', 'select', false, [
        '满意', '基本满意', '不满意', '仍诉求',
      ], 'mass.petition.satisfaction'),
      f('riskResult', '风险处置结果', 'select', false, [
        '息诉罢访', '签订息访协议', '持续稳控',
        '重点管控', '化解', '未化解', '仍有越级上访苗头',
      ], 'mass.petition.riskResult'),
      f('totalPetitions', '同一涉众案件信访总件数', 'number'),
      f('collectivePetitionBatch', '集体访批次', 'number'),
      f('participantsCount', '参与人数', 'number'),
      f('repeatPetitionCount', '重复访人次', 'number'),
      f('keyPersonnelControl', '重点人员稳控人数', 'number'),
      f('archiveDate', '办结归档日期', 'date'),
      f('materialCompleteness', '材料齐全情况'),

      f('petitionMatter', '信访事项', 'textarea'),

      ...commonTail,
    ];
  }

  if (moduleId === 'mass-publicity') {
    return [
      section('宣传信息'),
      f('publicityDate', '宣传日期', 'date', false),
      f('publicityType', '宣传类型', 'select', false, [
        '平台阵地', '新媒体', '文字外宣', '主题活动',
      ], undefined, true),
      f('publishPlatform', '发布载体', 'select', false, [
        '县局主页', '公安内网动态', '微信公众号', '视频号',
        '抖音等新媒体', '市级/省级报刊', '法治类刊物',
        '内部简报', '警队工作文章',
      ], undefined, true),
      f('publicityForm', '宣传形式', 'select', false, [
        '工作动态', '简讯', '涉案警示短视频',
        '反诈/涉众警示视频', '新闻稿件', '深度报道',
        '主题宣传日', '集中宣传', '入户宣讲', '广场活动',
      ], undefined, true),
      f('workTitle', '稿件/作品标题', 'text', false),
      f('publishLevel', '发布层级', 'select', false, ['县级', '市级', '省级'], undefined, true),
      f('quantity', '数量', 'number'),
      f('readCount', '阅读/传播量'),
      f('responsibleOfficer', '责任民警'),
      f('remarks', '备注', 'textarea'),
      ...commonTail,
    ];
  }

  if (moduleId === 'mass-interview') {
    return [
      // 一、约谈基础信息
      section('约谈基础信息'),
      f('interviewNo', '约谈编号'),
      f('interviewDate', '约谈日期', 'date', false),
      f('interviewTime', '约谈时间'),
      f('interviewPlace', '约谈地点', 'select', false, ['大队', '上门', '其他地点'], 'mass.interview.interviewPlace'),
      f('interviewForm', '约谈形式', 'select', false, ['当面约谈', '电话约谈', '视频约谈']),
      f('interviewingOfficer', '约谈民警', 'text', false),
      f('recorder', '记录人'),
      f('relatedCaseName', '关联案件/线索名称'),
      f('relatedCaseNo', '案件编号'),

      // 二、被约谈人（重点人）信息
      section('被约谈人信息', true, 'interviewees'),
      f('intervieweeName', '姓名', 'text', false),
      f('intervieweeGender', '性别', 'select', false, ['男', '女']),
      f('intervieweeAge', '年龄', 'number'),
      f('intervieweeIdNo', '身份证号'),
      f('intervieweePhone', '联系电话', 'text', false),
      f('intervieweeAddress', '现住址'),
      f('intervieweeIdentity', '身份', 'select', false, [
        '受害人', '投资人', '涉案人员', '信访牵头人',
        '重点人员', '煽动组织者', '重复访人员', '集体访组织者',
      ]),
      f('riskLevel', '风险等级', 'select', false, ['一般关注', '重点管控', '极高风险'], 'mass.interview.riskLevel'),
      f('isElderly', '是否老年人', 'select', false, ['是', '否']),
      f('isHardship', '是否家庭困难人员', 'select', false, ['是', '否']),

      // 三、约谈内容与结果
      section('约谈内容与结果'),
      f('interviewReason', '约谈事由', 'select', false, [
        '约谈企业', '追赃挽损', '炒作舆情',
        '策划群体性事件', '对案件进展不满',
      ], 'mass.interview.interviewReason', true),
      f('interviewContent', '约谈主要内容', 'select', false, [
        '警示约谈', '督促整改', '核实诉求',
        '法律宣讲', '风险告知', '政策解释',
        '思想疏导', '情绪安抚',
      ], 'mass.interview.interviewContent', true),
      f('controlMeasures', '采取稳控措施', 'select', false, [
        '训诫', '警告', '签订承诺书', '息访保证书',
        '建立微信联系', '常态化回访', '上门走访', '帮扶救助',
      ], 'mass.interview.controlMeasures', true),
      f('intervieweeAttitude', '被约谈人态度', 'select', false, [
        '配合', '抵触', '情绪激动', '诉求化解', '息访罢访',
      ], 'mass.interview.intervieweeAttitude', true),
      f('nextFollowUpDate', '下次回访/约谈时间', 'date'),
      f('followUpOfficer', '后续稳控责任人'),
      f('interviewMatter', '约谈事项', 'textarea'),

      ...commonTail,
    ];
  }

  return undefined;
}
