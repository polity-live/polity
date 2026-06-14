/**
 * Create Document Dialog Component
 *
 * Dialog for creating a new document in a group.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { Plus, Loader2 } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface CreateDocumentDialogProps {
  groupId: string;
  groupName?: string;
  onCreateDocument: (title: string) => Promise<void>;
  isCreating?: boolean;
}

export function CreateDocumentDialog({
  groupName,
  onCreateDocument,
  isCreating = false,
}: CreateDocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) return;

    await onCreateDocument(title);
    setTitle('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isCreating) {
      handleCreate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0404_new_document_e69f5da6')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translateText('generated.inline.0405_create_new_document_07d90501')}
          </DialogTitle>
          <DialogDescription>
            {translateText('generated.inline.0406_enter_a_title_for_your_new_document_749e9123')}
            {groupName
              ? translateText('generated.inline.0051_in_groupname_bd500208', {
                  groupName: groupName,
                })
              : ''}
            .
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              {translateText('generated.inline.0407_document_title_73ee9605')}
            </Label>
            <Input
              id="title"
              placeholder={translateText('generated.inline.0408_my_document_3916ed57')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              autoFocus
            />
          </div>
          <Button onClick={handleCreate} className="w-full" disabled={isCreating || !title.trim()}>
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
      </DialogContent>
    </Dialog>
  );
}
