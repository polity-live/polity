import * as React from 'react';
import { LinkIcon } from 'lucide-react';
import { isUrl, KEYS } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/shared/ui/ui/alert-dialog.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/shared/ui/ui/dropdown-menu.tsx';
import { Input } from '@/features/shared/ui/ui/input.tsx';

import {
  ToolbarSplitButton,
  ToolbarSplitButtonPrimary,
  ToolbarSplitButtonSecondary,
} from '@/features/shared/ui/layout';

interface MediaConfigItem {
  accept: string[];
  icon: React.ReactNode;
  title: string;
  tooltip: string;
}

function MediaUrlDialogContent({
  currentConfig,
  nodeType,
  setOpen,
}: {
  currentConfig: MediaConfigItem;
  nodeType: string;
  setOpen: (value: boolean) => void;
}) {
  const editor = useEditorRef();
  const [url, setUrl] = React.useState('');
  const { t } = useTranslation();

  const embedMedia = React.useCallback(() => {
    if (!isUrl(url)) return toast.error(t('plateJs.errors.invalidUrl'));

    setOpen(false);
    editor.tf.insertNodes({
      children: [{ text: '' }],
      name: nodeType === KEYS.file ? url.split('/').pop() : undefined,
      type: nodeType,
      url,
    });
  }, [url, editor, nodeType, setOpen]);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{currentConfig.title}</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogDescription className="group relative w-full">
        <label
          className="text-muted-foreground/70 group-focus-within:text-foreground has-[+input:not(:placeholder-shown)]:text-foreground absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-sm transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium"
          htmlFor="url"
        >
          <span className="bg-background inline-flex px-2">{t('plateJs.toolbar.url', 'URL')}</span>
        </label>
        <Input
          id="url"
          className="w-full"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') embedMedia();
          }}
          placeholder=""
          type="url"
          autoFocus
        />
      </AlertDialogDescription>{' '}
      <AlertDialogFooter>
        <AlertDialogCancel>{t('plateJs.toolbar.cancel')}</AlertDialogCancel>
        <AlertDialogAction
          onClick={e => {
            e.preventDefault();
            embedMedia();
          }}
        >
          {t('plateJs.toolbar.accept')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

export interface MediaToolbarButtonViewProps {
  nodeType: any;
  props: any;
  editor: any;
  open: any;
  setOpen: any;
  dialogOpen: any;
  setDialogOpen: any;
  t: any;
  MEDIA_CONFIG: any;
  currentConfig: MediaConfigItem;
  openFilePicker: any;
}

export function MediaToolbarButtonView({
  nodeType,
  props,
  open,
  setOpen,
  dialogOpen,
  setDialogOpen,
  t,
  currentConfig,
  openFilePicker,
}: MediaToolbarButtonViewProps) {
  return (
    <>
      <ToolbarSplitButton
        onClick={() => {
          openFilePicker();
        }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        pressed={open}
      >
        <ToolbarSplitButtonPrimary>{currentConfig.icon}</ToolbarSplitButtonPrimary>

        <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
          <DropdownMenuTrigger asChild>
            <ToolbarSplitButtonSecondary />
          </DropdownMenuTrigger>

          <DropdownMenuContent onClick={e => e.stopPropagation()} align="start" alignOffset={-32}>
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => openFilePicker()}>
                {currentConfig.icon}
                {t('plateJs.toolbar.uploadFromComputer')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
                <LinkIcon />
                {t('plateJs.toolbar.insertViaURL')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarSplitButton>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={value => {
          setDialogOpen(value);
        }}
      >
        <AlertDialogContent className="gap-6">
          <MediaUrlDialogContent
            currentConfig={currentConfig}
            nodeType={nodeType}
            setOpen={setDialogOpen}
          />
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
