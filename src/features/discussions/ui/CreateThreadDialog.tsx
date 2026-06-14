import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Textarea } from '@/features/shared/ui/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/shared/ui/ui/dialog';
import { File, Upload, X } from 'lucide-react';
import { useUploadFile } from '@/features/file-upload/hooks/use-upload-file.ts';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface CreateThreadDialogProps {
  amendmentId: string;
  userId?: string;
  amendmentTitle?: string;
  senderName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateThread: (
    amendmentId: string,
    title: string,
    description: string,
    userId: string,
    fileId?: string
  ) => Promise<string>;
}

export function CreateThreadDialog({
  amendmentId,
  userId,
  open,
  onOpenChange,
  onCreateThread,
}: CreateThreadDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { uploadFile, isUploading } = useUploadFile();

  const handleSubmit = async () => {
    if (!title.trim() || !userId) return;

    setIsSubmitting(true);
    try {
      // Upload file if selected
      let uploadedFileId: string | null = null;
      if (selectedFile) {
        try {
          const uploadResult = await uploadFile(selectedFile);
          uploadedFileId = uploadResult?.key ?? null;
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      }

      // Create thread
      await onCreateThread(amendmentId, title, description, userId, uploadedFileId || undefined);

      setTitle('');
      setDescription('');
      setSelectedFile(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating thread:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
            <Label htmlFor="title">{translateText('generated.inline.0028_title_768e0c1c')}</Label>
            <Input
              id="title"
              placeholder={translateText('generated.inline.0382_enter_thread_title_14bd46df')}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="description">
              {translateText('generated.inline.0130_description_optional_f1da5c02')}
            </Label>
            <Textarea
              id="description"
              placeholder={translateText(
                'generated.inline.0383_describe_what_this_thread_is_about_133a420c'
              )}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="file">
              {translateText('generated.inline.0384_attachment_optional_fe28692b')}
            </Label>
            <div className="mt-2">
              {selectedFile ? (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4" />
                    <span className="text-sm">{selectedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="hover:bg-muted flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4">
                  <Upload className="h-5 w-5" />
                  <span>
                    {translateText('generated.inline.0385_choose_file_to_attach_b555434d')}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFile(file);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {translateText('generated.inline.0065_cancel_77dfd213')}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isUploading || !title.trim()}>
            {isUploading
              ? translateText('generated.inline.0057_uploading_070e328e')
              : isSubmitting
                ? translateText('generated.inline.0013_creating_28ea7667')
                : translateText('generated.inline.0058_create_thread_ea3fa33f')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
