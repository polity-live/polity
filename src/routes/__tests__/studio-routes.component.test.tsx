// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const io = vi.hoisted(() => ({
  groupId: undefined as string | undefined,
  form: vi.fn(),
  read: vi.fn(),
}));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: any) => ({
    ...options,
    useSearch: () => ({ groupId: io.groupId }),
  }),
}));
vi.mock('@/features/create/hooks/useCreateStudioProjectForm', () => ({
  useCreateStudioProjectForm: io.form,
}));
vi.mock('@/features/create/ui/CreateFormShell', () => ({
  CreateFormShell: ({ config }: any) => <p>{config.title}</p>,
}));
import { Route as createRoute } from '../_authed/create/studio-project';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  io.groupId = undefined;
});
it('validates group identifiers and renders personal or group creation with the selected context', () => {
  const options = createRoute as any;
  expect(options.validateSearch.safeParse({ groupId: 'invalid' }).success).toBe(false);
  const groupId = '00000000-0000-4000-a000-000000000001';
  expect(options.validateSearch.parse({ groupId })).toEqual({ groupId });
  io.form.mockReturnValue({ title: 'Create project' });
  const Page = options.component;
  const { rerender } = render(<Page />);
  expect(io.form).toHaveBeenLastCalledWith(null);
  expect(screen.getByText('Create project')).toBeTruthy();
  io.groupId = groupId;
  rerender(<Page />);
  expect(io.form).toHaveBeenLastCalledWith(groupId);
});
