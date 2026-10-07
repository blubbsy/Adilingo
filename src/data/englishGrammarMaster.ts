export type TenseGroup = 'present' | 'past' | 'future' | 'conditional';
export type PersonGroup = 'first' | 'third_singular' | 'plural';

export interface TenseSubjectConjugation {
  subject: string; // e.g. "I", "He / She / It", "We / They"
  verbText: string; // e.g. "write", "writes"
  fullActive: string; // e.g. "I write a letter.", "He writes a letter."
  translation: string; // e.g. "我写一封信。", "他写一封信。"
  changedPart: string; // "write" vs "writes"
}

export interface EnglishTenseRecord {
  id: string;
  group: TenseGroup;
  nameEn: string;
  nameZh: string;
  formulaActive: string; // "S + V₁ / V₁(s/es) + O"
  formulaPassive: string; // "S + am/is/are + V₃ (written)"
  signalWords: string[]; // ["always", "usually", "every day"]
  summaryZh: string;
  summaryEn: string;
  conjugations: {
    first: TenseSubjectConjugation; // "I"
    third_singular: TenseSubjectConjugation; // "He / She / It"
    plural: TenseSubjectConjugation; // "They / We"
  };
  passive: {
    sentence: string; // "A letter is written by him."
    translation: string; // "一封信被他写好。"
    verbPart: string; // "is written"
    whatChangedZh: string; // 动词变为 be (is) + V₃ (written)，宾语 a letter 提前为主语
  };
}

export const MASTER_VERB_EXAMPLE = {
  base: 'write',
  past: 'wrote',
  participle: 'written',
  gerund: 'writing',
  object: 'a letter',
  meaning: '写一封信',
};

