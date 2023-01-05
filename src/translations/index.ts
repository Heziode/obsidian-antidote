import en from './en.json';
import fr from './fr.json';

export type TransItemType = keyof typeof en;
export type LangType = 'en' | 'fr';

export const LANGS: Record<LangType, Partial<Record<TransItemType, string>>> = {
  en: en,
  fr: fr,
};
