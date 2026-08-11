/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));
vi.mock('@/features/shared/ui/status', () => ({
  BadgeControl: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

import { VersionComparisonView } from '../VersionComparisonView';

describe('VersionComparisonView A04 branch accountability', () => {
  afterEach(() => cleanup());

  it('extracts strings, arrays, text nodes, child nodes, and unknown objects', () => {
    render(
      <VersionComparisonView
        originalVersion={[
          'String line',
          { type: 'p', text: 'Text node', children: [] },
          { type: 'p', children: [{ type: 'span', text: 'Child text', children: [] }] },
          { type: 'unknown' } as any,
        ]}
        currentVersion="Current string"
        changeRequest={{
          id: 'request',
          title: 'Request title',
          description: 'Request description',
        }}
      />
    );

    expect(screen.getAllByText(/String line/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Current string').length).toBeGreaterThan(0);
    expect(screen.getByText('Request title')).toBeTruthy();
    expect(
      screen.getByText('features.amendments.supportConfirmation.comparison.hasChanges')
    ).toBeTruthy();
  });

  it('renders all empty fallbacks without a change request', () => {
    render(<VersionComparisonView originalVersion={null as any} currentVersion={null as any} />);
    expect(
      screen.getAllByText('features.amendments.supportConfirmation.comparison.empty')
    ).toHaveLength(4);
    expect(
      screen.queryByText('features.amendments.supportConfirmation.comparison.hasChanges')
    ).toBeNull();
  });

  it('handles equal non-empty child documents without a change badge', () => {
    const content = { type: 'p', children: [{ type: 'span', text: 'Same', children: [] }] } as any;
    render(<VersionComparisonView originalVersion={content} currentVersion={content} />);
    expect(screen.getAllByText('Same')).toHaveLength(4);
    expect(
      screen.queryByText('features.amendments.supportConfirmation.comparison.hasChanges')
    ).toBeNull();
  });
});
