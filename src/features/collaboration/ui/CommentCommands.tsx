import { createContext, useContext } from 'react';
export const CommentCommands = createContext<{ remove: (id: string) => Promise<void> } | null>(
  null
);
export const useCommentCommands = () => useContext(CommentCommands);
