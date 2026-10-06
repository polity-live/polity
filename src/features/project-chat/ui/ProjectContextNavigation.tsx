import { createContext, useContext } from 'react';
import type { ProjectContextReference } from '../logic/context-references';
import type { EditorContext } from '../logic/contracts';

export type ActivateProjectContext = (
  reference: ProjectContextReference,
  sourceContext?: EditorContext
) => void;
export const ProjectContextNavigation = createContext<ActivateProjectContext | undefined>(
  undefined
);
export const useProjectContextNavigation = () => useContext(ProjectContextNavigation);
