import {
  Archive, Banknote, BarChart3,   BookOpenCheck, BookText, BriefcaseBusiness, CalendarCheck,
  CalendarClock, CalendarDays, ClipboardCheck, ClipboardList, DatabaseBackup, FileArchive,
  FileSearch, FileText, FolderKanban, Gavel, Handshake, Inbox, Landmark, LayoutDashboard,
  LayoutGrid, ListChecks, LockKeyhole, MapPinned, Megaphone, MessageSquareText, Network,
  Package, Radar, ScrollText, SearchCheck, Settings, Smartphone, Snowflake,
  StickyNote, TableProperties, Target, Users, WalletCards, Waypoints, Workflow, LineChart, Scale
} from 'lucide-react';

import type { NavDepartment } from './types';
import { module, singleModule } from './moduleBuilders';

export const DEPARTMENTS: NavDepartment[] = [
  {
    id: 'office',
    label: '大队办公室',
    icon: Landmark,
    modules: [
      module('office', '大队办公室', 'office-finance-assets', '经费保障', '经费、党费、福利、采购和固定资产等综合保障事项。', ['经费报账', '党费管理', '公务往来', '福利发放', '物资采购', '固定资产'], Banknote),
      module('office', '大队办公室', 'office-party-attendance', '党建与考勤', '党建活动、人员考勤、值班加班等日常管理。', ['三会一课', '主题党日', '组织生活', '党员管理', '考勤登记', '值班加班'], CalendarCheck),
      module('office', '大队办公室', 'office-doc-report', '文件与报表', '文件流转、材料归档、报表报送和上传下达。', ['涉密文件', '非涉密文件', '报表上报', '材料归档', '公文处理', '通知传达', '会议精神', '工作反馈', '落实跟踪'], FileText),
      singleModule('office', '大队办公室', 'office-cluster', '集群、协同、协查', '集群战役、协同案件和协查事项统一登记。', '登记信息', true, Workflow),
      singleModule('office', '大队办公室', 'office-other', '其他事项', '无法归入固定类目的综合事项，由用户自定义登记。', '用户自定义', true, LayoutGrid),
    ],
  },
  {
    id: 'mass',
    label: '涉众办',
    icon: Users,
    modules: [
      singleModule('mass', '涉众办', 'mass-clue', '涉众线索登记', '群众提供线索、核实情况和移交流转。', '线索信息', true, Radar),
      singleModule('mass', '涉众办', 'mass-statistics', '涉众数据统计', '涉众案件、人数、金额和追赃挽损统计。', '统计记录', true, BarChart3),
      singleModule('mass', '涉众办', 'mass-petition', '信访处理反馈', '上访、12345、信访件处理和反馈闭环。', '信访记录', true, Inbox),
      singleModule('mass', '涉众办', 'mass-interview', '约谈管理', '涉众案件相关人员约谈、笔录和承诺落实。', '约谈记录', true, Handshake),
      singleModule('mass', '涉众办', 'mass-publicity', '宣传工作', '宣传稿件、视频、活动等成果统计。', '宣传记录', true, Megaphone),
    ],
  },
  {
    id: 'legal',
    label: '法制室',
    icon: Gavel,
    modules: [
      singleModule('legal', '法制室', 'legal-report-case', '接报案登记', '报案人、报案内容、受理审核和分流处理。', '接报案登记', true, ClipboardList),
      singleModule('legal', '法制室', 'legal-case-ledger', '案件总台账', '全大队案件登记、来源、承办和基础信息管理。', '案件总台账', true, BookText),
      singleModule('legal', '法制室', 'legal-special-action', '专项行动', '专项行动部署、任务落实、阶段成果和材料汇总。', '专项行动', true, Target),
      module('legal', '法制室', 'legal-assessment', '考核管理', '考核指标、对象、结果、奖惩和整改建议。', ['考核标准', '考核对象', '结果登记', '整改建议'], ClipboardCheck),
    ],
  },
  {
    id: 'squadron',
    label: '案件中队',
    icon: BriefcaseBusiness,
    modules: [
      singleModule('squadron', '案件中队', 'squad-case', '中队案件管理', '中队案件台账、任务分配、进度和质量管控。', '中队案件管理', true, FolderKanban),
      singleModule('squadron', '案件中队', 'squad-daily', '每日工作记录', '办案民警每日工作、完成情况和下一步计划。', '每日工作记录', true, CalendarDays),
      singleModule('squadron', '案件中队', 'squad-coercive', '强制措施登记', '拘留、取保、监视居住、逮捕等强制措施登记。', '强制措施登记', true, LockKeyhole),
      singleModule('squadron', '案件中队', 'squad-property', '涉案财物管理', '查封、扣押、冻结、移交和处置情况。', '财物登记', true, Package),
    ],
  },
  {
    id: 'evidence',
    label: '调证分析',
    icon: SearchCheck,
    modules: [
      singleModule('evidence', '调证分析', 'evidence-clue', '线索登记', '上级下发、中队移交和资金线索登记。', '线索登记', true, MapPinned),
      singleModule('evidence', '调证分析', 'evidence-request', '调证登记', '银行、支付平台、第三方数据调取登记。', '调证登记', true, FileSearch),
      singleModule('evidence', '调证分析', 'evidence-freeze', '资金查控', '涉案账户冻结、续冻、解冻和执行银行记录。', '资金查控', true, Snowflake),
      singleModule('evidence', '调证分析', 'evidence-phone-collection', '设备采集', '涉案电子设备信息采集与登记。', '设备采集', true, Smartphone),
      singleModule('evidence', '调证分析', 'evidence-report', '资金分析', '资金流向、账户关联、分析结论和报告提交。', '资金分析', true, LineChart),
    ],
  },
];


export const PLATFORM_NAV = {
  top: [
    { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
    { id: 'graph', label: '案件图谱', icon: Network },
    { id: 'timeline', label: '案件时间轴', icon: CalendarClock },
    { id: 'linkage', label: '串并案分析', icon: Waypoints },
    { id: 'dailyNotes', label: '日常随手记', icon: StickyNote },
    { id: 'legalForms', label: '文书库', icon: Gavel },
    { id: 'legalKnowledge', label: '典法查阅', icon: Scale },
  ],
  data: [
    { id: 'systemSettings', label: '系统设置', icon: Settings },
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

