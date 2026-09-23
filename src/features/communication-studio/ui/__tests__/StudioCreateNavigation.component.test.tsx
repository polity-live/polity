/* @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { StudioWorkspace } from '../StudioWorkspace';

vi.mock('../../hooks/useStudioController', () => ({
  useStudioController: () => ({
    projects: [],
    isLoading: false,
    failure: '',
    error: '',
    canvasEnabled: true,
  }),
}));
vi.mock('@/features/project-chat/hooks/editor-bridge', () => ({
  useProjectEditorBridge: () => undefined,
}));
vi.mock('../../hooks/useStudioEditorTools', () => ({ useStudioEditorTools: () => undefined }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));
vi.mock('@/features/shared/ui/navigation/SmartLink', () => ({
  SmartLink: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../StudioEditor', () => ({ StudioEditor: () => null }));
vi.mock('../CanvasGovernancePanel', () => ({ CanvasGovernancePanel: () => null }));

afterEach(cleanup);

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
});
