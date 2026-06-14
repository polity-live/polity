import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import type { TFunction } from 'i18next';

import { PlaceholderPlugin } from '@platejs/media/react';
import { AudioLinesIcon, FileUpIcon, FilmIcon, ImageIcon } from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { useTranslation } from 'react-i18next';
import { useFilePicker } from 'use-file-picker';

const getMediaConfig = (t: TFunction) => ({
  [KEYS.audio]: {
    accept: ['audio/*'],
    icon: <AudioLinesIcon className="size-4" />,
    title: t('plateJs.toolbar.insertAudio'),
    tooltip: t('plateJs.toolbar.audio'),
  },
  [KEYS.file]: {
    accept: ['*'],
    icon: <FileUpIcon className="size-4" />,
    title: t('plateJs.toolbar.insertFile'),
    tooltip: t('plateJs.toolbar.file'),
  },
  [KEYS.img]: {
    accept: ['image/*'],
    icon: <ImageIcon className="size-4" />,
    title: t('plateJs.toolbar.insertImage'),
    tooltip: t('plateJs.toolbar.image'),
  },
  [KEYS.video]: {
    accept: ['video/*'],
    icon: <FilmIcon className="size-4" />,
    title: t('plateJs.toolbar.insertVideo'),
    tooltip: t('plateJs.toolbar.video'),
  },
});
import { MediaToolbarButtonView } from './MediaToolbarButtonView';
export function MediaToolbarButton({
  nodeType,
  ...props
}: DropdownMenuProps & { nodeType: string }) {
  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const { t } = useTranslation();

  const MEDIA_CONFIG = React.useMemo(() => getMediaConfig(t), [t]);
  const currentConfig = MEDIA_CONFIG[nodeType as keyof typeof MEDIA_CONFIG];

  const { openFilePicker } = useFilePicker({
    accept: currentConfig.accept,
    multiple: true,
    onFilesSuccessfullySelected: ({ plainFiles: updatedFiles }: { plainFiles: File[] }) => {
      editor.getTransforms(PlaceholderPlugin).insert.media(updatedFiles as unknown as FileList);
    },
  });
  return (
    <MediaToolbarButtonView
      nodeType={nodeType}
      props={props}
      editor={editor}
      open={open}
      setOpen={setOpen}
      dialogOpen={dialogOpen}
      setDialogOpen={setDialogOpen}
      t={t}
      MEDIA_CONFIG={MEDIA_CONFIG}
      currentConfig={currentConfig}
      openFilePicker={openFilePicker}
    />
  );
}
