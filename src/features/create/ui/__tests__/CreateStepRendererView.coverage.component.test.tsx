/* @vitest-environment jsdom */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/shared/ui/form', () => ({
  FieldGrid: ({ children }: { children: any }) => <div data-testid="grid">{children}</div>,
  FieldList: ({ children }: { children: any }) => <div data-testid="list">{children}</div>,
}));
vi.mock('../CreateTextDescriptorField', () => ({
  CreateTextDescriptorField: () => <div>text field</div>,
}));
vi.mock('../CreateTypeaheadDescriptorField', () => ({
  CreateTypeaheadDescriptorField: () => <div>typeahead field</div>,
}));

import { CreateStepRendererView } from '../CreateStepRendererView';

afterEach(cleanup);

describe('CreateStepRendererView branches', () => {
  it('renders every direct field kind and default custom-component props', () => {
    const CustomComponent = ({ label = 'default props' }: { label?: string }) => <div>{label}</div>;
    render(
      <CreateStepRendererView
        step={
          {
            label: 'Fields',
            isValid: () => true,
            fields: [
              {
                key: 'custom',
                kind: 'custom',
                node: <span>custom node</span>,
                className: 'custom-class',
              },
              { key: 'component-default', kind: 'customComponent', component: CustomComponent },
              {
                key: 'component-props',
                kind: 'customComponent',
                component: CustomComponent,
                props: { label: 'provided props' },
              },
              {
                key: 'typeahead',
                kind: 'typeahead',
                label: 'Search',
                props: { value: null, onChange: vi.fn() },
              },
              { key: 'text', kind: 'text', label: 'Text', value: '', onValueChange: vi.fn() },
            ],
          } as any
        }
      />
    );
    expect(screen.getByText('custom node')).toBeTruthy();
    expect(screen.getByText('default props')).toBeTruthy();
    expect(screen.getByText('provided props')).toBeTruthy();
    expect(screen.getByText('typeahead field')).toBeTruthy();
    expect(screen.getByText('text field')).toBeTruthy();
  });

  it('renders grid and list sections with each heading combination', () => {
    render(
      <CreateStepRendererView
        step={
          {
            label: 'Sections',
            isValid: () => true,
            sections: [
              { key: 'title', layout: 'grid', title: 'Title only', fields: [] },
              { key: 'description', description: 'Description only', fields: [] },
              { key: 'neither', fields: [] },
            ],
          } as any
        }
      />
    );
    expect(screen.getByTestId('grid')).toBeTruthy();
    expect(screen.getByText('Title only')).toBeTruthy();
    expect(screen.getByText('Description only')).toBeTruthy();
  });

  it('returns null for an empty step', () => {
    const { container } = render(
      <CreateStepRendererView step={{ label: 'Empty', isValid: () => true } as any} />
    );
    expect(container.firstChild).toBeNull();
  });
});
