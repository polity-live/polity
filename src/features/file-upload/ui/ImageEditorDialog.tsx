'use client';

import isPropValid from '@emotion/is-prop-valid';
import { lazy, Suspense, useRef, type ComponentProps } from 'react';
import type { FilerobotImageEditorConfig } from 'react-filerobot-image-editor';
import { StyleSheetManager } from 'styled-components';

import { Dialog, DialogContent, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { Skeleton } from '@/features/shared/ui/ui/skeleton';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { buildEditorTheme, ImageEditorVendorStyles, readEditorCssVar } from './ImageEditorTheme';
import { ImageEditorTooltipBridge } from './ImageEditorTooltipBridge';

type SavedImageData = Parameters<NonNullable<FilerobotImageEditorConfig['onSave']>>[0];
type DialogContentProps = ComponentProps<typeof DialogContent>;
type DialogOutsideInteractionEvent =
  | Parameters<NonNullable<DialogContentProps['onInteractOutside']>>[0]
  | Parameters<NonNullable<DialogContentProps['onPointerDownOutside']>>[0]
  | Parameters<NonNullable<DialogContentProps['onFocusOutside']>>[0];

const FilerobotImageEditor = lazy(() => import('react-filerobot-image-editor'));

const shouldForwardEditorProp = (propName: string, target: unknown) =>
  typeof target === 'string' ? isPropValid(propName) : true;

const FILEROBOT_PORTAL_SELECTOR = [
  '#SfxPopper',
  '#SfxPopup',
  '#SfxModal',
  '#SfxDrawer',
  '.SfxPopper-wrapper',
  '.SfxPopper-root',
  '.SfxMenu-root',
  '.SfxPopup-root',
  '.SfxModal-root',
  '.SfxDrawer-root',
  '[data-tippy-root]',
].join(',');

function isFilerobotPortalTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(FILEROBOT_PORTAL_SELECTOR));
}

function keepFilerobotPortalInteraction(event: DialogOutsideInteractionEvent) {
  if (isFilerobotPortalTarget(event.detail.originalEvent.target)) {
    event.preventDefault();
  }
}

interface ImageEditorDialogProps {
  imageUrl?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (file: File) => Promise<boolean>;
}

const TARGET_LAYOUT_TRANSLATIONS = {
  polityTargets: 'Target layouts',
  targetLayouts: 'Recommended crops',
  avatarSquare: 'Avatar 1:1',
  avatarSquareDescription: '512 x 512',
  profileCover: 'User profile cover',
  profileCoverDescription: '1024 x 256',
  groupCover: 'Group cover',
  groupCoverDescription: '1024 x 256',
  amendmentCover: 'Amendment image',
  amendmentCoverDescription: '1024 x 256',
  storyPortrait: 'Story portrait',
  storyPortraitDescription: '1080 x 1920',
};

function dataUrlToBlob(dataUrl: string) {
  return fetch(dataUrl).then(response => response.blob());
}

async function savedImageDataToFile(imageData: SavedImageData) {
  const mimeType = imageData.mimeType || 'image/png';
  const extension = imageData.extension || mimeType.split('/')[1] || 'png';
  const fileName = imageData.fullName || `${imageData.name || 'edited-image'}.${extension}`;
  let blob: Blob | null = null;

  if (imageData.imageCanvas) {
    blob = await new Promise<Blob | null>(resolve => {
      imageData.imageCanvas?.toBlob(resolve, mimeType, imageData.quality ?? 0.92);
    });
  }

  if (!blob && imageData.imageBase64) {
    blob = await dataUrlToBlob(imageData.imageBase64);
  }

  if (!blob) {
    throw new Error('The editor did not return image data.');
  }

  return new File([blob], fileName, { type: mimeType });
}

