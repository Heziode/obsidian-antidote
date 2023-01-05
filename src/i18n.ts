import { I18n as I18nJS, TranslateOptions } from 'i18n-js';
import set from 'lodash.set';
import { moment } from 'obsidian';

import { LANGS, LangType, TransItemType } from './translations';

export type Scope = TransItemType | TransItemType[];

function flatToNestedObject(target: Record<string, unknown>) {
  const nested = {};

  Object.keys(target).forEach((path) => set(nested, path, target[path]));

  return nested;
}

const i18nObject: Record<string, unknown> = {};
for (const keyStr in LANGS) {
  const key = keyStr as LangType;
  i18nObject[key] = flatToNestedObject(LANGS[key]);
}

const i18n = new I18nJS(i18nObject);
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

let locale: LangType = 'en';
if (moment.locale().replace('-', '_') in LANGS) {
  locale = moment.locale().replace('-', '_') as LangType;
}
i18n.locale = locale;

export const I18n = i18n;

export const t: <T = string>(
  scope: Scope,
  options?: TranslateOptions
) => string | T = (scope, options) => {
  return i18n.t(scope, options);
};
