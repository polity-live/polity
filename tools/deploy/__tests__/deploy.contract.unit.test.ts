import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  confirmTarget,
  createReporter,
  formatTargets,
  hasCommand,
  parseDeployOptions,
  promptDeployTargets,
  reportDeployError,
  runDeployCli,
  waitForZeroHealth,
} from '../deploy.mjs';

function reporter() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  };
}

describe('deployment CLI contracts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('parses supported target flags and rejects unknown flags', () => {
    expect(parseDeployOptions(['--all', '--dry-run'])).toMatchObject({
      deployAll: true,
      dryRun: true,
      promptForTargets: false,
    });
    expect(parseDeployOptions(['--yes']).deployAll).toBe(true);
    expect(parseDeployOptions(['--skip-supabase', '--skip-fly', '--skip-vercel'])).toMatchObject({
      promptForTargets: false,
      targets: { supabase: false, fly: false, vercel: false },
    });
    expect(parseDeployOptions([]).promptForTargets).toBe(true);
    expect(() => parseDeployOptions(['--preview'])).toThrow('Unknown flag');
  });

  it('formats every target and emits every reporter level', () => {
    expect(formatTargets({ supabase: true, fly: true, vercel: true })).toContain('Vercel');
    expect(formatTargets({ supabase: false, fly: false, vercel: false })).toBe('none');
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const output = createReporter(logger as unknown as Console);
    output.info('info');
    output.success('success');
    output.warn('warn');
    output.error('error');
    output.step('step');
    expect(logger.log).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledOnce();
    expect(createReporter()).toEqual(expect.objectContaining({ info: expect.any(Function) }));
  });

  it('detects commands on Windows and POSIX and maps execution failures', () => {
    const execute = vi.fn();
    expect(hasCommand('node', { execute, platform: 'win32' })).toBe(true);
    expect(execute).toHaveBeenCalledWith('where node', { stdio: 'ignore' });
    expect(hasCommand('node', { execute, platform: 'linux' })).toBe(true);
    expect(execute).toHaveBeenLastCalledWith('which node', { stdio: 'ignore' });
    expect(
      hasCommand('missing', {
        execute: vi.fn(() => {
          throw new Error('missing');
        }),
        platform: 'linux',
      })
    ).toBe(false);
    expect(hasCommand('node')).toBe(true);
  });

  it('normalizes interactive yes/no/default answers and retries invalid input', async () => {
    const warn = vi.fn();
    const readline = {
      question: vi
        .fn()
        .mockResolvedValueOnce('maybe')
        .mockResolvedValueOnce(' YES ')
        .mockResolvedValueOnce('nein')
        .mockResolvedValueOnce(''),
    };
    await expect(confirmTarget(readline, 'one?', true, warn)).resolves.toBe(true);
    await expect(confirmTarget(readline, 'two?', true, warn)).resolves.toBe(false);
    await expect(confirmTarget(readline, 'three?', false, warn)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('collects interactive targets and closes the prompt', async () => {
    const close = vi.fn();
    const question = vi
      .fn()
      .mockResolvedValueOnce('y')
      .mockResolvedValueOnce('n')
      .mockResolvedValueOnce('ja');
    const result = await promptDeployTargets({
      reporter: reporter(),
      createReadline: vi.fn(() => ({ close, question })),
      input: {} as never,
      output: {} as never,
    });
    expect(result).toEqual({ vercel: true, supabase: false, fly: true });
    expect(close).toHaveBeenCalledOnce();
  });

  it('reports healthy, HTTP, response-body, and thrown healthcheck outcomes', async () => {
    await expect(
      waitForZeroHealth({ fetcher: vi.fn().mockResolvedValue({ ok: true }), now: vi.fn(() => 0) })
    ).resolves.toEqual({ healthy: true, lastError: '' });

    let tick = 0;
    await expect(
      waitForZeroHealth({
        fetcher: vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'down' }),
        now: vi.fn(() => tick++),
        wait: vi.fn(),
        timeout: 2,
        interval: 1,
      })
    ).resolves.toEqual({ healthy: false, lastError: 'HTTP 503: down' });

    tick = 0;
    await expect(
      waitForZeroHealth({
        fetcher: vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => {
            throw new Error('unreadable');
          },
        }),
        now: vi.fn(() => tick++),
        wait: vi.fn(),
        timeout: 2,
      })
    ).resolves.toEqual({ healthy: false, lastError: 'HTTP 500' });

    for (const thrown of [
      { cause: { code: 'ECONNRESET' } },
      new Error('network'),
      'plain failure',
    ]) {
      tick = 0;
      const result = await waitForZeroHealth({
        fetcher: vi.fn().mockRejectedValue(thrown),
        now: vi.fn(() => tick++),
        wait: vi.fn(),
        timeout: 2,
      });
      expect(result.healthy).toBe(false);
      expect(result.lastError).toBeTruthy();
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await expect(waitForZeroHealth()).resolves.toEqual({ healthy: true, lastError: '' });
    await expect(
      waitForZeroHealth({
        fetcher: vi
          .fn()
          .mockResolvedValueOnce({ ok: false, status: 503, text: async () => '' })
          .mockResolvedValueOnce({ ok: true }),
        now: vi.fn(() => 0),
        interval: 0,
      })
    ).resolves.toEqual({ healthy: true, lastError: '' });
  });

  it('rejects unsafe pre-flight states without executing deployments', async () => {
    await expect(runDeployCli({ args: [], reporter: reporter() })).rejects.toThrow(
      'Interactive target selection'
    );
    await expect(
      runDeployCli({
        args: [],
        inputIsTTY: true,
        promptTargets: vi.fn().mockResolvedValue({ supabase: false, fly: false, vercel: false }),
        reporter: reporter(),
      })
    ).resolves.toMatchObject({ deployed: false, reason: 'no-targets' });
    await expect(
      runDeployCli({
        args: ['--all'],
        execute: vi.fn(() => 'feature\n'),
        reporter: reporter(),
      })
    ).rejects.toThrow('Deploy is only allowed');
    await expect(
      runDeployCli({
        args: ['--all'],
        execute: vi.fn(() => 'master\n'),
        commandAvailable: vi.fn(() => false),
        reporter: reporter(),
      })
    ).rejects.toThrow('CLI not found');
    await expect(
      runDeployCli({
        args: ['--skip-supabase', '--skip-fly'],
        execute: vi.fn(() => 'master\n'),
        commandAvailable: vi.fn(() => true),
        projectLinked: false,
        reporter: reporter(),
      })
    ).rejects.toThrow('Vercel project not linked');
  });

  it('executes a complete dry-run without mutating deployment targets', async () => {
    const execute = vi.fn(command => (String(command).startsWith('git ') ? 'master\n' : ''));
    await expect(
      runDeployCli({
        args: ['--all', '--dry-run'],
        execute,
        commandAvailable: vi.fn(() => true),
        projectLinked: true,
        reporter: reporter(),
      })
    ).resolves.toMatchObject({ deployed: false, dryRun: true });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('executes live targets and handles healthy and unhealthy Fly checks', async () => {
    const execute = vi.fn(command => (String(command).startsWith('git ') ? 'deploy\n' : ''));
    await expect(
      runDeployCli({
        args: ['--all'],
        execute,
        commandAvailable: vi.fn(name => name !== 'flyctl'),
        projectLinked: true,
        checkHealth: vi.fn().mockResolvedValue({ healthy: true, lastError: '' }),
        reporter: reporter(),
      })
    ).resolves.toMatchObject({ deployed: true });
    expect(execute).toHaveBeenCalledWith('fly deploy --yes', { stdio: 'inherit' });

    const unhealthyReporter = reporter();
    await runDeployCli({
      args: ['--skip-supabase', '--skip-vercel'],
      execute: vi.fn(command => (String(command).startsWith('git ') ? 'master\n' : '')),
      commandAvailable: vi.fn(() => true),
      checkHealth: vi.fn().mockResolvedValue({ healthy: false, lastError: 'HTTP 503' }),
      reporter: unhealthyReporter,
    });
    expect(unhealthyReporter.warn).toHaveBeenCalledWith('Last error: HTTP 503');

    const emptyErrorReporter = reporter();
    await runDeployCli({
      args: ['--skip-supabase', '--skip-vercel'],
      execute: vi.fn(command => (String(command).startsWith('git ') ? 'master\n' : '')),
      commandAvailable: vi.fn(() => true),
      checkHealth: vi.fn().mockResolvedValue({ healthy: false, lastError: '' }),
      reporter: emptyErrorReporter,
    });
    expect(emptyErrorReporter.info).toHaveBeenCalledWith(expect.stringContaining('logs'));

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    await expect(
      runDeployCli({
        args: ['--skip-supabase', '--skip-vercel'],
        execute: vi.fn(command => (String(command).startsWith('git ') ? 'master\n' : '')),
        commandAvailable: vi.fn(() => true),
        reporter: reporter(),
      })
    ).resolves.toMatchObject({ deployed: true });
  });

  it('reports top-level errors through an injectable process boundary', () => {
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const processState = {};
    reportDeployError(
      new Error('boom'),
      logger as unknown as Console,
      processState as unknown as NodeJS.Process
    );
    reportDeployError(
      'plain',
      logger as unknown as Console,
      processState as unknown as NodeJS.Process
    );
    expect(processState).toHaveProperty('exitCode', 1);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
