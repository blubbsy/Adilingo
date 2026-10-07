import { describe, expect, it } from 'vitest';
import { buildClozeExercise } from '../types';
import type { VocabItem } from '../../types';

describe('Cloze Fill-in-the-gap Exercise Builder', () => {
  const englishItem: VocabItem = {
    id: 'en-apple',
    hanzi: 'apple',
    pinyin: '/ˈæpl/',
    pinyinNumbered: '',
    english: ['苹果'],
    hskLevel: 1,
    levels: { cefr: 1 },
    frequency: 1,
    topics: ['Food'],
    exampleSentence: {
      hanzi: 'She eats a fresh apple every single day.',
      pinyin: '/ˈæpl/',
      english: '她每一天都吃一个新鲜苹果。',
    },
  };

  const chineseItem: VocabItem = {
    id: 'zh-shui',
    hanzi: '水',
    pinyin: 'shuǐ',
    pinyinNumbered: 'shui3',
    english: ['water'],
    hskLevel: 1,
    levels: { hsk3_2026: 1 },
    frequency: 1,
    topics: ['Daily Life'],
    exampleSentence: {
      hanzi: '我想喝一杯水。',
      pinyin: 'Wǒ xiǎng hē yì bēi shuǐ.',
      english: 'I would like to drink a glass of water.',
    },
  };

  const distractors: VocabItem[] = [
    {
      id: 'en-book',
      hanzi: 'book',
      pinyin: '/bʊk/',
      pinyinNumbered: '',
      english: ['书'],
      hskLevel: 1,
      levels: { cefr: 1 },
      frequency: 2,
      topics: ['Daily'],
    },
    {
      id: 'en-water',
      hanzi: 'water',
      pinyin: '/ˈwɔːtər/',
      pinyinNumbered: '',
      english: ['水'],
      hskLevel: 1,
      levels: { cefr: 1 },
      frequency: 3,
      topics: ['Daily'],
    },
    {
      id: 'en-friend',
      hanzi: 'friend',
      pinyin: '/frend/',
      pinyinNumbered: '',
      english: ['朋友'],
      hskLevel: 1,
      levels: { cefr: 1 },
      frequency: 4,
      topics: ['People'],
    },
  ];

  it('correctly creates a cloze exercise for an English sentence', () => {
    const cloze = buildClozeExercise(englishItem, distractors);
    expect(cloze).not.toBeNull();
    if (!cloze) return;

    expect(cloze.kind).toBe('cloze');
    expect(cloze.targetWord).toBe('apple');
    expect(cloze.prefix).toBe('She eats a fresh ');
    expect(cloze.suffix).toBe(' every single day.');
    expect(cloze.options.length).toBe(4);
    expect(cloze.options).toContain('apple');
    expect(cloze.options[cloze.correctIndex]).toBe('apple');
    expect(cloze.translation).toBe('她每一天都吃一个新鲜苹果。');
  });

  it('correctly creates a cloze exercise for a Chinese sentence', () => {
    const zhDistractors: VocabItem[] = [
      { id: 'zh-cha', hanzi: '茶', pinyin: 'chá', pinyinNumbered: 'cha2', english: ['tea'], hskLevel: 1, levels: {}, frequency: 2, topics: [] },
      { id: 'zh-fan', hanzi: '饭', pinyin: 'fàn', pinyinNumbered: 'fan4', english: ['meal'], hskLevel: 1, levels: {}, frequency: 3, topics: [] },
      { id: 'zh-cai', hanzi: '菜', pinyin: 'cài', pinyinNumbered: 'cai4', english: ['dish'], hskLevel: 1, levels: {}, frequency: 4, topics: [] },
    ];

    const cloze = buildClozeExercise(chineseItem, zhDistractors);
    expect(cloze).not.toBeNull();
    if (!cloze) return;

    expect(cloze.kind).toBe('cloze');
    expect(cloze.targetWord).toBe('水');
    expect(cloze.prefix).toBe('我想喝一杯');
    expect(cloze.suffix).toBe('。');
    expect(cloze.options.length).toBe(4);
    expect(cloze.options[cloze.correctIndex]).toBe('水');
  });

  it('returns null if item has no example sentence', () => {
    const withoutSentence: VocabItem = { ...englishItem, exampleSentence: undefined };
    expect(buildClozeExercise(withoutSentence, distractors)).toBeNull();
  });
});
