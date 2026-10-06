import { createContext, useContext } from 'react';
export const AiEditorTraceContext = createContext<string | undefined>(undefined);
export const useAiEditorDocumentId = () => useContext(AiEditorTraceContext);
