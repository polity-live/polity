/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CityDesignWorkspaceView } from '../CityDesignWorkspaceView';

afterEach(cleanup);

const props = {
  title: 'Workspace',
  selectionAddressLabel: 'Address',
  metricLabels: ['100 m'],
  isDirty: true,
  children: <div>Canvas</div>,
};

describe('CityDesignWorkspaceView A04 alternatives', () => {
  it('renders a card without its outer workspace in content-only mode', () => {
    render(<CityDesignWorkspaceView {...props} contentOnly beforeCard={<div>Before</div>} />);
    expect(screen.queryByTestId('city-design-workspace')).toBeNull();
    expect(screen.getByText('Canvas')).toBeTruthy();
  });

  it('renders embedded and ordinary outer workspaces', () => {
    const { rerender } = render(<CityDesignWorkspaceView {...props} embedded />);
    expect(screen.getByTestId('city-design-workspace').dataset.embedded).toBe('true');
    rerender(<CityDesignWorkspaceView {...props} isDirty={false} embedded={false} />);
    expect(screen.getByTestId('city-design-workspace').dataset.embedded).toBeUndefined();
  });
});
