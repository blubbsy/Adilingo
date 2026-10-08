import type { CourseId, SessionRequest, StudyMode, VocabItem } from '../types';
import { getCourseConfig } from './courses';

export type TopicTheme =
  | 'home'
  | 'nature'
  | 'food'
  | 'health'
  | 'travel'
  | 'work'
  | 'lifestyle'
  | 'social';

export const THEME_LABELS: Record<TopicTheme, string> = {
  home: 'Home & Living',
  nature: 'Nature & Animals',
  food: 'Food & Dining',
  health: 'Body & Health',
  travel: 'Travel & Transport',
  work: 'Work & Office',
  lifestyle: 'Daily Lifestyle',
  social: 'Social & People',
};

export interface TopicPack {
  id: string;
  title: string;
  chineseTitle: string;
  emoji: string;
  theme: TopicTheme;
  description: string;
  /** Curated Hanzi words to look up from the curriculum vocabulary library. */
  curatedWords: string[];
  /** Supplementary full items for essential real-world terms not in core HSK lists. */
  supplementaryWords?: VocabItem[];
  /** Built from the course's own word topics; the description is generated when shown (localized). */
  derived?: boolean;
}

export const TOPIC_PACKS: TopicPack[] = [
  // 1. Kitchen & Cooking Tools
  {
    id: 'kitchen-tools',
    title: 'Kitchen & Cooking Tools',
    chineseTitle: '厨房与厨具',
    emoji: '🍳',
    theme: 'home',
    description: 'Cookware, utensils, cutlery, kitchen appliances, and culinary essentials.',
    curatedWords: [
      '厨房', '锅', '刀', '叉', '叉子', '勺', '勺子', '筷子', '碗', '饭碗',
      '盘子', '盘', '盆', '水壶', '壶', '杯子', '微波炉', '冰箱', '炉子', '炉灶',
      '铲子', '调料',
    ],
    supplementaryWords: [
      {
        id: 'supp:kao1xiang1',
        hanzi: '烤箱',
        pinyin: 'kǎo xiāng',
        pinyinNumbered: 'kao3 xiang1',
        english: ['oven'],
        hskLevel: 3,
        levels: {},
        frequency: 2500,
        topics: ['Kitchen & Cooking Tools'],
        exampleSentence: {
          hanzi: '妈妈用烤箱烤了一个蛋糕。',
          pinyin: 'Māma yòng kǎoxiāng kǎole yíge dàngāo.',
          english: 'Mom baked a cake with the oven.',
        },
      },
      {
        id: 'supp:cai4ban3',
        hanzi: '菜板',
        pinyin: 'cài bǎn',
        pinyinNumbered: 'cai4 ban3',
        english: ['cutting board', 'chopping board'],
        hskLevel: 3,
        levels: {},
        frequency: 3200,
        topics: ['Kitchen & Cooking Tools'],
        exampleSentence: {
          hanzi: '请把菜放在菜板上切。',
          pinyin: 'Qǐng bǎ cài fàng zài càibǎn shang qiē.',
          english: 'Please put the vegetables on the cutting board to chop.',
        },
      },
      {
        id: 'supp:wei2qun2',
        hanzi: '围裙',
        pinyin: 'wéi qún',
        pinyinNumbered: 'wei2 qun2',
        english: ['apron'],
        hskLevel: 3,
        levels: {},
        frequency: 3800,
        topics: ['Kitchen & Cooking Tools'],
        exampleSentence: {
          hanzi: '做饭时穿上围裙可以防止弄脏衣服。',
          pinyin: 'Zuò fàn shí chuān shang wéiqún kěyǐ fángzhǐ nòngzāng yīfu.',
          english: 'Wearing an apron when cooking prevents your clothes from getting dirty.',
        },
      },
      {
        id: 'supp:xiao1pi2dao1',
        hanzi: '削皮刀',
        pinyin: 'xiāo pí dāo',
        pinyinNumbered: 'xiao1 pi2 dao1',
        english: ['peeler'],
        hskLevel: 3,
        levels: {},
        frequency: 4100,
        topics: ['Kitchen & Cooking Tools'],
        exampleSentence: {
          hanzi: '我用削皮刀给土豆削皮。',
          pinyin: 'Wǒ yòng xiāopídāo gěi tǔdòu xiāopí.',
          english: 'I use a peeler to peel the potatoes.',
        },
      },
      {
        id: 'supp:xi3jie2jing1',
        hanzi: '洗洁精',
        pinyin: 'xǐ jié jīng',
        pinyinNumbered: 'xi3 jie2 jing1',
        english: ['dish soap', 'dishwashing liquid'],
        hskLevel: 3,
        levels: {},
        frequency: 3900,
        topics: ['Kitchen & Cooking Tools'],
        exampleSentence: {
          hanzi: '洗碗的时候别放太多洗洁精。',
          pinyin: 'Xǐ wǎn de shíhou bié fàng tài duō xǐjiéjīng.',
          english: "Don't use too much dishwashing liquid when doing the dishes.",
        },
      },
    ],
  },

  // 2. Furniture & Home Living
  {
    id: 'furniture',
    title: 'Furniture & Home Living',
    chineseTitle: '家具与家居',
    emoji: '🛋️',
    theme: 'home',
    description: 'Chairs, tables, beds, storage, home decor, and room furnishings.',
    curatedWords: [
      '家具', '桌子', '椅子', '餐桌', '书桌', '写字台', '沙发', '床', '书架', '书柜',
      '地毯', '窗帘', '帘子', '台灯', '灯', '镜子', '抽屉', '柜子', '架子', '枕头',
      '被子', '毯子', '床单', '门', '窗户', '锁', '钥匙',
    ],
    supplementaryWords: [
      {
        id: 'supp:yi1gui4',
        hanzi: '衣柜',
        pinyin: 'yī guì',
        pinyinNumbered: 'yi1 gui4',
        english: ['wardrobe', 'closet'],
        hskLevel: 3,
        levels: {},
        frequency: 2800,
        topics: ['Furniture & Home Living'],
        exampleSentence: {
          hanzi: '我的衣服都挂在衣柜里。',
          pinyin: 'Wǒ de yīfu dōu guà zài yīguì lǐ.',
          english: 'My clothes are all hanging in the wardrobe.',
        },
      },
      {
        id: 'supp:cha2ji1',
        hanzi: '茶几',
        pinyin: 'chá jī',
        pinyinNumbered: 'cha2 ji1',
        english: ['coffee table', 'tea table'],
        hskLevel: 3,
        levels: {},
        frequency: 3400,
        topics: ['Furniture & Home Living'],
        exampleSentence: {
          hanzi: '把茶杯放在茶几上吧。',
          pinyin: 'Bǎ chábēi fàng zài chájī shang ba.',
          english: 'Please put the teacup on the coffee table.',
        },
      },
      {
        id: 'supp:chuang2tou2gui4',
        hanzi: '床头柜',
        pinyin: 'chuáng tóu guì',
        pinyinNumbered: 'chuang2 tou2 gui4',
        english: ['bedside table', 'nightstand'],
        hskLevel: 3,
        levels: {},
        frequency: 3600,
        topics: ['Furniture & Home Living'],
        exampleSentence: {
          hanzi: '台灯放在床头柜上。',
          pinyin: 'Táidēng fàng zài chuángtóuguì shang.',
          english: 'The desk lamp is on the bedside table.',
        },
      },
    ],
  },

  // 3. Animals & Wildlife
  {
    id: 'animals',
    title: 'Animals & Wildlife',
    chineseTitle: '动物与自然',
    emoji: '🐼',
    theme: 'nature',
    description: 'Pets, farm animals, wild creatures, insects, and ocean life.',
    curatedWords: [
      '动物', '宠物', '狗', '猫', '鸟', '鱼', '马', '牛', '奶牛', '羊',
      '猪', '鸡', '鸭子', '鹅', '兔子', '兔', '熊猫', '大熊猫', '老虎', '虎',
      '狮子', '大象', '猴子', '猴', '熊', '蛇', '龟', '鹿', '狼', '蝴蝶',
      '蜜蜂', '鹰',
    ],
    supplementaryWords: [
      {
        id: 'supp:wu1gui1',
        hanzi: '乌龟',
        pinyin: 'wū guī',
        pinyinNumbered: 'wu1 gui1',
        english: ['turtle', 'tortoise'],
        hskLevel: 2,
        levels: {},
        frequency: 2600,
        topics: ['Animals & Wildlife'],
        exampleSentence: {
          hanzi: '乌龟爬得很慢。',
          pinyin: 'Wūguī pá de hěn màn.',
          english: 'Turtles crawl very slowly.',
        },
      },
      {
        id: 'supp:hu2li0',
        hanzi: '狐狸',
        pinyin: 'hú li',
        pinyinNumbered: 'hu2 li0',
        english: ['fox'],
        hskLevel: 3,
        levels: {},
        frequency: 2900,
        topics: ['Animals & Wildlife'],
        exampleSentence: {
          hanzi: '狐狸是一种聪明的动物。',
          pinyin: 'Húli shì yì zhǒng cōngming de dòngwù.',
          english: 'The fox is a smart animal.',
        },
      },
      {
        id: 'supp:qi3e2',
        hanzi: '企鹅',
        pinyin: 'qǐ é',
        pinyinNumbered: 'qi3 e2',
        english: ['penguin'],
        hskLevel: 3,
        levels: {},
        frequency: 3100,
        topics: ['Animals & Wildlife'],
        exampleSentence: {
          hanzi: '企鹅生活在寒冷的南极。',
          pinyin: 'Qǐ’é shēnghuó zài hánlěng de Nánjí.',
          english: 'Penguins live in the cold Antarctic.',
        },
      },
      {
        id: 'supp:hai3tun2',
        hanzi: '海豚',
        pinyin: 'hǎi tún',
        pinyinNumbered: 'hai3 tun2',
        english: ['dolphin'],
        hskLevel: 3,
        levels: {},
        frequency: 3300,
        topics: ['Animals & Wildlife'],
        exampleSentence: {
          hanzi: '海豚对人类非常友好。',
          pinyin: 'Hǎitún duì rénlèi fēicháng yǒuhǎo.',
          english: 'Dolphins are very friendly towards humans.',
        },
      },
    ],
  },

  // 4. Food & Dining Out
  {
    id: 'food',
    title: 'Food & Dining Out',
    chineseTitle: '美食与餐饮',
    emoji: '🍜',
    theme: 'food',
    description: 'Dishes, drinks, ordering meals, dining customs, and flavor profiles.',
    curatedWords: [
      '米饭', '面条', '面包', '包子', '饺子', '火锅', '牛肉', '猪肉', '羊肉', '鸡肉',
      '蔬菜', '水果', '苹果', '香蕉', '西瓜', '鸡蛋', '牛奶', '豆浆', '咖啡', '茶',
      '绿茶', '红茶', '啤酒', '菜单', '点菜', '买单', '味道', '好吃', '甜', '苦',
      '辣', '咸', '酸',
    ],
  },

  // 5. Body Parts & Health
  {
    id: 'body-health',
    title: 'Body Parts & Health',
    chineseTitle: '身体与健康',
    emoji: '🩺',
    theme: 'health',
    description: 'Human anatomy, common ailments, medical care, and wellness.',
    curatedWords: [
      '身体', '头', '头发', '眼睛', '耳朵', '鼻子', '嘴', '嘴巴', '牙齿', '舌头',
      '脸', '脖子', '肩膀', '手', '手指', '胳膊', '肚子', '腿', '脚', '心脏',
      '肌肉', '骨头', '医生', '护士', '医院', '药', '生病', '感冒', '发烧', '咳嗽',
      '头疼', '疼',
    ],
  },

  // 6. Travel, Airport & Transport
  {
    id: 'travel-transport',
    title: 'Travel & Transport',
    chineseTitle: '出行与交通',
    emoji: '✈️',
    theme: 'travel',
    description: 'Flights, train travel, city transit, luggage, tickets, and hotels.',
    curatedWords: [
      '飞机', '机场', '航班', '火车', '火车站', '地铁', '公交车', '出租车', '自行车', '轮船',
      '船', '票', '车票', '机票', '护照', '签证', '行李', '行李箱', '酒店', '宾馆',
      '预订', '地图', '出发', '到达', '旅游', '旅行', '导游', '路', '车站', '司机',
    ],
  },

  // 7. Work, Office & Careers
  {
    id: 'work-office',
    title: 'Work & Office',
    chineseTitle: '职场与办公',
    emoji: '💼',
    theme: 'work',
    description: 'Workplace communication, office equipment, meetings, and business terms.',
    curatedWords: [
      '公司', '办公室', '电脑', '笔记本', '打印机', '屏幕', '键盘', '鼠标', '笔', '纸',
      '文件', '邮件', '会议', '开会', '同事', '老板', '经理', '客户', '项目', '报告',
      '计划', '合同', '工资', '面试', '简历', '职业', '工作', '加班', '休假',
    ],
  },

  // 8. Weather, Seasons & Nature
  {
    id: 'weather-seasons',
    title: 'Weather & Seasons',
    chineseTitle: '天气与四季',
    emoji: '⛅',
    theme: 'nature',
    description: 'Meteorological terms, four seasons, temperature, and natural phenomena.',
    curatedWords: [
      '天气', '气候', '晴天', '阴天', '多云', '下雨', '下雪', '刮风', '太阳', '月亮',
      '星星', '云', '雷', '闪电', '彩虹', '温度', '气温', '度', '冷', '热',
      '暖和', '凉快', '春天', '夏天', '秋天', '冬天', '季节', '风', '雪', '雨',
    ],
  },

  // 9. Clothing & Fashion
  {
    id: 'clothing',
    title: 'Clothing & Fashion',
    chineseTitle: '服饰与穿搭',
    emoji: '👗',
    theme: 'lifestyle',
    description: 'Apparel, footwear, accessories, jewelry, and getting dressed.',
    curatedWords: [
      '衣服', '衬衫', '裤子', '外套', '大衣', '毛衣', '裙子', '连衣裙', '西装', '鞋',
      '鞋子', '运动鞋', '皮鞋', '袜子', '帽子', '手套', '围巾', '皮带', '领带', '眼镜',
      '墨镜', '手表', '包', '书包', '钱包', '雨伞', '穿', '戴',
    ],
    supplementaryWords: [
      {
        id: 'supp:ti1xu4',
        hanzi: 'T恤',
        pinyin: 'T xù',
        pinyinNumbered: 'T xu4',
        english: ['T-shirt'],
        hskLevel: 2,
        levels: {},
        frequency: 2100,
        topics: ['Clothing & Fashion'],
        exampleSentence: {
          hanzi: '夏天穿纯棉T恤很舒服。',
          pinyin: 'Xiàtiān chuān chúnmián T-xù hěn shūfu.',
          english: 'Wearing a cotton T-shirt is very comfortable in summer.',
        },
      },
      {
        id: 'supp:niu2zai3ku4',
        hanzi: '牛仔裤',
        pinyin: 'niú zǎi kù',
        pinyinNumbered: 'niu2 zai3 ku4',
        english: ['jeans'],
        hskLevel: 2,
        levels: {},
        frequency: 2300,
        topics: ['Clothing & Fashion'],
        exampleSentence: {
          hanzi: '他喜欢穿蓝色牛仔裤。',
          pinyin: 'Tā xǐhuan chuān lánsè niúzǎikù.',
          english: 'He likes wearing blue jeans.',
        },
      },
    ],
  },

  // 10. Family & Relationships
  {
    id: 'family',
    title: 'Family & Relationships',
    chineseTitle: '家庭与亲友',
    emoji: '👨‍👩‍👧',
    theme: 'social',
    description: 'Family tree, kinship terms, close relatives, friends, and social circles.',
    curatedWords: [
      '家庭', '家人', '父母', '父亲', '母亲', '爸爸', '妈妈', '儿子', '女儿', '哥哥',
      '弟弟', '姐姐', '妹妹', '爷爷', '奶奶', '外公', '外婆', '丈夫', '妻子', '亲戚',
      '朋友', '邻居', '同学', '先生', '女士', '孩子', '大人', '老人', '客人',
    ],
  },

  // 11. Emotions & Personality
  {
    id: 'emotions',
    title: 'Emotions & Personality',
    chineseTitle: '情绪与性格',
    emoji: '😊',
    theme: 'social',
    description: 'Feelings, moods, mental states, temperament, and personal traits.',
    curatedWords: [
      '情绪', '心情', '开心', '高兴', '快乐', '伤心', '难过', '生气', '发脾气', '害怕',
      '担心', '紧张', '兴奋', '满意', '骄傲', '害羞', '自信', '热情', '认真', '幽默',
      '聪明', '善良', '勇敢', '耐心', '奇怪', '孤独', '轻松', '难受', '着急',
    ],
  },

  // 12. Shopping, Money & Stores
  {
    id: 'shopping',
    title: 'Shopping & Finance',
    chineseTitle: '购物与消费',
    emoji: '💳',
    theme: 'lifestyle',
    description: 'Payment methods, shopping, prices, bargaining, discounts, and stores.',
    curatedWords: [
      '钱', '人民币', '现金', '信用卡', '银行', '账户', '价格', '便宜', '贵', '打折',
      '特价', '买', '卖', '付钱', '支付', '发票', '收据', '商店', '超市', '商场',
      '市场', '质量', '购物', '花费', '顾客', '收费', '售货员', '省钱',
    ],
  },

  // 13. Education & School
  {
    id: 'education',
    title: 'Education & Study',
    chineseTitle: '学习与校园',
    emoji: '🎓',
    theme: 'lifestyle',
    description: 'Classroom life, stationery, exams, degrees, language learning, and books.',
    curatedWords: [
      '学校', '大学', '中学', '小学', '教室', '图书馆', '老师', '学生', '同学', '书',
      '课本', '本子', '作业', '考试', '成绩', '学期', '学习', '练习', '复习', '问题',
      '答案', '课程', '毕业', '生词', '语法', '发音', '字典',
    ],
  },

  // 14. Sports, Hobbies & Free Time
  {
    id: 'sports-hobbies',
    title: 'Sports & Hobbies',
    chineseTitle: '运动与休闲',
    emoji: '⚽',
    theme: 'lifestyle',
    description: 'Athletic activities, recreational hobbies, outdoor sports, and games.',
    curatedWords: [
      '运动', '足球', '篮球', '网球', '乒乓球', '游泳', '跑步', '羽毛球', '音乐', '电影',
      '摄影', '画画', '看书', '唱歌', '跳舞', '旅游', '游戏', '比赛', '健身', '爬山',
      '滑雪', '吉他', '钢琴', '棋', '散步', '爱好',
    ],
  },
];

