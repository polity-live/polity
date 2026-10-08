import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const execute = promisify(execFile);

export async function removeBenchmarkProfile(artifactDir, profile) {
  if (
    profile &&
    dirname(resolve(profile)) === resolve(artifactDir) &&
    /^chrome-profile-.+$/u.test(basename(profile))
  )
    await rm(profile, { recursive: true, force: true });
}

export async function openBenchmarkEnvironment(artifactDir, platform = process.platform) {
  let profile;
  let browser;
  async function close() {
    try {
      await browser?.close();
    } finally {
      await removeBenchmarkProfile(artifactDir, profile);
    }
  }
  try {
    await mkdir(artifactDir, { recursive: true });
    profile = await mkdtemp(resolve(artifactDir, 'chrome-profile-'));
    // Disable Energy Saver only in our disposable profile, never the user's Chrome/PWAs.
    await writeFile(
      resolve(profile, 'Local State'),
      JSON.stringify({ performance_tuning: { battery_saver_mode: { state: 0 } } })
    );
    browser = await chromium.launchPersistentContext(profile, {
      headless: false,
      viewport: { width: 1940, height: 1160 },
      args: [
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=CalculateNativeWinOcclusion',
      ],
    });
    let battery = null;
    if (platform === 'win32') {
      const { stdout } = await execute(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          'Get-CimInstance Win32_Battery | Select-Object BatteryStatus,EstimatedChargeRemaining | ConvertTo-Json -Compress',
        ],
        { windowsHide: true }
      );
      battery = stdout.trim() ? JSON.parse(stdout) : null;
    }
    return {
      browser,
      benchmarkEnvironment: {
        batterySaverModeState: 0,
        battery,
        backgroundThrottlingDisabled: true,
      },
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
