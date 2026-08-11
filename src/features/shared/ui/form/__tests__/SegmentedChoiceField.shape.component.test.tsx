/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SegmentedChoiceField } from '../SegmentedChoiceField';

afterEach(cleanup);

describe('SegmentedChoiceField shape', () => {
  it('uses rounded-corner icon options instead of circular controls', () => {
    render(
      <SegmentedChoiceField
        value="one"
        onValueChange={vi.fn()}
        size="icon"
        options={[
          { value: 'one', label: 'One' },
          { value: 'two', label: 'Two' },
        ]}
      />
    );

    for (const button of screen.getAllByRole('button')) {
      expect(button.className).toContain('rounded-md');
      expect(button.className).not.toContain('rounded-full');
    }
  });
});
