import { createContext, type ReactNode, useContext } from 'react';

export type SurfaceMode = 'auto' | 'standalone' | 'embedded';
export type ResolvedSurfaceMode = Exclude<SurfaceMode, 'auto'>;

const SurfaceDepthContext = createContext(0);

export function SurfaceLayerProvider({ children }: { children: ReactNode }) {
  const depth = useContext(SurfaceDepthContext);

  return <SurfaceDepthContext.Provider value={depth + 1}>{children}</SurfaceDepthContext.Provider>;
}

export function useResolvedSurfaceMode(surface: SurfaceMode = 'auto'): ResolvedSurfaceMode {
  const depth = useContext(SurfaceDepthContext);

  if (surface !== 'auto') {
    return surface;
  }

  return depth > 0 ? 'embedded' : 'standalone';
}
