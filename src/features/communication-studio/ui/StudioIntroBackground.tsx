import { useEffect, useRef, useState } from 'react';
import { Image as CanvasImage } from 'react-konva';
import type Konva from 'konva';
import type { FrameNode } from '../logic/document-v3';
import { activePalette, type StudioThemeSnapshot } from '../logic/theme';
import { frameIntro } from '../logic/event-intro';
import { createIntroPlayer } from '../logic/event-intro-player';

export function StudioIntroBackground({
  frame,
  theme,
  url,
  animate,
  clockOffset = 0,
}: {
  frame: FrameNode;
  theme: StudioThemeSnapshot;
  url?: string;
  animate: boolean;
  clockOffset?: number;
}) {
  const node = useRef<Konva.Image>(null);
  const [image, setImage] = useState<HTMLCanvasElement>();
  const clock = useRef(clockOffset);
  clock.current = clockOffset;
  const intro = frameIntro(frame);
  const { width, height } = frame.transform;
  const paletteKey = JSON.stringify(activePalette(theme));
  const mode = intro?.mode,
    scene = intro?.scene,
    intensity = intro?.intensity,
    epochMs = intro?.epochMs,
    snapshotAt = intro?.snapshotAt;
  useEffect(() => {
    if (!mode || mode === 'static') {
      setImage(undefined);
      return;
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1920 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    setImage(canvas);
    return createIntroPlayer(
      canvas,
      {
        mode,
        scene,
        assetId: null,
        // frameIntro returns a schema-validated intro or the complete default intro.
        intensity: intensity as number,
        epochMs,
        snapshotAt: animate ? snapshotAt : (epochMs ?? 0),
      },
      theme,
      url,
      () => Date.now() + clock.current,
      () => node.current?.getLayer()?.batchDraw()
    );
    // Theme projections clone the document once per second; only actual palette changes rebuild the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scene, intensity, epochMs, snapshotAt, width, height, url, paletteKey, animate]);
  if (!image) return null;
  return <CanvasImage ref={node} image={image} width={width} height={height} listening={false} />;
}
