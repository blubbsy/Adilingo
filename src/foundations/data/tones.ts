/** Tone material: syllables that differ only by tone, and the tone-change (sandhi) rules with their exceptions. */

export interface ToneMember {
  tone: 1 | 2 | 3 | 4;
  hanzi: string;
  /** Pinyin with tone mark. */
  pinyin: string;
  meaning: string;
}

export interface ToneSet {
  /** Toneless syllable. */
  syllable: string;
  members: ToneMember[];
}

const set = (syllable: string, members: [1 | 2 | 3 | 4, string, string, string][]): ToneSet => ({
  syllable,
  members: members.map(([tone, hanzi, pinyin, meaning]) => ({ tone, hanzi, pinyin, meaning })),
});

/** Same syllable, different tone, different word. */
export const TONE_SETS: ToneSet[] = [
  set('ma', [[1, '妈', 'mā', 'mum'], [2, '麻', 'má', 'hemp'], [3, '马', 'mǎ', 'horse'], [4, '骂', 'mà', 'to scold']]),
  set('shu', [[1, '书', 'shū', 'book'], [2, '熟', 'shú', 'ripe, familiar'], [3, '鼠', 'shǔ', 'mouse'], [4, '树', 'shù', 'tree']]),
  set('tang', [[1, '汤', 'tāng', 'soup'], [2, '糖', 'táng', 'sugar'], [3, '躺', 'tǎng', 'to lie down'], [4, '烫', 'tàng', 'scalding hot']]),
  set('yi', [[1, '一', 'yī', 'one'], [2, '姨', 'yí', 'aunt'], [3, '椅', 'yǐ', 'chair'], [4, '意', 'yì', 'meaning']]),
  set('wen', [[1, '温', 'wēn', 'warm'], [2, '文', 'wén', 'writing'], [3, '稳', 'wěn', 'steady'], [4, '问', 'wèn', 'to ask']]),
  set('qi', [[1, '七', 'qī', 'seven'], [2, '骑', 'qí', 'to ride'], [3, '起', 'qǐ', 'to rise'], [4, '气', 'qì', 'air, gas']]),
  set('xi', [[1, '西', 'xī', 'west'], [2, '习', 'xí', 'to practise'], [3, '洗', 'xǐ', 'to wash'], [4, '戏', 'xì', 'play, drama']]),
  set('fan', [[1, '翻', 'fān', 'to turn over'], [2, '烦', 'fán', 'annoying'], [3, '反', 'fǎn', 'opposite'], [4, '饭', 'fàn', 'meal']]),
  set('ba', [[1, '八', 'bā', 'eight'], [2, '拔', 'bá', 'to pull out'], [3, '把', 'bǎ', 'to hold'], [4, '爸', 'bà', 'dad']]),
  set('mai', [[3, '买', 'mǎi', 'to buy'], [4, '卖', 'mài', 'to sell']]),
  set('deng', [[1, '灯', 'dēng', 'lamp'], [3, '等', 'děng', 'to wait'], [4, '凳', 'dèng', 'stool']]),
  set('guan', [[1, '关', 'guān', 'to close'], [3, '管', 'guǎn', 'to manage'], [4, '惯', 'guàn', 'habit']]),
  set('shui', [[2, '谁', 'shuí', 'who'], [3, '水', 'shuǐ', 'water'], [4, '睡', 'shuì', 'to sleep']]),
  set('jiao', [[1, '交', 'jiāo', 'to hand over'], [3, '脚', 'jiǎo', 'foot'], [4, '叫', 'jiào', 'to call']]),
];

/** Two-syllable words that differ only by tone. */
export const WORD_PAIRS: { a: ToneMember; b: ToneMember }[] = [
  {
    a: { tone: 3, hanzi: '水饺', pinyin: 'shuǐjiǎo', meaning: 'dumplings' },
    b: { tone: 4, hanzi: '睡觉', pinyin: 'shuìjiào', meaning: 'to sleep' },
  },
  {
    a: { tone: 1, hanzi: '山西', pinyin: 'Shānxī', meaning: 'Shanxi (province)' },
    b: { tone: 3, hanzi: '陕西', pinyin: 'Shǎnxī', meaning: 'Shaanxi (province)' },
  },
];

export type SandhiRuleId = 'third' | 'bu' | 'yi-fourth' | 'yi-other' | 'yi-stays' | 'bu-neutral' | 'neutral';

export interface SandhiCase {
  /** Written form. */
  hanzi: string;
  /** Spelled as it is usually WRITTEN (dictionary tones). */
  written: string;
  /** Spoken tones. */
  spoken: string;
  rule: SandhiRuleId;
  meaning: string;
  /** Exceptions are the cases where the usual change does NOT happen. */
  exception?: boolean;
  /** Plausible wrong readings. */
  wrong: string[];
}

