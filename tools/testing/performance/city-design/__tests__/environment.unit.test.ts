import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openBenchmarkEnvironment, removeBenchmarkProfile } from '../environment.mjs';

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  mkdtemp: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
  launch: vi.fn(),
  close: vi.fn(),
  execute: vi.fn(),
}));
vi.mock('node:fs/promises', () => mocks);
vi.mock('@playwright/test', () => ({ chromium: { launchPersistentContext: mocks.launch } }));
vi.mock('node:child_process', () => ({
  execFile: Object.assign(mocks.execute, {
    [Symbol.for('nodejs.util.promisify.custom')]: (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        mocks.execute(...args, (error: Error | null, stdout: string) =>
          error ? reject(error) : resolve({ stdout })
        );
      }),
  }),
}));

const artifactDir = resolve('output/playwright/city-design-performance');
const profile = resolve(artifactDir, 'chrome-profile-test');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.mkdtemp.mockResolvedValue(profile);
  mocks.launch.mockResolvedValue({ close: mocks.close });
  mocks.execute.mockImplementation((_command, _args, _options, callback) =>
    callback(null, '{"BatteryStatus":2,"EstimatedChargeRemaining":14}', '')
  );
});
afterEach(() => vi.restoreAllMocks());

describe('isolated benchmark browser environment', () => {
  it('writes Energy Saver settings before launching only the disposable profile', async () => {
    const environment = await openBenchmarkEnvironment(artifactDir, 'win32');
    expect(mocks.mkdir).toHaveBeenCalledWith(artifactDir, { recursive: true });
    expect(mocks.mkdtemp).toHaveBeenCalledWith(resolve(artifactDir, 'chrome-profile-'));
    expect(mocks.writeFile).toHaveBeenCalledWith(
      resolve(profile, 'Local State'),
      JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } })
    );
    expect(mocks.writeFile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.launch.mock.invocationCallOrder[0]!
    );
    expect(mocks.launch).toHaveBeenCalledWith(profile, {
      headless: false,
      viewport: { width: 1940, height: 1160 },
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=CalculateNativeWinOcclusion',
      ],
    });
    expect(mocks.execute).toHaveBeenCalledWith(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_Battery | Select-Object BatteryStatus,EstimatedChargeRemaining | ConvertTo-Json -Compress',
      ],
      { windowsHide: true },
      expect.any(Function)
    );
    expect(environment.benchmarkEnvironment).toEqual({
      batterySaverModeState: 0,
      battery: { BatteryStatus: 2, EstimatedChargeRemaining: 14 },
      backgroundThrottlingDisabled: true,
    });
    await environment.close();
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rm.mock.invocationCallOrder[0]!
    );
    expect(mocks.rm).toHaveBeenCalledWith(profile, { recursive: true, force: true });
  });

  it('does not query Windows battery information on other platforms', async () => {
    const environment = await openBenchmarkEnvironment(artifactDir, 'linux');
    expect(environment.benchmarkEnvironment.battery).toBeNull();
    expect(mocks.execute).not.toHaveBeenCalled();
    await environment.close();
  });

  it('uses the current platform by default', async () => {
    await (await openBenchmarkEnvironment(artifactDir)).close();
    expect(mocks.execute.mock.calls.length).toBe(process.platform === 'win32' ? 1 : 0);
  });

  it('records no battery when CIM returns an empty result', async () => {
    mocks.execute.mockImplementation((_command, _args, _options, callback) =>
      callback(null, ' \r\n', '')
    );
    expect(
      (await openBenchmarkEnvironment(artifactDir, 'win32')).benchmarkEnvironment.battery
    ).toBeNull();
  });

  it.each(['mkdir', 'mkdtemp', 'writeFile', 'launch'] as const)(
    'cleans up whatever was allocated when %s fails',
    async stage => {
      mocks[stage].mockRejectedValueOnce(new Error(stage));
      await expect(openBenchmarkEnvironment(artifactDir, 'linux')).rejects.toThrow(stage);
      expect(mocks.close).not.toHaveBeenCalled();
      if (stage === 'writeFile' || stage === 'launch')
        expect(mocks.rm).toHaveBeenCalledWith(profile, { recursive: true, force: true });
      else expect(mocks.rm).not.toHaveBeenCalled();
    }
  );

  it.each(['invalid JSON', 'command failure'])(
    'closes and removes the profile after battery %s',
    async failure => {
      mocks.execute.mockImplementation((_command, _args, _options, callback) =>
        callback(failure === 'command failure' ? new Error(failure) : null, 'invalid', '')
      );
      await expect(openBenchmarkEnvironment(artifactDir, 'win32')).rejects.toThrow();
      expect(mocks.close).toHaveBeenCalledOnce();
      expect(mocks.rm).toHaveBeenCalledOnce();
    }
  );

  it('still removes its profile when browser shutdown fails', async () => {
    const environment = await openBenchmarkEnvironment(artifactDir, 'linux');
    mocks.close.mockRejectedValueOnce(new Error('close failed'));
    await expect(environment.close()).rejects.toThrow('close failed');
    expect(mocks.rm).toHaveBeenCalledWith(profile, { recursive: true, force: true });
  });

  it.each([
    undefined,
    artifactDir,
    resolve(artifactDir, 'chrome-profile-'),
    resolve(artifactDir, 'other-profile'),
    resolve(artifactDir, 'chrome-profile-parent/nested'),
    resolve(artifactDir, '../chrome-profile-outside'),
  ])('refuses cleanup outside an owned direct child: %s', async target => {
    await removeBenchmarkProfile(artifactDir, target);
    expect(mocks.rm).not.toHaveBeenCalled();
  });
});
