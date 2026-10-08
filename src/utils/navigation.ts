import { Award, BarChart3, BookMarked, BookOpen, BookOpenCheck, Home, Layers, Zap, type LucideIcon } from 'lucide-react';
import { getCourseConfig, type CourseId, type ViewId } from '../data/courses';
import { t, type UiLanguage } from './i18n';

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
      return track === 'english' ? (lang === 'zh' ? '分级路径' : 'Paths') : t('nav.learn', lang);
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
  const zh = lang === 'zh';
  switch (view) {
    case 'home':
      return zh ? '首页' : 'Home';
    case 'learn':
      return track === 'english' ? (zh ? '路径' : 'Paths') : zh ? '学习' : 'Learn';
    case 'grammar':
      return zh ? '语法' : 'Grammar';
    case 'irregular':
      return zh ? '动词' : 'Verbs';
    case 'topics':
      return zh ? '主题' : 'Topics';
    case 'dictionary':
      return zh ? '词典' : 'Words';
    case 'insights':
      return zh ? '统计' : 'Stats';
    case 'achievements':
      return zh ? '徽章' : 'Badges';
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
