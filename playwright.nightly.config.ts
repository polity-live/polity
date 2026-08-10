import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig(baseConfig, {
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      grep: /@mobile/,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'firefox-nightly',
      grep: /@cross-browser/,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit-nightly',
      grep: /@cross-browser/,
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
