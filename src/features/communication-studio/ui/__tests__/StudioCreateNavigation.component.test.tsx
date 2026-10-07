/* @vitest-environment jsdom */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StudioWorkspace } from '../StudioWorkspace';

const io = vi.hoisted(() => ({
  projects: [] as any[],
  isLoading: false,
  canManageGroup: true,
  failure: '',
}));

vi.mock('@rocicorp/zero/react', () => ({ useQuery: () => [io.canManageGroup] }));

vi.mock('../../hooks/useStudioController', () => ({
  useStudioController: () => ({
    projects: io.projects,
    isLoading: io.isLoading,
    failure: io.failure,
    error: '',
    canvasEnabled: true,
    identity: { id: 'author' },
  }),
}));
vi.mock('@/features/project-chat/hooks/editor-bridge', () => ({
  useProjectEditorBridge: () => undefined,
}));
vi.mock('../../hooks/useStudioEditorTools', () => ({ useStudioEditorTools: () => undefined }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));
vi.mock('@/features/shared/ui/collections/useCollectionView', () => ({
  useCollectionView: () => {
    const [view, setView] = useState<'cards' | 'compact'>('cards');
    return { view, setView };
  },
}));
vi.mock('../StudioInvitations', () => ({ StudioInvitations: () => null }));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../StudioEditor', () => ({ StudioEditor: () => null }));

afterEach(() => {
  cleanup();
  io.projects = [];
  io.isLoading = false;
  io.canManageGroup = true;
  io.failure = '';
});

it('opens the personal Studio create flow', () => {
  render(<StudioWorkspace open={vi.fn()} />);
  expect(screen.getByRole('link', { name: 'create' }).getAttribute('href')).toBe(
    '/create/studio-project'
  );
  expect(screen.queryByRole('heading', { name: 'newProject' })).toBeNull();
});

it('passes the fixed group context to the Studio create flow', () => {
  render(<StudioWorkspace groupId="group-1" open={vi.fn()} />);
  expect(screen.getByRole('link', { name: 'create' }).getAttribute('href')).toBe(
    '/create/studio-project?groupId=group-1'
  );
  expect(screen.queryByRole('tab', { name: 'sharedWithMe' })).toBeNull();
});

it('hides group creation when the current member cannot manage projects', () => {
  io.canManageGroup = false;
  render(<StudioWorkspace groupId="group-1" open={vi.fn()} />);
  expect(screen.queryByRole('link', { name: 'create' })).toBeNull();
});

it('opens a group Studio project within its group route', () => {
  io.projects = [{ id: 'project-1', title: 'Group project', kind: 'single', owner_id: 'author' }];
  render(<StudioWorkspace groupId="group-1" open={vi.fn()} />);
  expect(screen.getByRole('link', { name: /Group project/ }).getAttribute('href')).toBe(
    '/group/group-1/studio/project-1'
  );
});

it('opens a personal Studio project within the personal route', () => {
  io.projects = [
    { id: 'project-1', title: 'Personal project', kind: 'single', owner_id: 'author' },
  ];
  render(<StudioWorkspace open={vi.fn()} />);
  expect(screen.getByRole('link', { name: /Personal project/ }).getAttribute('href')).toBe(
    '/studio/project-1'
  );
});

it('shows own and shared projects together and filters them by ownership and title', () => {
  io.projects = [
    { id: 'mine', title: 'My Campaign', kind: 'campaign', owner_id: 'author' },
    { id: 'shared', title: 'Shared Poster', kind: 'single', owner_id: 'collaborator' },
  ];
  render(<StudioWorkspace open={vi.fn()} />);
  expect(screen.getByRole('link', { name: /My Campaign/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Shared Poster/ })).toBeTruthy();

  fireEvent.mouseDown(screen.getByRole('tab', { name: 'myProjects' }), { button: 0 });
  expect(screen.getByRole('link', { name: /My Campaign/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Shared Poster/ })).toBeNull();

  fireEvent.mouseDown(screen.getByRole('tab', { name: 'sharedWithMe' }), { button: 0 });
  expect(screen.queryByRole('link', { name: /My Campaign/ })).toBeNull();
  expect(screen.getByRole('link', { name: /Shared Poster/ })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: 'searchProjects' }), {
    target: { value: '  POSTER  ' },
  });
  expect(screen.getByRole('link', { name: /Shared Poster/ })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: 'searchProjects' }), {
    target: { value: 'campaign' },
  });
  expect(screen.getByText('noMatchingProjects')).toBeTruthy();
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'allProjects' }), { button: 0 });
  expect(screen.getByRole('link', { name: /My Campaign/ })).toBeTruthy();
});

it('keeps ownership filters focusable', () => {
  io.projects = [
    { id: 'mine', title: 'Mine', kind: 'single', owner_id: 'author' },
    { id: 'shared', title: 'Shared', kind: 'single', owner_id: 'collaborator' },
  ];
  render(<StudioWorkspace open={vi.fn()} />);
  for (const name of ['allProjects', 'myProjects', 'sharedWithMe']) {
    const tab = screen.getByRole('tab', { name });
    tab.focus();
    expect(document.activeElement).toBe(tab);
  }
});

it('switches between project cards and compact rows', () => {
  io.projects = [{ id: 'project-1', title: 'Project', kind: 'single', owner_id: 'author' }];
  const { container } = render(<StudioWorkspace open={vi.fn()} />);
  expect(container.querySelector('[data-workspace-row]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'common.workspace.compactView' }));
  expect(container.querySelector('[data-workspace-row]')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Project/ }).getAttribute('href')).toBe(
    '/studio/project-1'
  );
  fireEvent.click(screen.getByRole('button', { name: 'common.workspace.cardsView' }));
  expect(container.querySelector('[data-workspace-row]')).toBeNull();
});

it('distinguishes loading, no projects, and no search results', () => {
  io.isLoading = true;
  const { rerender } = render(<StudioWorkspace open={vi.fn()} />);
  expect(screen.getByRole('status').textContent).toBe('loading');
  io.isLoading = false;
  rerender(<StudioWorkspace open={vi.fn()} />);
  expect(screen.getByText('empty')).toBeTruthy();
  io.projects = [{ id: 'project-1', title: 'Project', kind: 'single', owner_id: 'author' }];
  rerender(<StudioWorkspace open={vi.fn()} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'searchProjects' }), {
    target: { value: 'missing' },
  });
  expect(screen.getByText('noMatchingProjects')).toBeTruthy();
});

it('keeps create and project navigation usable when the project query reports a failure', () => {
  io.projects = [{ id: 'project-1', title: 'Project', kind: 'single', owner_id: 'author' }];
  io.failure = 'Connection unavailable';
  render(<StudioWorkspace open={vi.fn()} />);
  expect(screen.getByRole('alert').textContent).toBe('Connection unavailable');
  expect(screen.getByRole('link', { name: 'create' }).getAttribute('href')).toBe(
    '/create/studio-project'
  );
  expect(screen.getByRole('link', { name: /Project/ }).getAttribute('href')).toBe(
    '/studio/project-1'
  );
});
