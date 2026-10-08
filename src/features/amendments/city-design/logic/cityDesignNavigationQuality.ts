export interface CityDesignNavigationQualityApi {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
}

/** Quality changes are infrequent; restoring quality never requires an idle animation loop. */
export function createCityDesignNavigationQuality(
  apply: (moving: boolean, pixelRatio: number) => void,
  fullPixelRatio: number,
  api: CityDesignNavigationQualityApi = {
    now: () => performance.now(),
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: handle => clearTimeout(handle),
  }
) {
  let moving = false;
  let gesture = false;
  let settling = false;
  let reduced = false;
  let disposed = false;
  let lastChange = 0;
  let previousFrame: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const samples: number[] = [];

  function scheduleRestore() {
    if (timer !== undefined) api.clearTimeout(timer);
    timer = undefined;
    if (!moving || gesture || settling || disposed) return;
    timer = api.setTimeout(
      () => {
        timer = undefined;
        if (disposed || gesture || settling) return;
        if (api.now() - lastChange < 200) {
          scheduleRestore();
          return;
        }
        moving = false;
        reduced = false;
        previousFrame = null;
        samples.length = 0;
        apply(false, fullPixelRatio);
      },
      Math.max(0, 200 - (api.now() - lastChange))
    );
  }

  return {
    cameraChanged() {
      if (disposed) return;
      lastChange = api.now();
      if (!moving) {
        moving = true;
        previousFrame = null;
        samples.length = 0;
        apply(true, Math.min(fullPixelRatio, 1));
      }
      scheduleRestore();
    },
    setGesture(active: boolean) {
      gesture = active;
      scheduleRestore();
    },
    setSettling(active: boolean) {
      settling = active;
      scheduleRestore();
    },
    recordFrame(timestamp: number) {
      if (!moving || disposed) return;
      if (previousFrame !== null && !reduced) {
        samples.push(timestamp - previousFrame);
        if (samples.length > 20) samples.shift();
        if (samples.length === 20 && samples.reduce((sum, value) => sum + value, 0) / 20 > 18) {
          reduced = true;
          apply(true, Math.min(fullPixelRatio, 0.75));
        }
      }
      previousFrame = timestamp;
    },
    get moving() {
      return moving;
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) api.clearTimeout(timer);
      timer = undefined;
    },
  };
}
