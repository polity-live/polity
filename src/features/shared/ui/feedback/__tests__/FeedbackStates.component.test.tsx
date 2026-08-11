/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EmptyState, ErrorState, InlineNotice, ResultBanner } from '../FeedbackStates';

afterEach(() => cleanup());

describe('feedback states', () => {
  it('renders all optional empty-state regions', () => {
    render(
      <EmptyState
        title="No members"
        description="Invite someone to begin."
        icon={<span>People icon</span>}
        action={<button>Invite</button>}
        className="empty-custom"
      />
    );
    expect(screen.getByText('No members')).toBeTruthy();
    expect(screen.getByText('Invite someone to begin.')).toBeTruthy();
    expect(screen.getByText('People icon')).toBeTruthy();
    expect(screen.getByText('Invite')).toBeTruthy();
  });

  it('omits optional empty content and resolves default and custom error titles', () => {
    const empty = render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    empty.unmount();

    const defaultError = render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    defaultError.unmount();

    render(
      <ErrorState title="Request failed" description="Try later" action={<button>Retry</button>} />
    );
    expect(screen.getByText('Request failed')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('uses default notice icon and supports titled custom-icon variants', () => {
    const fallback = render(<InlineNotice>General information</InlineNotice>);
    expect(screen.getByText('General information')).toBeTruthy();
    expect(fallback.container.querySelector('svg')).toBeTruthy();
    fallback.unmount();

    render(
      <InlineNotice title="Saved" variant="success" icon={<span>Custom icon</span>}>
        Changes are live.
      </InlineNotice>
    );
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Custom icon')).toBeTruthy();
    expect(screen.getByText('Changes are live.')).toBeTruthy();
  });

  it('keeps result banners aligned and forwards custom classes', () => {
    const { container } = render(
      <ResultBanner variant="warning" className="result-custom">
        Review required
      </ResultBanner>
    );
    expect(container.firstElementChild?.className).toContain('items-start');
    expect(container.firstElementChild?.className).toContain('result-custom');
  });
});
