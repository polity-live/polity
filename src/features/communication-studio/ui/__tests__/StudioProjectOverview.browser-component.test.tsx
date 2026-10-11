import { render, screen } from '@testing-library/react';
import { page, userEvent } from 'vitest/browser';
import { expect, it, vi } from 'vitest';
import { StudioProjectOverview } from '../StudioProjectOverview';
import { CollectionPreferencesContext } from '@/features/shared/ui/collections/useCollectionView';
import { workspaceDisplaySchema } from '@/zero/preferences/workspace-schema';

vi.mock('@rocicorp/zero/react', async importOriginal => ({
  ...(await importOriginal<typeof import('@rocicorp/zero/react')>()),
  useQuery: () => [true],
}));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
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

it('keeps template and shared-project metadata when switching actual collection preferences to compact rows', async () => {
  render(
    <CollectionPreferencesContext.Provider
      value={{
        userId: crypto.randomUUID(),
        display: workspaceDisplaySchema.parse({}),
        isLoading: false,
      }}
    >
      <StudioProjectOverview
        groupId={null}
        ownerId="author"
        projects={
          [
            {
              id: crypto.randomUUID(),
              title: 'Reusable template',
              kind: 'single',
              owner_id: 'author',
              is_template: true,
            },
            {
              id: crypto.randomUUID(),
              title: 'Shared collaboration',
              kind: 'single',
              owner_id: 'collaborator',
              is_template: false,
            },
          ] as never
        }
        isLoading={false}
        failure=""
        projectHref={id => `/studio/${id}`}
      />
    </CollectionPreferencesContext.Provider>
  );
  expect(screen.getByText(/single · templateSaved/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'common.workspace.compactView' }));
  expect(screen.getByRole('button', { name: 'common.workspace.compactView' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getByText('templateSaved')).toBeTruthy();
  expect(screen.getAllByText('sharedWithMe').length).toBeGreaterThan(0);
  expect(screen.getByRole('link', { name: /Reusable template/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Shared collaboration/ })).toBeTruthy();
});
