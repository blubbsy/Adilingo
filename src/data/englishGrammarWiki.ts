export type GrammarCategory =
  | 'tenses'
  | 'clauses'
  | 'verbals'
  | 'sentence_structure'
  | 'modal_verbs'
  | 'conditionals'
  | 'voice'
  | 'articles_nouns'
  | 'prepositions';

export interface GrammarWikiArticle {
  id: string;
  titleEn: string;
  titleZh: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  category: GrammarCategory;
  summaryZh: string;
  formula?: string;
  rules: {
    ruleZh: string;
    exampleEn: string;
    exampleZh: string;
    highlight?: string;
  }[];
  pitfallsZh?: string; // Common mistakes / 避坑指南
  keywords: string[];
}

export const GRAMMAR_CATEGORIES: { id: GrammarCategory | 'all'; labelZh: string; icon: string }[] = [
  { id: 'all', labelZh: '全部语法专题', icon: '📚' },
  { id: 'tenses', labelZh: '时态体系与SPO', icon: '⏱️' },
  { id: 'sentence_structure', labelZh: '核心句型与倒装', icon: '🏗️' },
  { id: 'clauses', labelZh: '三大从句(定/名/状)', icon: '🔗' },
  { id: 'verbals', labelZh: '非谓语(不定式/动名词/分词)', icon: '⚡' },
  { id: 'modal_verbs', labelZh: '情态动词与推测', icon: '🎯' },
  { id: 'conditionals', labelZh: '虚拟语气与条件句', icon: '🔮' },
  { id: 'voice', labelZh: '被动语态蜕变', icon: '🔄' },
  { id: 'articles_nouns', labelZh: '冠词与名词单复数', icon: '📝' },
  { id: 'prepositions', labelZh: '介词与逻辑连词', icon: '📍' },
];

