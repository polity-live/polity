'use client';

import { createContext, useContext, type ReactNode } from 'react';

interface OverlayPortalBoundaryValue {
  container: HTMLElement | null;
  contained: boolean;
}

const OverlayPortalBoundaryContext = createContext<OverlayPortalBoundaryValue>({
  container: null,
  contained: false,
});

export function OverlayPortalBoundary({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <OverlayPortalBoundaryContext.Provider value={{ container, contained: Boolean(container) }}>
      {children}
    </OverlayPortalBoundaryContext.Provider>
  );
}

export function useOverlayPortalBoundary() {
  return useContext(OverlayPortalBoundaryContext);
}
