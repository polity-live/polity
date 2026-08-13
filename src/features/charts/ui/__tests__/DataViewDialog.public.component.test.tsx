/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataViewDialog } from '../DataViewDialog';

const modelMocks = vi.hoisted(() => ({
  useDataViewDialogModel: vi.fn(),
}));

vi.mock('../../hooks/useDataViewDialogModel', () => modelMocks);

afterEach(() => {
  cleanup();
});

describe('DataViewDialog public runtime', () => {
  it('does not initialize the Zero-backed model outside ConnectedAppRuntime', () => {
    const { container } = render(<DataViewDialog />);

    expect(container.childElementCount).toBe(0);
    expect(modelMocks.useDataViewDialogModel).not.toHaveBeenCalled();
  });
});
