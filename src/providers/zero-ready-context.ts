import { createContext, useContext } from 'react';

export const ZeroReadyContext = createContext(false);

export function useZeroReady() {
  return useContext(ZeroReadyContext);
}
