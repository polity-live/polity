'use client';

import * as React from 'react';
import { Loader2Icon, UploadIcon } from 'lucide-react';

import { FileUploadTrigger } from '@/features/shared/ui/form';
import { cn } from '@/features/shared/utils/utils';

export type FileDropzoneRejectionCode = 'file-type' | 'file-size' | 'too-many-files';

export interface FileDropzoneRejection {
  code: FileDropzoneRejectionCode;
  file?: File;
}

interface FileDropzoneProps {
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  busy?: boolean;
  idleLabel: string;
  activeLabel: string;
  browseLabel: string;
  busyLabel?: string;
  hint?: string;
  className?: string;
  inputProps?: Omit<
    React.ComponentPropsWithoutRef<'input'>,
    'accept' | 'children' | 'className' | 'type'
  > &
    Record<`data-${string}`, string | number | boolean | undefined>;
  testId?: string;
  children?: React.ReactNode;
  onFilesSelected: (files: File[]) => void | Promise<void>;
  onFilesRejected?: (rejections: FileDropzoneRejection[]) => void;
}

function fileMatchesAccept(file: File, accept?: string) {
  if (!accept?.trim()) return true;

  const fileName = file.name.toLocaleLowerCase();
  const mimeType = file.type.toLocaleLowerCase();
  return accept
    .split(',')
    .map(value => value.trim().toLocaleLowerCase())
    .filter(Boolean)
    .some(value => {
      if (value.startsWith('.')) return fileName.endsWith(value);
      if (value.endsWith('/*')) return mimeType.startsWith(value.slice(0, -1));
      return mimeType === value;
    });
}

export function FileDropzone({
  accept,
  maxFiles = 1,
  maxSize,
  disabled = false,
  busy = false,
  idleLabel,
  activeLabel,
  browseLabel,
  busyLabel,
  hint,
  className,
  inputProps,
  testId = 'file-dropzone',
  children,
  onFilesSelected,
  onFilesRejected,
}: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = React.useState(false);
  const dragCounterRef = React.useRef(0);
  const isDisabled = disabled || busy;

  const handleFiles = React.useCallback(
    (files: File[]) => {
      if (isDisabled || files.length === 0) return;
      if (files.length > maxFiles) {
        onFilesRejected?.([{ code: 'too-many-files' }]);
        return;
      }

      const rejections: FileDropzoneRejection[] = [];
      const acceptedFiles = files.filter(file => {
        if (!fileMatchesAccept(file, accept)) {
          rejections.push({ code: 'file-type', file });
          return false;
        }
        if (maxSize != null && file.size > maxSize) {
          rejections.push({ code: 'file-size', file });
          return false;
        }
        return true;
      });

      if (rejections.length > 0) onFilesRejected?.(rejections);
      if (acceptedFiles.length > 0) void onFilesSelected(acceptedFiles);
    },
    [accept, isDisabled, maxFiles, maxSize, onFilesRejected, onFilesSelected]
  );

  const resetDragState = () => {
    dragCounterRef.current = 0;
    setIsDragActive(false);
  };

  return (
    <div
      className={cn(
        'rounded-md border border-dashed px-4 py-6 transition-colors sm:px-6',
        isDragActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/20',
        isDisabled && 'pointer-events-none opacity-70',
        className
      )}
      data-testid={testId}
      onDragEnter={event => {
        event.preventDefault();
        event.stopPropagation();
        if (isDisabled) return;
        dragCounterRef.current += 1;
        setIsDragActive(true);
      }}
      onDragLeave={event => {
        event.preventDefault();
        event.stopPropagation();
        dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
        if (dragCounterRef.current === 0) setIsDragActive(false);
      }}
      onDragOver={event => {
        event.preventDefault();
        event.stopPropagation();
        if (!isDisabled) event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={event => {
        event.preventDefault();
        event.stopPropagation();
        resetDragState();
        handleFiles(Array.from(event.dataTransfer.files ?? []));
      }}
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <div className="bg-background flex size-12 items-center justify-center rounded-xl border shadow-sm">
          <UploadIcon className="text-primary size-5" />
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-medium">{isDragActive ? activeLabel : idleLabel}</p>
          {hint ? <p className="text-muted-foreground">{hint}</p> : null}
        </div>
        <FileUploadTrigger
          inputProps={{ ...inputProps, accept, multiple: maxFiles > 1 }}
          onFilesSelected={files => handleFiles(Array.from(files))}
          variant="outline"
          className="min-w-44"
          disabled={isDisabled}
        >
          {busy ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <UploadIcon className="size-4" />
          )}
          {busy ? busyLabel || browseLabel : browseLabel}
        </FileUploadTrigger>
        {children}
      </div>
    </div>
  );
}
