/* @vitest-environment jsdom */

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ controller: vi.fn(), view: vi.fn() }));

vi.mock('../useEventEditController', () => ({
  useEventEditController: (props: unknown) => {
    mocks.controller(props);
    return { marker: 'controller-result' };
  },
}));
vi.mock('../EventEditView', () => ({
  EventEditView: (props: unknown) => {
    mocks.view(props);
    return <div>event-edit-view</div>;
  },
}));

import { EventEdit } from '../EventEdit';

describe('EventEdit coverage', () => {
  it('connects default and explicit props to the controller and view', () => {
    const onTabChange = vi.fn();
    const { rerender } = render(<EventEdit eventId="event-1" />);
    expect(mocks.controller).toHaveBeenLastCalledWith({
      eventId: 'event-1',
      mode: 'edit',
      defaultTab: undefined,
      onTabChange: undefined,
    });
    expect(mocks.view).toHaveBeenLastCalledWith({ marker: 'controller-result' });

    rerender(
      <EventEdit eventId="new" mode="create" defaultTab="event-type" onTabChange={onTabChange} />
    );
    expect(mocks.controller).toHaveBeenLastCalledWith({
      eventId: 'new',
      mode: 'create',
      defaultTab: 'event-type',
      onTabChange,
    });
  });
});
