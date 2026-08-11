/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ModeSync } from '../mode-sync';

const controller = vi.hoisted(() => vi.fn());
vi.mock('../useModeSyncController', () => ({ useModeSyncController: controller }));

afterEach(cleanup);

describe('ModeSync', () => {
  it('uses the default read-only state and forwards explicit state', () => {
    const first = render(<ModeSync />);
    expect(controller).toHaveBeenLastCalledWith({ currentMode: undefined, readOnly: false });
    expect(first.container.firstChild).toBeNull();
    first.unmount();

    render(<ModeSync currentMode={'view' as never} readOnly />);
    expect(controller).toHaveBeenLastCalledWith({ currentMode: 'view', readOnly: true });
  });
});
