/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  text: undefined as Record<string, any> | undefined,
  typeahead: undefined as Record<string, any> | undefined,
  renderedText: undefined as Record<string, any> | undefined,
  renderedTypeahead: undefined as Record<string, any> | undefined,
  validationArgs: [] as Record<string, any>[],
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));
vi.mock('@/features/shared/ui/form', () => ({
  TextField: (props: Record<string, any>) => {
    captured.text = props;
    return (
      <div>
        <button type="button" onClick={() => props.onValueChange('next')}>
          text change
        </button>
        <button type="button" onClick={() => props.onBlur({})}>
          text blur
        </button>
      </div>
    );
  },
  TypeaheadField: (props: Record<string, any>) => {
    captured.typeahead = props;
    return (
      <div>
        <button type="button" onClick={() => props.onInteract()}>
          interact
        </button>
        <button
          type="button"
          onClick={() =>
            props.multiple ? props.onValuesChange(['next']) : props.onChange({ id: 'next' })
          }
        >
          change
        </button>
      </div>
    );
  },
}));
vi.mock('@/features/create/hooks/useCreateDescriptorFieldState', () => ({
  useCreateDescriptorFieldState: (args: Record<string, any>) => {
    captured.validationArgs.push(args);
    return { hintText: 'state hint', isInvalid: true, isValid: false, markInteracted: vi.fn() };
  },
}));
vi.mock('../CreateStepRendererFieldsView', () => ({
  CreateTextDescriptorFieldView: (props: Record<string, any>) => {
    captured.renderedText = props;
    return <div />;
  },
  CreateTypeaheadDescriptorFieldView: (props: Record<string, any>) => {
    captured.renderedTypeahead = props;
    return <div />;
  },
}));

import { CreateTextDescriptorFieldView } from '../CreateTextDescriptorFieldView';
import { CreateTypeaheadDescriptorFieldView } from '../CreateTypeaheadDescriptorFieldView';
import {
  CreateTextDescriptorField,
  CreateTypeaheadDescriptorField,
} from '../CreateStepDescriptorFields';

beforeEach(() => {
  captured.validationArgs = [];
});
afterEach(cleanup);

