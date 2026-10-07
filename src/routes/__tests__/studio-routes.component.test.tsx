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
vi.mock('@/server/studio/read', () => ({ readStudioProject: io.read }));
import { Route as createRoute } from '../_authed/create/studio-project';
import { Route as readRoute } from '../api/studio/read/$id';
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
it('passes the request and project identifier to the authorized Studio reader', async () => {
  const request = new Request('https://example.test/api/studio/read/project');
  const response = Response.json({ project: { id: 'project' } });
  io.read.mockResolvedValue(response);
  expect(await (readRoute as any).server.handlers.GET({ request, params: { id: 'project' } })).toBe(
    response
  );
  expect(io.read).toHaveBeenCalledWith(request, 'project');
});
