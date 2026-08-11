import { describe, expect, it, vi } from 'vitest';

const defaults = vi.hoisted(() => ({ deploy: vi.fn() }));

vi.mock('../../../src/server/supabase-auth-template-deployment', () => ({
  deploySupabaseAuthTemplates: defaults.deploy,
}));

import {
  confirmProduction,
  parseAuthTemplateDeployOptions,
  runAuthTemplateDeployCli,
} from '../deploy-auth-templates';

describe('Supabase auth template deployment CLI', () => {
  it('uses the default deployment boundary when no override is supplied', async () => {
    defaults.deploy.mockResolvedValueOnce({ changedFields: [], deployed: false });
    await expect(
      runAuthTemplateDeployCli({
        args: ['--dry-run'],
        env: { SUPABASE_PROJECT_REF: 'project', SUPABASE_ACCESS_TOKEN: 'token' },
        loadEnvironmentFile: vi.fn(),
        logger: { log: vi.fn() },
      })
    ).resolves.toMatchObject({ dryRun: true, deployed: false });
    expect(defaults.deploy).toHaveBeenCalledOnce();
  });

  it('parses separate and inline options and rejects unknown environments', () => {
    expect(
      parseAuthTemplateDeployOptions(
        ['--environment=production', '--dry-run', '--confirm-alias', 'alias'],
        {}
      )
    ).toEqual({
      environment: 'production',
      dryRun: true,
      confirmAlias: 'alias',
    });
    expect(() => parseAuthTemplateDeployOptions(['--environment', 'preview'], {})).toThrow(
      'development or production'
    );
  });

  it('runs a deterministic development dry-run without external environment loading', async () => {
    const deploy = vi
      .fn()
      .mockResolvedValue({ changedFields: ['mailer_subjects_invite'], deployed: false });
    const loadEnvironmentFile = vi.fn();
    const logger = { log: vi.fn() };

    await expect(
      runAuthTemplateDeployCli({
        args: ['--dry-run'],
        env: { SUPABASE_PROJECT_REF: 'project', SUPABASE_ACCESS_TOKEN: 'token' },
        loadEnvironmentFile,
        deploy,
        logger,
      })
    ).resolves.toEqual({
      alias: 'polity-auth-templates-development',
      changedFields: ['mailer_subjects_invite'],
      deployed: false,
      dryRun: true,
    });
    expect(loadEnvironmentFile).toHaveBeenCalledTimes(2);
    expect(deploy).toHaveBeenCalledWith({
      accessToken: 'token',
      dryRun: true,
      projectRef: 'project',
    });
  });

  it('requires exact confirmation before a production mutation', async () => {
    const confirm = vi.fn().mockRejectedValue(new Error('wrong alias'));
    const deploy = vi.fn();

    await expect(
      runAuthTemplateDeployCli({
        args: ['--environment=production'],
        env: { SUPABASE_PROJECT_REF: 'project', SUPABASE_ACCESS_TOKEN: 'token' },
        loadEnvironmentFile: vi.fn(),
        deploy,
        confirm,
      })
    ).rejects.toThrow('wrong alias');
    expect(deploy).not.toHaveBeenCalled();
  });

  it('accepts only the exact non-interactive production alias', async () => {
    await expect(confirmProduction('expected', 'expected')).resolves.toBeUndefined();
    await expect(confirmProduction('expected', 'wrong')).rejects.toThrow('expected alias');
    await expect(confirmProduction('expected')).rejects.toThrow('interactive terminal');
  });

  it('accepts and rejects answers from an injected interactive prompt and always closes it', async () => {
    const close = vi.fn();
    const createReadline = vi.fn(() => ({
      question: vi.fn().mockResolvedValue(' expected '),
      close,
    }));
    await expect(
      confirmProduction('expected', undefined, {
        createReadline: createReadline as never,
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

  it('uses process defaults and the built-in non-interactive confirmation safely', async () => {
    const originalArgv = process.argv;
    const originalProjectRef = process.env.SUPABASE_PROJECT_REF;
    const originalAccessToken = process.env.SUPABASE_ACCESS_TOKEN;
    process.argv = [
      'node',
      'deploy-auth-templates.ts',
      '--environment=production',
      '--confirm-alias=polity-auth-templates-production',
    ];
    process.env.SUPABASE_PROJECT_REF = 'project';
    process.env.SUPABASE_ACCESS_TOKEN = 'token';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await expect(
        runAuthTemplateDeployCli({
          loadEnvironmentFile: vi.fn(),
          deploy: vi.fn().mockResolvedValue({ changedFields: [], deployed: true }),
        })
      ).resolves.toEqual({
        alias: 'polity-auth-templates-production',
        changedFields: [],
        deployed: true,
        dryRun: false,
      });
      expect(log).toHaveBeenCalledOnce();
    } finally {
      process.argv = originalArgv;
      if (originalProjectRef === undefined) delete process.env.SUPABASE_PROJECT_REF;
      else process.env.SUPABASE_PROJECT_REF = originalProjectRef;
      if (originalAccessToken === undefined) delete process.env.SUPABASE_ACCESS_TOKEN;
      else process.env.SUPABASE_ACCESS_TOKEN = originalAccessToken;
    }
  });

  it('rejects each missing required credential before deployment', async () => {
    const baseOptions = {
      args: ['--dry-run'],
      loadEnvironmentFile: vi.fn(),
      deploy: vi.fn(),
      logger: { log: vi.fn() },
    };
    await expect(
      runAuthTemplateDeployCli({ ...baseOptions, env: { SUPABASE_ACCESS_TOKEN: 'token' } })
    ).rejects.toThrow('SUPABASE_PROJECT_REF is required');
    await expect(
      runAuthTemplateDeployCli({ ...baseOptions, env: { SUPABASE_PROJECT_REF: 'project' } })
    ).rejects.toThrow('SUPABASE_ACCESS_TOKEN is required');
    expect(baseOptions.deploy).not.toHaveBeenCalled();
  });

  it('loads default dotenv files while keeping deployment in an injected dry-run boundary', async () => {
    const deploy = vi.fn().mockResolvedValue({ changedFields: [], deployed: false });

    await expect(
      runAuthTemplateDeployCli({
        args: ['--dry-run'],
        env: { SUPABASE_PROJECT_REF: 'project', SUPABASE_ACCESS_TOKEN: 'token' },
        deploy,
        logger: { log: vi.fn() },
      })
    ).resolves.toEqual({
      alias: 'polity-auth-templates-development',
      changedFields: [],
      deployed: false,
      dryRun: true,
    });
    expect(deploy).toHaveBeenCalledOnce();
  });
});
