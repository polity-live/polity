import { useImagePreview, useImagePreviewValue } from '@platejs/media/react';
import { useEditorRef } from 'platejs/react';
const SCROLL_SPEED = 4;
import { MediaPreviewDialogView } from './MediaPreviewDialogView';
export function MediaPreviewDialog() {
  const editor = useEditorRef();
  const isOpen = useImagePreviewValue('isOpen', editor.id);
  const scale = useImagePreviewValue('scale');
  const isEditingScale = useImagePreviewValue('isEditingScale');
  const {
    closeProps,
    currentUrlIndex,
    maskLayerProps,
    nextDisabled,
    nextProps,
    prevDisabled,
    prevProps,
    scaleTextProps,
    zommOutProps,
    zoomInDisabled,
    zoomInProps,
    zoomOutDisabled,
  } = useImagePreview({ scrollSpeed: SCROLL_SPEED });
  return (
    <MediaPreviewDialogView
      editor={editor}
      isOpen={isOpen}
      scale={scale}
      isEditingScale={isEditingScale}
      closeProps={closeProps}
      currentUrlIndex={currentUrlIndex}
      maskLayerProps={maskLayerProps}
      nextDisabled={nextDisabled}
      nextProps={nextProps}
      prevDisabled={prevDisabled}
      prevProps={prevProps}
      scaleTextProps={scaleTextProps}
      zommOutProps={zommOutProps}
      zoomInDisabled={zoomInDisabled}
      zoomInProps={zoomInProps}
      zoomOutDisabled={zoomOutDisabled}
    />
  );
}
