import { File, X } from 'lucide-react';

import {
  FileInputField,
  FormControlInput,
  FormControlLabel,
  FormControlTextarea,
} from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { Button } from '@/features/shared/ui/ui/button';
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
            <div className="mt-2">
              {selectedFile ? (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4" />
                    <span className="text-sm">{selectedFile.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={onRemoveFile} disabled={isUploading}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <FileInputField
                  id="file"
                  aria-label={translateText('generated.inline.0385_choose_file_to_attach_b555434d')}
                  className="hover:bg-muted h-auto cursor-pointer rounded-lg border-2 border-dashed p-4 file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:shadow-xs"
                  onChange={event => onFileChange(event.target.files?.[0] ?? null)}
                />
              )}
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
