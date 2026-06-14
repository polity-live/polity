import type { PlateElementProps } from 'platejs/react';
import { useTocElementController } from './useTocElementController';
import { TocElementView } from './TocElementView';

export function TocElement(props: PlateElementProps) {
  const viewProps = useTocElementController(props);

  return <TocElementView {...viewProps} />;
}
