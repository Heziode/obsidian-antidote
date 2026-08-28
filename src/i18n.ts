import { I18n as I18nJS, TranslateOptions } from 'i18n-js';
import { moment } from 'obsidian';

import { LANGS, LangType, TransItemType } from './translations';

export type Scope = TransItemType | TransItemType[];

/**
 * Turn `{ 'a.b': 'x' }` into `{ a: { b: 'x' } }`: translation files store their
 * keys flat, while the i18n library looks them up through nested objects.
 */
function flatToNestedObject(
  target: Record<string, unknown>
): Record<string, unknown> {
  const nested: Record<string, unknown> = {};

  for (const [path, value] of Object.entries(target)) {
    const keys = path.split('.');
    const leaf = keys[keys.length - 1];

    let node = nested;
    for (const key of keys.slice(0, -1)) {
      const child = node[key];
      node[key] = typeof child === 'object' && child !== null ? child : {};
      node = node[key] as Record<string, unknown>;
    }

    node[leaf] = value;
  }

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
