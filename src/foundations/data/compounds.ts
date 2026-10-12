/**
 * Characters built from two parts. About four in five characters are "semantic + phonetic" compounds:
 * one part hints at the meaning, the other at the sound. The rest combine two meanings.
 */

export interface CompoundPart {
  /** Character as written inside the compound. */
  c: string;
  /** `meaning` hints at the sense, `sound` at the pronunciation, `both` = a meaning compound. */
  role: 'meaning' | 'sound' | 'both';
  /** The part's own pinyin and gloss (shown after the answer). */
  pinyin: string;
  gloss: string;
}

export interface Compound {
  hanzi: string;
  pinyin: string;
  meaning: string;
  /** Left/top part first, as written. */
  parts: [CompoundPart, CompoundPart];
  /** `phonetic` = semantic + sound; `meaning` = two meaning parts. */
  type: 'phonetic' | 'meaning';
  /** Sound family, e.g. everything built on 青. */
  family?: string;
}

const m = (c: string, pinyin: string, gloss: string): CompoundPart => ({ c, role: 'meaning', pinyin, gloss });
const s = (c: string, pinyin: string, gloss: string): CompoundPart => ({ c, role: 'sound', pinyin, gloss });
const b = (c: string, pinyin: string, gloss: string): CompoundPart => ({ c, role: 'both', pinyin, gloss });

const water = m('氵', 'shuǐ', 'water');
const heart = m('忄', 'xīn', 'heart');
const speech = m('讠', 'yán', 'speech');
const hand = m('扌', 'shǒu', 'hand');
const mouth = m('口', 'kǒu', 'mouth');
const sun = m('日', 'rì', 'sun');
const eye = m('目', 'mù', 'eye');
const person = m('亻', 'rén', 'person');
const woman = m('女', 'nǚ', 'woman');

