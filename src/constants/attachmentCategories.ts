/**
 * 附件分类统一枚举（单一事实源）
 * 录入时选择、详情页按分类分组展示、列表筛选均引用此处，避免各处重复硬编码。
 */
export const ATTACHMENT_CATEGORIES = [
  '书证',
  '笔录',
  '银行流水',
  '鉴定意见',
  '照片',
  '音视频',
  '其他',
] as const;

export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

/** 默认分类 */
export const DEFAULT_ATTACHMENT_CATEGORY: AttachmentCategory = '其他';
