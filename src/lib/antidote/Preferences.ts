import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';

/**
 * Absolute path of the macOS preferences reader. Electron applications started
 * from the Finder only inherit a minimal PATH, so the binary is resolved
 * explicitly instead of relying on the environment.
 */
const DEFAULTS_BIN = '/usr/bin/defaults';

/** Reading a preference is instantaneous: never let a stuck process hang a command. */
const DEFAULTS_TIMEOUT_MS = 5000;

/**
 * `bplist-parser` refuses any property list holding more than 32768 objects.
 * Connectix keeps the description of every text editor it knows about in its
 * preferences, so the file outgrows that default limit over time and parsing
 * fails with `maxObjectCount exceeded`. That limit only exists to avoid absurd
 * allocations while reading a corrupted file, so a much higher ceiling is still
 * a safe guard.
 *
 * @see https://github.com/Heziode/obsidian-antidote/issues/18
 */
const MAX_PLIST_OBJECT_COUNT = 1000000;

/**
 * Read a single key of a macOS preference domain as a string.
 *
 * The `defaults` command is asked first: it goes through the preferences
 * daemon, so it answers with the value currently in use, whatever the size and
 * the on-disk format of the domain. Parsing the property list ourselves is only
 * kept as a fallback, for the setups where that command cannot be spawned.
 *
 * @param domain Preference domain, e.g. `com.druide.Connectix`.
 * @param key Key to read inside that domain.
 * @returns The value of the key, or an empty string when it is defined nowhere.
 */
export async function readPreference(
  domain: string,
  key: string
): Promise<string> {
  const value = await readFromDefaults(domain, key);
  return value !== '' ? value : readFromPropertyList(domain, key);
}

/** Ask the preferences daemon, without ever throwing: an empty string means "unknown". */
function readFromDefaults(domain: string, key: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      DEFAULTS_BIN,
      ['read', domain, key],
      { timeout: DEFAULTS_TIMEOUT_MS },
      (error, stdout) => {
        // An unknown domain, an unknown key or a missing binary all exit with a
        // non-zero status: report them as "unknown" so that the caller falls
        // back to the property list instead of failing.
        resolve(error ? '' : unquote(stdout.trim()));
      }
    );
  });
}

/**
 * `defaults` describes values with the property list syntax, which wraps a
 * string in double quotes as soon as it holds a character such as a space.
 * Give back the value as it is stored.
 */
function unquote(value: string): string {
  if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) {
    return value;
  }
  return value.slice(1, -1).replace(/\\(["\\])/g, '$1');
}

/** Fallback: read the preference file of the domain directly. */
async function readFromPropertyList(
  domain: string,
  key: string
): Promise<string> {
  const file = `${homedir()}/Library/Preferences/${domain}.plist`;
  if (!existsSync(file)) return '';

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const parser = require('bplist-parser');
  parser.maxObjectCount = Math.max(
    parser.maxObjectCount,
    MAX_PLIST_OBJECT_COUNT
  );

  const [preferences] = await parser.parseFile(file);
  const value = preferences?.[key];
  return typeof value === 'string' ? value : '';
}
