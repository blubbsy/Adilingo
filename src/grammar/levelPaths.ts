import type { Curriculum, HskLevel, VocabItem } from '../types';
import { curriculumInfo, levelLabel } from '../data/vocab';
import { createT, formatList, type TFunction } from '../i18n';
import type { GrammarPoint, LearningPath, PathIcon, PathStep, PathUnit } from './types';

/** Words per unit in generated syllabus paths. */
export const UNIT_SIZE = 10;

const LEVEL_ICON: Record<HskLevel, PathIcon> = { 1: 'sprout', 2: 'sprout', 3: 'bridge', 4: 'bridge', 5: 'mountain', 6: 'mountain', 7: 'crown' };

/**
 * One syllabus path per level of the active curriculum: every word of the level in
 * curriculum order (curated starters, then by frequency), 10 per unit, with that level's
 * grammar points spread evenly across the units.
 */
/** Language helpers for the generated texts (English by default, e.g. in tests). */
export interface PathText {
  t: TFunction;
  formatList: (items: string[]) => string;
}

const ENGLISH_PATH_TEXT: PathText = { t: createT('en'), formatList: (items) => formatList('en', items) };

export function buildLevelPaths(
  vocab: VocabItem[],
  grammar: GrammarPoint[],
  curriculum: Curriculum,
  text: PathText = ENGLISH_PATH_TEXT,
): LearningPath[] {
  const { t } = text;
  const info = curriculumInfo(curriculum);
  const english = curriculum === 'cefr' || curriculum === 'cet';
  const label = (level: number) => (english ? levelLabel(level, 'english', t) : levelLabel(level));
  const maxLevel = Math.max(...info.levels);
  return info.levels.map((level) => {
    const words = vocab.filter((v) => v.hskLevel === level);
    // HSK 2.0 tops out at level 6, so it also takes the advanced-band grammar there.
    const points = grammar.filter((g) => g.hskLevel === level || (level === maxLevel && g.hskLevel > maxLevel));
    const unitCount = Math.max(1, Math.ceil(words.length / UNIT_SIZE));
    const grammarByUnit = new Map<number, GrammarPoint[]>();
    points.forEach((g, j) => {
      const u = Math.floor((j * unitCount) / points.length);
      grammarByUnit.set(u, [...(grammarByUnit.get(u) ?? []), g]);
    });
    const id = `level-${curriculum}-${level}`;
    const units: PathUnit[] = [];
    for (let u = 0; u < unitCount; u++) {
      const chunk = words.slice(u * UNIT_SIZE, (u + 1) * UNIT_SIZE);
      const unitGrammar = grammarByUnit.get(u) ?? [];
      const steps: PathStep[] = [];
      if (chunk.length) {
        steps.push({
          id: `${id}-u${u + 1}-words`,
          type: 'vocab',
          title: t('grammar.paths.words', { from: u * UNIT_SIZE + 1, to: u * UNIT_SIZE + chunk.length }),
          wordIds: chunk.map((w) => w.id),
        });
      }
      for (const g of unitGrammar) steps.push({ id: `${id}-u${u + 1}-${g.id}`, type: 'grammar', grammarId: g.id });
      if (!steps.length) continue;
      const preview = chunk.slice(0, 4).map((w) => w.hanzi).join(' · ');
      units.push({
        id: `${id}-u${u + 1}`,
        title: preview || unitGrammar.map((g) => g.titleHanzi ?? g.title).join(' · '),
        goal: [
          chunk.length ? t('dictionary.wordCount', { count: chunk.length }) : '',
          unitGrammar.length ? t('grammar.paths.goalGrammar', { list: text.formatList(unitGrammar.map((g) => g.titleHanzi ?? g.title)) }) : '',
        ]
          .filter(Boolean)
          .join(' · '),
        steps,
      });
    }
    return {
      id,
      title: t('grammar.paths.syllabusTitle', { level: label(level) }),
      description: t('grammar.paths.syllabusDesc', { words: words.length, points: points.length, curriculum: t(`curriculum.${curriculum}.short`) }),
      icon: LEVEL_ICON[level],
      units,
    };
  });
}

const TIER_ICON: Record<number, PathIcon> = { 1: 'sprout', 2: 'bridge', 3: 'mountain' };

/**
 * Paths of a specialty course: one per tier (Essentials / Professional / Expert); every unit is one sub-topic of the
 * field, split into steps of {@link UNIT_SIZE} terms. Vocabulary only – specialty courses have no grammar.
 */
export function buildDomainPaths(vocab: VocabItem[], text: PathText = ENGLISH_PATH_TEXT): LearningPath[] {
  const { t } = text;
  const tiers = [...new Set(vocab.map((v) => v.hskLevel))].sort((a, b) => a - b);
  return tiers.map((tier) => {
    const words = vocab.filter((v) => v.hskLevel === tier);
    const byTopic = new Map<string, VocabItem[]>();
    for (const w of words) {
      const topic = w.topics[0] ?? '';
      byTopic.set(topic, [...(byTopic.get(topic) ?? []), w]);
    }
    const id = `level-domain-${tier}`;
    const units: PathUnit[] = [];
    for (const [topic, items] of byTopic) {
      const parts = Math.ceil(items.length / UNIT_SIZE);
      for (let part = 0; part < parts; part++) {
        const chunk = items.slice(part * UNIT_SIZE, (part + 1) * UNIT_SIZE);
        const n = units.length + 1;
        units.push({
          id: `${id}-u${n}`,
          title: parts > 1 ? t('grammar.paths.topicPart', { topic, n: part + 1, total: parts }) : topic,
          goal: chunk.slice(0, 4).map((w) => w.hanzi).join(' · '),
          steps: [{ id: `${id}-u${n}-words`, type: 'vocab', title: t('grammar.paths.words', { from: part * UNIT_SIZE + 1, to: part * UNIT_SIZE + chunk.length }), wordIds: chunk.map((w) => w.id) }],
        });
      }
    }
    const tierName = t(`level.domain.${Math.min(3, Math.max(1, tier)) as 1 | 2 | 3}`);
    return {
      id,
      title: tierName,
      description: t('grammar.paths.domainDesc', { words: words.length, topics: byTopic.size }),
      icon: TIER_ICON[tier] ?? 'sprout',
      units,
    };
  });
}
