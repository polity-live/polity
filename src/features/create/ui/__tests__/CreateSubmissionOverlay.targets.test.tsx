/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => children,
  motion: new Proxy({}, { get: (_target, tag) => tag }),
  useReducedMotion: () => true,
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { CreateSubmissionOverlay } from '../CreateSubmissionOverlay';

afterEach(cleanup);

describe('CreateSubmissionOverlay target links', () => {
  it('renders route and external targets with the same stable ready action', () => {
    const common = {
      status: 'ready' as const,
      entityType: 'group' as const,
      title: 'Working group',
      progressSteps: [],
      onBack: vi.fn(),
      onRetry: vi.fn(),
    };
    const view = render(
      <CreateSubmissionOverlay
        {...common}
        target={{
          kind: 'route',
          entityType: 'group',
          to: '/group/$id',
          params: { id: 'group-1' },
        }}
      />
    );
    expect(
      view.container
        .querySelector('[data-action-id="create.submission.target.open-ready"]')
        ?.getAttribute('href')
    ).toBe('/group/group-1');

    view.rerender(
      <CreateSubmissionOverlay
        {...common}
        target={{ kind: 'external', entityType: 'group', href: 'https://example.test/result' }}
      />
    );
    expect(
      view.container
        .querySelector('[data-action-id="create.submission.target.open-ready"]')
        ?.getAttribute('href')
    ).toBe('https://example.test/result');
  });

  it('renders inert target content when an error has no recoverable destination', () => {
    const { container } = render(
      <CreateSubmissionOverlay
        status="error"
        entityType="group"
        title="Working group"
        progressSteps={[]}
        target={{ kind: 'external', entityType: 'group', href: '' }}
        onBack={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    const target = container.querySelector('[data-create-action="navigate-created-target"]');
    expect(target).toBeTruthy();
    expect(target?.querySelector('a')).toBeNull();
  });

  it('serializes route search and hash while skipping empty search values', () => {
    const { container } = render(
      <CreateSubmissionOverlay
        status="ready"
        entityType="group"
        title="Working group"
        progressSteps={[]}
        target={{
          kind: 'route',
          entityType: 'group',
          label: 'Open result',
          to: '/group/result',
          search: { tab: 'members', page: 2, empty: null, absent: undefined },
          hash: 'details here',
        }}
        onBack={vi.fn()}
        onRetry={vi.fn()}
      />
    );

    expect(
      container
        .querySelector('[data-action-id="create.submission.target.open-ready"]')
        ?.getAttribute('href')
    ).toBe('/group/result?tab=members&page=2#details%20here');
    expect(container.textContent).toContain('Open result');
  });

  it('uses an explicit target label key', () => {
    const { container } = render(
      <CreateSubmissionOverlay
        status="ready"
        entityType="group"
        title="Working group"
        progressSteps={[]}
        target={{
          kind: 'route',
          entityType: 'group',
          labelKey: 'target.custom',
          to: '/group/result',
        }}
        onBack={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(container.textContent).toContain('target.custom');
  });

  it('completes ready steps and defaults missing submitting step status', () => {
    const common = {
      entityType: 'group' as const,
      title: 'Working group',
      target: null,
      onBack: vi.fn(),
      onRetry: vi.fn(),
    };
    const { container, rerender } = render(
      <CreateSubmissionOverlay
        {...common}
        status="ready"
        progressSteps={[{ key: 'create', label: 'Create', status: 'active' }]}
      />
    );
    expect(container.textContent).toContain('pages.create.progress.submission.overlay.completed');

    rerender(
      <CreateSubmissionOverlay
        {...common}
        status="submitting"
        progressSteps={[{ key: 'create', label: 'Create' }]}
      />
    );
    expect(container.textContent).toContain('pages.create.progress.submission.overlay.waiting');

    rerender(
      <CreateSubmissionOverlay
        {...common}
        status="error"
        progressSteps={[{ key: 'create', label: 'Create', status: 'active' }]}
      />
    );
    expect(container.textContent).toContain(
      'pages.create.progress.submission.overlay.reviewNeeded'
    );
  });
});
