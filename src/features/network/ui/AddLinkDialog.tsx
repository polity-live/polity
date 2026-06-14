/**
 * Add Link Dialog Component
 *
 * Dialog for adding a new link to the group.
 */

import { useState } from 'react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';
import { Plus } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

interface AddLinkDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { label: string; url: string }) => void;
}

export function AddLinkDialog({ isOpen, onOpenChange, onSubmit }: AddLinkDialogProps) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ label, url });
    setLabel('');
    setUrl('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0761_add_link_2cf006b1')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {translateText('generated.inline.0762_add_new_link_5122d31f')}
            </DialogTitle>
            <DialogDescription>
              {translateText('generated.inline.0763_add_a_link_to_this_group_s_resources_239da38d')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link-label">
                {translateText('generated.inline.0535_label_74341e3c')}
              </Label>
              <Input
                id="link-label"
                placeholder={translateText(
                  'generated.inline.0764_website_social_media_etc_a52f7d5f'
                )}
                value={label}
                onChange={e => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">
                {translateText('generated.inline.0028_url_0e2d9b07')}
              </Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">
              {translateText('generated.inline.0761_add_link_2cf006b1')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
