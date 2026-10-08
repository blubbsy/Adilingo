import type { study as en } from '../en/study';

export const study: Record<keyof typeof en, string> = {
  'card.flipToPinyin': '点击汉字翻转查看拼音',
  'card.flipToHanzi': '点击翻回汉字',
  'card.peekPinyinBtn': '查看拼音',
  'card.showHanziBtn': '查看汉字',
  'card.adaptiveScaffold': '智能辅助：历史失误 {count} 次 · 自动显示拼音',
  'card.stumbledNotice': '曾失误 {count} 次 · 可点击汉字翻转查看拼音',
  'speed.label': '播放速度',
  'speed.slow': '慢速重播',
  'speed.slowHint': '长按或 Shift+点击可慢速重播一次',
  'speed.cycle': '速度 {rate}× — 按 S 切换',
};
