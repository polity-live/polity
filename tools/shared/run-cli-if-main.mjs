import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runs a CLI entry point only when its module is the process entry module.
 * Keeping this decision in one tested boundary avoids untestable per-script
 * branches while preserving normal import semantics.
 *
 * @param {string} moduleUrl
 * @param {() => unknown | Promise<unknown>} runner
 * @param {{ argvEntry?: string | null, onError?: (error: unknown) => unknown }} [options]
 */
export async function runCliIfMain(moduleUrl, runner, options = {}) {
  const argvEntry = options.argvEntry === undefined ? process.argv[1] : options.argvEntry;
  if (!argvEntry) return false;
  if (path.resolve(argvEntry) !== path.resolve(fileURLToPath(moduleUrl))) return false;

  try {
    await runner();
    return true;
  } catch (error) {
    if (!options.onError) throw error;
    options.onError(error);
    return false;
  }
}
