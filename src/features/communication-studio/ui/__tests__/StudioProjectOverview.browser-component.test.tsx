import { render, screen } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { expect, it, vi } from 'vitest';
import { StudioProjectOverview } from '../StudioProjectOverview';

vi.mock('@rocicorp/zero/react', () => ({ useQuery: () => [true] }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));
vi.mock('@/features/shared/ui/collections/useCollectionView', () => ({
  useCollectionView: () => ({ view: 'cards', setView: vi.fn() }),
}));
vi.mock('../StudioInvitations', () => ({ StudioInvitations: () => null }));
vi.mock('@/features/shared/ui/navigation/SmartLink', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/shared/ui/navigation/SmartLink')>()),
  SmartLink: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

it('moves focus and selection through Studio ownership tabs with the keyboard', async () => {
  render(
    <StudioProjectOverview
      groupId={null}
      ownerId="author"
      projects={
        [
          { id: 'mine', title: 'Mine', kind: 'single', owner_id: 'author' },
          { id: 'shared', title: 'Shared', kind: 'single', owner_id: 'collaborator' },
        ] as never
      }
      isLoading={false}
      failure=""
      projectHref={id => `/studio/${id}`}
    />
  );

  const all = page.getByRole('tab', { name: 'allProjects' });
  await all.click();
  await userEvent.keyboard('{ArrowRight}');
  const mine = page.getByRole('tab', { name: 'myProjects' });
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'myProjects' }));
  await expect.element(mine).toHaveAttribute('data-state', 'active');
  expect(screen.queryByRole('link', { name: /Shared/ })).toBeNull();
  await userEvent.keyboard('{ArrowRight}');
  const shared = page.getByRole('tab', { name: 'sharedWithMe' });
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'sharedWithMe' }));
  await expect.element(shared).toHaveAttribute('data-state', 'active');
  expect(screen.queryByRole('link', { name: /Mine/ })).toBeNull();
});
