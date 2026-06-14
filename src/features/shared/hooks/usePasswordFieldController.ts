import { useState } from 'react';

export function usePasswordFieldController() {
  const [isVisible, setIsVisible] = useState(false);

  return {
    isVisible,
    onVisibilityToggle: () => setIsVisible(value => !value),
  };
}