export const ENGLISH_TENSES: EnglishTenseRecord[] = [
  // 1. Present Simple
  {
    id: 'present-simple',
    group: 'present',
    nameEn: 'Present Simple',
    nameZh: '一般现在时',
    formulaActive: 'S + V₁ (第三人称单数加 -s/-es) + O',
    formulaPassive: 'O + am / is / are + V₃ (written) (+ by S)',
    signalWords: ['always', 'usually', 'often', 'every day', 'never', 'sometimes'],
    summaryZh: '表示经常性、习惯性的动作，或客观事实、永恒真理。',
    summaryEn: 'Habits, regular actions, facts, and general truths.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'write',
        fullActive: 'I write a letter.',
        translation: '我写一封信。',
        changedPart: 'write (原形 V₁)',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'writes',
        fullActive: 'He writes a letter.',
        translation: '他写一封信。',
        changedPart: 'writes (加 -s)',
      },
      plural: {
        subject: 'We / They',
        verbText: 'write',
        fullActive: 'They write a letter.',
        translation: '他们写一封信。',
        changedPart: 'write (原形 V₁)',
      },
    },
    passive: {
      sentence: 'A letter is written by him.',
      translation: '一封信被他写出来。',
      verbPart: 'is written',
      whatChangedZh: '宾语 a letter 前置；be 动词根据第三人称单数变为 is；write 变为过去分词 written。',
    },
  },

  // 2. Present Continuous
  {
    id: 'present-continuous',
    group: 'present',
    nameEn: 'Present Continuous',
    nameZh: '现在进行时',
    formulaActive: 'S + am / is / are + V-ing + O',
    formulaPassive: 'O + am / is / are + being + V₃ (+ by S)',
    signalWords: ['now', 'right now', 'at the moment', 'currently', 'Look!', 'Listen!'],
    summaryZh: '表示说话此刻正在发生进行的动作，或现阶段正在持续的行为。',
    summaryEn: 'Actions happening right now or ongoing during the current period.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'am writing',
        fullActive: 'I am writing a letter.',
        translation: '我正在写一封信。',
        changedPart: 'am writing',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'is writing',
        fullActive: 'He is writing a letter.',
        translation: '他正在写一封信。',
        changedPart: 'is writing',
      },
      plural: {
        subject: 'We / They',
        verbText: 'are writing',
        fullActive: 'They are writing a letter.',
        translation: '他们正在写一封信。',
        changedPart: 'are writing',
      },
    },
    passive: {
      sentence: 'A letter is being written.',
      translation: '一封信正在被写。',
      verbPart: 'is being written',
      whatChangedZh: '进行时被动核心公式：be + being + V₃；字母/信件单数使用 is being written。',
    },
  },

  // 3. Present Perfect
  {
    id: 'present-perfect',
    group: 'present',
    nameEn: 'Present Perfect',
    nameZh: '现在完成时',
    formulaActive: 'S + have / has + V₃ (written) + O',
    formulaPassive: 'O + have / has + been + V₃ (+ by S)',
    signalWords: ['already', 'yet', 'just', 'ever', 'never', 'since 2020', 'for 3 years', 'so far'],
    summaryZh: '表示过去发生的动作对现在造成的影响/结果，或从过去持续到现在的经历。',
    summaryEn: 'Past action with a present result, life experiences, or continuing up to now.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'have written',
        fullActive: 'I have written a letter.',
        translation: '我已经写好了一封信。',
        changedPart: 'have written',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'has written',
        fullActive: 'He has written a letter.',
        translation: '他已经写好了一封信。',
        changedPart: 'has written (助动词用 has)',
      },
      plural: {
        subject: 'We / They',
        verbText: 'have written',
        fullActive: 'They have written a letter.',
        translation: '他们已经写好了一封信。',
        changedPart: 'have written',
      },
    },
    passive: {
      sentence: 'A letter has been written.',
      translation: '一封信已经被写好了。',
      verbPart: 'has been written',
      whatChangedZh: '完成时被动核心：have/has + been + V₃；单数主语使用 has been written。',
    },
  },

  // 4. Present Perfect Continuous
  {
    id: 'present-perfect-continuous',
    group: 'present',
    nameEn: 'Present Perfect Continuous',
    nameZh: '现在完成进行时',
    formulaActive: 'S + have / has + been + V-ing + O',
    formulaPassive: '(现代英语中极少使用此被动，通常转为现在完成时被动)',
    signalWords: ['all morning', 'for 2 hours', 'since 8 AM', 'lately', 'recently'],
    summaryZh: '强调从过去开始一直不间断持续到现在的动作，着重体现“动作的过程与持续性”。',
    summaryEn: 'Focuses on the continuous duration of an activity that started in the past.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'have been writing',
        fullActive: 'I have been writing a letter for two hours.',
        translation: '我已经连续写信写了两个小时。',
        changedPart: 'have been writing',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'has been writing',
        fullActive: 'He has been writing a letter for two hours.',
        translation: '他已经连续写信写了两个小时。',
        changedPart: 'has been writing',
      },
      plural: {
        subject: 'We / They',
        verbText: 'have been writing',
        fullActive: 'They have been writing a letter for two hours.',
        translation: '他们已经连续写信写了两个小时。',
        changedPart: 'have been writing',
      },
    },
    passive: {
      sentence: 'A letter has been in progress of being written. (常用：has been written)',
      translation: '一封信一直在被撰写中。',
      verbPart: 'has been being written (理论形式)',
      whatChangedZh: '强调持续过程；因语音赘述，实际口语常直接用现在完成时被动 has been written 表达。',
    },
  },

  // 5. Past Simple
  {
    id: 'past-simple',
    group: 'past',
    nameEn: 'Past Simple',
    nameZh: '一般过去时',
    formulaActive: 'S + V₂ (wrote) + O',
    formulaPassive: 'O + was / were + V₃ (written) (+ by S)',
    signalWords: ['yesterday', 'last night', 'in 1999', 'two days ago', 'just now', 'then'],
    summaryZh: '表示过去某个特定时间点发生的、且已结束的动作或状态。',
    summaryEn: 'Completed actions in the past at a specific or known time.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'wrote',
        fullActive: 'I wrote a letter yesterday.',
        translation: '我昨天写了一封信。',
        changedPart: 'wrote (不规则过去式 V₂)',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'wrote',
        fullActive: 'He wrote a letter yesterday.',
        translation: '他昨天写了一封信。',
        changedPart: 'wrote (所有人称形式一致)',
      },
      plural: {
        subject: 'We / They',
        verbText: 'wrote',
        fullActive: 'They wrote a letter yesterday.',
        translation: '他们昨天写了一封信。',
        changedPart: 'wrote (所有人称形式一致)',
      },
    },
    passive: {
      sentence: 'A letter was written yesterday.',
      translation: '昨天有一封信被写出来。',
      verbPart: 'was written',
      whatChangedZh: '一般过去时被动：was/were + V₃；单数主语用 was written，复数 letters 用 were written。',
    },
  },

  // 6. Past Continuous
  {
    id: 'past-continuous',
    group: 'past',
    nameEn: 'Past Continuous',
    nameZh: '过去进行时',
    formulaActive: 'S + was / were + V-ing + O',
    formulaPassive: 'O + was / were + being + V₃ (+ by S)',
    signalWords: ['at that time', 'at 8 PM yesterday', 'when he arrived', 'while', 'as'],
    summaryZh: '表示在过去某一特定时刻或某一时间段内正在进行的动作。',
    summaryEn: 'Action that was in progress at a specific moment in the past.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'was writing',
        fullActive: 'I was writing a letter when you called.',
        translation: '你打电话来时我正在写信。',
        changedPart: 'was writing',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'was writing',
        fullActive: 'He was writing a letter when you called.',
        translation: '你打电话来时他正在写信。',
        changedPart: 'was writing',
      },
      plural: {
        subject: 'We / They',
        verbText: 'were writing',
        fullActive: 'They were writing a letter when you called.',
        translation: '你打电话来时他们正在写信。',
        changedPart: 'were writing (复数助动词用 were)',
      },
    },
    passive: {
      sentence: 'A letter was being written when you called.',
      translation: '你打电话时，一封信正被撰写中。',
      verbPart: 'was being written',
      whatChangedZh: '过去进行时被动：was/were + being + V₃；保留进行时态的 being 与过去被动的 was written。',
    },
  },

  // 7. Past Perfect
  {
    id: 'past-perfect',
    group: 'past',
    nameEn: 'Past Perfect',
    nameZh: '过去完成时 (过去的过去)',
    formulaActive: 'S + had + V₃ (written) + O',
    formulaPassive: 'O + had + been + V₃ (+ by S)',
    signalWords: ['by the time', 'before', 'after', 'by then', 'already', 'hardly... when'],
    summaryZh: '表示在过去某一时间或某一动作之前就已经完成的动作（“过去的过去”）。',
    summaryEn: 'Action completed before another action or point in the past.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'had written',
        fullActive: 'I had written a letter before he arrived.',
        translation: '在他到达之前，我已经写好了信。',
        changedPart: 'had written',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'had written',
        fullActive: 'He had written a letter before he arrived.',
        translation: '在他到达之前，他已经写好了信。',
        changedPart: 'had written (所有人称统一用 had)',
      },
      plural: {
        subject: 'We / They',
        verbText: 'had written',
        fullActive: 'They had written a letter before he arrived.',
        translation: '在他到达之前，他们已经写好了信。',
        changedPart: 'had written',
      },
    },
    passive: {
      sentence: 'A letter had been written before he arrived.',
      translation: '在他到达之前，信就已经被写好了。',
      verbPart: 'had been written',
      whatChangedZh: '过去完成时被动：had + been + V₃；标明该事件在过去参照点之前已被完成。',
    },
  },

  // 8. Past Perfect Continuous
  {
    id: 'past-perfect-continuous',
    group: 'past',
    nameEn: 'Past Perfect Continuous',
    nameZh: '过去完成进行时',
    formulaActive: 'S + had + been + V-ing + O',
    formulaPassive: '(罕用被动，转用过去完成时被动 had been written)',
    signalWords: ['for hours before...', 'since morning until then', 'all day before'],
    summaryZh: '表示在过去的某个时间点之前一直持续进行的动作，强调动作的延续过程。',
    summaryEn: 'Emphasizes ongoing duration up until another past moment.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'had been writing',
        fullActive: 'I had been writing a letter for an hour before the power went out.',
        translation: '停电之前我已经连续写信写了一个小时。',
        changedPart: 'had been writing',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'had been writing',
        fullActive: 'He had been writing a letter for an hour before the power went out.',
        translation: '停电之前他已经连续写信写了一个小时。',
        changedPart: 'had been writing',
      },
      plural: {
        subject: 'We / They',
        verbText: 'had been writing',
        fullActive: 'They had been writing a letter for an hour before the power went out.',
        translation: '停电之前他们已经连续写信写了一个小时。',
        changedPart: 'had been writing',
      },
    },
    passive: {
      sentence: 'A letter had been written for an hour. (常直接转为完成时被动)',
      translation: '在停电前，写信的工作已经持续进行了一个小时。',
      verbPart: 'had been written',
      whatChangedZh: '英语习惯中避免连续两个 be 动词形式 (had been being written)，日常均转换为 had been written。',
    },
  },

  // 9. Future Simple
  {
    id: 'future-simple',
    group: 'future',
    nameEn: 'Future Simple',
    nameZh: '一般将来时',
    formulaActive: 'S + will + V₁ (write) + O / be going to + V₁',
    formulaPassive: 'O + will + be + V₃ (written) (+ by S)',
    signalWords: ['tomorrow', 'next week', 'soon', 'in the future', 'later', 'in 2030'],
    summaryZh: '表示将来某一时刻将要发生的动作或存在的状态。',
    summaryEn: 'Decisions made now, predictions, promises, or future facts.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'will write',
        fullActive: 'I will write a letter tomorrow.',
        translation: '我明天会写一封信。',
        changedPart: 'will write',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'will write',
        fullActive: 'He will write a letter tomorrow.',
        translation: '他明天会写一封信。',
        changedPart: 'will write (情态助动词后接动词原形)',
      },
      plural: {
        subject: 'We / They',
        verbText: 'will write',
        fullActive: 'They will write a letter tomorrow.',
        translation: '他们明天会写一封信。',
        changedPart: 'will write',
      },
    },
    passive: {
      sentence: 'A letter will be written tomorrow.',
      translation: '明天将会写好一封信。',
      verbPart: 'will be written',
      whatChangedZh: '一般将来时被动：will + be + V₃；情态助动词 will 后面保持原形 be，再接过去分词 written。',
    },
  },

  // 10. Future Continuous
  {
    id: 'future-continuous',
    group: 'future',
    nameEn: 'Future Continuous',
    nameZh: '将来进行时',
    formulaActive: 'S + will + be + V-ing + O',
    formulaPassive: 'O + will + be + being + V₃ (极罕见，通常转为将来被动)',
    signalWords: ['at this time tomorrow', 'at 10 AM tomorrow', 'this time next week'],
    summaryZh: '表示在将来某一确切时间正在进行或持续的动作。',
    summaryEn: 'Action that will be in progress at a specific future moment.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'will be writing',
        fullActive: 'I will be writing a letter at 10 AM tomorrow.',
        translation: '明天上午十点我将正在写信。',
        changedPart: 'will be writing',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'will be writing',
        fullActive: 'He will be writing a letter at 10 AM tomorrow.',
        translation: '明天上午十点他将正在写信。',
        changedPart: 'will be writing',
      },
      plural: {
        subject: 'We / They',
        verbText: 'will be writing',
        fullActive: 'They will be writing a letter at 10 AM tomorrow.',
        translation: '明天上午十点他们将正在写信。',
        changedPart: 'will be writing',
      },
    },
    passive: {
      sentence: 'A letter will be written at 10 AM tomorrow.',
      translation: '明天上午十点将会有信件被写出。',
      verbPart: 'will be written',
      whatChangedZh: '将来进行时被动理论为 will be being written，实际英语交流中简化为 will be written。',
    },
  },

  // 11. Future Perfect
  {
    id: 'future-perfect',
    group: 'future',
    nameEn: 'Future Perfect',
    nameZh: '将来完成时',
    formulaActive: 'S + will + have + V₃ (written) + O',
    formulaPassive: 'O + will + have + been + V₃ (+ by S)',
    signalWords: ['by tomorrow evening', 'by next Friday', 'by the end of this year'],
    summaryZh: '表示在将来某个时间点之前将已经全部完成的动作。',
    summaryEn: 'Action that will be completed before a specific point in the future.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'will have written',
        fullActive: 'I will have written a letter by noon.',
        translation: '到中午时分我将已经写好一封信。',
        changedPart: 'will have written',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'will have written',
        fullActive: 'He will have written a letter by noon.',
        translation: '到中午时分他将已经写好一封信。',
        changedPart: 'will have written (will后保持have原形)',
      },
      plural: {
        subject: 'We / They',
        verbText: 'will have written',
        fullActive: 'They will have written a letter by noon.',
        translation: '到中午时分他们将已经写好一封信。',
        changedPart: 'will have written',
      },
    },
    passive: {
      sentence: 'A letter will have been written by noon.',
      translation: '到中午时分一封信将已被写好。',
      verbPart: 'will have been written',
      whatChangedZh: '将来完成时被动：will + have + been + V₃；主谓宾转换后清晰表达截止未来的完成状态。',
    },
  },

  // 12. Conditional Simple
  {
    id: 'conditional-simple',
    group: 'conditional',
    nameEn: 'Conditional Simple (Would)',
    nameZh: '条件句 / 虚拟语气现在',
    formulaActive: 'S + would + V₁ (write) + O',
    formulaPassive: 'O + would + be + V₃ (written) (+ by S)',
    signalWords: ['if I had time', 'under these conditions', 'otherwise', 'supposing'],
    summaryZh: '表示对假想情况的推测或虚拟，或者过去将来时（从过去看将要发生）。',
    summaryEn: 'Hypothetical situations, conditional outcomes, or future-in-the-past.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'would write',
        fullActive: 'I would write a letter if I had time.',
        translation: '如果有时间，我就会写一封信。',
        changedPart: 'would write',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'would write',
        fullActive: 'He would write a letter if he had time.',
        translation: '如果有时间，他就会写一封信。',
        changedPart: 'would write',
      },
      plural: {
        subject: 'We / They',
        verbText: 'would write',
        fullActive: 'They would write a letter if they had time.',
        translation: '如果有时间，他们就会写一封信。',
        changedPart: 'would write',
      },
    },
    passive: {
      sentence: 'A letter would be written if there were time.',
      translation: '如果有时间，就会有一封信被写出。',
      verbPart: 'would be written',
      whatChangedZh: '条件句被动：would + be + V₃；would 后面接原形 be，再接过去分词 written。',
    },
  },

  // 13. Conditional Perfect
  {
    id: 'conditional-perfect',
    group: 'conditional',
    nameEn: 'Conditional Perfect (Would have V₃)',
    nameZh: '条件完成句 / 虚拟语气过去',
    formulaActive: 'S + would + have + V₃ (written) + O',
    formulaPassive: 'O + would + have + been + V₃ (+ by S)',
    signalWords: ['if I had had time', 'but I forgot', 'in that case', 'otherwise'],
    summaryZh: '表示对过去已经发生事情的虚拟反事实假设（“本来就会……”）。',
    summaryEn: 'Expresses what would have happened in the past under different circumstances.',
    conjugations: {
      first: {
        subject: 'I',
        verbText: 'would have written',
        fullActive: 'I would have written a letter, but I had no pen.',
        translation: '我本来会写一封信的，但我当时没有笔。',
        changedPart: 'would have written',
      },
      third_singular: {
        subject: 'He / She / It',
        verbText: 'would have written',
        fullActive: 'He would have written a letter, but he had no pen.',
        translation: '他本来会写一封信的，但他当时没有笔。',
        changedPart: 'would have written (所有人称统一用 have)',
      },
      plural: {
        subject: 'We / They',
        verbText: 'would have written',
        fullActive: 'They would have written a letter, but they had no pen.',
        translation: '他们本来会写一封信的，但他们当时没有笔。',
        changedPart: 'would have written',
      },
    },
    passive: {
      sentence: 'A letter would have been written if we had had time.',
      translation: '要是当时有时间，信本来就已经被写好了。',
      verbPart: 'would have been written',
      whatChangedZh: '条件完成时被动：would + have + been + V₃；清晰标记过去未实现的假设状态。',
    },
  },
];

/**
 * High-level comparison summary for Active vs Passive transformation rules
 */
export const ACTIVE_PASSIVE_RULES = [
  {
    step: '1. S ↔ O 角色对调 (Subject-Object Swap)',
    rule: '主动句中的动作承受者（宾语 Object）被提拔为被动句的主语（Subject）。原主动语态主语移到句末或加 "by..." 表达。',
    exampleActive: 'He [S] writes a letter [O].',
    examplePassive: 'A letter [S] is written by him.',
  },
  {
    step: '2. 注入 Be 动词助动词 (Conjugate "be")',
    rule: '根据原句时态以及新主语的单复数/人称，放入对应时态的 be 动词（am/is/are, was/were, have been, will be 等）。',
    exampleActive: 'wrote (过去式) → was / were',
    examplePassive: 'has written (现在完成时) → has been / have been',
  },
  {
    step: '3. 核心动词化为过去分词 (V₃ Past Participle)',
    rule: '无论原时态为何，主动句里的主谓实义动词一律转换为第三形态（过去分词 V₃），如 write → written。',
    exampleActive: 'writes / wrote / writing → written',
    examplePassive: 'is written / was written / is being written / will be written',
  },
];
