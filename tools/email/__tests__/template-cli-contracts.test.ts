import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { supabaseAuthTemplateSlugs } from '../../../emails/auth/_registry';
import { buildSupabaseAuthTemplates } from '../build-auth-templates';
import {
  assertIncludes as assertAuthTemplateIncludes,
  assertUnique as assertUniqueAuthField,
  checkSupabaseAuthTemplates,
} from '../check-auth-templates';
import {
  assertIncludes as assertPolityTemplateIncludes,
  assertUniqueAlias,
  checkPolityTemplates,
} from '../check-templates';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('email template CLI contracts', () => {
  it('builds every auth template only into an isolated output directory', async () => {
    const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polity-auth-emails-'));
    roots.push(outputDirectory);
    const logger = { log: vi.fn() };

    const written = await buildSupabaseAuthTemplates({ outputDirectory, logger });

    expect(written).toHaveLength(supabaseAuthTemplateSlugs.length);
    expect(written.every(file => path.dirname(file) === outputDirectory)).toBe(true);
    expect(written.every(file => fs.readFileSync(file, 'utf8').includes('{{'))).toBe(true);
    expect(logger.log).toHaveBeenCalledTimes(supabaseAuthTemplateSlugs.length);
  });

  it('supports the default output and logger contracts with an injected non-writing boundary', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const written = await buildSupabaseAuthTemplates({ write });

    expect(written).toHaveLength(supabaseAuthTemplateSlugs.length);
    expect(write).toHaveBeenCalledTimes(supabaseAuthTemplateSlugs.length);
    expect(log).toHaveBeenCalledTimes(supabaseAuthTemplateSlugs.length);
  });

  it('checks all bilingual Supabase auth template invariants', async () => {
    const logger = { log: vi.fn() };
    const result = await checkSupabaseAuthTemplates(logger);

    expect(result.templates).toBe(supabaseAuthTemplateSlugs.length);
    expect(result.fields).toBe(supabaseAuthTemplateSlugs.length * 2);
    expect(logger.log).toHaveBeenCalledTimes(result.templates);
  });

  it('checks every environment, locale, alias, link, and plain-text template', async () => {
    const logger = { log: vi.fn() };
    const result = await checkPolityTemplates(logger);

    expect(result.aliases).toBeGreaterThan(0);
    expect(logger.log).toHaveBeenCalledTimes(result.aliases);
  });

  it('rejects missing template invariants and duplicate aliases', () => {
    expect(() => assertAuthTemplateIncludes('html', '{{ .Token }}', 'invite')).toThrow(
      'invite is missing'
    );
    expect(() => assertPolityTemplateIncludes('html', 'lang="de"', 'newsletter')).toThrow(
      'newsletter is missing'
    );
    expect(() => assertUniqueAlias(new Set(['newsletter']), 'newsletter')).toThrow(
      'Duplicate template alias'
    );
    expect(() =>
      assertUniqueAuthField(new Set(['mailer_subjects_invite']), 'mailer_subjects_invite')
    ).toThrow('Duplicate Management API field');
  });
});
