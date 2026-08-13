/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FeedList,
  FeedPanel,
  FeedSplitLayout,
  FeedStatePanel,
  FeedToolbar,
} from '../feed/FeedSurface';
import { ChoiceCardField } from '../form/ChoiceCardField';
import { SectionProgressTopBar } from '../navigation/SectionProgressTopBar';

vi.mock('@/features/shared/motion', () => ({
  MotionGroup: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  MotionItem: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  CardContent: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
}));
const shell = vi.hoisted(() => ({ invalid: true }));
vi.mock('../form/FormFieldShell', () => ({
  FormFieldShell: ({ children }: { children: (state: object) => React.ReactNode }) =>
    children({ describedBy: 'description', invalid: shell.invalid }),
}));
vi.mock('@/features/shared/ui/ui/radio-group', () => ({
  RadioGroup: ({
    children,
    onValueChange,
    ...props
  }: React.PropsWithChildren<{ onValueChange: (value: string) => void }>) => (
    <div {...props}>
      <button onClick={() => onValueChange('two')}>change choice</button>
      {children}
    </div>
  ),
  RadioGroupItem: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input type="radio" {...props} />
  ),
}));
vi.mock('@/features/shared/ui/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress">{value}</div>,
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe('six-branch shared surfaces', () => {
  it('renders every feed surface and optional state content', () => {
    const Icon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
    render(
      <>
        <FeedSplitLayout className="split">Split</FeedSplitLayout>
        <FeedPanel className="panel">Panel</FeedPanel>
        <FeedToolbar className="toolbar">Toolbar</FeedToolbar>
        <FeedList className="list">
          <span>One</span>
          {null}
          <span>Two</span>
        </FeedList>
        <FeedStatePanel
          icon={Icon}
          title="Title"
          description="Description"
          className="state"
          contentClassName="content"
        >
          Child
        </FeedStatePanel>
        <FeedStatePanel>Empty state</FeedStatePanel>
      </>
    );
    expect(screen.getByText('Split').className).toContain('split');
    expect(screen.getByText('Icon')).toBeTruthy();
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Empty state')).toBeTruthy();
  });

  it('renders selected and unselected choice cards and reports changes', () => {
    const onValueChange = vi.fn();
    const Icon = ({ className }: { className?: string }) => <span className={className}>Icon</span>;
    render(
      <ChoiceCardField
        required
        value="one"
        onValueChange={onValueChange}
        options={[
          {
            value: 'one',
            label: 'One',
            description: 'Description',
            content: 'Content',
            suffix: 'Suffix',
            icon: Icon,
            disabled: true,
          },
          { value: 'two', label: 'Two' },
        ]}
      />
    );
    fireEvent.click(screen.getByText('change choice'));
    expect(onValueChange).toHaveBeenCalledWith('two');
    expect(screen.getByText('One').closest('label')?.className).toContain('border-primary');
    expect(screen.getByText('Two').closest('label')?.className).toContain('hover:bg-muted');
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText('Suffix')).toBeTruthy();
  });

  it('supports explicit choice IDs and grids', () => {
    shell.invalid = false;
    render(
      <ChoiceCardField
        id="choice"
        grid="four"
        value="none"
        onValueChange={vi.fn()}
        options={[{ value: 'one', label: 'One' }]}
      />
    );
    expect(screen.getByText('change choice').parentElement?.className).toContain('grid-cols-2');
    shell.invalid = true;
  });

  it('clamps progress and covers active, complete, disabled, and described steps', () => {
    const onItemSelect = vi.fn();
    const Icon = ({ className }: { className?: string }) => (
      <span className={className}>Step icon</span>
    );
    const first = render(
      <SectionProgressTopBar
        items={[
          { id: 'active', label: 'Active', icon: Icon as never, description: 'Active description' },
          { id: 'done', label: 'Done', completed: true, description: 'Done description' },
          { id: 'disabled', label: <span>Disabled</span>, disabled: true },
          { id: 'plain', label: 'Plain' },
        ]}
        activeId="active"
        progressValue={Number.NaN}
        label="Progress"
        countLabel="1 / 4"
        onItemSelect={onItemSelect}
        sticky
        showDescriptions
      />
    );
    expect(screen.getByTestId('progress').textContent).toBe('0');
    fireEvent.click(screen.getByText('Active').closest('button')!);
    fireEvent.click(screen.getByText('Plain').closest('button')!);
    expect(onItemSelect.mock.calls.map(call => call[0])).toEqual(['active', 'plain']);
    expect(screen.getByText('Active description')).toBeTruthy();
    first.unmount();

    const second = render(
      <SectionProgressTopBar items={[]} activeId="none" progressValue={150} countLabel="Count" />
    );
    expect(screen.getByTestId('progress').textContent).toBe('100');
    second.unmount();
    render(
      <SectionProgressTopBar
        items={[{ id: 'active', label: 'No icon' }]}
        activeId="active"
        progressValue={-10}
        label="Label"
      />
    );
    expect(screen.getByTestId('progress').textContent).toBe('0');
  });
});
