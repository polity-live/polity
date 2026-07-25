import { describe, expect, it, vi } from 'vitest';

import { navItemsAuthenticated } from '../nav-items-authenticated';

describe('navItemsAuthenticated', () => {
  it('performs exactly one navigation for a primary item click', () => {
    const navigate = vi.fn();
    const searchItem = navItemsAuthenticated(navigate).primaryNavItems.find(
      item => item.id === 'search'
    );

    searchItem?.onClick?.();

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: '/search' });
  });
});
