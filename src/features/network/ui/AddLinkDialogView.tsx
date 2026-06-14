import { Plus } from 'lucide-react';
import type { FormEventHandler } from 'react';

import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { FormControlInput, FormControlLabel } from '@/features/shared/ui/form';
import { ScrollableDialogContent } from '@/features/shared/ui/dialog';
import { Button } from '@/features/shared/ui/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/features/shared/ui/ui/dialog';

interface AddLinkDialogViewProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  url: string;
  onLabelChange: (label: string) => void;
  onUrlChange: (url: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function AddLinkDialogView({
  isOpen,
  onOpenChange,
  label,
  url,
  onLabelChange,
  onUrlChange,
  onSubmit,
}: AddLinkDialogViewProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          {translateText('generated.inline.0761_add_link_2cf006b1')}
        </Button>
      </DialogTrigger>
      <ScrollableDialogContent>
        <form onSubmit={onSubmit}>
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
              <FormControlLabel htmlFor="link-label">
                {translateText('generated.inline.0535_label_74341e3c')}
              </FormControlLabel>
              <FormControlInput
                id="link-label"
                placeholder={translateText(
                  'generated.inline.0764_website_social_media_etc_a52f7d5f'
                )}
                value={label}
                onChange={event => onLabelChange(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <FormControlLabel htmlFor="link-url">
                {translateText('generated.inline.0028_url_0e2d9b07')}
              </FormControlLabel>
              <FormControlInput
                id="link-url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={event => onUrlChange(event.target.value)}
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
      </ScrollableDialogContent>
    </Dialog>
  );
}
