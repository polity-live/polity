import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  confirmProduction,
  loadEnvironment,
  main,
  parseEnvironment,
  parseLocale,
  parseOptions,
  reportMainError,
  requireEnv,
  runPolityTemplateDeployCli,
} from '../deploy-template';

describe('Resend template deployment CLI', () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalArgv = process.argv;
  const originalEnvironment = process.env.NEWSLETTER_ENVIRONMENT;
  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    process.argv = originalArgv;
    if (originalEnvironment === undefined) delete process.env.NEWSLETTER_ENVIRONMENT;
    else process.env.NEWSLETTER_ENVIRONMENT = originalEnvironment;
  });

  it('parses dry-run, environment, locale, slug, and confirmation boundaries', () => {
    expect(
      parseOptions([
        'newsletter',
        '--dry-run',
        '--environment=production',
        '--locale',
        'en',
        '--confirm-alias=polity-newsletter-production-en',
      ])
    ).toMatchObject({
      slug: 'newsletter',
      dryRun: true,
      environment: 'production',
      locale: 'en',
      confirmAlias: 'polity-newsletter-production-en',
    });
    expect(() => parseOptions([])).toThrow('Template slug is required');
    expect(() => parseOptions(['newsletter', '--unknown'])).toThrow('Unknown option');
    expect(() => parseOptions(['newsletter', 'extra'])).toThrow('Unexpected argument');
    expect(() => parseEnvironment('preview')).toThrow('Invalid environment');
    expect(() => parseLocale('fr')).toThrow('Invalid locale');
    expect(
      parseOptions(['newsletter'], {
        npm_config_confirm_alias: 'alias',
        npm_config_dry_run: 'true',
        npm_config_environment: 'production',
        npm_config_locale: 'en',
      })
    ).toEqual({
      confirmAlias: 'alias',
      dryRun: true,
      environment: 'production',
      locale: 'en',
      slug: 'newsletter',
    });
    expect(
      parseOptions(['newsletter', '--environment', 'development', '--locale=de', 'production'], {})
    ).toMatchObject({ environment: 'production', locale: 'de' });
    expect(() => parseOptions(['newsletter', '--confirm-alias'], {})).toThrow(
      'exact production alias'
    );
    expect(parseOptions(['newsletter', '--confirm-alias', 'alias'], {})).toMatchObject({
      confirmAlias: 'alias',
    });
    expect(() => parseOptions(['newsletter', '--environment'], {})).toThrow('requires development');
    expect(() => parseOptions(['newsletter', '--locale'], {})).toThrow('requires de or en');
  });

  it('requires trimmed deployment credentials', () => {
    delete process.env.RESEND_API_KEY;
    expect(() => requireEnv('RESEND_API_KEY')).toThrow('RESEND_API_KEY is required');
    process.env.RESEND_API_KEY = ' key ';
    expect(requireEnv('RESEND_API_KEY')).toBe('key');
  });

  it('loads local environment layers and confirms only an exact production alias', async () => {
    loadEnvironment('development');
    await expect(confirmProduction('expected', 'expected')).resolves.toBeUndefined();
    await expect(confirmProduction('expected', 'wrong')).rejects.toThrow('expected alias');
    await expect(confirmProduction('expected')).rejects.toThrow('interactive terminal');

    const close = vi.fn();
    await expect(
      confirmProduction('expected', undefined, {
        createReadline: (() => ({
          question: vi.fn().mockResolvedValue(' expected '),
          close,
        })) as never,
        inputIsTTY: true,
        outputIsTTY: true,
      })
    ).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();

    const rejectedClose = vi.fn();
    await expect(
      confirmProduction('expected', undefined, {
        createReadline: (() => ({
          question: vi.fn().mockResolvedValue('wrong'),
          close: rejectedClose,
        })) as never,
        inputIsTTY: true,
        outputIsTTY: true,
      })
    ).rejects.toThrow('was not confirmed');
    expect(rejectedClose).toHaveBeenCalledOnce();
  });

  it('executes a complete dry-run and reports top-level failures through an injectable boundary', async () => {
    process.argv = ['node', 'deploy-template.ts', 'newsletter', '--dry-run'];
    process.env.NEWSLETTER_ENVIRONMENT = 'development';
    await expect(main()).resolves.toBeUndefined();

    const logger = { error: vi.fn() };
    const processState: { exitCode?: number } = {};
    reportMainError(new Error('boom'), logger, processState);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
    expect(processState.exitCode).toBe(1);

    reportMainError('plain failure', logger, processState);
    expect(logger.error).toHaveBeenLastCalledWith('plain failure');
  });

  it('covers deterministic production, validation, and default dependency boundaries', async () => {
    const definition = { alias: 'polity-newsletter-production-de' } as never;
    const deploy = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.fn().mockResolvedValue(undefined);
    const client = {} as never;
    await expect(
      runPolityTemplateDeployCli({
        args: [
          'newsletter',
          '--environment=production',
          '--confirm-alias=polity-newsletter-production-de',
        ],
        env: { RESEND_API_KEY: ' secret ', NEWSLETTER_ENVIRONMENT: 'production' },
        load: vi.fn(),
        assertEnvironment: vi.fn(),
        getDefinition: vi.fn(() => definition),
        render: vi.fn().mockResolvedValue({ html: '<p>ok</p>', text: 'ok' }),
        confirm,
        createClient: vi.fn(() => client),
        deploy,
      })
    ).resolves.toEqual({ alias: 'polity-newsletter-production-de', dryRun: false });
    expect(confirm).toHaveBeenCalledWith(
      'polity-newsletter-production-de',
      'polity-newsletter-production-de'
    );
    expect(deploy).toHaveBeenCalledWith(expect.objectContaining({ client, dryRun: false }));

    await expect(
      runPolityTemplateDeployCli({
        args: [
          'newsletter',
          '--environment=production',
          '--confirm-alias=polity-newsletter-production-de',
        ],
        env: { RESEND_API_KEY: 'secret', NEWSLETTER_ENVIRONMENT: 'production' },
        load: vi.fn(),
        assertEnvironment: vi.fn(),
        getDefinition: vi.fn(() => definition),
        render: vi.fn().mockResolvedValue({ html: '', text: '' }),
        createClient: vi.fn(() => client),
        deploy: vi.fn().mockResolvedValue(undefined),
      })
    ).resolves.toEqual({ alias: 'polity-newsletter-production-de', dryRun: false });

    await expect(
      runPolityTemplateDeployCli({
        args: ['unknown', '--dry-run'],
        env: {},
        isTemplateSlug: (_value: string): _value is 'newsletter' | 'product-update' => false,
      })
    ).rejects.toThrow('Unknown template');

    await expect(
      runPolityTemplateDeployCli({
        args: ['newsletter', '--dry-run'],
        env: { NEWSLETTER_ENVIRONMENT: 'development' },
        load: vi.fn(),
        assertEnvironment: vi.fn(),
        getDefinition: vi.fn(() => definition),
        render: vi.fn().mockResolvedValue({ html: '', text: '' }),
        createClient: vi.fn(() => client),
        deploy: vi.fn().mockResolvedValue(undefined),
      })
    ).resolves.toEqual({ alias: 'polity-newsletter-production-de', dryRun: true });
  });
});
