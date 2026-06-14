import * as React from 'react';

import { Button, type ButtonProps } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';

type FileUploadInputProps = Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'children' | 'className' | 'type'
>;

interface FileUploadTriggerProps extends Omit<ButtonProps, 'type'> {
  inputProps?: FileUploadInputProps;
  inputClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onFilesSelected?: (files: FileList, event: React.ChangeEvent<HTMLInputElement>) => void;
  resetOnSelect?: boolean;
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (!ref) {
    return;
  }

  if (typeof ref === 'function') {
    ref(value);
    return;
  }

  (ref as React.MutableRefObject<T | null>).current = value;
}

export function FileUploadTrigger({
  children,
  inputProps,
  inputClassName,
  inputRef,
  onFilesSelected,
  resetOnSelect = true,
  disabled,
  onClick,
  ...buttonProps
}: FileUploadTriggerProps) {
  const internalInputRef = React.useRef<HTMLInputElement | null>(null);
  const { disabled: inputDisabled, onChange, tabIndex, ...restInputProps } = inputProps ?? {};
  const resolvedDisabled = disabled || inputDisabled;

  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      internalInputRef.current = node;
      assignRef(inputRef, node);
    },
    [inputRef]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);

    const files = event.currentTarget.files;
    if (files && files.length > 0) {
      onFilesSelected?.(files, event);
    }

    if (resetOnSelect) {
      event.currentTarget.value = '';
    }
  };

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);

    if (!event.defaultPrevented && !resolvedDisabled) {
      internalInputRef.current?.click();
    }
  };

  return (
    <>
      <input
        {...restInputProps}
        ref={setInputRef}
        type="file"
        tabIndex={tabIndex ?? -1}
        aria-hidden="true"
        disabled={resolvedDisabled}
        className={cn('sr-only', inputClassName)}
        onChange={handleInputChange}
      />
      <Button
        {...buttonProps}
        type="button"
        disabled={resolvedDisabled}
        onClick={handleButtonClick}
      >
        {children}
      </Button>
    </>
  );
}
