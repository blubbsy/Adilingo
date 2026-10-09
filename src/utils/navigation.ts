import { Award, BarChart3, BookMarked, BookOpenCheck, Home, Layers, Zap, type LucideIcon } from 'lucide-react';
import { SECONDARY_VIEWS, getCourseConfig, type CourseId, type ViewId } from '../data/courses';
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
  irregular: Zap,
  topics: Layers,
  dictionary: BookMarked,
  insights: BarChart3,
  achievements: Award,
};

/** Both language courses call the learning screen "Paths & Grammar"; courses without grammar just "Paths". */
function label(view: ViewId, grammar: boolean, lang: UiLanguage): string {
  switch (view) {
    case 'home':
      return t('nav.dashboard', lang);
    case 'learn':
      return grammar ? t('nav.learn', lang) : t('nav.paths', lang);
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

function short(view: ViewId, grammar: boolean, lang: UiLanguage): string {
  switch (view) {
    case 'home':
      return t('nav.short.home', lang);
    case 'learn':
      return grammar ? t('nav.short.learn', lang) : t('nav.short.paths', lang);
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
  const { features } = getCourseConfig(courseId);
  return views
    .filter((id) => !SECONDARY_VIEWS.includes(id))
    .map((id) => ({ id, label: label(id, features.grammar, lang), short: short(id, features.grammar, lang), icon: ICONS[id] }));
}

/** Navigation for the sidebar / top bar, derived from the views the course declares. */
export function navItemsFor(courseId: CourseId | undefined, lang: UiLanguage): NavItem[] {
  return build(getCourseConfig(courseId).views, courseId, lang);
}

/** Navigation for the phone bottom bar. */
export function mobileNavItemsFor(courseId: CourseId | undefined, lang: UiLanguage): NavItem[] {
  return build(getCourseConfig(courseId).mobileViews, courseId, lang);
}
