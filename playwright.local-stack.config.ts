import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** Run browser tests against an already running local app, Zero and database stack. */
export default defineConfig({
  ...base,
  webServer: [],
});
