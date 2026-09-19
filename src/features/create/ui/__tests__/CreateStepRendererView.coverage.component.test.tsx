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
  it('collapses optional sections but keeps required or explicitly visible fields accessible', () => {
    const custom = (key: string, extra = {}) => ({
      key,
      kind: 'custom',
      node: <span>{key}</span>,
      ...extra,
    });
    const { container, rerender } = render(
      <CreateStepRendererView
        compactOptional
        step={
          {
            label: 'Optional',
            optional: true,
            isValid: () => true,
            sections: [
              { key: 'named', title: 'Extras', fields: [custom('additional')] },
              { key: 'unnamed', fields: [custom('no-title')] },
              {
                key: 'required',
                collapsible: true,
                fields: [
                  {
                    key: 'required-input',
                    kind: 'text',
                    required: true,
                    label: 'Required',
                    value: '',
                    onValueChange: vi.fn(),
                  },
                ],
              },
              {
                key: 'visible',
                collapsible: true,
                fields: [custom('essential', { alwaysVisible: true })],
              },
              { key: 'expanded', collapsible: false, fields: [custom('expanded')] },
            ],
          } as any
        }
      />
    );
    expect(container.querySelectorAll('details')).toHaveLength(2);
    expect(screen.getByText('Extras', { selector: 'summary' })).toBeTruthy();
    expect(screen.getByText('essential').closest('details')).toBeNull();
    expect(screen.getByText('text field').closest('details')).toBeNull();
    rerender(
      <CreateStepRendererView
        compactOptional
        step={
          {
            label: 'Required step',
            optional: false,
            isValid: () => true,
            fields: [custom('main'), custom('supplement', { supplementary: true })],
          } as any
        }
      />
    );
    expect(screen.getByText('main').closest('details')).toBeNull();
    expect(screen.getByText('supplement').closest('details')).toBeTruthy();
    rerender(
      <CreateStepRendererView
        compactOptional
        step={
          {
            label: 'Always shown',
            optional: true,
            isValid: () => true,
            fields: [
              custom('always', { alwaysVisible: true }),
              {
                key: 'required',
                kind: 'text',
                required: true,
                label: 'Required',
                value: '',
                onValueChange: vi.fn(),
              },
            ],
          } as any
        }
      />
    );
    expect(container.querySelector('details')).toBeNull();
    rerender(
      <CreateStepRendererView
        compactOptional
        step={
          {
            label: 'Explicit expanded',
            optional: true,
            collapsible: false,
            isValid: () => true,
            fields: [custom('expanded')],
          } as any
        }
      />
    );
    expect(container.querySelector('details')).toBeNull();
  });
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
