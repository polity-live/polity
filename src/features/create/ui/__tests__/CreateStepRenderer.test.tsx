/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { TypeaheadItem } from '@/features/shared/logic/typeaheadHelpers';
import { CreateStepRenderer } from '../CreateStepRenderer';
import type { CreateFormStep } from '../../types/create-form.types';

const items: TypeaheadItem[] = [
  {
    id: 'group-1',
    entityType: 'group',
    label: 'Budget Circle',
  },
];

describe('CreateStepRenderer', () => {
  it('renders controlled text descriptors', () => {
    function Harness() {
      const [value, setValue] = useState('');
      const step: CreateFormStep = {
        label: 'Basics',
        isValid: () => Boolean(value),
        fields: [
          {
            key: 'title',
            kind: 'text',
            label: 'Title',
            required: true,
            value,
            onValueChange: setValue,
            placeholder: 'Add title',
          },
        ],
      };

      return <CreateStepRenderer step={step} />;
    }

    render(<Harness />);

    fireEvent.change(screen.getByPlaceholderText('Add title'), {
      target: { value: 'Community budget' },
    });

    expect(screen.getByDisplayValue('Community budget')).toBeTruthy();
  });

  it('renders typeahead descriptors and custom slots', () => {
    function Harness() {
      const [value, setValue] = useState<string | undefined>();
      const step: CreateFormStep = {
        label: 'Relations',
        isValid: () => true,
        fields: [
          {
            key: 'group',
            kind: 'typeahead',
            label: 'Group',
            props: {
              items,
              value,
              onChange: item => setValue(item?.id),
              placeholder: 'Search groups',
            },
          },
          {
            key: 'custom',
            kind: 'custom',
            node: <div>Custom review</div>,
          },
        ],
      };

      return <CreateStepRenderer step={step} />;
    }

    render(<Harness />);

    fireEvent.focus(screen.getByPlaceholderText('Search groups'));
    fireEvent.click(screen.getByRole('button', { name: /Budget Circle/i }));

    expect(screen.getByText('Budget Circle')).toBeTruthy();
    expect(screen.getByText('Custom review')).toBeTruthy();
  });

  it('keeps legacy content as a fallback', () => {
    const step: CreateFormStep = {
      label: 'Legacy',
      isValid: () => true,
      content: <div>Legacy content</div>,
    };

    render(<CreateStepRenderer step={step} />);

    expect(screen.getByText('Legacy content')).toBeTruthy();
  });
});
