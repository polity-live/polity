// @vitest-environment jsdom

import * as React from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  shellProps: undefined as any,
  typeaheadProps: undefined as any,
}));

vi.mock('@/features/shared/theme', () => ({
  featureThemeClassName: (token: string) => `theme-${token}`,
}));

vi.mock('@/features/shared/hooks/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => `translated:${key}` }),
}));

vi.mock('@/features/shared/ui/form/FormFieldShell', () => ({
  FormFieldShell: ({ children, ...props }: any) => {
    mocks.shellProps = props;
    return (
      <div data-testid="shell">
        {props.description ? <span data-testid="description">{props.description}</span> : null}
        {props.error ? <span data-testid="error">{props.error}</span> : null}
        {typeof children === 'function'
          ? children({ describedBy: 'description-id', id: props.id ?? 'field-id' })
          : children}
      </div>
    );
  },
}));

vi.mock('@/features/shared/ui/form/FormControls', () => ({
  FormControlInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  FormControlTextarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

vi.mock('@/features/shared/ui/typeahead', () => ({
  TypeaheadSearch: (props: any) => {
    mocks.typeaheadProps = props;
    return (
      <div>
        <button type="button" onClick={props.onInteract}>
          interact
        </button>
        {props.multiple ? (
          <button type="button" onClick={() => props.onValuesChange(['next'])}>
            change multi
          </button>
        ) : (
          <button type="button" onClick={() => props.onChange({ id: 'next' })}>
            change single
          </button>
        )}
      </div>
    );
  },
}));

import { CreateInputField, CreateTextareaField, CreateTypeaheadField } from '../CreateFields';

afterEach(cleanup);

describe('CreateFields', () => {
  it('normalizes null and undefined input values and uses required and optional hints', () => {
    const nullValue = render(
      <CreateInputField id="name" label="Name" required value={null} onValueChange={vi.fn()} />
    );
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('translated:pages.create.common.requiredHint')).toBeTruthy();
    expect(mocks.shellProps.descriptionClassName).toContain('text-muted-foreground');
    nullValue.unmount();

    render(<CreateInputField label="Optional" value={undefined} onValueChange={vi.fn()} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('translated:pages.create.common.optionalHint')).toBeTruthy();
  });

  it('marks a required input invalid and forwards change and optional blur handlers', () => {
    const onValueChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <CreateInputField
        label="Required"
        required
        value=""
        onValueChange={onValueChange}
        onBlur={onBlur}
        className="input"
      />
    );
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'typed' } });
    expect(onValueChange).toHaveBeenCalledWith('typed');
    expect(screen.getByTestId('error').textContent).toContain('requiredHint');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(mocks.shellProps.description).toBeUndefined();

    fireEvent.blur(field);
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('renders valid numeric and string inputs with default and custom hints', () => {
    const numeric = render(<CreateInputField label="Count" value={42} onValueChange={vi.fn()} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('42');
    expect(screen.getByText('translated:pages.create.common.validHint')).toBeTruthy();
    expect(screen.getByRole('textbox').className).toContain('SuccessRing');
    numeric.unmount();

    render(
      <CreateInputField
        label="Named"
        hint="Custom hint"
        hintClassName="custom-hint"
        value="Ada"
        onValueChange={vi.fn()}
      />
    );
    expect(screen.getByText('Custom hint')).toBeTruthy();
    expect(mocks.shellProps.descriptionClassName).toContain('custom-hint');
  });

  it('shows validator failures after interaction and validator success initially', () => {
    const validator = (value: string) => (value === 'bad' ? 'Invalid value' : null);
    const invalid = render(
      <CreateInputField label="Code" value="bad" validator={validator} onValueChange={vi.fn()} />
    );
    expect(screen.queryByText('Invalid value')).toBeNull();
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByText('Invalid value')).toBeTruthy();
    invalid.unmount();

    render(
      <CreateInputField label="Code" value="good" validator={validator} onValueChange={vi.fn()} />
    );
    expect(screen.getByText('translated:pages.create.common.validHint')).toBeTruthy();
  });

  it('covers invalid and valid textarea borders and absent blur callbacks', () => {
    const view = render(
      <CreateTextareaField label="Body" required value="" onValueChange={vi.fn()} />
    );
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox').className).toContain('ThemedBorder');
    view.unmount();

    render(<CreateTextareaField label="Body" value="Complete" onValueChange={vi.fn()} />);
    expect(screen.getByRole('textbox').className).toContain('SuccessBorder');
    expect(screen.getByRole('textbox').getAttribute('data-valid')).toBe('true');
  });

  it('forwards textarea changes and custom hint classes', () => {
    const onValueChange = vi.fn();
    render(
      <CreateTextareaField
        id="body"
        label="Body"
        hint="Help"
        hintClassName="hint-class"
        value="Text"
        onValueChange={onValueChange}
      />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Next' } });
    expect(onValueChange).toHaveBeenCalledWith('Next');
    expect(mocks.shellProps.descriptionClassName).toContain('hint-class');
  });

  it('handles valid and invalid multi-value typeahead interactions', () => {
    const onValuesChange = vi.fn();
    const valid = render(
      <CreateTypeaheadField
        label="People"
        multiple
        values={['one', 'two']}
        onValuesChange={onValuesChange}
        items={[]}
      />
    );
    expect(mocks.typeaheadProps.className).toContain('SuccessBorderAlpha');
    fireEvent.click(screen.getByText('change multi'));
    expect(onValuesChange).toHaveBeenCalledWith(['next']);
    valid.unmount();

    render(
      <CreateTypeaheadField
        label="People"
        required
        multiple
        values={[]}
        onValuesChange={onValuesChange}
        items={[]}
      />
    );
    fireEvent.click(screen.getByText('interact'));
    expect(mocks.typeaheadProps.className).toContain('ThemedBorderAlpha');
    expect(screen.getByTestId('error')).toBeTruthy();
  });

  it('handles single-value typeahead fallbacks and changes', () => {
    const onChange = vi.fn();
    const empty = render(
      <CreateTypeaheadField label="Person" value={undefined} onChange={onChange} items={[]} />
    );
    expect(screen.getByText('translated:pages.create.common.optionalHint')).toBeTruthy();
    fireEvent.click(screen.getByText('change single'));
    expect(onChange).toHaveBeenCalledWith({ id: 'next' });
    empty.unmount();

    const required = render(
      <CreateTypeaheadField
        label="Required person"
        required
        value={undefined}
        onChange={onChange}
        items={[]}
      />
    );
    fireEvent.click(screen.getByText('interact'));
    expect(mocks.typeaheadProps.className).toContain('ThemedBorderBeta');
    required.unmount();

    render(<CreateTypeaheadField label="Person" value="one" onChange={onChange} items={[]} />);
    expect(mocks.typeaheadProps.className).toContain('SuccessBorderAlpha');
  });
});
