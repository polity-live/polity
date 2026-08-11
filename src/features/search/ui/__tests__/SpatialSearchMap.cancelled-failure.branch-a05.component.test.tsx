// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const deferred = vi.hoisted(() => {
  let rejectImport: (reason: unknown) => void = () => undefined;
  const importPromise = new Promise<never>((_resolve, reject) => {
    rejectImport = reject;
  });
  return { importPromise, rejectImport: (reason: unknown) => rejectImport(reason) };
});

vi.mock('react-leaflet', () => deferred.importPromise);

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/features/shared/ui/feedback', () => ({
  MapPanelSkeleton: ({ label }: any) => <div data-testid="skeleton">{label}</div>,
}));

import { SpatialSearchMap } from '../SpatialSearchMap';

describe('SpatialSearchMap cancelled loading', () => {
  it('ignores an import rejection after unmount', async () => {
    const rendered = render(
      <SpatialSearchMap
        items={[]}
        activeItem={null}
        center={[0, 0]}
        onBoundsChange={vi.fn()}
        onItemSelect={vi.fn()}
      />
    );
    rendered.unmount();
    await act(async () => deferred.rejectImport(new Error('late failure')));
    expect(document.body.textContent).toBe('');
  });
});
