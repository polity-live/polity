import { createHash } from 'node:crypto';

const marker = '// Post-acceptance fresh-context history diagnostic adapter.';
const anchor =
  '    await measureMutationBrowserActions(page, seed, conversation, onMutationUpdate, () =>';

const insertion = `    ${marker}
    if (
      process.env.ZERO_PERFORMANCE_CPU_PROFILE === '1' &&
      records.some(record =>
        record.visit === 'back' &&
        record.failures.some(failure => failure.startsWith('Cached display exceeds '))
      )
    ) {
      try {
        const { runNavigationHistoryDiagnostic } = await import('./navigation-history-diagnostic');
        await runNavigationHistoryDiagnostic({
          browser,
          donorContext: context,
          routes,
          appURL: required(process.env.VITE_APP_URL),
          output: required(process.env.ZERO_PERFORMANCE_OUTPUT),
          alphaWarningKey: ALPHA_WARNING_SESSION_KEY,
          navigate,
          inspect,
        });
      } catch (error) {
        console.warn('Navigation history diagnostic could not complete.');
      }
    }
`;

// Exact revision-owned inputs. Both newline encodings are accepted; no source is normalized.
export const navigationHistoryCanonicalHashes = new Map([
  [
    'b7932d59b06fbdc17369f8479f2fd4402d39c7bdda430c607a9d7604bb00c282',
    '0d62c605cc6897b646da1944134a64d73d653ca087f6800e65583bd0ceaa15e7',
  ],
  [
    '1f0d2f8c55cc472acc79f8735ad49a0d6356c079b026eb321087a51ee76b432d',
    'af907cec965b72d51240c9db75f79c2cabcc3f3c31e6040b33527b13bcaa61f0',
  ],
  [
    '332e39228b42655c2f459018bbe7845ad2edae35d8f53f883a662239fbbd0969',
    '220dff6f346644d8289b3833393121a6e9b2e61fe6f5b9395434c9e036945a19',
  ],
  [
    '24d0ca60744abc89cd173a99cf0442b26e7f9f6985523ff81c83fabc7cda9aec',
    '4eaf3f14835154570834105eb79de9703f3be73c894ec1030f6e6478d7030a3f',
  ],
]);

const sha256 = source => createHash('sha256').update(source).digest('hex');

/** Add diagnostic work only after the revision's unchanged navigation acceptance loop. */
export function adaptNavigationHistoryDiagnostic(source) {
  if (source.includes(marker)) throw new Error('Navigation history adapter already present');
  const inputSHA256 = sha256(source);
  const expectedOutput = navigationHistoryCanonicalHashes.get(inputSHA256);
  if (!expectedOutput) throw new Error('Unrecognized revision-owned journeys source hash');
  const occurrences = source.split(anchor).length - 1;
  if (occurrences !== 1) throw new Error('Unrecognized navigation diagnostic insertion boundary');
  const boundary = source.indexOf(anchor);
  const before = source.slice(0, boundary);
  if (
    !before.includes("for (const visit of ['first', 'back', 'repeat'])") ||
    !before.includes('await page.waitForTimeout(5_100)') ||
    !before.includes("const itinerary = visit === 'back' ? [...routes].reverse() : routes;") ||
    !before.includes('await inspect(page, clientSamples)')
  ) {
    throw new Error('Unrecognized revision-owned navigation itinerary');
  }
  const adapted = source.slice(0, boundary) + insertion + source.slice(boundary);
  if (adapted.replace(insertion, '') !== source)
    throw new Error('Navigation history adapter changed revision-owned source');
  const outputSHA256 = sha256(adapted);
  if (outputSHA256 !== expectedOutput)
    throw new Error('Navigation history adapter output hash mismatch');
  return { source: adapted, inputSHA256, outputSHA256 };
}

export function removeNavigationHistoryDiagnostic(source) {
  if (source.split(insertion).length !== 2)
    throw new Error('Unrecognized navigation history adapter output');
  return source.replace(insertion, '');
}