function ImageEditorLoadingSkeleton({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="bg-background flex h-full min-h-dvh flex-col"
      data-slot="image-editor-loading-skeleton"
    >
      <span className="sr-only">{label}</span>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[64px_minmax(0,1fr)] md:grid-cols-[76px_minmax(0,1fr)_260px]">
        <div className="flex flex-col gap-3 border-r p-3">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="aspect-square rounded-md" />
          ))}
        </div>
        <div className="bg-muted/20 flex min-w-0 flex-col p-4">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Skeleton className="h-full max-h-[70dvh] w-full max-w-4xl rounded-lg" />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <Skeleton className="h-2 w-36 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        </div>
        <div className="hidden border-l p-4 md:block">
          <div className="space-y-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 rounded-md" />
              <Skeleton className="h-9 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImageEditorDialog({
  imageUrl,
  open,
  onOpenChange,
  onSave,
}: ImageEditorDialogProps) {
  const { t, language } = useTranslation();
  const editorHostRef = useRef<HTMLDivElement>(null);
  const previewPixelRatio =
    typeof window === 'undefined' ? 1 : Math.max(window.devicePixelRatio || 1, 1);

  if (!imageUrl) return null;

  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-background !fixed !inset-0 !top-0 !left-0 !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-hidden !rounded-none !border-0 !p-0"
        onFocusOutside={keepFilerobotPortalInteraction}
        onInteractOutside={keepFilerobotPortalInteraction}
        onPointerDownOutside={keepFilerobotPortalInteraction}
        showCloseButton={false}
        style={{
          inset: 0,
          width: '100vw',
          maxWidth: 'none',
          height: '100dvh',
          maxHeight: '100dvh',
          transform: 'none',
        }}
      >
        <DialogTitle className="sr-only">{t('common.actions.edit', 'Edit image')}</DialogTitle>
        <Suspense
          fallback={<ImageEditorLoadingSkeleton label={t('common.status.loading', 'Loading...')} />}
        >
          <div ref={editorHostRef} className="h-full w-full">
            <StyleSheetManager shouldForwardProp={shouldForwardEditorProp}>
              <ImageEditorVendorStyles />
              <FilerobotImageEditor
                source={imageUrl}
                theme={buildEditorTheme()}
                annotationsCommon={{
                  fill: readEditorCssVar('--foreground', '#17201c'),
                  stroke: readEditorCssVar('--primary', '#12362d'),
                }}
                Crop={{
                  autoResize: true,
                  presetsFolders: [
                    {
                      titleKey: 'polityTargets',
                      groups: [
                        {
                          titleKey: 'targetLayouts',
                          items: [
                            {
                              titleKey: 'avatarSquare',
                              descriptionKey: 'avatarSquareDescription',
                              width: 512,
                              height: 512,
                              ratio: 1,
                            },
                            {
                              titleKey: 'profileCover',
                              descriptionKey: 'profileCoverDescription',
                              width: 1024,
                              height: 256,
                              ratio: 4,
                            },
                            {
                              titleKey: 'groupCover',
                              descriptionKey: 'groupCoverDescription',
                              width: 1024,
                              height: 256,
                              ratio: 4,
                            },
                            {
                              titleKey: 'amendmentCover',
                              descriptionKey: 'amendmentCoverDescription',
                              width: 1024,
                              height: 256,
                              ratio: 4,
                            },
                            {
                              titleKey: 'storyPortrait',
                              descriptionKey: 'storyPortraitDescription',
                              width: 1080,
                              height: 1920,
                              ratio: 9 / 16,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                }}
                defaultTabId="Adjust"
                defaultToolId="Crop"
                defaultSavedImageType="png"
                defaultSavedImageQuality={0.92}
                translations={TARGET_LAYOUT_TRANSLATIONS}
                language={language}
                savingPixelRatio={2}
                previewPixelRatio={previewPixelRatio}
                closeAfterSave={false}
                onBeforeSave={() => false}
                onClose={() => onOpenChange(false)}
                onSave={async imageData => {
                  try {
                    const editedFile = await savedImageDataToFile(imageData);
                    const success = await onSave(editedFile);
                    if (success) onOpenChange(false);
                  } catch (error) {
                    console.error('Image editor save error:', error);
                    toast.error(t('common.actions.uploadImageFailed'));
                  }
                }}
              />
            </StyleSheetManager>
            <ImageEditorTooltipBridge hostRef={editorHostRef} />
          </div>
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
