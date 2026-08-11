/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { Users } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import { AgendaEntityBadgeView } from '../AgendaBadgesView';

afterEach(cleanup);

describe('AgendaEntityBadgeView', () => {
  it('navigates through its stable badge action without bubbling to its card', () => {
    const parentClick = vi.fn();
    const { container } = render(
      <div onClick={parentClick}>
        <AgendaEntityBadgeView
          label="Working group"
          href="/group/group-1"
          status="active"
          tone="success"
          Icon={Users}
        />
      </div>
    );
    const link = container.querySelector<HTMLElement>(
      '[data-action-id="agendas.badge.entity.navigate"]'
    );
    fireEvent.click(link!);
    expect(link?.getAttribute('href')).toBe('/group/group-1');
    expect(parentClick).not.toHaveBeenCalled();
  });
});
