import { EditorPosition, MarkdownView } from 'obsidian';
import { Range, Position } from './rangeUtils';
/**
 * This file is translated from VS Code.
 *
 * {@link https://github.com/microsoft/vscode/blob/98edc012088772eab301d01db92ba48dae03e148/src/vs/editor/common/core/wordHelper.ts}
 */

export const USUAL_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

/**
 * Word inside a model.
 */
export interface IWordAtPosition {
  /**
   * The word.
   */
  readonly word: string;
  /**
   * The column where the word starts.
   */
  readonly startColumn: number;
  /**
   * The column where the word ends.
   */
  readonly endColumn: number;
}

export interface IGetWordAtTextConfig {
  maxLen: number;
  windowSize: number;
  timeBudget: number;
}

const _defaultConfig: IGetWordAtTextConfig = {
  maxLen: 1000,
  windowSize: 15,
  timeBudget: 150,
};

/**
 * Create a word definition regular expression based on default word separators.
 * Optionally provide allowed separators that should be included in words.
 *
 * The default would look like this:
 * /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
 */
function createWordRegExp(allowInWords: string = ''): RegExp {
  let source = '(-?\\d*\\.\\d\\w*)|([^';
  for (const sep of USUAL_WORD_SEPARATORS) {
    if (allowInWords.indexOf(sep) >= 0) {
      continue;
    }
    source += '\\' + sep;
  }
  source += '\\s]+)';
  return new RegExp(source, 'g');
}

// catches numbers (including floating numbers) in the first group, and alphanum in the second
export const DEFAULT_WORD_REGEXP = createWordRegExp();

export function ensureValidWordDefinition(
  wordDefinition?: RegExp | null
): RegExp {
  let result: RegExp = DEFAULT_WORD_REGEXP;

  if (wordDefinition && wordDefinition instanceof RegExp) {
    if (!wordDefinition.global) {
      let flags = 'g';
      if (wordDefinition.ignoreCase) {
        flags += 'i';
      }
      if (wordDefinition.multiline) {
        flags += 'm';
      }
      if ((wordDefinition as any).unicode) {
        flags += 'u';
      }
      result = new RegExp(wordDefinition.source, flags);
    } else {
      result = wordDefinition;
    }
  }

  result.lastIndex = 0;

  return result;
}

function _findRegexMatchEnclosingPosition(
  wordDefinition: RegExp,
  text: string,
  pos: number,
  stopPos: number
): RegExpExecArray | null {
  let match: RegExpExecArray | null;
  while ((match = wordDefinition.exec(text))) {
    const matchIndex = match.index || 0;
    if (matchIndex <= pos && wordDefinition.lastIndex >= pos) {
      return match;
    } else if (stopPos > 0 && matchIndex > stopPos) {
      return null;
    }
  }
  return null;
}

export function getWordAtText(
  column: number,
  wordDefinition: RegExp,
  text: string,
  textOffset: number,
  config?: IGetWordAtTextConfig
): IWordAtPosition | null {
  if (!config) {
    config = _defaultConfig;
  }

  if (text.length > config.maxLen) {
    // don't throw strings that long at the regexp
    // but use a sub-string in which a word must occur
    let start = column - config.maxLen / 2;
    if (start < 0) {
      start = 0;
    } else {
      textOffset += start;
    }
    text = text.substring(start, column + config.maxLen / 2);
    return getWordAtText(column, wordDefinition, text, textOffset, config);
  }

  const t1 = Date.now();
  const pos = column - 1 - textOffset;

  let prevRegexIndex = -1;
  let match: RegExpExecArray | null = null;

  for (let i = 1; ; i++) {
    // check time budget
    if (Date.now() - t1 >= config.timeBudget) {
      break;
    }

    // reset the index at which the regexp should start matching, also know where it
    // should stop so that subsequent search don't repeat previous searches
    const regexIndex = pos - config.windowSize * i;
    wordDefinition.lastIndex = Math.max(0, regexIndex);
    const thisMatch = _findRegexMatchEnclosingPosition(
      wordDefinition,
      text,
      pos,
      prevRegexIndex
    );

    if (!thisMatch && match) {
      // stop: we have something
      break;
    }

    match = thisMatch;

    // stop: searched at start
    if (regexIndex <= 0) {
      break;
    }
    prevRegexIndex = regexIndex;
  }

  if (match) {
    const result = {
      word: match[0],
      startColumn: textOffset + 1 + match.index!,
      endColumn: textOffset + 1 + match.index! + match[0].length,
    };
    wordDefinition.lastIndex = 0;
    return result;
  }

  return null;
}

export function regExpLeadsToEndlessLoop(regexp: RegExp): boolean {
  // Exit early if it's one of these special cases which are meant to match
  // against an empty string
  if (
    regexp.source === '^' ||
    regexp.source === '^$' ||
    regexp.source === '$' ||
    regexp.source === '^\\s*$'
  ) {
    return false;
  }

  // We check against an empty string. If the regular expression doesn't advance
  // (e.g. ends in an endless loop) it will match an empty string.
  const match = regexp.exec('');
  return !!(match && regexp.lastIndex === 0);
}

export function getWordRangeAtPosition(
  view: MarkdownView,
  position: Position | EditorPosition,
  regexp: RegExp
): Range | undefined {
  // const position = this._validatePosition(_position);

  if (regExpLeadsToEndlessLoop(regexp)) {
    // use default when custom-regexp is bad
    throw new Error(
      `[getWordRangeAtPosition]: ignoring custom regexp '${regexp.source}' because it matches the empty string.`
    );
  }

  const wordAtText = getWordAtText(
    (position instanceof Position ? position.character : position.ch) + 1,
    ensureValidWordDefinition(regexp),
    view.editor.getLine(position.line),
    0
  );

  if (wordAtText) {
    return new Range(
      position.line,
      wordAtText.startColumn - 1,
      position.line,
      wordAtText.endColumn - 1
    );
  }
  return undefined;
}
