import type { CourseId, HskLevel, TrackId, VocabItem } from '../types';
import manifest from './generated/domainManifest.json';

export type DomainFamily = 'engineering' | 'medicine' | 'sports';

/** One specialty vocabulary domain (compiled from `content/domains/<id>.txt`). */
export interface DomainInfo {
  id: string;
  name: { en: string; zh: string };
  family: DomainFamily;
  description: string;
  count: number;
  /** Concepts per tier: Essentials / Professional / Expert. */
  tiers: [number, number, number];
  topics: string[];
}

export const DOMAINS: DomainInfo[] = manifest as unknown as DomainInfo[];
export const DOMAIN_FAMILIES: DomainFamily[] = ['engineering', 'medicine', 'sports'];
export const FAMILY_ICON: Record<DomainFamily, string> = { engineering: '⚙️', medicine: '🩺', sports: '🏅' };

/** Name of a domain in the interface language (languages without an own name use English). */
export function domainName(domain: DomainInfo, lang: string): string {
  return (domain.name as Record<string, string>)[lang] ?? domain.name.en;
}

export function getDomain(id: string): DomainInfo | undefined {
  return DOMAINS.find((d) => d.id === id);
}

/** `chinese:emotor` – the Chinese terms of the domain, `english:emotor` – the English terms. */
export function domainCourseId(domain: string, track: TrackId): CourseId {
  return `${track}:${domain}`;
}

/** Splits a course id into track and domain; `null` for the plain language courses. */
export function parseDomainCourse(courseId: string | undefined): { track: TrackId; domain: string } | null {
  if (!courseId || !courseId.includes(':')) return null;
  const [track, ...rest] = courseId.split(':');
  if (track !== 'chinese' && track !== 'english') return null;
  return { track, domain: rest.join(':') };
}

/** Compact concept row written by `scripts/build-content.mjs`. */
type Row = [string, number, string, string, string, string, string, string, string, string, string, string, string];

const chunks = import.meta.glob('./generated/domains/*.json') as Record<string, () => Promise<{ default: Row[] }>>;

/** Loads the vocabulary of one domain for one language track (separate chunk per domain). */
export async function loadDomainItems(domain: string, track: TrackId): Promise<VocabItem[]> {
  const load = chunks[`./generated/domains/${domain}.json`];
  if (!load) throw new Error(`Unknown domain "${domain}"`);
  const rows = (await load()).default;
  return rows.map(([cid, tier, topic, en, zh, zhPy, zhNum, abbr, def, exEn, exZh, exZhPy, speak], i): VocabItem => {
    const base = {
      hskLevel: tier as HskLevel,
      levels: { domain: tier as HskLevel },
      frequency: i + 1,
      topics: [topic],
      definition: def,
      abbr: abbr || undefined,
      speakAs: speak || undefined,
      domain,
    };
    if (track === 'chinese') {
      return {
        ...base,
        id: `d:${domain}:${cid}:zh`,
        hanzi: zh,
        pinyin: zhPy,
        pinyinNumbered: zhNum,
        english: [en],
        exampleSentence: { hanzi: exZh, pinyin: exZhPy, english: exEn },
      };
    }
    return {
      ...base,
      id: `d:${domain}:${cid}:en`,
      hanzi: en,
      pinyin: '',
      pinyinNumbered: '',
      english: [zh],
      exampleSentence: { hanzi: exEn, pinyin: '', english: exZh },
    };
  });
}
