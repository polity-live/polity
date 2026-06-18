import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('early PWA install prompt capture script', () => {
  it('captures beforeinstallprompt before React hydration can miss it', () => {
    const rootRouteSource = readFileSync(join(process.cwd(), 'src/routes/__root.tsx'), 'utf8');

    expect(rootRouteSource).toContain('earlyPwaInstallPromptCaptureScript');
    expect(rootRouteSource).toContain('beforeinstallprompt');
    expect(rootRouteSource).toContain('preventDefault');
    expect(rootRouteSource).toContain('__polityPwaInstallPromptEvent');
    expect(rootRouteSource).toContain('polity:pwa-install-prompt-captured');
  });
});
