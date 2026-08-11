'use client';

import { useEffect, useState } from 'react';

export function AppHydrationMarker() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated ? <span hidden data-testid="app-hydration" data-state="hydrated" /> : null;
}
