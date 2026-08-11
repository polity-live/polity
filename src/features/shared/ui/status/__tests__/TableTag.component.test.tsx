/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTableTagSurfaceClassName, TableTag } from '../TableTag';

vi.mock('@/features/shared/theme', () => ({
  getEntityToneClasses: (entityType: string) => ({ tableTag: `tone-${entityType}` }),
}));
vi.mock('@/features/shared/ui/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    variant?: string;
  }) => (
    <div data-variant={variant} {...props}>
      {children}
    </div>
  ),
}));

afterEach(cleanup);

describe('TableTag', () => {
  it('builds the entity surface class and uses the default variant', () => {
    expect(getTableTagSurfaceClassName('group')).toContain('tone-group');
    render(<TableTag entityType="group">Group</TableTag>);
    expect(screen.getByText('Group').getAttribute('data-variant')).toBe('outline');
  });

  it('forwards a custom class and variant', () => {
    render(
      <TableTag entityType="user" variant="secondary" className="custom">
        User
      </TableTag>
    );
    expect(screen.getByText('User').className).toContain('custom');
    expect(screen.getByText('User').getAttribute('data-variant')).toBe('secondary');
  });
});
