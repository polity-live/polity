import { useEffect, useRef } from 'react';

interface UseNewAiConversationIntentOptions {
  enabled: boolean;
  ready: boolean;
  onConsume: () => void;
  onCreate: () => void | Promise<void>;
}

export function useNewAiConversationIntent({
  enabled,
  ready,
  onConsume,
  onCreate,
}: UseNewAiConversationIntentOptions) {
  const handledRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      handledRef.current = false;
      return;
    }

    if (!ready || handledRef.current) return;

    handledRef.current = true;
    onConsume();
    void onCreate();
  }, [enabled, onConsume, onCreate, ready]);
}