describe('standalone create descriptor views', () => {
  it('covers invalid, valid, and neutral text tones plus optional blur', () => {
    const mark = vi.fn();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <CreateTextDescriptorFieldView
        field={{ key: 'title', kind: 'text', label: 'Title', value: '', onValueChange } as any}
        invalid
        isValid={false}
        hintText="required"
        onMarkInteracted={mark}
      />
    );
    expect(captured.text).toMatchObject({ description: undefined, error: 'required' });
    fireEvent.click(screen.getByText('text change'));
    fireEvent.click(screen.getByText('text blur'));
    expect(mark).toHaveBeenCalledTimes(2);

    rerender(
      <CreateTextDescriptorFieldView
        field={
          {
            key: 'title',
            kind: 'text',
            label: 'Title',
            value: 'ok',
            onValueChange,
            error: 'explicit',
          } as any
        }
        invalid={false}
        isValid
        hintText="hint"
        onMarkInteracted={mark}
      />
    );
    expect(captured.text?.className).toContain('theme-createCreateFieldsSuccessRing');

    rerender(
      <CreateTextDescriptorFieldView
        field={{ key: 'title', kind: 'text', label: 'Title', value: '', onValueChange } as any}
        invalid={false}
        isValid={false}
        hintText="hint"
        onMarkInteracted={mark}
      />
    );
    expect(captured.text?.descriptionClassName).toContain('text-muted-foreground');
  });

  it('covers multi and single typeahead callbacks and validation tones', () => {
    const mark = vi.fn();
    const multiInteract = vi.fn();
    const onValuesChange = vi.fn();
    const { rerender } = render(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'groups',
            kind: 'typeahead',
            label: 'Groups',
            props: { multiple: true, values: [], onInteract: multiInteract, onValuesChange },
          } as any
        }
        multiple
        invalid
        isValid={false}
        hintText="required"
        onMarkInteracted={mark}
      />
    );
    fireEvent.click(screen.getByText('interact'));
    fireEvent.click(screen.getByText('change'));
    expect(multiInteract).toHaveBeenCalledOnce();
    expect(onValuesChange).toHaveBeenCalledWith(['next']);
    expect(captured.typeahead).toMatchObject({ description: undefined, error: 'required' });

    rerender(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'groups',
            kind: 'typeahead',
            label: 'Groups',
            props: { multiple: true, values: [], onValuesChange },
          } as any
        }
        multiple
        invalid={false}
        isValid={false}
        hintText="multi hint"
        onMarkInteracted={mark}
      />
    );
    expect(captured.typeahead).toMatchObject({ description: 'multi hint', error: undefined });

    rerender(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'group',
            kind: 'typeahead',
            label: 'Group',
            props: { value: null, onChange: vi.fn() },
          } as any
        }
        multiple={false}
        invalid={false}
        isValid
        hintText="hint"
        onMarkInteracted={mark}
      />
    );
    fireEvent.click(screen.getByText('interact'));
    expect(captured.typeahead?.className).toContain('theme-createCreateFieldsSuccessBorderAlpha');

    rerender(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'group',
            kind: 'typeahead',
            label: 'Group',
            props: { value: null, onChange: vi.fn() },
          } as any
        }
        multiple={false}
        invalid
        isValid={false}
        hintText="single required"
        onMarkInteracted={mark}
      />
    );
    expect(captured.typeahead).toMatchObject({ description: undefined, error: 'single required' });

    rerender(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'group',
            kind: 'typeahead',
            label: 'Group',
            props: { value: null, onChange: vi.fn() },
          } as any
        }
        multiple={false}
        invalid={false}
        isValid={false}
        hintText="hint"
        onMarkInteracted={mark}
      />
    );
    expect(captured.typeahead?.descriptionClassName).toContain('text-muted-foreground');
  });
});

describe('legacy create step descriptor adapters', () => {
  it('adapts text descriptions and explicit invalid overrides', () => {
    const { rerender } = render(
      <CreateTextDescriptorField
        field={
          {
            key: 'title',
            kind: 'text',
            label: 'Title',
            value: '',
            onValueChange: vi.fn(),
            description: 'description',
            invalid: false,
          } as any
        }
      />
    );
    expect(captured.validationArgs[0].hint).toBe('description');
    expect(captured.renderedText?.invalid).toBe(false);

    rerender(
      <CreateTextDescriptorField
        field={
          {
            key: 'title',
            kind: 'text',
            label: 'Title',
            value: '',
            onValueChange: vi.fn(),
            hint: 'fallback',
          } as any
        }
      />
    );
    expect(captured.validationArgs[1].hint).toBe('fallback');
    expect(captured.renderedText?.invalid).toBe(true);
  });

  it('adapts multi and single typeahead values and invalid fallbacks', () => {
    const { rerender } = render(
      <CreateTypeaheadDescriptorField
        field={
          {
            key: 'groups',
            kind: 'typeahead',
            label: 'Groups',
            invalid: false,
            props: { multiple: true, values: ['a', 'b'], onValuesChange: vi.fn() },
          } as any
        }
      />
    );
    expect(captured.validationArgs[0].value).toBe('a b');
    expect(captured.renderedTypeahead).toMatchObject({ multiple: true, invalid: false });

    rerender(
      <CreateTypeaheadDescriptorField
        field={
          {
            key: 'group',
            kind: 'typeahead',
            label: 'Group',
            props: { value: null, onChange: vi.fn() },
          } as any
        }
      />
    );
    expect(captured.validationArgs[1].value).toBe('');
    expect(captured.renderedTypeahead).toMatchObject({ multiple: false, invalid: true });
  });
});
