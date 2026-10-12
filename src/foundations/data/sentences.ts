/**
 * Sentence-order exercises. Every word carries its grammatical role; the learner puts the tiles into the order a
 * Chinese sentence needs. `level` groups the patterns from simple to demanding.
 */

export type SentenceRole = 'S' | 'V' | 'O' | 'T' | 'P' | 'A' | 'N' | 'Asp' | 'Q' | 'Cv' | 'Comp' | 'Adj' | 'Mod';

export const SENTENCE_ROLES: SentenceRole[] = ['S', 'V', 'O', 'T', 'P', 'A', 'N', 'Asp', 'Q', 'Cv', 'Comp', 'Adj', 'Mod'];

export interface SentenceTile {
  hanzi: string;
  pinyin: string;
  role: SentenceRole;
}

export interface SentenceItem {
  id: string;
  /** 1 = S V O … 7 = ba / comparison / complements. */
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Situation prompt (what the learner wants to say) and the meaning. */
  english: string;
  /** The correct order. */
  tiles: SentenceTile[];
  /** Other accepted orders, as index lists into `tiles`. */
  alternatives?: number[][];
}

const t = (hanzi: string, pinyin: string, role: SentenceRole): SentenceTile => ({ hanzi, pinyin, role });

export const SENTENCES: SentenceItem[] = [
  { id: 's1', level: 1, english: 'I drink water.', tiles: [t('我', 'wǒ', 'S'), t('喝', 'hē', 'V'), t('水', 'shuǐ', 'O')] },
  { id: 's2', level: 1, english: 'She studies Chinese.', tiles: [t('她', 'tā', 'S'), t('学', 'xué', 'V'), t('汉语', 'Hànyǔ', 'O')] },
  { id: 's3', level: 1, english: 'They watch a film.', tiles: [t('他们', 'tāmen', 'S'), t('看', 'kàn', 'V'), t('电影', 'diànyǐng', 'O')] },
  { id: 's4', level: 2, english: 'I study Chinese today.', tiles: [t('我', 'wǒ', 'S'), t('今天', 'jīntiān', 'T'), t('学', 'xué', 'V'), t('汉语', 'Hànyǔ', 'O')], alternatives: [[1, 0, 2, 3]] },
  { id: 's5', level: 2, english: 'She buys a book tomorrow.', tiles: [t('她', 'tā', 'S'), t('明天', 'míngtiān', 'T'), t('买', 'mǎi', 'V'), t('书', 'shū', 'O')], alternatives: [[1, 0, 2, 3]] },
  { id: 's6', level: 2, english: 'We watched a film yesterday.', tiles: [t('我们', 'wǒmen', 'S'), t('昨天', 'zuótiān', 'T'), t('看', 'kàn', 'V'), t('电影', 'diànyǐng', 'O')], alternatives: [[1, 0, 2, 3]] },
  { id: 's7', level: 3, english: "I don't drink coffee.", tiles: [t('我', 'wǒ', 'S'), t('不', 'bù', 'N'), t('喝', 'hē', 'V'), t('咖啡', 'kāfēi', 'O')] },
  { id: 's8', level: 3, english: 'He likes tea too.', tiles: [t('他', 'tā', 'S'), t('也', 'yě', 'A'), t('喜欢', 'xǐhuan', 'V'), t('茶', 'chá', 'O')] },
  { id: 's9', level: 3, english: 'We are all students.', tiles: [t('我们', 'wǒmen', 'S'), t('都', 'dōu', 'A'), t('是', 'shì', 'V'), t('学生', 'xuésheng', 'O')] },
  { id: 's10', level: 3, english: "I don't have time.", tiles: [t('我', 'wǒ', 'S'), t('没', 'méi', 'N'), t('有', 'yǒu', 'V'), t('时间', 'shíjiān', 'O')] },
  { id: 's11', level: 4, english: 'I eat at home.', tiles: [t('我', 'wǒ', 'S'), t('在家', 'zài jiā', 'P'), t('吃', 'chī', 'V'), t('饭', 'fàn', 'O')] },
  { id: 's12', level: 4, english: 'She studies Chinese at school.', tiles: [t('她', 'tā', 'S'), t('在学校', 'zài xuéxiào', 'P'), t('学习', 'xuéxí', 'V'), t('中文', 'Zhōngwén', 'O')] },
  { id: 's13', level: 4, english: 'He works at the company today.', tiles: [t('他', 'tā', 'S'), t('今天', 'jīntiān', 'T'), t('在公司', 'zài gōngsī', 'P'), t('工作', 'gōngzuò', 'V')], alternatives: [[1, 0, 2, 3]] },
  { id: 's14', level: 4, english: 'We have a meeting in Beijing tomorrow.', tiles: [t('我们', 'wǒmen', 'S'), t('明天', 'míngtiān', 'T'), t('在北京', 'zài Běijīng', 'P'), t('开会', 'kāihuì', 'V')], alternatives: [[1, 0, 2, 3]] },
  { id: 's15', level: 5, english: 'I ate three apples.', tiles: [t('我', 'wǒ', 'S'), t('吃', 'chī', 'V'), t('了', 'le', 'Asp'), t('三个', 'sān ge', 'Mod'), t('苹果', 'píngguǒ', 'O')] },
  { id: 's16', level: 5, english: 'He has been to China.', tiles: [t('他', 'tā', 'S'), t('去', 'qù', 'V'), t('过', 'guo', 'Asp'), t('中国', 'Zhōngguó', 'O')] },
  { id: 's17', level: 5, english: 'I am reading a book right now.', tiles: [t('我', 'wǒ', 'S'), t('正在', 'zhèngzài', 'Asp'), t('看', 'kàn', 'V'), t('书', 'shū', 'O')] },
  { id: 's18', level: 6, english: 'Do you drink tea?', tiles: [t('你', 'nǐ', 'S'), t('喝', 'hē', 'V'), t('茶', 'chá', 'O'), t('吗', 'ma', 'Q')] },
  { id: 's19', level: 6, english: 'What do you want to drink?', tiles: [t('你', 'nǐ', 'S'), t('想', 'xiǎng', 'A'), t('喝', 'hē', 'V'), t('什么', 'shénme', 'O')] },
  { id: 's20', level: 6, english: 'Who is he?', tiles: [t('他', 'tā', 'S'), t('是', 'shì', 'V'), t('谁', 'shéi', 'O')] },
  { id: 's21', level: 6, english: 'What time do you get up?', tiles: [t('你', 'nǐ', 'S'), t('几点', 'jǐ diǎn', 'T'), t('起床', 'qǐchuáng', 'V')] },
  { id: 's22', level: 7, english: 'I put the book on the table.', tiles: [t('我', 'wǒ', 'S'), t('把', 'bǎ', 'Cv'), t('书', 'shū', 'O'), t('放', 'fàng', 'V'), t('在桌子上', 'zài zhuōzi shang', 'Comp')] },
  { id: 's23', level: 7, english: 'He is taller than me.', tiles: [t('他', 'tā', 'S'), t('比', 'bǐ', 'Cv'), t('我', 'wǒ', 'O'), t('高', 'gāo', 'Adj')] },
  { id: 's24', level: 7, english: 'She sings very well.', tiles: [t('她', 'tā', 'S'), t('唱', 'chàng', 'V'), t('得很好', 'de hěn hǎo', 'Comp')] },
  { id: 's25', level: 7, english: 'I am very happy.', tiles: [t('我', 'wǒ', 'S'), t('很', 'hěn', 'A'), t('高兴', 'gāoxìng', 'Adj')] },
  { id: 's26', level: 7, english: 'I want to go to Beijing too.', tiles: [t('我', 'wǒ', 'S'), t('也', 'yě', 'A'), t('想', 'xiǎng', 'A'), t('去', 'qù', 'V'), t('北京', 'Běijīng', 'O')] },
];

export const SENTENCE_LEVELS: SentenceItem['level'][] = [1, 2, 3, 4, 5, 6, 7];

/** Does `order` (indexes into `item.tiles`) spell an accepted sentence? */
export function isAcceptedOrder(item: SentenceItem, order: number[]): boolean {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  const correct = item.tiles.map((_, i) => i);
  return same(order, correct) || (item.alternatives ?? []).some((alt) => same(order, alt));
}