export const COMPOUNDS: Compound[] = [
  // sound family 青 qīng
  { hanzi: '清', pinyin: 'qīng', meaning: 'clear (water)', parts: [water, s('青', 'qīng', 'blue-green')], type: 'phonetic', family: '青' },
  { hanzi: '请', pinyin: 'qǐng', meaning: 'please, to invite', parts: [speech, s('青', 'qīng', 'blue-green')], type: 'phonetic', family: '青' },
  { hanzi: '情', pinyin: 'qíng', meaning: 'feeling', parts: [heart, s('青', 'qīng', 'blue-green')], type: 'phonetic', family: '青' },
  { hanzi: '晴', pinyin: 'qíng', meaning: 'clear, sunny', parts: [sun, s('青', 'qīng', 'blue-green')], type: 'phonetic', family: '青' },
  { hanzi: '睛', pinyin: 'jīng', meaning: 'pupil of the eye', parts: [eye, s('青', 'qīng', 'blue-green')], type: 'phonetic', family: '青' },
  // sound family 包 bāo
  { hanzi: '抱', pinyin: 'bào', meaning: 'to hug', parts: [hand, s('包', 'bāo', 'bag')], type: 'phonetic', family: '包' },
  { hanzi: '饱', pinyin: 'bǎo', meaning: 'full (of food)', parts: [m('饣', 'shí', 'food'), s('包', 'bāo', 'bag')], type: 'phonetic', family: '包' },
  { hanzi: '跑', pinyin: 'pǎo', meaning: 'to run', parts: [m('⻊', 'zú', 'foot'), s('包', 'bāo', 'bag')], type: 'phonetic', family: '包' },
  { hanzi: '泡', pinyin: 'pào', meaning: 'bubble; to soak', parts: [water, s('包', 'bāo', 'bag')], type: 'phonetic', family: '包' },
  // sound family 马 mǎ
  { hanzi: '妈', pinyin: 'mā', meaning: 'mum', parts: [woman, s('马', 'mǎ', 'horse')], type: 'phonetic', family: '马' },
  { hanzi: '吗', pinyin: 'ma', meaning: 'question particle', parts: [mouth, s('马', 'mǎ', 'horse')], type: 'phonetic', family: '马' },
  // sound family 可 kě
  { hanzi: '河', pinyin: 'hé', meaning: 'river', parts: [water, s('可', 'kě', 'can')], type: 'phonetic', family: '可' },
  { hanzi: '歌', pinyin: 'gē', meaning: 'song', parts: [s('哥', 'gē', 'older brother'), m('欠', 'qiàn', 'open mouth')], type: 'phonetic' },
  // sound family 胡/其/相 and others
  { hanzi: '湖', pinyin: 'hú', meaning: 'lake', parts: [water, s('胡', 'hú', 'beard')], type: 'phonetic' },
  { hanzi: '想', pinyin: 'xiǎng', meaning: 'to think, miss', parts: [s('相', 'xiāng', 'mutual'), heart], type: 'phonetic' },
  { hanzi: '忙', pinyin: 'máng', meaning: 'busy', parts: [heart, s('亡', 'wáng', 'to perish')], type: 'phonetic' },
  { hanzi: '吃', pinyin: 'chī', meaning: 'to eat', parts: [mouth, s('乞', 'qǐ', 'to beg')], type: 'phonetic' },
  { hanzi: '你', pinyin: 'nǐ', meaning: 'you', parts: [person, s('尔', 'ěr', 'you (old)')], type: 'phonetic' },
  { hanzi: '他', pinyin: 'tā', meaning: 'he', parts: [person, s('也', 'yě', 'also')], type: 'phonetic' },
  { hanzi: '们', pinyin: 'men', meaning: 'plural suffix', parts: [person, s('门', 'mén', 'door')], type: 'phonetic' },
  { hanzi: '洗', pinyin: 'xǐ', meaning: 'to wash', parts: [water, s('先', 'xiān', 'first')], type: 'phonetic' },
  { hanzi: '钱', pinyin: 'qián', meaning: 'money', parts: [m('钅', 'jīn', 'metal'), s('戋', 'jiān', 'small')], type: 'phonetic' },
  { hanzi: '说', pinyin: 'shuō', meaning: 'to speak', parts: [speech, s('兑', 'duì', 'to exchange')], type: 'phonetic' },
  { hanzi: '话', pinyin: 'huà', meaning: 'speech', parts: [speech, s('舌', 'shé', 'tongue')], type: 'phonetic' },
  { hanzi: '打', pinyin: 'dǎ', meaning: 'to hit', parts: [hand, s('丁', 'dīng', 'nail')], type: 'phonetic' },
  { hanzi: '饭', pinyin: 'fàn', meaning: 'meal, rice', parts: [m('饣', 'shí', 'food'), s('反', 'fǎn', 'opposite')], type: 'phonetic' },
  // two meanings combined
  { hanzi: '休', pinyin: 'xiū', meaning: 'to rest', parts: [b('亻', 'rén', 'person'), b('木', 'mù', 'tree')], type: 'meaning' },
  { hanzi: '明', pinyin: 'míng', meaning: 'bright', parts: [b('日', 'rì', 'sun'), b('月', 'yuè', 'moon')], type: 'meaning' },
  { hanzi: '好', pinyin: 'hǎo', meaning: 'good', parts: [b('女', 'nǚ', 'woman'), b('子', 'zǐ', 'child')], type: 'meaning' },
  { hanzi: '林', pinyin: 'lín', meaning: 'woods', parts: [b('木', 'mù', 'tree'), b('木', 'mù', 'tree')], type: 'meaning' },
  { hanzi: '看', pinyin: 'kàn', meaning: 'to look', parts: [b('手', 'shǒu', 'hand'), b('目', 'mù', 'eye')], type: 'meaning' },
  { hanzi: '男', pinyin: 'nán', meaning: 'male', parts: [b('田', 'tián', 'field'), b('力', 'lì', 'strength')], type: 'meaning' },
  { hanzi: '问', pinyin: 'wèn', meaning: 'to ask', parts: [b('门', 'mén', 'door'), b('口', 'kǒu', 'mouth')], type: 'meaning' },
  { hanzi: '闻', pinyin: 'wén', meaning: 'to hear, smell', parts: [b('门', 'mén', 'door'), b('耳', 'ěr', 'ear')], type: 'meaning' },
  { hanzi: '间', pinyin: 'jiān', meaning: 'between, room', parts: [b('门', 'mén', 'door'), b('日', 'rì', 'sun')], type: 'meaning' },
  { hanzi: '明', pinyin: 'míng', meaning: 'bright', parts: [b('日', 'rì', 'sun'), b('月', 'yuè', 'moon')], type: 'meaning' },
  { hanzi: '尖', pinyin: 'jiān', meaning: 'pointed', parts: [b('小', 'xiǎo', 'small'), b('大', 'dà', 'big')], type: 'meaning' },
  { hanzi: '森', pinyin: 'sēn', meaning: 'forest', parts: [b('木', 'mù', 'tree'), b('林', 'lín', 'woods')], type: 'meaning' },
];

/** Characters that appear in the list twice are removed once. */
export const COMPOUND_LIST: Compound[] = COMPOUNDS.filter((x, i) => COMPOUNDS.findIndex((y) => y.hanzi === x.hanzi) === i);

/** Components used as wrong answers (all genuine components of characters). */
export const DISTRACTOR_PARTS: string[] = ['氵', '忄', '讠', '扌', '口', '日', '目', '亻', '女', '木', '月', '土', '火', '心', '手', '人', '子', '田', '力', '门', '耳', '大', '小', '山'];
