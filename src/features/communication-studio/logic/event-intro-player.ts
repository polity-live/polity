import type { FrameNode } from './document-v3';
import type { StudioThemeSnapshot } from './theme';
import { createSpatialIntro, paintIntroWash } from './event-intro-renderer';
import { introElapsed } from './event-intro';

/** One bounded animation loop; no React updates or document writes per video frame. */
export function createIntroPlayer(
  canvas: HTMLCanvasElement,
  intro: NonNullable<FrameNode['intro']>,
  theme: StudioThemeSnapshot,
  videoUrl: string | undefined,
  now: () => number,
  redraw: () => void
) {
  const ctx = canvas.getContext('2d');
  if (!ctx)
    return () => {
      /* No renderer was allocated. */
    };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scene: ReturnType<typeof createSpatialIntro> | undefined;
  let video: HTMLVideoElement | undefined;
  let raf = 0,
    disposed = false,
    lastDraw = -Infinity,
    lastSync = -Infinity,
    failed = false;
  const still = () => motion.matches || intro.snapshotAt !== undefined;
  const draw = () => {
    if (disposed) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!failed && scene) {
      try {
        if (scene.render(motion.matches ? 0 : introElapsed(intro, now()), intro.intensity))
          ctx.drawImage(scene.canvas, 0, 0, canvas.width, canvas.height);
      } catch {
        failed = true;
      }
    }
    if (!failed && video && video.readyState >= 2) {
      const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      ctx.drawImage(
        video,
        (canvas.width - video.videoWidth * scale) / 2,
        (canvas.height - video.videoHeight * scale) / 2,
        video.videoWidth * scale,
        video.videoHeight * scale
      );
    }
    paintIntroWash(ctx, canvas.width, canvas.height, theme, intro.scene);
    redraw();
  };
  const seekVideo = () => {
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const elapsed = motion.matches ? 0 : introElapsed(intro, now()) / 1000;
    video.currentTime = ((elapsed % video.duration) + video.duration) % video.duration;
  };
  const tick = (time: number) => {
    if (disposed || document.hidden || still()) return;
    if (time - lastDraw >= 1000 / 30) {
      lastDraw = time;
      if (
        video &&
        time - lastSync >= 2000 &&
        Number.isFinite(video.duration) &&
        video.duration > 0
      ) {
        lastSync = time;
        const elapsed = introElapsed(intro, now()) / 1000;
        const target = ((elapsed % video.duration) + video.duration) % video.duration;
        const distance = Math.abs(video.currentTime - target);
        if (Math.min(distance, video.duration - distance) > 0.35) seekVideo();
      }
      draw();
    }
    raf = requestAnimationFrame(tick);
  };
  const resume = () => {
    cancelAnimationFrame(raf);
    if (document.hidden) {
      video?.pause();
      return;
    }
    seekVideo();
    if (video && !still() && !failed)
      void video
        .play()
        .then(() => {
          if (disposed || document.hidden || still()) video?.pause();
        })
        .catch(() => {
          failed = true;
          draw();
        });
    else video?.pause();
    draw();
    if (!still()) raf = requestAnimationFrame(tick);
  };
  if (intro.mode === 'spatial') {
    try {
      scene = createSpatialIntro(canvas.width, canvas.height, theme, intro.scene);
    } catch {
      failed = true;
    }
  } else if (intro.mode === 'video' && videoUrl) {
    video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.preload = 'auto';
    video.onloadeddata = resume;
    video.onseeked = draw;
    video.onerror = () => {
      failed = true;
      video?.pause();
      draw();
    };
    video.src = videoUrl;
  }
  document.addEventListener('visibilitychange', resume);
  motion.addEventListener('change', resume);
  resume();
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', resume);
    motion.removeEventListener('change', resume);
    scene?.dispose();
    if (video) {
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  };
}
