import type { shell as en } from '../en/shell';

export const shell: Record<keyof typeof en, string> = {
  'nav.dashboard': '控制面板',
  'nav.learn': '学习路线与语法',
  'nav.topics': '主题分类训练',
  'nav.dictionary': '词典速查',
  'nav.insights': '学习数据统计',
  'nav.badges': '成就勋章',
  'nav.settings': '偏好设置',
  'nav.irregular': '不规则动词',
  'nav.grammar': '语法百科与时态',
  'header.course': '当前课程',
  'header.course.chinese': '中文 (HSK汉语考级)',
  'header.course.english': '英语 (CEFR/中高考/四六级)',
  'header.lang': '界面语言',
  'header.sync': '多端同步',
};
