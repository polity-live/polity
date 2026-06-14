import { PlateElement } from 'platejs/react';
export interface LinkElementViewProps {
  props: any;
  linkProps: any;
}

export function LinkElementView({ props, linkProps }: LinkElementViewProps) {
  return (
    <PlateElement
      {...props}
      as="a"
      className="text-primary decoration-primary font-medium underline underline-offset-4"
      attributes={{
        ...props.attributes,
        ...(linkProps as Record<string, unknown>),
      }}
    >
      {props.children}
    </PlateElement>
  );
}
