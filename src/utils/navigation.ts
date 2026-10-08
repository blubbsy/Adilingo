import { Award, BarChart3, BookMarked, BookOpen, BookOpenCheck, Home, Layers, Zap, type LucideIcon } from 'lucide-react';
import { getCourseConfig, type CourseId, type ViewId } from '../data/courses';
import { t, type UiLanguage } from '../i18n';

export interface NavItem {
  id: ViewId;
  /** Full label (sidebar / top bar). */
  label: string;
  /** Short label (phone bottom bar). */
  short: string;
  icon: LucideIcon;
}

const ICONS: Record<ViewId, LucideIcon> = {
  home: Home,
  learn: BookOpenCheck,
  grammar: BookOpen,
  irregular: Zap,
  topics: Layers,
  dictionary: BookMarked,
  insights: BarChart3,
  achievements: Award,
};

function label(view: ViewId, track: 'chinese' | 'english', lang: UiLanguage): string {
  switch (view) {
    case 'home':
      return t('nav.dashboard', lang);
    case 'learn':
      return track === 'english' ? t('nav.paths', lang) : t('nav.learn', lang);
    case 'grammar':
      return t('nav.grammar', lang);
    case 'irregular':
      return t('nav.irregular', lang);
    case 'topics':
      return t('nav.topics', lang);
    case 'dictionary':
      return t('nav.dictionary', lang);
    case 'insights':
      return t('nav.insights', lang);
    case 'achievements':
      return t('nav.badges', lang);
  }
}

function short(view: ViewId, track: 'chinese' | 'english', lang: UiLanguage): string {
  switch (view) {
    case 'home':
      return t('nav.short.home', lang);
    case 'learn':
      return track === 'english' ? t('nav.short.paths', lang) : t('nav.short.learn', lang);
    case 'grammar':
      return t('nav.short.grammar', lang);
    case 'irregular':
      return t('nav.short.irregular', lang);
    case 'topics':
      return t('nav.short.topics', lang);
    case 'dictionary':
      return t('nav.short.dictionary', lang);
    case 'insights':
      return t('nav.short.insights', lang);
    case 'achievements':
      return t('nav.short.badges', lang);
  }
}

function build(views: ViewId[], courseId: CourseId | undefined, lang: UiLanguage): NavItem[] {
  const { track } = getCourseConfig(courseId);
  return views.map((id) => ({ id, label: label(id, track, lang), short: short(id, track, lang), icon: ICONS[id] }));
}

/** Navigation for the sidebar / top bar, derived from the views the course declares. */
export function navItemsFor(courseId: CourseId | undefined, lang: UiLanguage): NavItem[] {
  return build(getCourseConfig(courseId).views, courseId, lang);
}

/** Navigation for the phone bottom bar. */
export function mobileNavItemsFor(courseId: CourseId | undefined, lang: UiLanguage): NavItem[] {
  return build(getCourseConfig(courseId).mobileViews, courseId, lang);
}
