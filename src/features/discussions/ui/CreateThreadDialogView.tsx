import { File as FileIcon, Loader2, Upload, X } from 'lucide-react';

import {
  FileUploadTrigger,
  FormControlInput,
  FormControlLabel,
  FormControlTextarea,
} from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
import { cn } from '@/features/shared/utils/utils';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';

interface CreateThreadDialogViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  isSubmitting: boolean;
  isUploading: boolean;
  selectedFile: File | null;
  title: string;
  onDescriptionChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onRemoveFile: () => void;
  onSubmit: () => void;
  onTitleChange: (value: string) => void;
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreateThreadDialogView({
  open,
  onOpenChange,
  description,
  isSubmitting,
  isUploading,
  selectedFile,
  title,
  onDescriptionChange,
  onFileChange,
  onRemoveFile,
  onSubmit,
  onTitleChange,
}: CreateThreadDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ScrollableDialogContent>
        <DialogHeader>
          <DialogTitle>
            {translateText('generated.inline.0380_create_new_discussion_thread_bcf180d6')}
          </DialogTitle>
          <DialogDescription>
            {translateText(
              'generated.inline.0381_start_a_new_discussion_about_this_amendment_ac4916e8'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <FormControlLabel htmlFor="title">
              {translateText('generated.inline.0028_title_768e0c1c')}
            </FormControlLabel>
            <FormControlInput
              id="title"
              placeholder={translateText('generated.inline.0382_enter_thread_title_14bd46df')}
              value={title}
              onChange={event => onTitleChange(event.target.value)}
            />
          </div>
          <div>
            <FormControlLabel htmlFor="description">
              {translateText('generated.inline.0130_description_optional_f1da5c02')}
            </FormControlLabel>
            <FormControlTextarea
              id="description"
              placeholder={translateText(
                'generated.inline.0383_describe_what_this_thread_is_about_133a420c'
              )}
              value={description}
              onChange={event => onDescriptionChange(event.target.value)}
              rows={4}
            />
          </div>
          <div>
            <FormControlLabel htmlFor="file">
              {translateText('generated.inline.0384_attachment_optional_fe28692b')}
            </FormControlLabel>
            <div
              className={cn(
                'mt-2 rounded-2xl border border-dashed px-4 py-5 transition-all sm:px-6',
                selectedFile ? 'border-primary/35 bg-primary/5' : 'border-border bg-muted/20',
                (isUploading || isSubmitting) && 'pointer-events-none opacity-70'
              )}
            >
              <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
                <div className="bg-background/80 flex h-12 w-12 items-center justify-center rounded-full border shadow-sm">
                  {isUploading ? (
                    <Loader2 className="text-primary h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="text-primary h-5 w-5" />
                  )}
                </div>

                {selectedFile ? (
                  <div className="bg-background/90 border-border/70 flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left shadow-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onRemoveFile}
                      disabled={isUploading || isSubmitting}
                      aria-label="Remove attachment"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p className="text-foreground font-medium">
                      {translateText('generated.inline.0385_choose_file_to_attach_b555434d')}
                    </p>
                    <p className="text-muted-foreground">
                      {translateText('generated.inline.0384_attachment_optional_fe28692b')}
                    </p>
                  </div>
                )}

                <FileUploadTrigger
                  inputProps={{
                    id: 'file',
                    'aria-label': translateText(
                      'generated.inline.0385_choose_file_to_attach_b555434d'
                    ),
                  }}
                  onFilesSelected={files => onFileChange(files[0] ?? null)}
                  variant="outline"
                  className="mx-auto min-w-44"
                  disabled={isUploading || isSubmitting}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {translateText('generated.inline.0057_uploading_070e328e')}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {selectedFile
                        ? translateText('generated.inline.0385_choose_file_to_attach_b555434d')
                        : translateText('generated.inline.0963_choose_file_eb7eb7a8')}
                    </>
                  )}
                </FileUploadTrigger>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {translateText('generated.inline.0065_cancel_77dfd213')}
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting || isUploading || !title.trim()}>
            {isUploading
              ? translateText('generated.inline.0057_uploading_070e328e')
              : isSubmitting
                ? translateText('generated.inline.0013_creating_28ea7667')
                : translateText('generated.inline.0058_create_thread_ea3fa33f')}
          </Button>
        </DialogFooter>
      </ScrollableDialogContent>
    </Dialog>
  );
}
