/** The radicals (部首) learners meet most often, with the meaning that explains the characters built on them. */

export type RadicalPosition = 'left' | 'right' | 'top' | 'bottom' | 'enclosing' | 'any';

export interface RadicalExample {
  hanzi: string;
  pinyin: string;
  meaning: string;
}

export interface Radical {
  /** Standalone form (what you look it up as). */
  id: string;
  /** Form it takes inside characters, when different (亻 for 人 …). */
  variant?: string;
  pinyin: string;
  meaning: string;
  position: RadicalPosition;
  strokes: number;
  /** Why the meaning shows up in the characters. */
  hint: string;
  examples: RadicalExample[];
}

const r = (
  id: string,
  variant: string | undefined,
  pinyin: string,
  meaning: string,
  position: RadicalPosition,
  strokes: number,
  hint: string,
  examples: [string, string, string][],
): Radical => ({
  id,
  variant,
  pinyin,
  meaning,
  position,
  strokes,
  hint,
  examples: examples.map(([hanzi, py, m]) => ({ hanzi, pinyin: py, meaning: m })),
});

export const RADICALS: Radical[] = [
  r('人', '亻', 'rén', 'person', 'left', 2, 'A walking figure. Characters about people, their roles and actions.', [['你', 'nǐ', 'you'], ['休', 'xiū', 'to rest'], ['作', 'zuò', 'to do, make']]),
  r('口', undefined, 'kǒu', 'mouth', 'any', 3, 'An open mouth. Eating, speaking, sounds and openings.', [['吃', 'chī', 'to eat'], ['吗', 'ma', 'question particle'], ['叫', 'jiào', 'to call']]),
  r('言', '讠', 'yán', 'speech, words', 'left', 2, 'Simplified 讠 is the short form. Speaking, language and requests.', [['说', 'shuō', 'to say'], ['话', 'huà', 'speech'], ['请', 'qǐng', 'please, to invite']]),
  r('水', '氵', 'shuǐ', 'water', 'left', 3, 'Three drops of water. Rivers, liquids and washing.', [['河', 'hé', 'river'], ['海', 'hǎi', 'sea'], ['洗', 'xǐ', 'to wash']]),
  r('火', '灬', 'huǒ', 'fire', 'bottom', 4, 'Flames; at the bottom of a character it becomes four dots 灬. Heat and burning.', [['灯', 'dēng', 'lamp'], ['热', 'rè', 'hot'], ['烧', 'shāo', 'to burn']]),
  r('木', undefined, 'mù', 'tree, wood', 'left', 4, 'A tree with trunk, branches and roots. Plants, wooden things.', [['林', 'lín', 'woods'], ['桌', 'zhuō', 'table'], ['树', 'shù', 'tree']]),
  r('日', undefined, 'rì', 'sun, day', 'left', 4, 'The sun. Time of day and brightness.', [['明', 'míng', 'bright'], ['时', 'shí', 'time'], ['晴', 'qíng', 'clear, sunny']]),
  r('月', undefined, 'yuè', 'moon; flesh', 'left', 4, 'Moon. On the left of body-part characters it stands for 肉 (flesh): 脑, 脚.', [['明', 'míng', 'bright'], ['脑', 'nǎo', 'brain'], ['脚', 'jiǎo', 'foot']]),
  r('心', '忄', 'xīn', 'heart, mind', 'left', 4, 'Heart; on the left it is the upright 忄. Feelings and thinking.', [['想', 'xiǎng', 'to think, miss'], ['忙', 'máng', 'busy'], ['快', 'kuài', 'fast, happy']]),
  r('手', '扌', 'shǒu', 'hand', 'left', 4, 'Hand; on the left it is 扌. Actions done with the hands.', [['打', 'dǎ', 'to hit, play'], ['找', 'zhǎo', 'to look for'], ['拿', 'ná', 'to take']]),
  r('女', undefined, 'nǚ', 'woman', 'left', 3, 'A kneeling woman. Family terms for women and female things.', [['妈', 'mā', 'mum'], ['好', 'hǎo', 'good'], ['姐', 'jiě', 'older sister']]),
  r('子', undefined, 'zǐ', 'child', 'any', 3, 'A baby with outstretched arms. Children, learning, offspring.', [['孩', 'hái', 'child'], ['学', 'xué', 'to study'], ['字', 'zì', 'character']]),
  r('土', undefined, 'tǔ', 'earth, soil', 'left', 3, 'A mound of soil. Ground, places and buildings.', [['地', 'dì', 'ground'], ['城', 'chéng', 'city'], ['块', 'kuài', 'piece, lump']]),
  r('金', '钅', 'jīn', 'metal, gold', 'left', 4, 'Simplified 钅 on the left. Metals and money.', [['钱', 'qián', 'money'], ['铁', 'tiě', 'iron'], ['银', 'yín', 'silver']]),
  r('食', '饣', 'shí', 'food, eat', 'left', 3, 'Simplified 饣 on the left. Food and meals.', [['饭', 'fàn', 'meal, rice'], ['饿', 'è', 'hungry'], ['饱', 'bǎo', 'full (of food)']]),
  r('足', '⻊', 'zú', 'foot', 'left', 7, 'A foot. Walking, running and jumping.', [['跑', 'pǎo', 'to run'], ['跳', 'tiào', 'to jump'], ['路', 'lù', 'road']]),
  r('目', undefined, 'mù', 'eye', 'left', 5, 'A turned eye. Seeing and sleeping.', [['看', 'kàn', 'to look'], ['睡', 'shuì', 'to sleep'], ['眼', 'yǎn', 'eye']]),
  r('耳', undefined, 'ěr', 'ear', 'any', 6, 'An ear. Hearing.', [['闻', 'wén', 'to smell, hear'], ['取', 'qǔ', 'to take, fetch'], ['聪', 'cōng', 'clever']]),
  r('门', undefined, 'mén', 'door, gate', 'enclosing', 3, 'Two door leaves. Doors, openings, and things that pass through them.', [['问', 'wèn', 'to ask'], ['间', 'jiān', 'room, between'], ['闭', 'bì', 'to close']]),
  r('辵', '辶', 'chuò', 'walk, movement', 'enclosing', 3, 'Simplified 辶 wraps the left and bottom. Movement and roads.', [['这', 'zhè', 'this'], ['过', 'guò', 'to pass'], ['进', 'jìn', 'to enter']]),
  r('宀', undefined, 'mián', 'roof', 'top', 3, 'A roof. Houses and shelter.', [['家', 'jiā', 'home'], ['室', 'shì', 'room'], ['完', 'wán', 'to finish']]),
  r('广', undefined, 'guǎng', 'building with a roof', 'enclosing', 3, 'A large shed. Shops, houses and rooms.', [['店', 'diàn', 'shop'], ['床', 'chuáng', 'bed'], ['度', 'dù', 'degree']]),
  r('穴', undefined, 'xué', 'cave, hole', 'top', 5, 'A cave under a roof. Holes and openings.', [['空', 'kōng', 'empty'], ['穿', 'chuān', 'to wear, pierce'], ['窗', 'chuāng', 'window']]),
  r('竹', '⺮', 'zhú', 'bamboo', 'top', 6, 'Two bamboo shoots, top form ⺮. Bamboo things: writing tools, grades.', [['笔', 'bǐ', 'pen'], ['第', 'dì', 'ordinal prefix'], ['等', 'děng', 'to wait']]),
  r('糸', '纟', 'mì', 'silk, thread', 'left', 3, 'Simplified 纟 on the left. Thread, colours and connections.', [['红', 'hóng', 'red'], ['给', 'gěi', 'to give'], ['级', 'jí', 'level']]),
  r('衣', '衤', 'yī', 'clothes', 'left', 5, 'Clothes, written 衤 on the left.', [['衬', 'chèn', 'shirt lining'], ['裤', 'kù', 'trousers'], ['被', 'bèi', 'quilt; passive marker']]),
  r('雨', undefined, 'yǔ', 'rain', 'top', 8, 'Raindrops under a cloud. Weather.', [['雪', 'xuě', 'snow'], ['雷', 'léi', 'thunder'], ['零', 'líng', 'zero']]),
  r('山', undefined, 'shān', 'mountain', 'any', 3, 'Three peaks. Mountains and hills.', [['岛', 'dǎo', 'island'], ['岁', 'suì', 'year of age'], ['峰', 'fēng', 'peak']]),
  r('马', undefined, 'mǎ', 'horse', 'left', 3, 'A horse. Horses and riding.', [['骑', 'qí', 'to ride'], ['骂', 'mà', 'to scold'], ['驾', 'jià', 'to drive']]),
  r('鸟', undefined, 'niǎo', 'bird', 'right', 5, 'A bird. Birds.', [['鸡', 'jī', 'chicken'], ['鸭', 'yā', 'duck'], ['鹅', 'é', 'goose']]),
  r('鱼', undefined, 'yú', 'fish', 'any', 8, 'A fish. Fish and sea life.', [['鲜', 'xiān', 'fresh'], ['鲨', 'shā', 'shark'], ['鲤', 'lǐ', 'carp']]),
  r('犬', '犭', 'quǎn', 'dog, animal', 'left', 3, 'Left form 犭. Mammals.', [['狗', 'gǒu', 'dog'], ['猫', 'māo', 'cat'], ['猪', 'zhū', 'pig']]),
  r('虫', undefined, 'chóng', 'insect', 'left', 6, 'A bug. Insects and crawling creatures.', [['蚊', 'wén', 'mosquito'], ['蛋', 'dàn', 'egg'], ['蜜', 'mì', 'honey']]),
  r('车', undefined, 'chē', 'vehicle', 'left', 4, 'A cart seen from above. Vehicles and wheels.', [['轮', 'lún', 'wheel'], ['轻', 'qīng', 'light'], ['输', 'shū', 'to transport; lose']]),
  r('刀', '刂', 'dāo', 'knife', 'right', 2, 'Right-hand form 刂. Cutting.', [['别', 'bié', 'other; do not'], ['到', 'dào', 'to arrive'], ['刻', 'kè', 'quarter hour; carve']]),
  r('力', undefined, 'lì', 'strength', 'right', 2, 'An arm muscle. Effort and force.', [['动', 'dòng', 'to move'], ['男', 'nán', 'male'], ['努', 'nǔ', 'to strive']]),
  r('大', undefined, 'dà', 'big', 'top', 3, 'A person with arms spread wide. Size.', [['太', 'tài', 'too'], ['天', 'tiān', 'sky, day'], ['夫', 'fū', 'husband']]),
  r('小', undefined, 'xiǎo', 'small', 'top', 3, 'Three tiny dots. Smallness.', [['少', 'shǎo', 'few'], ['尖', 'jiān', 'pointed'], ['小', 'xiǎo', 'small']]),
  r('石', undefined, 'shí', 'stone', 'left', 5, 'A rock below a cliff. Stone and minerals.', [['码', 'mǎ', 'number, code'], ['破', 'pò', 'broken'], ['研', 'yán', 'to grind, study']]),
  r('田', undefined, 'tián', 'field', 'any', 5, 'A field divided into plots. Farmland.', [['男', 'nán', 'male'], ['留', 'liú', 'to stay'], ['界', 'jiè', 'boundary']]),
  r('米', undefined, 'mǐ', 'rice', 'left', 6, 'Grains of rice. Food made of grains.', [['粉', 'fěn', 'powder'], ['糖', 'táng', 'sugar'], ['精', 'jīng', 'refined']]),
  r('示', '礻', 'shì', 'spirit, altar', 'left', 4, 'Left form 礻. Rituals, blessings, spirits.', [['礼', 'lǐ', 'ritual, gift'], ['神', 'shén', 'god, spirit'], ['福', 'fú', 'luck']]),
  r('走', undefined, 'zǒu', 'to walk', 'enclosing', 7, 'Walking legs. Movement on foot.', [['起', 'qǐ', 'to rise'], ['超', 'chāo', 'to surpass'], ['越', 'yuè', 'to cross, more']]),
  r('页', undefined, 'yè', 'page, head', 'right', 6, 'A head. Things about the head, and pages.', [['头', 'tóu', 'head'], ['题', 'tí', 'topic'], ['顾', 'gù', 'to look after']]),
  r('欠', undefined, 'qiàn', 'to lack; yawn', 'right', 4, 'An open mouth. Breath, singing, feelings.', [['欢', 'huān', 'joyful'], ['歌', 'gē', 'song'], ['次', 'cì', 'time (occasion)']]),
  r('攴', '攵', 'pū', 'to tap, action', 'right', 4, 'Right form 攵: a hand holding a stick. Doing something to things.', [['教', 'jiào', 'to teach'], ['数', 'shù', 'number'], ['放', 'fàng', 'to put']]),
  r('斤', undefined, 'jīn', 'axe; catty', 'right', 4, 'An axe. Cutting, and weight.', [['新', 'xīn', 'new'], ['所', 'suǒ', 'place'], ['斤', 'jīn', 'half-kilo']]),
  r('又', undefined, 'yòu', 'right hand; again', 'right', 2, 'A hand. Hands, and repeated action.', [['友', 'yǒu', 'friend'], ['双', 'shuāng', 'pair'], ['取', 'qǔ', 'to take']]),
  r('贝', undefined, 'bèi', 'shell, money', 'left', 4, 'Cowrie shells were money. Wealth and trade.', [['贵', 'guì', 'expensive'], ['财', 'cái', 'wealth'], ['货', 'huò', 'goods']]),
  r('见', undefined, 'jiàn', 'to see', 'right', 4, 'An eye on legs. Seeing.', [['观', 'guān', 'to observe'], ['规', 'guī', 'rule'], ['视', 'shì', 'to look at']]),
  r('阜', '阝', 'fù', 'hill (阝 on the LEFT)', 'left', 3, 'The same shape 阝 means HILL on the left and CITY on the right.', [['院', 'yuàn', 'courtyard'], ['阳', 'yáng', 'sun, positive'], ['阿', 'ā', 'prefix']]),
  r('邑', '阝', 'yì', 'city (阝 on the RIGHT)', 'right', 3, 'Right-hand 阝: a town. Places and towns.', [['都', 'dū', 'capital'], ['那', 'nà', 'that'], ['部', 'bù', 'part, ministry']]),
  r('厂', undefined, 'hàn', 'cliff', 'enclosing', 2, 'A cliff overhang. Shelter, origins.', [['历', 'lì', 'history'], ['原', 'yuán', 'original'], ['厕', 'cè', 'toilet']]),
  r('彳', undefined, 'chì', 'step', 'left', 3, 'A step. Walking and roads.', [['很', 'hěn', 'very'], ['往', 'wǎng', 'to go toward'], ['得', 'de', 'complement particle']]),
  r('冫', undefined, 'bīng', 'ice', 'left', 2, 'Two drops of ice. Cold.', [['冷', 'lěng', 'cold'], ['冰', 'bīng', 'ice'], ['凉', 'liáng', 'cool']]),
  r('艸', '艹', 'cǎo', 'grass, plant', 'top', 3, 'Top form 艹. Plants, flowers, tea.', [['花', 'huā', 'flower'], ['茶', 'chá', 'tea'], ['草', 'cǎo', 'grass']]),
  r('囗', undefined, 'wéi', 'enclosure', 'enclosing', 3, 'A walled box. Countries and surrounded spaces.', [['国', 'guó', 'country'], ['四', 'sì', 'four'], ['图', 'tú', 'picture']]),
  r('夕', undefined, 'xī', 'evening', 'any', 3, 'A crescent moon. Evening and night.', [['外', 'wài', 'outside'], ['多', 'duō', 'many'], ['夜', 'yè', 'night']]),
  r('寸', undefined, 'cùn', 'inch; hand', 'right', 3, 'A hand with a mark. Measure and rule.', [['对', 'duì', 'correct'], ['导', 'dǎo', 'to guide'], ['寸', 'cùn', 'inch']]),
];

export const RADICAL_BY_ID: ReadonlyMap<string, Radical> = new Map(RADICALS.map((x) => [x.id, x]));

/** All forms by which a learner sees the radical: the standalone character and its in-character variant. */
export const radicalForms = (x: Radical): string[] => (x.variant && x.variant !== x.id ? [x.id, x.variant] : [x.id]);
