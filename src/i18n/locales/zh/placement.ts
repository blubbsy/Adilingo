import type { placement as en } from '../en/placement';

export const placement: Record<keyof typeof en, string> = {
  'placement.title': '自适应水平测试',
  'placement.testing': '正在测试 {level}',
  'placement.question': '这个词是什么意思？',
  'placement.recommended': '推荐级别：{level}',
  'placement.basis': '根据你的自适应作答，你已扎实掌握 {level} 及以下的词汇。',
  'placement.basisBeginner': '根据你的自适应作答，你已具备扎实的入门级词汇基础。',
  'placement.skip.title': '跳过入门阶段',
  'placement.skip.desc': '将所有 {levels} 的词标记为已掌握，让每日学习队列直接从 {start} 开始。',
  'placement.markAndStart': '将 {levels} 标记为已掌握并开始',
  'placement.keepNew': '全部卡片保持为新词',
};
