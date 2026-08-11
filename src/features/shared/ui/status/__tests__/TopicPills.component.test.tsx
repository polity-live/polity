// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/theme', () => ({
  getSemanticToneClasses: (tone: string) => ({
    surface: `surface-${tone}`,
    text: `text-${tone}`,
    border: `border-${tone}`,
  }),
}));

vi.mock('@/features/shared/ui/status/StatusBadges', () => ({
  BadgeControl: ({
    children,
    className,
    onClick,
  }: {
    children?: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { TopicPill, TopicPillList } from '../TopicPills';

afterEach(cleanup);

describe('TopicPill', () => {
  it.each([
    ['climate action', 'success'],
    ['environment policy', 'success'],
    ['green future', 'success'],
    ['urban design', 'info'],
    ['city plan', 'info'],
    ['planning law', 'info'],
    ['transport network', 'warning'],
    ['traffic safety', 'warning'],
    ['mobility hub', 'warning'],
    ['budget 2027', 'warning'],
    ['finance committee', 'warning'],
    ['money matters', 'warning'],
    ['education reform', 'accent'],
    ['school board', 'accent'],
    ['learning center', 'accent'],
    ['health policy', 'danger'],
    ['medical services', 'danger'],
    ['care work', 'danger'],
    ['housing policy', 'info'],
    ['home ownership', 'info'],
    ['rent cap', 'info'],
    ['Digital rights', 'neutral'],
  ])('infers %s as the %s semantic tone', (topic, tone) => {
    render(<TopicPill topic={topic} />);
    expect(screen.getByRole('button').className).toContain(`surface-${tone}`);
  });

  it('honors explicit and defensive variants, medium size, custom class, and click behavior', () => {
    const onClick = vi.fn();
    const first = render(
      <TopicPill topic="Anything" variant="health" size="md" className="custom" onClick={onClick} />
    );
    const button = screen.getByRole('button');
    expect(button.className).toContain('surface-danger');
    expect(button.className).toContain('px-3');
    expect(button.className).toContain('cursor-pointer');
    expect(button.className).toContain('custom');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
    first.unmount();

    render(<TopicPill topic="Fallback" variant={'unknown' as any} />);
    expect(screen.getByRole('button').className).toContain('surface-neutral');
  });
});

describe('TopicPillList', () => {
  it('uses defaults, limits visible topics, and reports the remaining count', () => {
    render(<TopicPillList topics={['One', 'Two', 'Three', 'Four', 'Five']} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('renders every topic without a remainder and supports medium custom styling', () => {
    const view = render(
      <TopicPillList topics={['One', 'Two']} maxDisplay={3} size="md" className="topic-list" />
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByText(/^\+/)).toBeNull();
    expect(screen.getByText('One').className).toContain('px-3');
    expect(screen.getByText('One').parentElement?.className).toContain('topic-list');
    view.rerender(<TopicPillList topics={['One', 'Two']} maxDisplay={1} size="md" />);
    expect(screen.getByText('+1').className).toContain('px-3');
  });
});