export const SANDHI_CASES: SandhiCase[] = [
  { hanzi: '你好', written: 'nǐ hǎo', spoken: 'ní hǎo', rule: 'third', meaning: 'hello', wrong: ['nǐ hǎo', 'nì hǎo'] },
  { hanzi: '水果', written: 'shuǐ guǒ', spoken: 'shuí guǒ', rule: 'third', meaning: 'fruit', wrong: ['shuǐ guǒ', 'shuì guǒ'] },
  { hanzi: '很好', written: 'hěn hǎo', spoken: 'hén hǎo', rule: 'third', meaning: 'very good', wrong: ['hěn hǎo', 'hèn hǎo'] },
  { hanzi: '老虎', written: 'lǎo hǔ', spoken: 'láo hǔ', rule: 'third', meaning: 'tiger', wrong: ['lǎo hǔ', 'lào hǔ'] },
  { hanzi: '不是', written: 'bù shì', spoken: 'bú shì', rule: 'bu', meaning: 'is not', wrong: ['bù shì', 'bǔ shì'] },
  { hanzi: '不对', written: 'bù duì', spoken: 'bú duì', rule: 'bu', meaning: 'wrong', wrong: ['bù duì', 'bǔ duì'] },
  { hanzi: '不去', written: 'bù qù', spoken: 'bú qù', rule: 'bu', meaning: 'not go', wrong: ['bù qù', 'bǔ qù'] },
  { hanzi: '不吃', written: 'bù chī', spoken: 'bù chī', rule: 'bu', meaning: 'not eat', exception: true, wrong: ['bú chī', 'bǔ chī'] },
  { hanzi: '不好', written: 'bù hǎo', spoken: 'bù hǎo', rule: 'bu', meaning: 'not good', exception: true, wrong: ['bú hǎo', 'bǔ hǎo'] },
  { hanzi: '不来', written: 'bù lái', spoken: 'bù lái', rule: 'bu', meaning: 'not come', exception: true, wrong: ['bú lái', 'bǔ lái'] },
  { hanzi: '一个', written: 'yī gè', spoken: 'yí gè', rule: 'yi-fourth', meaning: 'one (item)', wrong: ['yī gè', 'yì gè'] },
  { hanzi: '一样', written: 'yī yàng', spoken: 'yí yàng', rule: 'yi-fourth', meaning: 'the same', wrong: ['yī yàng', 'yì yàng'] },
  { hanzi: '一天', written: 'yī tiān', spoken: 'yì tiān', rule: 'yi-other', meaning: 'one day', wrong: ['yī tiān', 'yí tiān'] },
  { hanzi: '一起', written: 'yī qǐ', spoken: 'yì qǐ', rule: 'yi-other', meaning: 'together', wrong: ['yī qǐ', 'yí qǐ'] },
  { hanzi: '一直', written: 'yī zhí', spoken: 'yì zhí', rule: 'yi-other', meaning: 'always', wrong: ['yī zhí', 'yí zhí'] },
  { hanzi: '第一', written: 'dì yī', spoken: 'dì yī', rule: 'yi-stays', meaning: 'first', exception: true, wrong: ['dì yí', 'dì yì'] },
  { hanzi: '一月', written: 'yī yuè', spoken: 'yī yuè', rule: 'yi-stays', meaning: 'January', exception: true, wrong: ['yí yuè', 'yì yuè'] },
  { hanzi: '星期一', written: 'xīngqī yī', spoken: 'xīngqī yī', rule: 'yi-stays', meaning: 'Monday', exception: true, wrong: ['xīngqī yí', 'xīngqī yì'] },
  { hanzi: '统一', written: 'tǒng yī', spoken: 'tǒng yī', rule: 'yi-stays', meaning: 'to unify', exception: true, wrong: ['tǒng yí', 'tǒng yì'] },
  { hanzi: '看不懂', written: 'kàn bù dǒng', spoken: 'kàn bu dǒng', rule: 'bu-neutral', meaning: "can't understand", exception: true, wrong: ['kàn bù dǒng', 'kàn bú dǒng'] },
  { hanzi: '来不来', written: 'lái bù lái', spoken: 'lái bu lái', rule: 'bu-neutral', meaning: 'come or not', exception: true, wrong: ['lái bù lái', 'lái bú lái'] },
  { hanzi: '妈妈', written: 'mā ma', spoken: 'mā ma', rule: 'neutral', meaning: 'mum', wrong: ['mā mā', 'mā má'] },
  { hanzi: '谢谢', written: 'xiè xie', spoken: 'xiè xie', rule: 'neutral', meaning: 'thanks', wrong: ['xiè xiè', 'xiè xiě'] },
];

/** Tone mark placement: which letter carries the mark. */
export interface MarkCase {
  /** Numbered syllable, e.g. liu2. */
  numbered: string;
  /** The letter that carries the mark. */
  letter: string;
  rule: 'a-e' | 'ou' | 'last' | 'iu-ui';
}

export const MARK_CASES: MarkCase[] = [
  { numbered: 'hao3', letter: 'a', rule: 'a-e' },
  { numbered: 'mei2', letter: 'e', rule: 'a-e' },
  { numbered: 'gou3', letter: 'o', rule: 'ou' },
  { numbered: 'zhou1', letter: 'o', rule: 'ou' },
  { numbered: 'liu2', letter: 'u', rule: 'iu-ui' },
  { numbered: 'jiu3', letter: 'u', rule: 'iu-ui' },
  { numbered: 'gui4', letter: 'i', rule: 'iu-ui' },
  { numbered: 'hui2', letter: 'i', rule: 'iu-ui' },
  { numbered: 'xue2', letter: 'e', rule: 'a-e' },
  { numbered: 'xie4', letter: 'e', rule: 'a-e' },
  { numbered: 'duo1', letter: 'o', rule: 'last' },
  { numbered: 'guo2', letter: 'o', rule: 'last' },
  { numbered: 'kuai4', letter: 'a', rule: 'a-e' },
  { numbered: 'ni3', letter: 'i', rule: 'last' },
  { numbered: 'ku4', letter: 'u', rule: 'last' },
  { numbered: 'lü4', letter: 'ü', rule: 'last' },
];
