import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createDocument } from '../../logic/templates';
import { element } from '../../logic/document';
const io = vi.hoisted(() => ({ controller: {} as any }));
vi.mock('../../hooks/useStudioController', () => ({ useStudioController: () => io.controller }));
vi.mock('../StudioCanvas', () => ({ default: () => <div /> }));
vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key.replace('features.studio.', '') }),
}));
vi.mock('@/features/file-upload/ui/ImageEditorDialog', () => ({ ImageEditorDialog: () => null }));
import { StudioWorkspace } from '../StudioWorkspace';
afterEach(cleanup);
function model() {
  const value = createDocument('campaign', 'Keyboard campaign', undefined, 1);
  return new Proxy(
    {
      value,
      page: value.pages[0],
      post: value.posts[0],
      active: value.pages[0].elements[1],
      peers: [],
      assets: [],
      exports: [
        { id: 'queued', format: 'pdf', status: 'queued', progress: 0 },
        { id: 'complete', format: 'png', status: 'completed', progress: 100 },
      ],
      projects: [{ id: 'p', title: 'Existing', kind: 'single' }],
      themes: [{ id: 'theme', name: 'Theme' }],
      sources: [{ id: 'source', title: 'Source' }],
      selected: ['a', 'b'],
      canEdit: true,
      busy: false,
      playing: false,
      guides: true,
      status: 'saved',
      collaboration: null,
      error: '',
      failure: '',
      photoEdit: undefined,
      kind: 'campaign',
      title: 'New campaign',
      template: 'announcement',
      mode: 'ai',
      weeks: 4,
      core: 3,
      stories: 2,
      brief: 'Explain participation',
      sourceType: 'event',
      format: 'png',
      scope: 'all',
      proposal: {
        posts: [{ title: 'Proposal', action: 'Join', slides: [{ title: 'Title', text: 'Text' }] }],
      },
    } as any,
    {
      get(target, key) {
        return key in target ? target[key] : (target[key] = vi.fn());
      },
    }
  );
}
async function keyboardControls(container: HTMLElement) {
  for (const detail of container.querySelectorAll('details')) detail.open = true;
  let count = 0;
  for (const control of container.querySelectorAll<
    HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >('button,input,select,textarea')) {
    if (control.disabled || control.closest('fieldset:disabled')) continue;
    control.focus();
    expect(document.activeElement).toBe(control);
    expect(control.tabIndex).toBeGreaterThanOrEqual(0);
    const changed = vi.fn();
    if (control.tagName === 'BUTTON') {
      control.addEventListener('click', changed);
      await userEvent.keyboard('{Enter}');
      expect(changed).toHaveBeenCalledOnce();
      control.removeEventListener('click', changed);
    } else if (control instanceof HTMLSelectElement) {
      control.addEventListener('keydown', changed);
      await userEvent.keyboard('{ArrowDown}');
      expect(changed).toHaveBeenCalled();
      control.removeEventListener('keydown', changed);
    } else if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      control.addEventListener('change', changed);
      await userEvent.keyboard(' ');
      expect(changed).toHaveBeenCalledOnce();
      control.removeEventListener('change', changed);
    } else if (
      control instanceof HTMLTextAreaElement ||
      (control instanceof HTMLInputElement && ['text', 'number'].includes(control.type))
    ) {
      control.addEventListener('input', changed);
      await userEvent.keyboard(
        control instanceof HTMLInputElement && control.type === 'number' ? '2' : 'x'
      );
      expect(changed).toHaveBeenCalled();
      control.removeEventListener('input', changed);
    }
    count++;
  }
  return count;
}
it('exposes Studio creation, text, media, campaign and export controls to real keyboard focus and native activation', async () => {
  io.controller = model();
  const ui = render(<StudioWorkspace groupId="group" open={vi.fn()} />);
  expect(await keyboardControls(ui.container)).toBeGreaterThan(8);
  ui.rerender(<StudioWorkspace groupId="group" projectId="project" open={vi.fn()} />);
  expect(await keyboardControls(ui.container)).toBeGreaterThan(50);
  io.controller.active = element('video');
  ui.rerender(<StudioWorkspace projectId="project" open={vi.fn()} />);
  expect(await keyboardControls(ui.container)).toBeGreaterThan(40);
  io.controller.active = element('image');
  ui.rerender(<StudioWorkspace projectId="project" open={vi.fn()} />);
  expect(await keyboardControls(ui.container)).toBeGreaterThan(40);
});