export const ENGLISH_GRAMMAR_WIKI: GrammarWikiArticle[] = [
  // 1. Five Basic Sentence Patterns
  {
    id: 'five-sentence-patterns',
    titleEn: 'Five Basic Sentence Patterns',
    titleZh: '英语五大基本句型 (SPO 骨架)',
    level: 'A1',
    category: 'sentence_structure',
    summaryZh: '英语所有千变万化的长难句，究其本质都是由这五种核心主谓宾骨架扩展而来的。',
    formula: '① S+V | ② S+V+O | ③ S+V+P | ④ S+V+IO+DO | ⑤ S+V+O+C',
    rules: [
      {
        ruleZh: '1. 主 + 谓 (S + V)：不及物动词，动作不涉及外物即可表达完整意义。',
        exampleEn: 'The sun rises in the east.',
        exampleZh: '太阳从东方升起。',
        highlight: 'rises',
      },
      {
        ruleZh: '2. 主 + 谓 + 宾 (S + V + O)：及物动词，动作必须有直接承受者。',
        exampleEn: 'She bought a new laptop yesterday.',
        exampleZh: '她昨天买了一台新笔记本电脑。',
        highlight: 'bought a new laptop',
      },
      {
        ruleZh: '3. 主 + 系 + 表 (S + V + P)：连系动词(be, look, seem, feel)连接主语与说明特征的表语。',
        exampleEn: 'The coffee smells wonderful.',
        exampleZh: '咖啡闻起来很香。',
        highlight: 'smells wonderful',
      },
      {
        ruleZh: '4. 主 + 谓 + 间宾 + 直宾 (S + V + IO + DO)：双宾语结构，动作涉及人(间宾)和物(直宾)。',
        exampleEn: 'He gave me a valuable suggestion.',
        exampleZh: '他给了我一条宝贵的建议。(me 为间接宾语，suggestion 为直接宾语)',
        highlight: 'gave me a valuable suggestion',
      },
      {
        ruleZh: '5. 主 + 谓 + 宾 + 宾补 (S + V + O + C)：宾语之后需要补充成分(说明宾语的状态或动作)句子才完整。',
        exampleEn: 'Music makes him happy.',
        exampleZh: '音乐使他快乐。(happy 补充说明 him 的状态)',
        highlight: 'makes him happy',
      },
    ],
    pitfallsZh: '双宾语可以转化为介词短语：give sb sth = give sth TO sb；buy sb sth = buy sth FOR sb。',
    keywords: ['sentence patterns', '基本句型', '主谓宾', '主系表', '双宾语', '宾补'],
  },

  // 2. Attributive Clauses
  {
    id: 'attributive-clauses',
    titleEn: 'Attributive Clauses (Relative Clauses)',
    titleZh: '定语从句 (修饰先行词的后置定语)',
    level: 'B1',
    category: 'clauses',
    summaryZh: '用来修饰名词或代词(先行词)的句子，相当于一个起形容词修饰作用的从句，紧跟在被修饰词后面。',
    formula: '先行词 (名词/代词) + 关系词 (that / which / who / whom / whose / where / when / why) + 从句',
    rules: [
      {
        ruleZh: '指人作主语或宾语：who (主/宾), whom (仅宾语), that (主/宾)。',
        exampleEn: 'The teacher who taught us physics has retired.',
        exampleZh: '教我们物理的那位老师已经退休了。',
        highlight: 'who taught us physics',
      },
      {
        ruleZh: '指物作主语或宾语：which, that。',
        exampleEn: 'This is the book that inspired millions of readers.',
        exampleZh: '这就是鼓舞了数百万读者的那本书。',
        highlight: 'that inspired millions',
      },
      {
        ruleZh: '表示所属“某人的/某物的”：whose + 名词。',
        exampleEn: 'I met a writer whose novels are bestsellers.',
        exampleZh: '我遇到了一位其小说十分畅销的作家。',
        highlight: 'whose novels',
      },
      {
        ruleZh: '关系副词表示地点/时间/原因：where (在那个地方), when (在那时), why (原因)。',
        exampleEn: 'This is the school where I studied for three years.',
        exampleZh: '这就是我读了三年的学校。',
        highlight: 'where I studied',
      },
    ],
    pitfallsZh: '非限制性定语从句(有逗号隔开)中绝对不能用 that，指物只能用 which，指人只能用 who！',
    keywords: ['attributive clause', '定语从句', 'relative clause', '先行词', 'that', 'which', 'who', 'whose', 'where'],
  },

  // 3. Noun Clauses
  {
    id: 'noun-clauses',
    titleEn: 'Noun Clauses (Subject, Object, Predicative, Appositive)',
    titleZh: '名词性从句 (主语从句 / 宾语从句 / 表语从句 / 同位语从句)',
    level: 'B1',
    category: 'clauses',
    summaryZh: '在复合句中充当名词角色的从句。根据位置不同，分别充当主语、宾语、表语或同位语。',
    formula: '连接词 (that / whether / what / who / how / why) + 完整陈述语序从句',
    rules: [
      {
        ruleZh: '宾语从句：置于及物动词或介词之后，作句子的宾语。',
        exampleEn: 'I know that hard work pays off in the end.',
        exampleZh: '我知道努力工作终会有回报。(that从句作know的宾语)',
        highlight: 'that hard work pays off',
      },
      {
        ruleZh: '主语从句：从句作整个句子的主语；常借助形式主语 It 避免头重脚轻。',
        exampleEn: 'It is obvious that climate change affects us all.',
        exampleZh: '显而易见，气候变化影响着我们所有人。(It为形式主语)',
        highlight: 'that climate change affects us all',
      },
      {
        ruleZh: '同位语从句：紧跟在 idea, fact, news, belief 等抽象名词后，具体解释其内容。',
        exampleEn: 'We heard the news that our team won the championship.',
        exampleZh: '我们听到了我们队伍赢得冠军的消息。',
        highlight: 'that our team won the championship',
      },
    ],
    pitfallsZh: '无论是宾语从句还是主语从句，连接词引导的从句内部必须使用【陈述语序】，绝不能倒装！(例如: I wonder where he lives, 不能说 where does he live)。',
    keywords: ['noun clause', '名词性从句', '宾语从句', '主语从句', '形式主语', '同位语从句'],
  },

  // 4. Non-finite: Infinitives
  {
    id: 'infinitives-to-do',
    titleEn: 'Infinitives (to do)',
    titleZh: '动词不定式 (to do) 核心用法',
    level: 'A2',
    category: 'verbals',
    summaryZh: '动词不定式保留动词特征但不能单独作谓语，通常具有“将来、目的、未完成”的语义色彩。',
    formula: 'to + 动词原形 (否定式: not to do)',
    rules: [
      {
        ruleZh: '作目的状语：表达做某事的目的（“为了……”）。',
        exampleEn: 'She woke up early to catch the first train.',
        exampleZh: '她早起是为了赶上第一班火车。',
        highlight: 'to catch the first train',
      },
      {
        ruleZh: '作宾语补足语：tell / ask / allow / encourage sb to do sth。',
        exampleEn: 'The doctor advised him to exercise regularly.',
        exampleZh: '医生建议他经常锻炼身体。',
        highlight: 'to exercise regularly',
      },
      {
        ruleZh: '作形式宾语结构：make / find / feel it + adj + to do sth。',
        exampleEn: 'I find it important to practice speaking every day.',
        exampleZh: '我认为每天练习口语很重要。',
        highlight: 'it important to practice',
      },
    ],
    pitfallsZh: '使役动词(make, let, have)和感官动词(see, hear, watch)后接宾补时，要省略 to！如: He made me laugh (不能说 made me to laugh)。但在被动语态中 to 必须还原：I was made TO laugh。',
    keywords: ['infinitive', '动词不定式', 'to do', '目的状语', '宾补', '使役动词'],
  },

  // 5. Non-finite: Gerunds vs Participles
  {
    id: 'gerunds-and-participles',
    titleEn: 'Gerunds (doing) vs Participles (doing / done)',
    titleZh: '动名词 (doing) 与分词 (doing / done) 辨析',
    level: 'B1',
    category: 'verbals',
    summaryZh: '动名词具有名词性（作主语/宾语），现在分词表主动进行，过去分词表被动完成（作定语/状语）。',
    formula: '动名词: doing (名词功能) | 现在分词: doing (主动/进行) | 过去分词: done (被动/完成)',
    rules: [
      {
        ruleZh: '介词后必定接动名词：如 be good at, look forward to, insist on + doing。',
        exampleEn: 'Thank you for helping me with this project.',
        exampleZh: '谢谢你在本项目中帮助我。(for后必须接helping)',
        highlight: 'for helping me',
      },
      {
        ruleZh: '固定接动名词的动词：enjoy, avoid, practice, mind, consider, finish。',
        exampleEn: 'He avoided answering the direct question.',
        exampleZh: '他避开了正面回答这个问题。',
        highlight: 'avoided answering',
      },
      {
        ruleZh: '分词作状语：逻辑主语一致原则。主动用 doing，被动用 done。',
        exampleEn: 'Hearing the bell, the students stopped writing.',
        exampleZh: '听到铃声，学生们停止了书写。(学生主动听到，用 Hearing)',
        highlight: 'Hearing the bell',
      },
    ],
    pitfallsZh: '记住“考虑建议盼原谅，承认推迟没商量”等必接 doing 的动词；look forward to 中的 to 是介词，必须接 doing！',
    keywords: ['gerund', 'participle', '动名词', '分词', 'doing', 'done', '逻辑主语'],
  },

  // 6. Conditionals & Subjunctive
  {
    id: 'conditionals-and-subjunctive',
    titleEn: 'Conditionals (0, 1st, 2nd, 3rd) & Subjunctive',
    titleZh: '条件句四大梯队与虚拟语气',
    level: 'B2',
    category: 'conditionals',
    summaryZh: '条件句用来表达因果假设。0与1类表示真实客观可能，2与3类表示反事实虚拟语气。',
    formula: '2nd: If S + did (were), S + would do | 3rd: If S + had done, S + would have done',
    rules: [
      {
        ruleZh: '0类条件句 (客观规律/真理)：If + 一般现在时, 主句一般现在时。',
        exampleEn: 'If you heat water to 100°C, it boils.',
        exampleZh: '如果你把水加热到100度，它就会沸腾。',
        highlight: 'boils',
      },
      {
        ruleZh: '1类条件句 (将来真实可能)：主将从现 (If从句一般现在时，主句will+原形)。',
        exampleEn: 'If it rains tomorrow, we will stay at home.',
        exampleZh: '如果明天下雨，我们就会待在家里。',
        highlight: 'will stay',
      },
      {
        ruleZh: '2类条件句 (与现在事实相反虚拟)：从句用过去式(be用were)，主句用 would/could + 原形。',
        exampleEn: 'If I were you, I would accept the offer immediately.',
        exampleZh: '如果我是你，我就会立刻接受这份录用通知。',
        highlight: 'would accept',
      },
      {
        ruleZh: '3类条件句 (与过去事实相反虚拟)：从句用 had done，主句用 would have done。',
        exampleEn: 'If she had studied harder, she would have passed the exam.',
        exampleZh: '如果她当时更努力学习，她那时就能通过考试了。',
        highlight: 'would have passed',
      },
    ],
    pitfallsZh: '建议/要求/命令类词(suggest, demand, require)后的宾语从句中，谓语动词必须用 (should) + 动词原形！如: He suggested that we (should) leave early。',
    keywords: ['conditionals', 'subjunctive', '虚拟语气', '条件句', '主将从现', 'were', 'would have done'],
  },

  // 7. Modal Verbs of Deduction
  {
    id: 'modal-verbs-deduction',
    titleEn: 'Modal Verbs: Deduction & Past Speculation',
    titleZh: '情态动词推测语气与“情态+have done”',
    level: 'B1',
    category: 'modal_verbs',
    summaryZh: '情态动词不仅表示“能够/必须”，还在语用中表示说话人对事情发生可能性的主观推断。',
    formula: '对现在推测: must/can’t/may + V₁ | 对过去推测: must/can’t/could/should + have + V₃',
    rules: [
      {
        ruleZh: '对现在的极高确定推测：must be (必定是) vs can\'t be (绝不可能是)。',
        exampleEn: 'The light is on; he must be in the office.',
        exampleZh: '灯还亮着，他一定在办公室里。',
        highlight: 'must be',
      },
      {
        ruleZh: '对过去的肯定推测：must have done (过去一定已经……)。',
        exampleEn: 'The ground is wet. It must have rained last night.',
        exampleZh: '地面是湿的。昨晚一定下雨了。',
        highlight: 'must have rained',
      },
      {
        ruleZh: '对过去本应做而未做的遗憾责备：should have done (本应该……却没做)。',
        exampleEn: 'You should have arrived earlier; the train has left.',
        exampleZh: '你本该早点到的；火车已经开走了。',
        highlight: 'should have arrived',
      },
    ],
    pitfallsZh: '表示不可能时，推测否定【只能用 can\'t】，绝不能用 mustn\'t（mustn\'t 表示“禁止、不准”，不表示推测！）。',
    keywords: ['modal verbs', '情态动词', '推测语气', 'must have done', 'should have done', 'can’t be'],
  },

  // 8. Inverted Sentences
  {
    id: 'inverted-sentences',
    titleEn: 'Inverted Sentences (Full & Partial Inversion)',
    titleZh: '倒装句结构 (完全倒装与部分倒装)',
    level: 'B2',
    category: 'sentence_structure',
    summaryZh: '为了强调语势或平衡句子结构，将谓语动词或助动词置于主语之前。',
    formula: '部分倒装: 否定词/Only + 助动词/be + 主语 + 实义动词',
    rules: [
      {
        ruleZh: '否定词放句首引起部分倒装：Never, Seldom, Hardly, Little, Not only。',
        exampleEn: 'Never have I seen such an extraordinary performance.',
        exampleZh: '我从未见过如此精彩非凡的演出。',
        highlight: 'Never have I seen',
      },
      {
        ruleZh: 'Only + 状语放句首引起部分倒装：强调条件或时间。',
        exampleEn: 'Only in this way can we solve the problem effectively.',
        exampleZh: '只有通过这种方法，我们才能有效地解决问题。',
        highlight: 'Only in this way can we',
      },
      {
        ruleZh: '方位副词放句首引起完全倒装：Here / There / Out / Down + 谓语 + 名词主语。',
        exampleEn: 'Here comes the bus!',
        exampleZh: '公共汽车来啦！(若主语是代词则不倒装: Here it comes!)',
        highlight: 'Here comes the bus',
      },
    ],
    pitfallsZh: '若 Here / There 句型的主语是【代词】（如 it, he, they），则不倒装！如: Here it comes (正确) vs Here comes it (错误)。',
    keywords: ['inversion', '倒装句', '部分倒装', '完全倒装', 'never', 'only in this way'],
  },

  // 9. Passive Voice Inversion
  {
    id: 'passive-voice-rules',
    titleEn: 'Passive Voice Transformations',
    titleZh: '被动语态转换法则与动作承受',
    level: 'A2',
    category: 'voice',
    summaryZh: '当不需要指出执行者，或者重点在强调动作承受者与客观结果时使用被动语态。',
    formula: '主语 + be (各种时态) + 过去分词 (V₃) (+ by 动作执行者)',
    rules: [
      {
        ruleZh: '各时态被动语态核心：be 动词承担时态变化，实义动词永远保持过去分词 V₃。',
        exampleEn: 'The new bridge was completed in 2024.',
        exampleZh: '新桥于2024年竣工。(一般过去时被动: was + completed)',
        highlight: 'was completed',
      },
      {
        ruleZh: '进行时被动：be + being + V₃。',
        exampleEn: 'The road is being repaired right now.',
        exampleZh: '这条路目前正在被抢修中。',
        highlight: 'is being repaired',
      },
      {
        ruleZh: '完成时被动：have / has / had + been + V₃。',
        exampleEn: 'All tickets have been sold out.',
        exampleZh: '所有门票已经被全部售罄。',
        highlight: 'have been sold out',
      },
    ],
    pitfallsZh: '不及物动词(如 happen, occur, appear, die)没有宾语，因此【绝对没有被动语态】！如: The accident happened (不能说 was happened)。',
    keywords: ['passive voice', '被动语态', 'be + done', 'happen无被动', 'by'],
  },

  // 10. Articles: a, an, the
  {
    id: 'articles-rules',
    titleEn: 'Articles (a / an / the / zero article)',
    titleZh: '冠词用法 (a / an / the 与零冠词规则)',
    level: 'A1',
    category: 'articles_nouns',
    summaryZh: '冠词是置于名词前限制其特指或泛指的虚词。分为不定冠词(a/an)、定冠词(the)与零冠词。',
    formula: 'a + 辅音音素开头词 | an + 元音音素开头词 | the + 特指/独一无二',
    rules: [
      {
        ruleZh: 'a vs an 看发音音素而非字母：元音音素(a, e, i, o, u发音)前用 an。',
        exampleEn: 'It took an hour to drive to a university with an honest guide.',
        exampleZh: '花了一个小时开车去一所大学，还配有一位诚实的向导。(元音发音前用an，辅音/j/前用a)',
        highlight: 'an hour',
      },
      {
        ruleZh: '定冠词 the：双方已知、特指某人某物、世界上独一无二的事物(the sun, the moon)。',
        exampleEn: 'Could you please pass me the salt on the table?',
        exampleZh: '能把桌上的那罐盐递给我吗？(双方共知的特指)',
        highlight: 'the salt on the table',
      },
      {
        ruleZh: '零冠词：球类运动(play football)、三餐(have breakfast)、泛指复数名词。',
        exampleEn: 'Children love playing games.',
        exampleZh: '孩子们喜欢玩游戏。(泛指，不用任何冠词)',
        highlight: 'Children love playing games',
      },
    ],
    pitfallsZh: '乐器前要加 the (play the piano, play the violin)；但球类前不加 the (play basketball, play tennis)！',
    keywords: ['articles', '冠词', 'a', 'an', 'the', '零冠词', '元音音素'],
  },
];
