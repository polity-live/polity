/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  textProps: undefined as Record<string, any> | undefined,
  typeaheadProps: undefined as Record<string, any> | undefined,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (key: string) => `theme-${key}`,
}));

vi.mock('@/features/shared/ui/form', () => ({
  TextField: (props: Record<string, any>) => {
    mocks.textProps = props;
    return (
      <div>
        <button type="button" onClick={() => props.onValueChange('changed')}>
          text-change
        </button>
        <button type="button" onClick={event => props.onBlur(event)}>
          text-blur
        </button>
      </div>
    );
  },
  TypeaheadField: (props: Record<string, any>) => {
    mocks.typeaheadProps = props;
    return (
      <div>
        <button type="button" onClick={() => props.onInteract()}>
          typeahead-interact
        </button>
        {props.multiple ? (
          <button type="button" onClick={() => props.onValuesChange(['one', 'two'])}>
            typeahead-change
          </button>
        ) : (
          <button type="button" onClick={() => props.onChange({ id: 'one' })}>
            typeahead-change
          </button>
        )}
      </div>
    );
  },
}));

import {
  CreateTextDescriptorFieldView,
  CreateTypeaheadDescriptorFieldView,
} from '../CreateStepRendererFieldsView';

function validation(overrides: Record<string, unknown> = {}) {
  return {
    hintText: 'Helpful hint',
    isInvalid: false,
    isValid: false,
    markInteracted: vi.fn(),
    ...overrides,
  } as any;
}

beforeEach(() => {
  mocks.textProps = undefined;
  mocks.typeaheadProps = undefined;
});

afterEach(cleanup);

describe('CreateTextDescriptorFieldView', () => {
  it('forwards a neutral text descriptor and marks value and blur interactions', () => {
    const state = validation();
    const onValueChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <CreateTextDescriptorFieldView
        field={
          {
            key: 'title',
            kind: 'text',
            label: 'Title',
            value: 'Initial',
            onValueChange,
            onBlur,
            required: true,
            placeholder: 'Enter title',
            inputClassName: 'input-extra',
          } as any
        }
        validationState={state}
        invalid={false}
      />
    );

    expect(mocks.textProps).toMatchObject({
      description: 'Helpful hint',
      error: undefined,
      invalid: false,
      className: 'input-extra',
      descriptionClassName: 'text-xs text-muted-foreground',
    });
    fireEvent.click(screen.getByText('text-change'));
    fireEvent.click(screen.getByText('text-blur'));
    expect(state.markInteracted).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenCalledWith('changed');
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('uses invalid hints as errors and preserves an explicit field error', () => {
    const state = validation({ isInvalid: true });
    const { rerender } = render(
      <CreateTextDescriptorFieldView
        field={
          { key: 'title', kind: 'text', label: 'Title', value: '', onValueChange: vi.fn() } as any
        }
        validationState={state}
        invalid
      />
    );
    expect(mocks.textProps).toMatchObject({
      description: undefined,
      error: 'Helpful hint',
      descriptionClassName: 'text-xs text-destructive',
    });

    rerender(
      <CreateTextDescriptorFieldView
        field={
          {
            key: 'title',
            kind: 'text',
            label: 'Title',
            value: '',
            onValueChange: vi.fn(),
            error: 'Explicit error',
          } as any
        }
        validationState={state}
        invalid
      />
    );
    expect(mocks.textProps?.error).toBe('Explicit error');
    fireEvent.click(screen.getByText('text-blur'));
    expect(state.markInteracted).toHaveBeenCalledOnce();
  });

  it('adds the successful text tone and ring', () => {
    render(
      <CreateTextDescriptorFieldView
        field={
          { key: 'title', kind: 'text', label: 'Title', value: 'ok', onValueChange: vi.fn() } as any
        }
        validationState={validation({ isValid: true })}
        invalid={false}
      />
    );
    expect(mocks.textProps?.descriptionClassName).toContain('theme-authNameStepSuccessText');
    expect(mocks.textProps?.className).toContain('theme-createCreateFieldsSuccessRing');
  });
});

describe('CreateTypeaheadDescriptorFieldView', () => {
  it('wraps multi-value interactions and optional source callbacks', () => {
    const state = validation({ isValid: true });
    const onInteract = vi.fn();
    const onValuesChange = vi.fn();
    render(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'groups',
            kind: 'typeahead',
            label: 'Groups',
            props: { multiple: true, onInteract, onValuesChange },
            inputClassName: 'extra',
          } as any
        }
        validationState={state}
        invalid={false}
        multiple
      />
    );

    expect(mocks.typeaheadProps).toMatchObject({
      multiple: true,
      description: 'Helpful hint',
      className: 'theme-createCreateFieldsSuccessBorderAlpha extra',
    });
    fireEvent.click(screen.getByText('typeahead-interact'));
    fireEvent.click(screen.getByText('typeahead-change'));
    expect(state.markInteracted).toHaveBeenCalledTimes(2);
    expect(onInteract).toHaveBeenCalledOnce();
    expect(onValuesChange).toHaveBeenCalledWith(['one', 'two']);
  });

  it('wraps single-value changes without requiring an onInteract callback', () => {
    const state = validation({ isInvalid: true });
    const onChange = vi.fn();
    render(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'group',
            kind: 'typeahead',
            label: 'Group',
            error: 'Explicit',
            props: { onChange },
          } as any
        }
        validationState={state}
        invalid
        multiple={false}
      />
    );

    expect(mocks.typeaheadProps).toMatchObject({
      description: undefined,
      error: 'Explicit',
      descriptionClassName: 'text-xs text-destructive',
    });
    fireEvent.click(screen.getByText('typeahead-interact'));
    fireEvent.click(screen.getByText('typeahead-change'));
    expect(state.markInteracted).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith({ id: 'one' });
  });

  it('uses multi-value invalid hints when no explicit error exists', () => {
    render(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'groups',
            kind: 'typeahead',
            label: 'Groups',
            props: { multiple: true, onValuesChange: vi.fn() },
          } as any
        }
        validationState={validation({ isInvalid: true })}
        invalid
        multiple
      />
    );
    expect(mocks.typeaheadProps).toMatchObject({
      description: undefined,
      error: 'Helpful hint',
    });
  });

  it('uses single-value neutral hints and no error when valid state is absent', () => {
    const { rerender } = render(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'group',
            kind: 'typeahead',
            label: 'Group',
            props: { onChange: vi.fn() },
          } as any
        }
        validationState={validation()}
        invalid={false}
        multiple={false}
      />
    );
    expect(mocks.typeaheadProps).toMatchObject({
      description: 'Helpful hint',
      error: undefined,
      descriptionClassName: 'text-xs text-muted-foreground',
    });

    rerender(
      <CreateTypeaheadDescriptorFieldView
        field={
          {
            key: 'group',
            kind: 'typeahead',
            label: 'Group',
            props: { onChange: vi.fn() },
          } as any
        }
        validationState={validation({ isInvalid: true })}
        invalid
        multiple={false}
      />
    );
    expect(mocks.typeaheadProps).toMatchObject({
      description: undefined,
      error: 'Helpful hint',
    });
  });
});