/**
 * Resolves all words for a given topic pack using the loaded curriculum vocabulary,
 * combining curated matches with supplementary items.
 */
export function resolveTopicWords(pack: TopicPack, allVocab: VocabItem[]): VocabItem[] {
  const mapByHanzi = new Map<string, VocabItem>();
  for (const item of allVocab) {
    if (!mapByHanzi.has(item.hanzi)) {
      mapByHanzi.set(item.hanzi, item);
    }
  }

  const results: VocabItem[] = [];
  const addedIds = new Set<string>();

  // 1. Add curated words that exist in curriculum vocab
  for (const hanzi of pack.curatedWords) {
    const found = mapByHanzi.get(hanzi);
    if (found && !addedIds.has(found.id)) {
      results.push(found);
      addedIds.add(found.id);
    }
  }

  // 2. Add supplementary words defined in pack
  if (pack.supplementaryWords) {
    for (const supp of pack.supplementaryWords) {
      if (!addedIds.has(supp.id)) {
        results.push(supp);
        addedIds.add(supp.id);
      }
    }
  }

  return results;
}

/**
 * Packs for the active course. Curated packs list Chinese words, so they exist only for the Chinese
 * course (never show Chinese-script words in the English course). Other courses get one pack per
 * topic found on their own vocabulary.
 */
