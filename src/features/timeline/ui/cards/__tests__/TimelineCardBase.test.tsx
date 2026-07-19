/* @vitest-environment jsdom */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TimelineCardBase, TimelineCardHeader } from '../TimelineCardBase';

afterEach(cleanup);

describe('TimelineCardBase', () => {
  it('clips its colored sections to the rounded card boundary', () => {
    const { container } = render(
      <TimelineCardBase contentType="agenda_item">
        <TimelineCardHeader contentType="agenda_item" title="Public hearing scheduled" />
      </TimelineCardBase>
    );

    const card = container.firstElementChild;
    const classNames = card?.className.split(' ') ?? [];

    expect(classNames).toEqual(
      expect.arrayContaining(['rounded-2xl', 'overflow-hidden', 'border', 'flex'])
    );
  });
});
