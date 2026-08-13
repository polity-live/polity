/* @vitest-environment node */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { EventLivestreamPlayer } from '../EventLivestreamPlayer';

describe('EventLivestreamPlayer SSR coverage', () => {
  it('resolves streams without accessing a browser hostname', () => {
    const html = renderToStaticMarkup(
      <EventLivestreamPlayer streamUrl="https://video.example/live" />
    );
    expect(html).toContain('https://video.example/live');
  });
});
