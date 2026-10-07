export type IrregularPattern = 'AAA' | 'ABB' | 'ABC' | 'ABA';

export interface IrregularVerb {
  id: string;
  v1: string; // Base / Infinitive
  v2: string; // Past Simple
  v3: string; // Past Participle
  meaningZh: string;
  ipaV1: string;
  ipaV2: string;
  ipaV3: string;
  pattern: IrregularPattern; // Pattern grouping helps rapid learning
  exampleSentence: {
    v1: string;
    v2: string;
    v3: string;
    meaningZh: string;
  };
}

export const IRREGULAR_VERBS: IrregularVerb[] = [
  // --- ABC Group (All three distinct: v1 != v2 != v3) ---
  {
    id: 'irr-write',
    v1: 'write',
    v2: 'wrote',
    v3: 'written',
    meaningZh: '写，书写',
    ipaV1: '/raɪt/',
    ipaV2: '/roʊt/',
    ipaV3: '/ˈrɪtn/',
    pattern: 'ABC',
    exampleSentence: {
      v1: 'I write letters every week.',
      v2: 'She wrote a letter yesterday.',
      v3: 'He has written ten letters.',
      meaningZh: '我每周写信 / 她昨天写了信 / 他已经写了十封信。',
    },
  },
  {
    id: 'irr-break',
    v1: 'break',
    v2: 'broke',
    v3: 'broken',
    meaningZh: '打破，打碎',
    ipaV1: '/breɪk/',
    ipaV2: '/broʊk/',
    ipaV3: '/ˈbroʊkən/',
    pattern: 'ABC',
    exampleSentence: {
      v1: 'Be careful not to break the vase.',
      v2: 'He broke his leg while skiing.',
      v3: 'The window was broken by the storm.',
      meaningZh: '当心别打碎花瓶 / 他滑雪时摔断了腿 / 窗户被暴风雨打破了。',
    },
  },
  {
    id: 'irr-speak',
    v1: 'speak',
    v2: 'spoke',
    v3: 'spoken',
    meaningZh: '说话，讲语言',
    ipaV1: '/spiːk/',
    ipaV2: '/spoʊk/',
    ipaV3: '/ˈspoʊkən/',
    pattern: 'ABC',
    exampleSentence: {
      v1: 'Can you speak English?',
      v2: 'She spoke to the manager.',
      v3: 'English is spoken all over the world.',
      meaningZh: '你会说英语吗？ / 她和经理说了话。 / 全世界都在说英语。',
    },
  },
  {
    id: 'irr-choose',
    v1: 'choose',
    v2: 'chose',
    v3: 'chosen',
    meaningZh: '选择，挑选',
    ipaV1: '/tʃuːz/',
    ipaV2: '/tʃoʊz/',
    ipaV3: '/ˈtʃoʊzn/',
    pattern: 'ABC',
    exampleSentence: {
      v1: 'You can choose any color.',
      v2: 'She chose the blue dress.',
      v3: 'They have chosen a new leader.',
      meaningZh: '你可以选任何颜色。 / 她选了蓝色裙子。 / 他们已选出新领袖。',
    },
  },
  {
    id: 'irr-see',
    v1: 'see',
    v2: 'saw',
    v3: 'seen',
    meaningZh: '看见，明白',
    ipaV1: '/siː/',
    ipaV2: '/sɔː/',
    ipaV3: '/siːn/',
    pattern: 'ABC',
    exampleSentence: {
      v1: 'I see what you mean.',
      v2: 'We saw an eagle in the sky.',
      v3: 'Have you seen my keys?',
      meaningZh: '我明白你的意思。 / 我们看见天空中有一只鹰。 / 你看见我的钥匙了吗？',
    },
  },
  {
    id: 'irr-give',
    v1: 'give',
    v2: 'gave',
    v3: 'given',
    meaningZh: '给，给予',
    ipaV1: '/ɡɪv/',
    ipaV2: '/ɡeɪv/',
    ipaV3: '/ˈɡɪvn/',
    pattern: 'ABC',
    exampleSentence: {
      v1: 'Please give me some advice.',
      v2: 'He gave her a bouquet of flowers.',
      v3: 'I was given another chance.',
      meaningZh: '请给我一些建议。 / 他送了她一束花。 / 我得到了另一次机会。',
    },
  },
  {
    id: 'irr-take',
    v1: 'take',
    v2: 'took',
    v3: 'taken',
    meaningZh: '拿，带走，花费',
    ipaV1: '/teɪk/',
    ipaV2: '/tʊk/',
    ipaV3: '/ˈteɪkən/',
    pattern: 'ABC',
    exampleSentence: {
      v1: 'Take an umbrella with you.',
      v2: 'She took my hand.',
      v3: 'The photo was taken in Paris.',
      meaningZh: '随身带把伞。 / 她牵了我的手。 / 这张照片是在巴黎拍的。',
    },
  },

  // --- ABB Group (Past Simple and Past Participle identical: v2 == v3) ---
  {
    id: 'irr-buy',
    v1: 'buy',
    v2: 'bought',
    v3: 'bought',
    meaningZh: '买，购买',
    ipaV1: '/baɪ/',
    ipaV2: '/bɔːt/',
    ipaV3: '/bɔːt/',
    pattern: 'ABB',
    exampleSentence: {
      v1: 'I want to buy a new laptop.',
      v2: 'She bought fresh bread this morning.',
      v3: 'We have bought the tickets already.',
      meaningZh: '我想买台新笔记本电脑。 / 她今早买了新鲜面包。 / 我们已经买好票了。',
    },
  },
  {
    id: 'irr-bring',
    v1: 'bring',
    v2: 'brought',
    v3: 'brought',
    meaningZh: '带来，引起',
    ipaV1: '/brɪŋ/',
    ipaV2: '/brɔːt/',
    ipaV3: '/brɔːt/',
    pattern: 'ABB',
    exampleSentence: {
      v1: 'Remember to bring your passport.',
      v2: 'He brought dessert to the party.',
      v3: 'She has brought good news.',
      meaningZh: '记得带护照。 / 他给聚会带来了甜点。 / 她带来了好消息。',
    },
  },
  {
    id: 'irr-teach',
    v1: 'teach',
    v2: 'taught',
    v3: 'taught',
    meaningZh: '教，教学',
    ipaV1: '/tiːtʃ/',
    ipaV2: '/tɔːt/',
    ipaV3: '/tɔːt/',
    pattern: 'ABB',
    exampleSentence: {
      v1: 'She loves to teach children.',
      v2: 'My father taught me how to swim.',
      v3: 'He has taught English for 10 years.',
      meaningZh: '她喜欢教小孩子。 / 我父亲教会了我游泳。 / 他已经教了10年英语。',
    },
  },
  {
    id: 'irr-find',
    v1: 'find',
    v2: 'found',
    v3: 'found',
    meaningZh: '找到，发现',
    ipaV1: '/faɪnd/',
    ipaV2: '/faʊnd/',
    ipaV3: '/faʊnd/',
    pattern: 'ABB',
    exampleSentence: {
      v1: 'I hope you find the solution.',
      v2: 'We found a quiet cafe around the corner.',
      v3: 'The lost phone was found yesterday.',
      meaningZh: '希望你找到解决办法。 / 我们在转角发现了一家安静的咖啡馆。 / 遗失的手机昨天被找到了。',
    },
  },
  {
    id: 'irr-make',
    v1: 'make',
    v2: 'made',
    v3: 'made',
    meaningZh: '制作，使得',
    ipaV1: '/meɪk/',
    ipaV2: '/meɪd/',
    ipaV3: '/meɪd/',
    pattern: 'ABB',
    exampleSentence: {
      v1: 'They make handmade soap.',
      v2: 'She made a delicious chocolate cake.',
      v3: 'This clock was made in Switzerland.',
      meaningZh: '他们制作手工皂。 / 她做了个美味的巧克力蛋糕。 / 这座钟是瑞士制造的。',
    },
  },

  // --- AAA Group (All three forms identical: v1 == v2 == v3) ---
  {
    id: 'irr-cost',
    v1: 'cost',
    v2: 'cost',
    v3: 'cost',
    meaningZh: '花费，值（多少钱）',
    ipaV1: '/kɔːst/',
    ipaV2: '/kɔːst/',
    ipaV3: '/kɔːst/',
    pattern: 'AAA',
    exampleSentence: {
      v1: 'How much does it cost?',
      v2: 'The ticket cost 50 dollars.',
      v3: 'The mistake has cost us dearly.',
      meaningZh: '这个要多少钱？ / 车票花了50美元。 / 这个失误让我们付出了沉重代价。',
    },
  },
  {
    id: 'irr-put',
    v1: 'put',
    v2: 'put',
    v3: 'put',
    meaningZh: '放置，表达',
    ipaV1: '/pʊt/',
    ipaV2: '/pʊt/',
    ipaV3: '/pʊt/',
    pattern: 'AAA',
    exampleSentence: {
      v1: 'Please put your bag on the shelf.',
      v2: 'She put the keys on the table.',
      v3: 'He has put a lot of effort into this.',
      meaningZh: '请把包放在架子上。 / 她把钥匙放在桌上。 / 他为此倾注了很大心血。',
    },
  },
  {
    id: 'irr-cut',
    v1: 'cut',
    v2: 'cut',
    v3: 'cut',
    meaningZh: '切，割，削减',
    ipaV1: '/kʌt/',
    ipaV2: '/kʌt/',
    ipaV3: '/kʌt/',
    pattern: 'AAA',
    exampleSentence: {
      v1: 'Be careful when you cut vegetables.',
      v2: 'He cut the rope with a sharp knife.',
      v3: 'Budget costs have been cut by 20%.',
      meaningZh: '切菜时要小心。 / 他用锋利的刀割断了绳子。 / 预算成本已被削减了20%。',
    },
  },

  // --- ABA Group (Base and Past Participle identical: v1 == v3 != v2) ---
  {
    id: 'irr-come',
    v1: 'come',
    v2: 'came',
    v3: 'come',
    meaningZh: '来，到达',
    ipaV1: '/kʌm/',
    ipaV2: '/keɪm/',
    ipaV3: '/kʌm/',
    pattern: 'ABA',
    exampleSentence: {
      v1: 'Please come here.',
      v2: 'She came to see me yesterday.',
      v3: 'Spring has come at last.',
      meaningZh: '请过来。 / 她昨天来看我了。 / 春天终于到来了。',
    },
  },
  {
    id: 'irr-become',
    v1: 'become',
    v2: 'became',
    v3: 'become',
    meaningZh: '成为，变成',
    ipaV1: '/bɪˈkʌm/',
    ipaV2: '/bɪˈkeɪm/',
    ipaV3: '/bɪˈkʌm/',
    pattern: 'ABA',
    exampleSentence: {
      v1: 'It will become easier with practice.',
      v2: 'He became an architect in 2020.',
      v3: 'She has become a world-renowned pianist.',
      meaningZh: '通过练习它会变得容易。 / 他在2020年成为了一名建筑师。 / 她已成为一位举世闻名的钢琴家。',
    },
  },
];
