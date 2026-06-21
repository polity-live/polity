'use client';

import isPropValid from '@emotion/is-prop-valid';
import { lazy, Suspense, type ComponentProps } from 'react';
import type { FilerobotImageEditorConfig } from 'react-filerobot-image-editor';
import { StyleSheetManager } from 'styled-components';

import { Dialog, DialogContent, DialogTitle } from '@/features/shared/ui/ui/dialog';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useTranslation } from '@/features/shared/hooks/use-translation';

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

function cssVar(name: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildEditorTheme(): NonNullable<FilerobotImageEditorConfig['theme']> {
  const background = cssVar('--background', '#07110e');
  const card = cssVar('--card', '#101a16');
  const foreground = cssVar('--foreground', '#f4efe4');
  const primary = cssVar('--primary', '#f4efe4');
  const border = cssVar('--border', '#2b3731');
  const muted = cssVar('--muted-foreground', '#9da69f');
  const accent = cssVar('--accent', card);
  const destructive = cssVar('--destructive', '#ef4444');

  return {
    palette: {
      'bg-primary': background,
      'bg-primary-active': accent,
      'bg-secondary': card,
      'bg-stateless': card,
      'bg-active': accent,
      'bg-hover': accent,
      'accent-primary': primary,
      'accent-primary-active': primary,
      'accent-stateless': primary,
      'icon-primary': foreground,
      'icons-secondary': muted,
      'icons-muted': muted,
      'icons-placeholder': muted,
      'borders-primary': border,
      'borders-secondary': border,
      'borders-strong': primary,
      'borders-disabled': border,
      'borders-item': border,
      'txt-primary': foreground,
      'txt-secondary': muted,
      'txt-placeholder': muted,
      'btn-disabled-text': muted,
      error: destructive,
      warning: destructive,
      success: cssVar('--success', primary),
      'light-shadow': 'rgb(0 0 0 / 0.24)',
    },
    typography: {
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
  };
}

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

export function ImageEditorDialog({
  imageUrl,
  open,
  onOpenChange,
  onSave,
}: ImageEditorDialogProps) {
  const { t, language } = useTranslation();
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
          fallback={
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              {t('common.status.loading', 'Loading...')}
            </div>
          }
        >
          <StyleSheetManager shouldForwardProp={shouldForwardEditorProp}>
            <FilerobotImageEditor
              source={imageUrl}
              theme={buildEditorTheme()}
              annotationsCommon={{
                fill: cssVar('--foreground', '#f4efe4'),
                stroke: cssVar('--primary', '#f4efe4'),
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
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
