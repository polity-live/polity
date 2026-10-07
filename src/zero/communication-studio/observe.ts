interface View {
  addListener(listener: () => void): () => void;
  destroy(): void;
}

/** Coalesce subscription changes and discard reads from an obsolete session. */
export function observeStudio<T>(
  views: readonly View[],
  load: () => Promise<T>,
  next: (value: T) => void,
  failed: (error: unknown) => void
) {
  let active = true;
  let scheduled = false;
  let generation = 0;
  const refresh = () => {
    generation++;
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const attempt = generation;
      if (!active) return;
      void load()
        .then(value => {
          if (active && attempt === generation) next(value);
        })
        .catch(error => {
          if (active && attempt === generation) failed(error);
        });
    });
  };
  views.forEach(view => view.addListener(refresh));
  refresh();
  return () => {
    active = false;
    views.forEach(view => view.destroy());
  };
}
