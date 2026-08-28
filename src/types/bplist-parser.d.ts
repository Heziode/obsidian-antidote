/**
 * Minimal typings for `bplist-parser`, which ships none of its own.
 * Only the surface used to read a macOS preference file is described.
 */
declare module 'bplist-parser' {
  /**
   * Highest number of objects a property list may hold before parsing is
   * refused. Writable, so that a caller can raise the default guard.
   */
  let maxObjectCount: number;

  /** Parse a binary property list. Answers one entry per stored root object. */
  function parseFile(
    fileNameOrBuffer: string
  ): Promise<Record<string, unknown>[]>;

  const parser: { maxObjectCount: number; parseFile: typeof parseFile };
  export default parser;
  export { maxObjectCount, parseFile };
}
