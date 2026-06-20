import type React from 'react';
import {
  Archive, Banknote, BookOpenCheck, BriefcaseBusiness, ClipboardCheck,
  DatabaseBackup, FileArchive, FileCog, FileSearch, FileText, FolderKanban,
  Gavel, Handshake, Landmark, LayoutDashboard, ListChecks, LockKeyhole,
  Megaphone, MessageSquareText, PieChart, ScrollText, SearchCheck,
  Settings, TableProperties, Users, WalletCards, Clock, StickyNote
} from 'lucide-react';

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
  hideTemplateSelector?: boolean;
  tabs: WorkTab[];
}

export interface NavDepartment {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  modules: WorkModule[];
}

const f = (id: string, label: string, type: FieldType = 'text', required = false, options?: string[], customOptionKey?: string, multiple?: boolean): FieldDefinition => ({
  id,
  label,
  type,
  required,
  options,
  customOptionKey,
  multiple,
});

const section = (label: string, repeatable = false, listName?: string): FieldDefinition => ({
  id: `__section_${label}`,
  label,
  type: 'section',
  repeatable,
  listName,
});

const commonTail = [
  f('handler', '经办人', 'text', false),
  f('attachment', '附件材料', 'attachment'),
];

function fieldsFor(moduleId: string, tab: string): FieldDefinition[] {
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
      f('caseType', '案件类型', 'select', false, [
        '帮助恐怖活动案', '走私假币案', '虚报注册资本案',
        '虚假出资、抽逃出资案', '欺诈发行股票、债券案', '违规披露、不披露重要信息案',
        '妨害清算案', '隐匿、故意销毁会计凭证、会计账簿、财务会计报告案',
        '虚假破产案', '非国家工作人员受贿案', '对非国家工作人员行贿案',
        '对外国公职人员、国际公共组织官员行贿案', '背信损害上市公司利益案',
        '伪造货币案', '出售、购买、运输假币案',
        '金融工作人员购买假币、以假币换取货币案', '持有、使用假币案',
        '变造货币案', '擅自设立金融机构案',
        '伪造、变造、转让金融机构经营许可证、批准文件案', '高利转贷案',
        '骗取贷款、票据承兑、金融票证案', '非法吸收公众存款案',
        '伪造、变造金融票证案', '妨害信用卡管理案', '窃取、收买、非法提供信用卡信息案',
        '伪造、变造国家有价证券案', '伪造、变造股票、公司、企业债券案',
        '擅自发行股票、公司、企业债券案', '内幕交易、泄露内幕信息案',
        '利用未公开信息交易案', '编造并传播证券、期货交易虚假信息案',
        '诱骗投资者买卖证券、期货合约案', '操纵证券、期货市场案',
        '背信运用受托财产案', '违法运用资金案', '违法发放贷款案',
        '吸收客户资金不入账案', '违规出具金融票证案', '对违法票据承兑、付款、保证案',
        '骗购外汇案', '逃汇案', '洗钱案', '集资诈骗案', '贷款诈骗案',
        '票据诈骗案', '金融凭证诈骗案', '信用证诈骗案', '信用卡诈骗案',
        '有价证券诈骗案', '保险诈骗案', '逃税案', '抗税案', '逃避追缴欠税案',
        '骗取出口退税案', '虚开增值税专用发票、用于骗取出口退税、抵扣税款发票案',
        '虚开发票案', '伪造、出售伪造的增值税专用发票案', '非法出售增值税专用发票案',
        '非法购买增值税专用发票、购买伪造的增值税专用发票案',
        '非法制造、出售非法制造的用于骗取出口退税、抵扣税款发票案',
        '非法制造、出售非法制造的发票案', '非法出售用于骗取出口退税、抵扣税款发票案',
        '非法出售发票案', '持有伪造的发票案', '损害商业信誉、商品声誉案',
        '虚假广告案', '串通投标案', '合同诈骗案', '组织、领导传销活动案',
        '非法经营案', '非法转让、倒卖土地使用权案', '提供虚假证明文件案',
        '出具证明文件重大失实案', '职务侵占案', '挪用资金案', '虚假诉讼案',
      ], 'report.caseType'),

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

  if (moduleId === 'mass-visit') {
    return [
      f('visitorName', '来访人姓名', 'text', false),
      f('gender', '性别', 'select', false, ['男', '女']),
      f('idNo', '身份证号'),
      f('phone', '联系方式', 'text', false),
      f('address', '住址'),
      f('visitDate', '来访时间', 'date', false),
      f('companions', '陪同人员'),
      f('projectName', '投资项目/平台', 'text', false),
      f('investmentAmount', '投资金额（万元）', 'number'),
      f('investmentDate', '投资时间', 'date'),
      f('actualLoss', '实际损失（万元）', 'number'),
      f('appeal', '主要诉求', 'textarea', false),
      f('disposalOpinion', '处置意见', 'textarea'),
      f('feedback', '反馈情况', 'textarea'),
      ...commonTail,
    ];
  }

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
      f('caseType', '案件类型', 'select', false, [
        '帮助恐怖活动案', '走私假币案', '虚报注册资本案',
        '虚假出资、抽逃出资案', '欺诈发行股票、债券案', '违规披露、不披露重要信息案',
        '妨害清算案', '隐匿、故意销毁会计凭证、会计账簿、财务会计报告案',
        '虚假破产案', '非国家工作人员受贿案', '对非国家工作人员行贿案',
        '对外国公职人员、国际公共组织官员行贿案', '背信损害上市公司利益案',
        '伪造货币案', '出售、购买、运输假币案',
        '金融工作人员购买假币、以假币换取货币案', '持有、使用假币案',
        '变造货币案', '擅自设立金融机构案',
        '伪造、变造、转让金融机构经营许可证、批准文件案', '高利转贷案',
        '骗取贷款、票据承兑、金融票证案', '非法吸收公众存款案',
        '伪造、变造金融票证案', '妨害信用卡管理案', '窃取、收买、非法提供信用卡信息案',
        '伪造、变造国家有价证券案', '伪造、变造股票、公司、企业债券案',
        '擅自发行股票、公司、企业债券案', '内幕交易、泄露内幕信息案',
        '利用未公开信息交易案', '编造并传播证券、期货交易虚假信息案',
        '诱骗投资者买卖证券、期货合约案', '操纵证券、期货市场案',
        '背信运用受托财产案', '违法运用资金案', '违法发放贷款案',
        '吸收客户资金不入账案', '违规出具金融票证案', '对违法票据承兑、付款、保证案',
        '骗购外汇案', '逃汇案', '洗钱案', '集资诈骗案', '贷款诈骗案',
        '票据诈骗案', '金融凭证诈骗案', '信用证诈骗案', '信用卡诈骗案',
        '有价证券诈骗案', '保险诈骗案', '逃税案', '抗税案', '逃避追缴欠税案',
        '骗取出口退税案', '虚开增值税专用发票、用于骗取出口退税、抵扣税款发票案',
        '虚开发票案', '伪造、出售伪造的增值税专用发票案', '非法出售增值税专用发票案',
        '非法购买增值税专用发票、购买伪造的增值税专用发票案',
        '非法制造、出售非法制造的用于骗取出口退税、抵扣税款发票案',
        '非法制造、出售非法制造的发票案', '非法出售用于骗取出口退税、抵扣税款发票案',
        '非法出售发票案', '持有伪造的发票案', '损害商业信誉、商品声誉案',
        '虚假广告案', '串通投标案', '合同诈骗案', '组织、领导传销活动案',
        '非法经营案', '非法转让、倒卖土地使用权案', '提供虚假证明文件案',
        '出具证明文件重大失实案', '职务侵占案', '挪用资金案', '虚假诉讼案',
      ], 'mass.statistics.caseType'),
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
      // 第一阶段：线索/案件信息
      section('线索/案件信息'),
      f('caseNo', '案件编号'),
      f('caseName', '案件名称', 'text', false),
      f('caseSource', '案件来源', 'select', false, ['群众报案', '举报', '上级交办', '部门移送', '工作发现', '自首']),
      f('caseType', '案件类型', 'select', false, [
        '帮助恐怖活动案', '走私假币案', '虚报注册资本案', '虚假出资、抽逃出资案',
        '欺诈发行股票、债券案', '违规披露、不披露重要信息案', '妨害清算案',
        '隐匿、故意销毁会计凭证、会计账簿、财务会计报告案', '虚假破产案',
        '非国家工作人员受贿案', '对非国家工作人员行贿案', '对外国公职人员、国际公共组织官员行贿案',
        '背信损害上市公司利益案', '伪造货币案', '出售、购买、运输假币案',
        '金融工作人员购买假币、以假币换取货币案', '持有、使用假币案', '变造货币案',
        '擅自设立金融机构案', '伪造、变造、转让金融机构经营许可证、批准文件案',
        '高利转贷案', '骗取贷款、票据承兑、金融票证案', '非法吸收公众存款案',
        '伪造、变造金融票证案', '妨害信用卡管理案', '窃取、收买、非法提供信用卡信息案',
        '伪造、变造国家有价证券案', '伪造、变造股票、公司、企业债券案',
        '擅自发行股票、公司、企业债券案', '内幕交易、泄露内幕信息案',
        '利用未公开信息交易案', '编造并传播证券、期货交易虚假信息案',
        '诱骗投资者买卖证券、期货合约案', '操纵证券、期货市场案',
        '背信运用受托财产案', '违法运用资金案', '违法发放贷款案',
        '吸收客户资金不入账案', '违规出具金融票证案', '对违法票据承兑、付款、保证案',
        '骗购外汇案', '逃汇案', '洗钱案', '集资诈骗案', '贷款诈骗案',
        '票据诈骗案', '金融凭证诈骗案', '信用证诈骗案', '信用卡诈骗案',
        '有价证券诈骗案', '保险诈骗案', '逃税案', '抗税案', '逃避追缴欠税案',
        '骗取出口退税案', '虚开增值税专用发票、用于骗取出口退税、抵扣税款发票案',
        '虚开发票案', '伪造、出售伪造的增值税专用发票案', '非法出售增值税专用发票案',
        '非法购买增值税专用发票、购买伪造的增值税专用发票案',
        '非法制造、出售非法制造的用于骗取出口退税、抵扣税款发票案',
        '非法制造、出售非法制造的发票案', '非法出售用于骗取出口退税、抵扣税款发票案',
        '非法出售发票案', '持有伪造的发票案', '损害商业信誉、商品声誉案',
        '虚假广告案', '串通投标案', '合同诈骗案', '组织、领导传销活动案',
        '非法经营案', '非法转让、倒卖土地使用权案', '提供虚假证明文件案',
        '出具证明文件重大失实案', '职务侵占案', '挪用资金案', '虚假诉讼案',
      ], 'evidence.request.caseType'),

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
      f('caseType', '线索/案件类型', 'select', false, [
        '帮助恐怖活动案', '走私假币案', '虚报注册资本案', '虚假出资、抽逃出资案',
        '欺诈发行股票、债券案', '违规披露、不披露重要信息案', '妨害清算案',
        '隐匿、故意销毁会计凭证、会计账簿、财务会计报告案', '虚假破产案',
        '非国家工作人员受贿案', '对非国家工作人员行贿案', '对外国公职人员、国际公共组织官员行贿案',
        '背信损害上市公司利益案', '伪造货币案', '出售、购买、运输假币案',
        '金融工作人员购买假币、以假币换取货币案', '持有、使用假币案', '变造货币案',
        '擅自设立金融机构案', '高利转贷案', '骗取贷款、票据承兑、金融票证案',
        '非法吸收公众存款案', '伪造、变造金融票证案', '妨害信用卡管理案',
        '伪造、变造国家有价证券案', '集资诈骗案', '贷款诈骗案', '票据诈骗案',
        '金融凭证诈骗案', '信用证诈骗案', '信用卡诈骗案', '有价证券诈骗案',
        '保险诈骗案', '逃税案', '抗税案', '骗取出口退税案', '虚开发票案',
        '合同诈骗案', '组织、领导传销活动案', '非法经营案', '职务侵占案',
        '挪用资金案', '虚假诉讼案',
      ], 'evidence.report.caseType'),
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
      f('filingDocNo', '受/立案文书号'),
    ];
  }

  if (moduleId === 'squad-daily') {
    return [
      section('案件基本信息'),
      f('caseNo', '案件编号'),
      f('caseName', '案件名称', 'text', false),
      f('caseType', '案件类型', 'select', false, [
        '帮助恐怖活动案', '走私假币案', '虚报注册资本案',
        '虚假出资、抽逃出资案', '欺诈发行股票、债券案', '违规披露、不披露重要信息案',
        '妨害清算案', '隐匿、故意销毁会计凭证、会计账簿、财务会计报告案',
        '虚假破产案', '非国家工作人员受贿案', '对非国家工作人员行贿案',
        '对外国公职人员、国际公共组织官员行贿案', '背信损害上市公司利益案',
        '伪造货币案', '出售、购买、运输假币案',
        '金融工作人员购买假币、以假币换取货币案', '持有、使用假币案',
        '变造货币案', '擅自设立金融机构案',
        '伪造、变造、转让金融机构经营许可证、批准文件案', '高利转贷案',
        '骗取贷款、票据承兑、金融票证案', '非法吸收公众存款案',
        '伪造、变造金融票证案', '妨害信用卡管理案', '窃取、收买、非法提供信用卡信息案',
        '伪造、变造国家有价证券案', '伪造、变造股票、公司、企业债券案',
        '擅自发行股票、公司、企业债券案', '内幕交易、泄露内幕信息案',
        '利用未公开信息交易案', '编造并传播证券、期货交易虚假信息案',
        '诱骗投资者买卖证券、期货合约案', '操纵证券、期货市场案',
        '背信运用受托财产案', '违法运用资金案', '违法发放贷款案',
        '吸收客户资金不入账案', '违规出具金融票证案', '对违法票据承兑、付款、保证案',
        '骗购外汇案', '逃汇案', '洗钱案', '集资诈骗案', '贷款诈骗案',
        '票据诈骗案', '金融凭证诈骗案', '信用证诈骗案', '信用卡诈骗案',
        '有价证券诈骗案', '保险诈骗案', '逃税案', '抗税案', '逃避追缴欠税案',
        '骗取出口退税案', '虚开增值税专用发票、用于骗取出口退税、抵扣税款发票案',
        '虚开发票案', '伪造、出售伪造的增值税专用发票案', '非法出售增值税专用发票案',
        '非法购买增值税专用发票、购买伪造的增值税专用发票案',
        '非法制造、出售非法制造的用于骗取出口退税、抵扣税款发票案',
        '非法制造、出售非法制造的发票案', '非法出售用于骗取出口退税、抵扣税款发票案',
        '非法出售发票案', '持有伪造的发票案', '损害商业信誉、商品声誉案',
        '虚假广告案', '串通投标案', '合同诈骗案', '组织、领导传销活动案',
        '非法经营案', '非法转让、倒卖土地使用权案', '提供虚假证明文件案',
        '出具证明文件重大失实案', '职务侵占案', '挪用资金案', '虚假诉讼案',
      ], 'daily.caseType'),
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
      f('caseType', '涉案类型', 'select', false, [
        '帮助恐怖活动案', '走私假币案', '虚报注册资本案',
        '虚假出资、抽逃出资案', '欺诈发行股票、债券案', '违规披露、不披露重要信息案',
        '妨害清算案', '隐匿、故意销毁会计凭证、会计账簿、财务会计报告案',
        '虚假破产案', '非国家工作人员受贿案', '对非国家工作人员行贿案',
        '对外国公职人员、国际公共组织官员行贿案', '背信损害上市公司利益案',
        '伪造货币案', '出售、购买、运输假币案',
        '金融工作人员购买假币、以假币换取货币案', '持有、使用假币案',
        '变造货币案', '擅自设立金融机构案',
        '伪造、变造、转让金融机构经营许可证、批准文件案', '高利转贷案',
        '骗取贷款、票据承兑、金融票证案', '非法吸收公众存款案',
        '伪造、变造金融票证案', '妨害信用卡管理案', '窃取、收买、非法提供信用卡信息案',
        '伪造、变造国家有价证券案', '伪造、变造股票、公司、企业债券案',
        '擅自发行股票、公司、企业债券案', '内幕交易、泄露内幕信息案',
        '利用未公开信息交易案', '编造并传播证券、期货交易虚假信息案',
        '诱骗投资者买卖证券、期货合约案', '操纵证券、期货市场案',
        '背信运用受托财产案', '违法运用资金案', '违法发放贷款案',
        '吸收客户资金不入账案', '违规出具金融票证案', '对违法票据承兑、付款、保证案',
        '骗购外汇案', '逃汇案', '洗钱案', '集资诈骗案', '贷款诈骗案',
        '票据诈骗案', '金融凭证诈骗案', '信用证诈骗案', '信用卡诈骗案',
        '有价证券诈骗案', '保险诈骗案', '逃税案', '抗税案', '逃避追缴欠税案',
        '骗取出口退税案', '虚开增值税专用发票、用于骗取出口退税、抵扣税款发票案',
        '虚开发票案', '伪造、出售伪造的增值税专用发票案', '非法出售增值税专用发票案',
        '非法购买增值税专用发票、购买伪造的增值税专用发票案',
        '非法制造、出售非法制造的用于骗取出口退税、抵扣税款发票案',
        '非法制造、出售非法制造的发票案', '非法出售用于骗取出口退税、抵扣税款发票案',
        '非法出售发票案', '持有伪造的发票案', '损害商业信誉、商品声誉案',
        '虚假广告案', '串通投标案', '合同诈骗案', '组织、领导传销活动案',
        '非法经营案', '非法转让、倒卖土地使用权案', '提供虚假证明文件案',
        '出具证明文件重大失实案', '职务侵占案', '挪用资金案', '虚假诉讼案',
      ], 'special.caseType'),
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
      f('caseType', '案件类型', 'select', false, [
        '帮助恐怖活动案', '走私假币案', '虚报注册资本案',
        '虚假出资、抽逃出资案', '欺诈发行股票、债券案', '违规披露、不披露重要信息案',
        '妨害清算案', '隐匿、故意销毁会计凭证、会计账簿、财务会计报告案',
        '虚假破产案', '非国家工作人员受贿案', '对非国家工作人员行贿案',
        '对外国公职人员、国际公共组织官员行贿案', '背信损害上市公司利益案',
        '伪造货币案', '出售、购买、运输假币案',
        '金融工作人员购买假币、以假币换取货币案', '持有、使用假币案',
        '变造货币案', '擅自设立金融机构案',
        '伪造、变造、转让金融机构经营许可证、批准文件案', '高利转贷案',
        '骗取贷款、票据承兑、金融票证案', '非法吸收公众存款案',
        '伪造、变造金融票证案', '妨害信用卡管理案', '窃取、收买、非法提供信用卡信息案',
        '伪造、变造国家有价证券案', '伪造、变造股票、公司、企业债券案',
        '擅自发行股票、公司、企业债券案', '内幕交易、泄露内幕信息案',
        '利用未公开信息交易案', '编造并传播证券、期货交易虚假信息案',
        '诱骗投资者买卖证券、期货合约案', '操纵证券、期货市场案',
        '背信运用受托财产案', '违法运用资金案', '违法发放贷款案',
        '吸收客户资金不入账案', '违规出具金融票证案', '对违法票据承兑、付款、保证案',
        '骗购外汇案', '逃汇案', '洗钱案', '集资诈骗案', '贷款诈骗案',
        '票据诈骗案', '金融凭证诈骗案', '信用证诈骗案', '信用卡诈骗案',
        '有价证券诈骗案', '保险诈骗案', '逃税案', '抗税案', '逃避追缴欠税案',
        '骗取出口退税案', '虚开增值税专用发票、用于骗取出口退税、抵扣税款发票案',
        '虚开发票案', '伪造、出售伪造的增值税专用发票案', '非法出售增值税专用发票案',
        '非法购买增值税专用发票、购买伪造的增值税专用发票案',
        '非法制造、出售非法制造的用于骗取出口退税、抵扣税款发票案',
        '非法制造、出售非法制造的发票案', '非法出售用于骗取出口退税、抵扣税款发票案',
        '非法出售发票案', '持有伪造的发票案', '损害商业信誉、商品声誉案',
        '虚假广告案', '串通投标案', '合同诈骗案', '组织、领导传销活动案',
        '非法经营案', '非法转让、倒卖土地使用权案', '提供虚假证明文件案',
        '出具证明文件重大失实案', '职务侵占案', '挪用资金案', '虚假诉讼案',
      ], 'legal.caseType'),
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

  if (moduleId === 'squad-case') {
    return [
      // ═══ 步骤1：案件基本信息 ═══
      section('案件基本信息'),
      f('caseNo', '案件编号'),
      f('caseName', '案件名称', 'text', false),
      f('caseSource', '案件来源', 'select', false, [
        '群众报案', '举报', '上级交办', '部门移送', '专项行动', '工作发现', '自首',
      ]),
      f('caseType', '案件类型', 'select', false, [
        '帮助恐怖活动案', '走私假币案', '虚报注册资本案',
        '虚假出资、抽逃出资案', '欺诈发行股票、债券案', '违规披露、不披露重要信息案',
        '妨害清算案', '隐匿、故意销毁会计凭证、会计账簿、财务会计报告案',
        '虚假破产案', '非国家工作人员受贿案', '对非国家工作人员行贿案',
        '对外国公职人员、国际公共组织官员行贿案', '背信损害上市公司利益案',
        '伪造货币案', '出售、购买、运输假币案',
        '金融工作人员购买假币、以假币换取货币案', '持有、使用假币案',
        '变造货币案', '擅自设立金融机构案',
        '伪造、变造、转让金融机构经营许可证、批准文件案', '高利转贷案',
        '骗取贷款、票据承兑、金融票证案', '非法吸收公众存款案',
        '伪造、变造金融票证案', '妨害信用卡管理案', '窃取、收买、非法提供信用卡信息案',
        '伪造、变造国家有价证券案', '伪造、变造股票、公司、企业债券案',
        '擅自发行股票、公司、企业债券案', '内幕交易、泄露内幕信息案',
        '利用未公开信息交易案', '编造并传播证券、期货交易虚假信息案',
        '诱骗投资者买卖证券、期货合约案', '操纵证券、期货市场案',
        '背信运用受托财产案', '违法运用资金案', '违法发放贷款案',
        '吸收客户资金不入账案', '违规出具金融票证案', '对违法票据承兑、付款、保证案',
        '骗购外汇案', '逃汇案', '洗钱案', '集资诈骗案', '贷款诈骗案',
        '票据诈骗案', '金融凭证诈骗案', '信用证诈骗案', '信用卡诈骗案',
        '有价证券诈骗案', '保险诈骗案', '逃税案', '抗税案', '逃避追缴欠税案',
        '骗取出口退税案', '虚开增值税专用发票、用于骗取出口退税、抵扣税款发票案',
        '虚开发票案', '伪造、出售伪造的增值税专用发票案', '非法出售增值税专用发票案',
        '非法购买增值税专用发票、购买伪造的增值税专用发票案',
        '非法制造、出售非法制造的用于骗取出口退税、抵扣税款发票案',
        '非法制造、出售非法制造的发票案', '非法出售用于骗取出口退税、抵扣税款发票案',
        '非法出售发票案', '持有伪造的发票案', '损害商业信誉、商品声誉案',
        '虚假广告案', '串通投标案', '合同诈骗案', '组织、领导传销活动案',
        '非法经营案', '非法转让、倒卖土地使用权案', '提供虚假证明文件案',
        '出具证明文件重大失实案', '职务侵占案', '挪用资金案', '虚假诉讼案',
      ]),
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

const module = (
  departmentId: string,
  departmentLabel: string,
  id: string,
  label: string,
  description: string,
  tabs: string[],
): WorkModule => ({
  id,
  label,
  departmentId,
  departmentLabel,
  description,
  tabs: tabs.map((tab, index) => ({
    id: `${id}-${index + 1}`,
    label: tab,
    fields: fieldsFor(id, tab),
  })),
});

const singleModule = (
  departmentId: string,
  departmentLabel: string,
  id: string,
  label: string,
  description: string,
  tab: string,
  hideTemplateSelector = true,
): WorkModule => ({
  id,
  label,
  departmentId,
  departmentLabel,
  description,
  hideTemplateSelector,
  tabs: [{ id: `${id}-1`, label: tab, fields: fieldsFor(id, tab) }],
});

export const DEPARTMENTS: NavDepartment[] = [
  {
    id: 'office',
    label: '大队办公室',
    icon: Landmark,
    modules: [
      module('office', '大队办公室', 'office-finance-assets', '经费保障', '经费、党费、福利、采购和固定资产等综合保障事项。', ['经费报账', '党费管理', '公务往来', '福利发放', '物资采购', '固定资产']),
      module('office', '大队办公室', 'office-party-attendance', '党建与考勤', '党建活动、人员考勤、值班加班等日常管理。', ['三会一课', '主题党日', '组织生活', '党员管理', '考勤登记', '值班加班']),
      module('office', '大队办公室', 'office-doc-report', '文件与报表', '文件流转、材料归档、报表报送和上传下达。', ['涉密文件', '非涉密文件', '报表上报', '材料归档', '公文处理', '通知传达', '会议精神', '工作反馈', '落实跟踪']),
      singleModule('office', '大队办公室', 'office-cluster', '集群、协同、协查', '集群战役、协同案件和协查事项统一登记。', '登记信息'),
      singleModule('office', '大队办公室', 'office-other', '其他事项', '无法归入固定类目的综合事项，由用户自定义登记。', '用户自定义'),
    ],
  },
  {
    id: 'mass',
    label: '涉众办',
    icon: Users,
    modules: [
      singleModule('mass', '涉众办', 'mass-clue', '涉众线索登记', '群众提供线索、核实情况和移交流转。', '线索信息'),
      singleModule('mass', '涉众办', 'mass-statistics', '涉众数据统计', '涉众案件、人数、金额和追赃挽损统计。', '统计记录'),
      singleModule('mass', '涉众办', 'mass-petition', '信访处理反馈', '上访、12345、信访件处理和反馈闭环。', '信访记录'),
      singleModule('mass', '涉众办', 'mass-interview', '约谈管理', '涉众案件相关人员约谈、笔录和承诺落实。', '约谈记录'),
      singleModule('mass', '涉众办', 'mass-publicity', '宣传工作', '宣传稿件、视频、活动等成果统计。', '宣传记录'),
    ],
  },
  {
    id: 'legal',
    label: '法制室',
    icon: Gavel,
    modules: [
      singleModule('legal', '法制室', 'legal-report-case', '接报案登记', '报案人、报案内容、受理审核和分流处理。', '接报案登记'),
      singleModule('legal', '法制室', 'legal-case-ledger', '案件总台账', '全大队案件登记、来源、承办和基础信息管理。', '案件总台账'),
      singleModule('legal', '法制室', 'legal-special-action', '专项行动', '专项行动部署、任务落实、阶段成果和材料汇总。', '专项行动'),
      module('legal', '法制室', 'legal-assessment', '考核管理', '考核指标、对象、结果、奖惩和整改建议。', ['考核标准', '考核对象', '结果登记', '整改建议']),
    ],
  },
  {
    id: 'squadron',
    label: '案件中队',
    icon: BriefcaseBusiness,
    modules: [
      singleModule('squadron', '案件中队', 'squad-case', '中队案件管理', '中队案件台账、任务分配、进度和质量管控。', '中队案件管理'),
      singleModule('squadron', '案件中队', 'squad-daily', '每日工作记录', '办案民警每日工作、完成情况和下一步计划。', '每日工作记录'),
      singleModule('squadron', '案件中队', 'squad-coercive', '强制措施登记', '拘留、取保、监视居住、逮捕等强制措施登记。', '强制措施登记'),
      singleModule('squadron', '案件中队', 'squad-property', '涉案财物管理', '查封、扣押、冻结、移交和处置情况。', '财物登记'),

    ],
  },
  {
    id: 'evidence',
    label: '调证分析',
    icon: SearchCheck,
    modules: [
      singleModule('evidence', '调证分析', 'evidence-clue', '线索登记', '上级下发、中队移交和资金线索登记。', '线索登记'),
      singleModule('evidence', '调证分析', 'evidence-request', '调证登记', '银行、支付平台、第三方数据调取登记。', '调证登记'),
      singleModule('evidence', '调证分析', 'evidence-freeze', '资金查控', '涉案账户冻结、续冻、解冻和执行银行记录。', '资金查控'),
      singleModule('evidence', '调证分析', 'evidence-phone-collection', '设备采集', '涉案电子设备信息采集与登记。', '设备采集'),
      singleModule('evidence', '调证分析', 'evidence-report', '资金分析', '资金流向、账户关联、分析结论和报告提交。', '资金分析'),
    ],
  },
];

export const PLATFORM_NAV = {
  top: [
    { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
    { id: 'graph', label: '案件图谱', icon: SearchCheck },
    { id: 'timeline', label: '案件时间轴', icon: Clock },
    { id: 'dailyNotes', label: '日常随手记', icon: StickyNote },
  ],
  data: [
    { id: 'systemSettings', label: '系统设置', icon: Settings },
    { id: 'statistics', label: '统计分析', icon: PieChart },
    { id: 'importExport', label: '导入导出', icon: TableProperties },
    { id: 'attachments', label: '附件档案', icon: FileArchive },
    { id: 'operationLog', label: '操作日志', icon: ScrollText },
    { id: 'backup', label: '备份恢复', icon: DatabaseBackup },
  ],
};

export const ICONS = {
  Archive,
  Banknote,
  BookOpenCheck,
  ClipboardCheck,
  FileSearch,
  FileText,
  FolderKanban,
  Handshake,
  ListChecks,
  LockKeyhole,
  Megaphone,
  MessageSquareText,
  WalletCards,
};

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
