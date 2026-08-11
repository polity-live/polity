// @vitest-environment node

import { renderToString } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import { ImageEditorDialog } from '../ImageEditorDialog';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, language: 'en' }),
}));

it('uses its server-safe pixel-ratio fallback before an image is available', () => {
  expect(
    renderToString(
      <ImageEditorDialog open={false} onOpenChange={vi.fn()} onSave={vi.fn(async () => true)} />
    )
  ).toBe('');
});
