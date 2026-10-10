import { createContext, useContext } from 'react';

/** The shell owns navigation data; layout-only consumers share its resolved visibility. */
export const SecondaryNavigationVisibleContext = createContext(false);

export function useSecondaryNavigationVisible() {
  return useContext(SecondaryNavigationVisibleContext);
}
