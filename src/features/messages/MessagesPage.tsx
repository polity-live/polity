'use client';

import { useMessagesPage } from './hooks/useMessagesPage';
import { MessagesPageShellView } from './MessagesPageShellView';

export default function MessagesPage() {
  const mp = useMessagesPage();
  return <MessagesPageShellView mp={mp} />;
}
