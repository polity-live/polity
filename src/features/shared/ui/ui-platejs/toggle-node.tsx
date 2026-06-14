import type { PlateElementProps } from 'platejs/react';

import { useToggleElementController } from './useToggleElementController';
import { ToggleElementView } from './ToggleElementView';

export function ToggleElement(props: PlateElementProps) {
  const viewProps = useToggleElementController(props);

  return <ToggleElementView {...viewProps} />;
}
