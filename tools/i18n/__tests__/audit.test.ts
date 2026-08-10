import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  allLocalesHaveTranslationKey,
  auditRepository,
  auditSourceText,
  flattenTranslationKeys,
  localeHasTranslationKey,
  runI18nAuditCli,
} from '../audit';
import {
  auditGermanOrthography,
  auditGermanSource,
  auditGermanValues,
  findAsciiGermanOrthography,
  runGermanOrthographyCli,
} from '../german-orthography';

const temporaryRoots: string[] = [];

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'polity-i18n-audit-'));
  temporaryRoots.push(root);
  for (const directory of ['src', 'emails', 'public']) {
    mkdirSync(join(root, directory), { recursive: true });
  }
  return root;
}

function write(root: string, file: string, value: string) {
  const target = join(root, file);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, value);
}

function writeValidRuntimeFiles(root: string) {
  write(
    root,
    'public/manifest.de.json',
    JSON.stringify({
      lang: 'de',
      name: 'Polity',
      description: 'Politische Plattform',
      screenshots: [{ label: 'Startseite' }],
    })
  );
  write(
    root,
    'public/manifest.en.json',
    JSON.stringify({
      lang: 'en',
      name: 'Polity',
      description: 'Political platform',
      screenshots: [{ label: 'Home' }],
    })
  );
  write(
    root,
    'public/custom-sw.js',
    `export const markers = ${JSON.stringify([
      'polity:set-language:v1',
      '/__polity/settings/language',
      "notificationTitle: 'New notification'",
      "notificationTitle: 'Neue Benachrichtigung'",
      "offline: 'Polity is currently offline.'",
      "offline: 'Polity ist derzeit offline.'",
    ])};`
  );
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('source i18n audit', () => {
  it('flattens locale objects and accepts exact or complete plural keys', () => {
    const reused = new Set(['existing']);
    expect(flattenTranslationKeys(null)).toEqual(new Set());
    expect(
      flattenTranslationKeys(
        { common: { title: 'Title', choices: ['One', 'Two'], nested: { value: 'Value' } } },
        'root',
        reused
      )
    ).toBe(reused);
    expect([...reused]).toEqual([
      'existing',
      'root.common.title',
      'root.common.choices',
      'root.common.nested.value',
    ]);

    const keys = new Set(['direct', 'plural_one', 'plural_other', 'partial_one']);
    expect(localeHasTranslationKey(keys, 'direct')).toBe(true);
    expect(localeHasTranslationKey(keys, 'plural')).toBe(true);
    expect(localeHasTranslationKey(keys, 'partial')).toBe(false);
    expect(localeHasTranslationKey(keys, 'missing')).toBe(false);
    expect(allLocalesHaveTranslationKey([keys, new Set(['direct'])], 'direct')).toBe(true);
    expect(allLocalesHaveTranslationKey([keys, new Set()], 'direct')).toBe(false);
  });

  it('classifies visible JSX, copy properties, helper returns, toasts and missing keys', () => {
    const findings = auditSourceText(
      `
        const config = {
          'title': \`Static visible copy\`,
          badges: tag\`\\unicode\`,
          subtitle: tag\`\\unicode\${value}\`,
          42: 'Not a copy property',
          title: 'Visible title',
          subtitle: condition ? 'First option' : 'Second option',
          description: ['Array copy', enabled && 'Logical copy'],
          helperText: value satisfies string,
          className: 'bg-red-500 text-white',
          label: values.includes('comparison value'),
          tooltip: 'Visible call copy'.trim(),
          title: 'Polity',
          helperText: makeCopy('Not statically visible'),
        };
        function helper(flag: boolean) {
          if (flag) return ('Helpful return copy' as string)!;
          return \`Dynamic helper \${value}\`;
        }
        function comparison() { return 'left' === 'right'; }
        function compact() { return 'Single'; }
        function classes() { return 'sm:flex bg-red-500'; }
        foo();
        (() => undefined)();
        toast.error('Saving failed');
        toast.info(\`Failure: \${reason}\`);
        toast.dismiss('Not audited');
        t(dynamic);
        t('other.namespace');
        t('common.actions.save');
        t('common.__definitely_missing_a10_key__');
        translateText('features.__definitely_missing_a10_key__');
        export function View() {
          return <section aria-label={'Open settings'} title={flag ? 'Primary tip' : 'Fallback tip'} buttonLabel="Visible button copy" data-copy="Visible but custom">
            Visible child copy
            {'Inline child copy'}
            {dynamic}
            <span title="Polity" />
            <input title />
          </section>;
        }
      `,
      'src/features/example/View.tsx'
    );

    expect(findings.filter(item => item.kind === 'jsx-text').map(item => item.value)).toEqual(
      expect.arrayContaining(['Visible child copy', 'Inline child copy'])
    );
    expect(findings.filter(item => item.kind === 'accessibility-copy').map(item => item.value)).toEqual(
      expect.arrayContaining(['Open settings', 'Primary tip', 'Fallback tip'])
    );
    expect(findings.filter(item => item.kind === 'copy-prop').map(item => item.value)).toEqual(
      expect.arrayContaining(['Visible title', 'First option', 'Second option', 'Array copy', 'Logical copy'])
    );
    expect(findings.filter(item => item.kind === 'helper-return').map(item => item.value)).toEqual(
      expect.arrayContaining(['Helpful return copy', 'Dynamic helper ${…}'])
    );
    expect(findings.filter(item => item.kind === 'toast-copy')).toHaveLength(2);
    expect(findings.filter(item => item.kind === 'missing-key')).toHaveLength(2);
    expect(findings.some(item => item.value === 'bg-red-500 text-white')).toBe(false);
    expect(findings.some(item => item.value === 'comparison value')).toBe(false);
  });

  it('ignores allowlisted, technical and explicitly non-UI server strings', () => {
    expect(
      auditSourceText(
        `
          const config = { title: 'Polity', label: 'EUR' };
          function helper() { return 'No visible server copy'; }
          toast.success('Polity');
        `,
        'src/server/example.ts'
      )
    ).toEqual([]);
    expect(
      auditSourceText(`function helper() { return 'No visible AI copy'; }`, 'src/lib/ai/helper.ts')
    ).toEqual([]);
  });
});

describe('German orthography audit', () => {
  it('walks nested locale and manifest values with stable paths', () => {
    expect(auditGermanValues(null, 'fixture.json')).toEqual([]);
    expect(auditGermanValues(42, 'fixture.json')).toEqual([]);
    expect(auditGermanValues(['Fuer Gaeste'], 'fixture.json')).toMatchObject([
      { file: 'fixture.json', path: '0', words: ['Fuer', 'Gaeste'] },
    ]);
    expect(
      auditGermanValues(
        { title: 'Fuer Gaeste', items: ['OK', 'Spaeter pruefen'], ignored: null },
        'fixture.json',
        'root'
      )
    ).toMatchObject([
      { path: 'root.title', words: ['Fuer', 'Gaeste'] },
      { path: 'root.items.1', words: ['Spaeter', 'pruefen'] },
    ]);
  });

  it('deduplicates ASCII substitutions and audits only user-facing source values', () => {
    expect(findAsciiGermanOrthography('fuer Gaeste, fuer alle und gross')).toEqual([
      'fuer',
      'Gaeste',
      'gross',
    ]);

    const findings = auditGermanSource(
      `
        import value from './fuer-technical';
        export * from './fuer-export';
        export { value } from './fuer-named';
        type Technical = 'fuer-type';
        const route = { href: '/fuer-gaeste', id: 'fuer-gaeste' };
        const technicalKey = { 'Fuer key': 'OK', 42: 'OK' };
        const key = 'common.fuer_gaeste';
        const allowed = 'euckenstrasse';
        const visible = 'Das ist fuer Gaeste';
        const dynamic = \`Spaeter fuer \${name}\`;
        const invalidEscape = tag\`\\unicode\`;
        const element = <a href="/fuer-gaeste" data-testid="fuer-gaeste" title="Fuer Gaeste">OK</a>;
      `,
      'src/example.tsx'
    );

    expect(findings.map(item => item.words)).toEqual([
      ['fuer', 'Gaeste'],
      ['Spaeter', 'fuer'],
      ['Fuer', 'Gaeste'],
    ]);
    expect(findings.every(item => item.file === 'src/example.tsx')).toBe(true);
  });

  it('walks source, email, service-worker and German manifest values', () => {
    const root = temporaryRoot();
    writeValidRuntimeFiles(root);
    write(
      root,
      'src/index.ts',
      `export const visible = 'Fuer Gaeste'; export const later = 'Spaeter pruefen';`
    );
    write(root, 'emails/message.ts', `export const subject = 'Spaeter pruefen';`);
    write(
      root,
      'public/manifest.de.json',
      JSON.stringify({
        lang: 'de',
        name: 'Fuer Gaeste',
        description: 'Spaeter pruefen',
        screenshots: [{ label: 'Startseite' }],
      })
    );

    const findings = auditGermanOrthography(root);
    expect(findings.map(item => item.file)).toEqual(
      expect.arrayContaining(['src\\index.ts', 'emails\\message.ts', 'public\\manifest.de.json'])
    );
    expect(findings).toEqual(
      [...findings].sort(
        (left, right) =>
          left.file.localeCompare(right.file) ||
          left.line - right.line ||
          (left.path ?? '').localeCompare(right.path ?? '')
      )
    );
  });
});

describe('repository i18n audit', () => {
  it('applies directory/file exclusions and aggregates source, orthography, manifest and worker findings', () => {
    const root = temporaryRoot();
    write(root, 'src/components/Visible.tsx', `export const View = () => <div>Visible copy</div>;`);
    write(root, 'src/components/Words.ts', `export const text = 'Fuer Gaeste';`);
    write(root, 'src/__tests__/ignored.test.tsx', `export const View = () => <div>Ignored copy</div>;`);
    write(root, 'src/fixtures/ignored.ts', `export const text = 'Fuer Gaeste';`);
    write(root, 'src/generated/ignored.ts', `export const text = 'Fuer Gaeste';`);
    write(root, 'src/components/ignored.stories.tsx', `export const View = () => <div>Ignored copy</div>;`);
    write(root, 'src/components/generated.ts', `export const text = 'Fuer Gaeste';`);
    write(root, 'src/features/docs/content/ignored.tsx', `export const View = () => <div>Ignored copy</div>;`);
    write(root, 'src/i18n/locales/de/ignored.ts', `export const text = 'Fuer Gaeste';`);
    write(root, 'src/example.d.ts', `export interface Example { value: string }`);
    write(root, 'src/example.css', `.example { color: red; }`);
    write(root, 'emails/message.ts', `export const subject = 'Spaeter pruefen';`);
    write(
      root,
      'public/manifest.de.json',
      JSON.stringify({ lang: 'en', name: '', description: 'Fuer alle', screenshots: [{}] })
    );
    write(
      root,
      'public/manifest.en.json',
      JSON.stringify({ lang: 'en', name: 'Polity', description: 'Platform', screenshots: [{}] })
    );
    write(root, 'public/custom-sw.js', `const offline = 'offline';`);

    const findings = auditRepository(root);
    expect(findings.some(item => item.kind === 'jsx-text' && item.value === 'Visible copy')).toBe(
      true
    );
    expect(findings.some(item => item.kind === 'german-orthography')).toBe(true);
    expect(findings.filter(item => item.kind === 'manifest')).toHaveLength(2);
    expect(findings.filter(item => item.kind === 'service-worker')).toHaveLength(6);
    expect(findings.some(item => item.value.includes('Ignored copy'))).toBe(false);
    expect(findings).toEqual(
      [...findings].sort(
        (left, right) =>
          left.file.localeCompare(right.file) ||
          left.line - right.line ||
          left.kind.localeCompare(right.kind)
      )
    );
  });

  it('returns no findings for a minimal complete repository', () => {
    const root = temporaryRoot();
    writeValidRuntimeFiles(root);
    write(root, 'src/index.ts', `export const value = 1;`);
    write(root, 'emails/index.ts', `export const value = 1;`);

    expect(auditRepository(root)).toEqual([]);
  });
});

describe('i18n audit CLIs', () => {
  it('reports findings, summaries and success through injected dependencies', () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const processState: { exitCode?: number } = {};
    const finding = {
      file: 'src/View.tsx',
      line: 7,
      kind: 'jsx-text' as const,
      value: 'Visible copy',
    };

    expect(runI18nAuditCli({ audit: () => [finding], logger, processState })).toEqual([finding]);
    expect(logger.error).toHaveBeenCalledWith('src/View.tsx:7 [jsx-text] "Visible copy"');
    expect(logger.error).toHaveBeenCalledWith('\n1 unexplained i18n finding(s).');
    expect(processState.exitCode).toBe(1);

    expect(runI18nAuditCli({ audit: () => [], logger, processState: {} })).toEqual([]);
    expect(logger.log).toHaveBeenCalledWith('i18n audit passed with zero unexplained findings.');
  });

  it('formats German paths and source locations and covers default console/process wiring', () => {
    const logger = { error: vi.fn(), log: vi.fn() };
    const processState: { exitCode?: number } = {};
    const findings = [
      {
        file: 'manifest.de.json',
        line: 1,
        path: 'description',
        value: 'Fuer alle',
        words: ['Fuer'],
      },
      { file: 'src/View.tsx', line: 4, value: 'Spaeter', words: ['Spaeter'] },
    ];

    expect(runGermanOrthographyCli({ audit: () => findings, logger, processState })).toEqual(
      findings
    );
    expect(logger.error).toHaveBeenCalledWith(
      'manifest.de.json (description) [german-orthography] ["Fuer"] in "Fuer alle"'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'src/View.tsx:4 [german-orthography] ["Spaeter"] in "Spaeter"'
    );
    expect(processState.exitCode).toBe(1);

    expect(runGermanOrthographyCli({ audit: () => [], logger, processState: {} })).toEqual([]);
    expect(logger.log).toHaveBeenCalledWith('German orthography audit passed with zero findings.');

    const root = temporaryRoot();
    writeValidRuntimeFiles(root);
    write(root, 'src/index.ts', `export const value = 1;`);
    write(root, 'emails/index.ts', `export const value = 1;`);
    const previousDirectory = process.cwd();
    process.chdir(root);
    try {
      expect(runI18nAuditCli({ logger, processState: {} })).toEqual([]);
      expect(runGermanOrthographyCli({ logger, processState: {} })).toEqual([]);
    } finally {
      process.chdir(previousDirectory);
    }

    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const previousExitCode = process.exitCode;
    expect(runI18nAuditCli({ audit: () => [] })).toEqual([]);
    expect(runGermanOrthographyCli({ audit: () => [] })).toEqual([]);
    process.exitCode = previousExitCode;
    consoleLog.mockRestore();
  });
});
