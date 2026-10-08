export type UiLanguage = 'en' | 'zh';

export const TRANSLATIONS: Record<UiLanguage, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.learn': 'Paths & Grammar',
    'nav.topics': 'Topic Training',
    'nav.dictionary': 'Dictionary',
    'nav.insights': 'Insights',
    'nav.badges': 'Badges',
    'nav.settings': 'Settings',
    'nav.irregular': 'Irregular Verbs',
    'nav.grammar': 'Grammar Wikipedia',

    // Header & Course Switcher
    'header.course': 'Course',
    'header.course.chinese': 'Chinese (HSK)',
    'header.course.english': 'English (CEFR/CET)',
    'header.lang': 'Language',
    'header.sync': 'Sync',

    // Dashboard Hero & Schedule
    'dashboard.dailySchedule': 'FSRS Daily Schedule',
    'dashboard.dueAndNew': '{due} reviews + {new} new',
    'dashboard.allCaughtUp': 'All caught up for today!',
    'dashboard.estimatedTime': 'Estimated time: about {min} min ({reviewed}/{cap} reviewed today)',
    'dashboard.restMessage': 'Great job! Memory consolidates during rest. You can still do extra practice below.',
    'dashboard.startSession': "Start today's session",
    'dashboard.extraPractice': 'Extra practice ({count})',
    'dashboard.placementTest': 'Take placement test',
    'dashboard.bulkMark': 'I already know this (mark levels)',
    'dashboard.topicTraining': 'Topic training (Kitchen, Furniture, Animals...)',
    'dashboard.customPractice': 'Custom practice (modes & levels)',
    'dashboard.hideCustomPractice': 'Hide custom practice',
    'dashboard.recommended': 'Recommended for you',
    'dashboard.irregularVerbsHero': 'Irregular Verbs Drill (V₁ / V₂ / V₃)',
    'dashboard.grammarHero': 'English Grammar Wikipedia & SPO Master Blueprint',

    // Dashboard Tiles
    'dashboard.streak': 'Streak',
    'dashboard.today': 'Today',
    'dashboard.trueRetention': 'True Retention',
    'dashboard.speed': 'Speed',
    'dashboard.bestDays': 'best {best}d',
    'dashboard.ofGoal': 'of {cap} goal',
    'dashboard.perCard': 'per card',
    'dashboard.matureCards': '{count} mature cards',
    'dashboard.needsMatureCards': 'needs ≥21d cards',
    'dashboard.retentionTooltip': 'Accuracy on mature cards (scheduled interval ≥ 21 days)',

    // Syllabus Progress
    'dashboard.syllabusProgress': 'Syllabus progress',
    'dashboard.wordsLearned': '{seen} of {total} words learned or started',
    'dashboard.currentLevel': 'current',
    'dashboard.learningPaths': 'Learning paths',
    'dashboard.topicTrainingBtn': 'Topic training',
    'dashboard.bulkMarkLevels': 'Bulk mark levels',

    // Settings Modal
    'settings.title': 'Settings & Preferences',
    'settings.uiLanguage': 'Interface Language',
    'settings.uiLanguageDesc': 'Choose between English and Simplified Chinese interface.',
    'settings.course': 'Course Track',
    'settings.curriculum': 'Curriculum standard',
    'settings.dailyCap': 'Daily review cap',
    'settings.newCards': 'New cards per day',
    'settings.speechRate': 'Speech speed',
    'settings.colorTones': 'Tone colors',
    'settings.soundEffects': 'Sound effects',
    'settings.theme': 'Appearance theme',
    'settings.theme.system': 'System default',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.close': 'Done',
    'settings.pace': 'Learning Pace & Goals',
    'settings.pace.casual': 'Casual',
    'settings.pace.steady': 'Steady (Recommended)',
    'settings.pace.ambitious': 'Ambitious',
    'settings.pace.intensive': 'Intensive',
    'settings.pace.custom': 'Custom',
    'settings.sessionSize': 'Cards per sprint session',
    'settings.sessionSizeDesc': 'Number of cards in each focused study session',
    'settings.dailyCapDesc': 'Maximum due cards scheduled per day',
    'settings.newCardsDesc': 'Brand new words introduced each day',
    'settings.pinyinHelper': 'Chinese Character & Pinyin Assistant',
    'settings.pinyinHelperDesc': 'Customize how Pinyin pronunciation is revealed for Chinese characters.',
    'settings.pinyinMode': 'Pinyin display behavior',
    'settings.pinyinMode.adaptive': 'Adaptive (Auto-reveal for struggled words)',
    'settings.pinyinMode.flip': 'Click to Flip only (Peek on demand)',
    'settings.pinyinMode.always': 'Always Visible',
    'settings.pinyinMode.never': 'Off (Pure immersion)',
    'settings.pinyinThreshold': 'Mistake threshold for auto-reveal',
    'settings.pinyinThresholdDesc': 'Automatically reveals Pinyin when a word has this many review failures.',
    'card.flipToPinyin': 'Tap character to peek Pinyin',
    'card.flipToHanzi': 'Tap to flip back to character',
    'card.peekPinyinBtn': 'Peek Pinyin',
    'card.showHanziBtn': 'Show Character',
    'card.adaptiveScaffold': 'Adaptive helper: {count} mistakes · Pinyin auto-revealed',
    'card.stumbledNotice': 'Stumbled {count}× · Tap character to peek Pinyin',

    // Common
    'common.search': 'Search words...',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.level': 'Level',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.finish': 'Finish',
    'common.loading': 'Loading...',
    'common.practice': 'Practice',

    // Audio speed
    'speed.label': 'Playback speed',
    'speed.slow': 'Slow replay',
    'speed.slowHint': 'Hold or Shift+click to replay slowly once',
    'speed.cycle': 'Speed {rate}× — press S to change',
  },
  zh: {
    // Navigation
    'nav.dashboard': '控制面板',
    'nav.learn': '学习路线与语法',
    'nav.topics': '主题分类训练',
    'nav.dictionary': '词典速查',
    'nav.insights': '学习数据统计',
    'nav.badges': '成就勋章',
    'nav.settings': '偏好设置',
    'nav.irregular': '不规则动词',
    'nav.grammar': '语法百科与时态',

    // Header & Course Switcher
    'header.course': '当前课程',
    'header.course.chinese': '中文 (HSK汉语考级)',
    'header.course.english': '英语 (CEFR/中高考/四六级)',
    'header.lang': '界面语言',
    'header.sync': '多端同步',

    // Dashboard Hero & Schedule
    'dashboard.dailySchedule': 'FSRS 每日复习计划',
    'dashboard.dueAndNew': '{due} 个待复习 + {new} 个新词',
    'dashboard.allCaughtUp': '今日学习任务已全部完成！',
    'dashboard.estimatedTime': '预计用时：约 {min} 分钟（今日已学 {reviewed}/{cap}）',
    'dashboard.restMessage': '太棒了！休息时记忆会进一步巩固。如果想继续，可以在下方进行巩固练习。',
    'dashboard.startSession': '开始今日学习',
    'dashboard.extraPractice': '巩固练习 ({count})',
    'dashboard.placementTest': '水平定级测试',
    'dashboard.bulkMark': '已掌握这些词（批量标记）',
    'dashboard.topicTraining': '分类主题词汇（厨房、家居、动物...）',
    'dashboard.customPractice': '自定义练习（题型与等级）',
    'dashboard.hideCustomPractice': '收起自定义练习',
    'dashboard.recommended': '为你推荐',
    'dashboard.irregularVerbsHero': '不规则动词专项特训 (原形 / 过去式 / 分词)',
    'dashboard.grammarHero': '英语语法百科全书与 SPO 时态全览',

    // Dashboard Tiles
    'dashboard.streak': '连续打卡',
    'dashboard.today': '今日进度',
    'dashboard.trueRetention': '长期记忆率',
    'dashboard.speed': '答题速度',
    'dashboard.bestDays': '最高 {best} 天',
    'dashboard.ofGoal': '目标 {cap} 词',
    'dashboard.perCard': '每词平均',
    'dashboard.matureCards': '{count} 个熟词',
    'dashboard.needsMatureCards': '需≥21天熟词',
    'dashboard.retentionTooltip': '熟词准确率（复习间隔 ≥ 21 天的成熟卡片）',

    // Syllabus Progress
    'dashboard.syllabusProgress': '课程大纲进度',
    'dashboard.wordsLearned': '已掌握或开始学习 {seen}/{total} 个词汇',
    'dashboard.currentLevel': '当前阶段',
    'dashboard.learningPaths': '进阶学习路线',
    'dashboard.topicTrainingBtn': '主题场景词汇',
    'dashboard.bulkMarkLevels': '批量标记掌握',

    // Settings Modal
    'settings.title': '系统设置与偏好',
    'settings.uiLanguage': '界面语言',
    'settings.uiLanguageDesc': '在英文界面与简体中文界面之间自由切换。',
    'settings.course': '学习课程与目标语言',
    'settings.curriculum': '考纲标准',
    'settings.dailyCap': '每日复习上限',
    'settings.newCards': '每日新学词数',
    'settings.speechRate': '语音朗读语速',
    'settings.colorTones': '拼音声调颜色',
    'settings.soundEffects': '答题反馈音效',
    'settings.theme': '主题外观',
    'settings.theme.system': '跟随系统',
    'settings.theme.light': '浅色模式',
    'settings.theme.dark': '深色模式',
    'settings.close': '完成',
    'settings.pace': '学习节奏与每日目标',
    'settings.pace.casual': '休闲',
    'settings.pace.steady': '稳步 (推荐)',
    'settings.pace.ambitious': '高效进阶',
    'settings.pace.intensive': '高强冲刺',
    'settings.pace.custom': '自定义',
    'settings.sessionSize': '单次冲刺题量',
    'settings.sessionSizeDesc': '每次专注练习包含的单词卡片数量',
    'settings.dailyCapDesc': '每日复习上限（到期卡片总配额）',
    'settings.newCardsDesc': '每日新学词数（从词库引入的新词量）',
    'settings.pinyinHelper': '汉字拼音智能辅助',
    'settings.pinyinHelperDesc': '自定义汉字发音与拼音的辅助显示方式。',
    'settings.pinyinMode': '拼音显示策略',
    'settings.pinyinMode.adaptive': '智能自适应 (错题/难词自动显示拼音)',
    'settings.pinyinMode.flip': '仅点击翻转 (按需手动查看)',
    'settings.pinyinMode.always': '始终显示拼音',
    'settings.pinyinMode.never': '关闭辅助 (纯汉字沉浸)',
    'settings.pinyinThreshold': '自动提示失误门槛',
    'settings.pinyinThresholdDesc': '单词累计复习失误达到该次数时，自动显示拼音打破记忆阻碍。',
    'card.flipToPinyin': '点击汉字翻转查看拼音',
    'card.flipToHanzi': '点击翻回汉字',
    'card.peekPinyinBtn': '查看拼音',
    'card.showHanziBtn': '查看汉字',
    'card.adaptiveScaffold': '智能辅助：历史失误 {count} 次 · 自动显示拼音',
    'card.stumbledNotice': '曾失误 {count} 次 · 可点击汉字翻转查看拼音',

    // Common
    'common.search': '搜索词汇...',
    'common.filter': '筛选',
    'common.all': '全部',
    'common.level': '等级',
    'common.back': '返回',
    'common.next': '下一步',
    'common.finish': '完成',
    'common.loading': '加载中...',
    'common.practice': '开始练习',

    // Audio speed
    'speed.label': '播放速度',
    'speed.slow': '慢速重播',
    'speed.slowHint': '长按或 Shift+点击可慢速重播一次',
    'speed.cycle': '速度 {rate}× — 按 S 切换',
  },
};

/**
 * Translates a key into the chosen language, interpolating `{param}` variables.
 */
export function t(key: string, lang: UiLanguage = 'en', vars?: Record<string, string | number>): string {
  const dictionary = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  let text = dictionary[key] ?? TRANSLATIONS.en[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }

  return text;
}
