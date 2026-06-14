import * as React from 'react';

import { PlateElement } from 'platejs/react';

import { useCalloutElementController } from './useCalloutElementController';
import { CalloutElementView } from './CalloutElementView';

export function CalloutElement({
  attributes,
  children,
  className,
  ...props
}: React.ComponentProps<typeof PlateElement>) {
  const viewProps = useCalloutElementController({ attributes, children, className, ...props });

  return <CalloutElementView {...viewProps} />;
}