export function packsForCourse(course: CourseId | undefined, vocab: VocabItem[]): TopicPack[] {
  if (getCourseConfig(course).features.topics === 'curated-packs') return TOPIC_PACKS;

  const byTopic = new Map<string, VocabItem[]>();
  for (const item of vocab) {
    for (const topic of item.topics) {
      const list = byTopic.get(topic) ?? [];
      list.push(item);
      byTopic.set(topic, list);
    }
  }
  return [...byTopic.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([topic, words]) => ({
      id: `topic:${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: topic,
      chineseTitle: topic,
      emoji: '📚',
      theme: 'lifestyle' as TopicTheme,
      description: '',
      derived: true,
      curatedWords: [],
      supplementaryWords: words,
    }));
}

/**
 * The session request for drilling a topic pack. Pack words are matched by id only (a `topics` filter
 * would drop curated words that do not carry the pack title) and supplementary words that are not in
 * the course library travel with the request so the session pool can contain them.
 */
export function buildTopicSessionRequest(
  words: VocabItem[],
  mode: StudyMode,
  label: string,
  limit?: number,
): SessionRequest {
  return {
    label,
    mode,
    levels: [],
    topics: [],
    wordIds: words.map((w) => w.id),
    extraItems: words,
    includeNotDue: true,
    ignoreCap: true,
    limit,
  };
}
