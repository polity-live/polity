'use client';

import { useVersionControlModel, type VersionControlProps } from '../hooks/useVersionControlModel';
import { VersionControlView } from './VersionControlView';

export function VersionControl(props: VersionControlProps) {
  const model = useVersionControlModel(props);

  return <VersionControlView model={model} />;
}
