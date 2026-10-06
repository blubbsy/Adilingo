import { describe, expect, it } from 'vitest';
import { TOPIC_PACKS, resolveTopicWords } from '../topicPacks';
import type { VocabItem } from '../../types';

const mockVocab: VocabItem[] = [
  { id: 'guo1', hanzi: '锅', pinyin: 'guō', pinyinNumbered: 'guo1', english: ['pot', 'pan'], hskLevel: 2, levels: {}, frequency: 100, topics: [] },
  { id: 'dao1', hanzi: '刀', pinyin: 'dāo', pinyinNumbered: 'dao1', english: ['knife'], hskLevel: 2, levels: {}, frequency: 101, topics: [] },
  { id: 'zhuo1zi', hanzi: '桌子', pinyin: 'zhuō zi', pinyinNumbered: 'zhuo1 zi0', english: ['table', 'desk'], hskLevel: 1, levels: {}, frequency: 102, topics: [] },
  { id: 'yi3zi', hanzi: '椅子', pinyin: 'yǐ zi', pinyinNumbered: 'yi3 zi0', english: ['chair'], hskLevel: 1, levels: {}, frequency: 103, topics: [] },
  { id: 'gou3', hanzi: '狗', pinyin: 'gǒu', pinyinNumbered: 'gou3', english: ['dog'], hskLevel: 1, levels: {}, frequency: 104, topics: [] },
  { id: 'mao1', hanzi: '猫', pinyin: 'māo', pinyinNumbered: 'mao1', english: ['cat'], hskLevel: 1, levels: {}, frequency: 105, topics: [] },
];

describe('Topic Packs & Vocabulary Training', () => {
  it('contains comprehensive topic packs covering essential everyday themes', () => {
    expect(TOPIC_PACKS.length).toBeGreaterThanOrEqual(12);

    const ids = new Set(TOPIC_PACKS.map((p) => p.id));
    expect(ids.has('kitchen-tools')).toBe(true);
    expect(ids.has('furniture')).toBe(true);
    expect(ids.has('animals')).toBe(true);
    expect(ids.has('food')).toBe(true);
    expect(ids.has('body-health')).toBe(true);
    expect(ids.has('travel-transport')).toBe(true);

    for (const pack of TOPIC_PACKS) {
      expect(pack.id).toBeTruthy();
      expect(pack.title).toBeTruthy();
      expect(pack.chineseTitle).toBeTruthy();
      expect(pack.emoji).toBeTruthy();
      expect(pack.theme).toBeTruthy();
      expect(pack.description).toBeTruthy();
      expect(pack.curatedWords.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('correctly resolves matching words from vocab for kitchen tools', () => {
    const kitchenPack = TOPIC_PACKS.find((p) => p.id === 'kitchen-tools')!;
    expect(kitchenPack).toBeDefined();

    const resolved = resolveTopicWords(kitchenPack, mockVocab);
    const hanziList = resolved.map((w) => w.hanzi);
    expect(hanziList).toContain('锅');
    expect(hanziList).toContain('刀');
    // Also contains supplementary items like 烤箱
    expect(hanziList).toContain('烤箱');
    expect(hanziList).toContain('菜板');
  });

  it('correctly resolves matching words for furniture and animals', () => {
    const furniturePack = TOPIC_PACKS.find((p) => p.id === 'furniture')!;
    const furnitureResolved = resolveTopicWords(furniturePack, mockVocab);
    const furnitureHanzi = furnitureResolved.map((w) => w.hanzi);
    expect(furnitureHanzi).toContain('桌子');
    expect(furnitureHanzi).toContain('椅子');
    expect(furnitureHanzi).toContain('衣柜');

    const animalsPack = TOPIC_PACKS.find((p) => p.id === 'animals')!;
    const animalsResolved = resolveTopicWords(animalsPack, mockVocab);
    const animalsHanzi = animalsResolved.map((w) => w.hanzi);
    expect(animalsHanzi).toContain('狗');
    expect(animalsHanzi).toContain('猫');
    expect(animalsHanzi).toContain('乌龟');
  });

  it('ensures resolved word IDs are distinct with no duplicates', () => {
    for (const pack of TOPIC_PACKS) {
      const words = resolveTopicWords(pack, mockVocab);
      const ids = words.map((w) => w.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    }
  });
});
