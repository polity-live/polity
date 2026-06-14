import { Loader2, Plus } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface CreateDocumentDialogViewProps {
  groupName?: string;
  isCreating: boolean;
  isOpen: boolean;
  onCreate: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onOpenChange: (isOpen: boolean) => void;
  onTitleChange: (title: string) => void;
  title: string;
}

export function CreateDocumentDialogView({
  groupName,
  isCreating,
  isOpen,
  onCreate,
  onKeyDown,
  onOpenChange,
  onTitleChange,
  title,
}: CreateDocumentDialogViewProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0404_new_document_e69f5da6')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent>
        <DialogHeader>
          <DialogTitle>
            {translateText('generated.inline.0405_create_new_document_07d90501')}
          </DialogTitle>
          <DialogDescription>
            {translateText('generated.inline.0406_enter_a_title_for_your_new_document_749e9123')}
            {groupName
              ? translateText('generated.inline.0051_in_groupname_bd500208', {
                  groupName,
                })
              : ''}
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <FormControlLabel htmlFor="title">
              {translateText('generated.inline.0407_document_title_73ee9605')}
            </FormControlLabel>
            <FormControlInput
              id="title"
              placeholder={translateText('generated.inline.0408_my_document_3916ed57')}
              value={title}
              onChange={event => onTitleChange(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={isCreating}
              autoFocus
            />
          </div>
          <Button onClick={onCreate} className="w-full" disabled={isCreating || !title.trim()}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {translateText('generated.inline.0409_creating_28ea7667')}
              </>
            ) : (
              translateText('generated.inline.0059_create_document_040d4708')
            )}
          </Button>
        </div>
      </ScrollableDialogContent>
    </Dialog>
  );
}
