import { v4 as uuidv4 } from 'uuid';
import type { ITemplateBlock, TBlockType, TSectionType } from '/@/types/template';

export interface IBlockPaletteItem {
  type: TBlockType;
  label: string;
  sectionType?: TSectionType;
  defaultContent?: string;
}

export const BLOCK_PALETTE: IBlockPaletteItem[] = [
  { type: 'basics', label: '个人信息' },
  { type: 'avatar', label: '头像' },
  { type: 'section', label: '个人简介', sectionType: 'summary' },
  { type: 'section', label: '工作经历', sectionType: 'experience' },
  { type: 'section', label: '教育经历', sectionType: 'education' },
  { type: 'section', label: '专业技能', sectionType: 'skills' },
  { type: 'section', label: '项目经历', sectionType: 'projects' },
  { type: 'section', label: '语言能力', sectionType: 'languages' },
  { type: 'section', label: '证书资质', sectionType: 'certificates' },
  { type: 'divider', label: '分隔线' },
  { type: 'text', label: '静态文本', defaultContent: '在此输入文本' },
  {
    type: 'html',
    label: '自定义 HTML',
    defaultContent: '<div class="custom"><strong>{{basics.name}}</strong> · {{basics.headline}}</div>',
  },
];

export function createBlockFromPalette(item: IBlockPaletteItem): ITemplateBlock {
  return {
    id: uuidv4(),
    type: item.type,
    visible: true,
    sectionType: item.sectionType,
    content: item.defaultContent,
  };
}

export function createEmptyRow(spans: number[] = [12]) {
  return {
    id: uuidv4(),
    columns: spans.map((span) => ({
      id: uuidv4(),
      span,
      blocks: [] as ITemplateBlock[],
    })),
  };
}

export function cloneDeepConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
