import type { bulk as en } from '../en/bulk';

export const bulk: Record<keyof typeof en, string> = {
  'bulk.title.english': '标记已掌握的等级',
  'bulk.title.chinese': '这些我已经会了',
  'bulk.desc.english': '英语已经很熟练？将已掌握的 CEFR 等级标记为已知，跳过入门词汇，直接安排中级词汇。',
  'bulk.desc.chinese': '已经学过中文？将已掌握的等级标记为已知，跳过入门词汇，直接安排中级词汇。',
  'bulk.markedKnown': '已标记为已掌握',
  'bulk.markKnown': '标记为已掌握',
};
