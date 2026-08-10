/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../resizable';

vi.mock('react-resizable-panels', () => ({
  Group: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="group" {...props} />,
  Panel: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="panel" {...props} />,
  Separator: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="separator" {...props} />
  ),
}));

afterEach(cleanup);

describe('resizable primitives', () => {
  it('renders groups, panels, and separators without a grip', () => {
    render(
      <ResizablePanelGroup className="custom">
        <ResizablePanel>Panel</ResizablePanel>
        <ResizableHandle />
      </ResizablePanelGroup>
    );
    expect(screen.getByTestId('group').className).toContain('custom');
    expect(screen.getByTestId('separator').querySelector('svg')).toBeNull();
  });

  it('renders the optional grip handle', () => {
    render(<ResizableHandle withHandle />);
    expect(screen.getByTestId('separator').querySelector('svg')).toBeTruthy();
  });
});
