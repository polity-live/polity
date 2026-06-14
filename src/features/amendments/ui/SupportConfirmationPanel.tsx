'use client';

/**
 * SupportConfirmationPanel Component
 *
 * Displays pending support confirmations for a group and allows
 * group admins to confirm or decline continued support.
 */

interface SupportConfirmationPanelProps {
  groupId: string;
}
import { useSupportConfirmationPanelController } from './useSupportConfirmationPanelController';
import { SupportConfirmationPanelView } from './SupportConfirmationPanelView';

export function SupportConfirmationPanel({ groupId }: SupportConfirmationPanelProps) {
  const viewProps = useSupportConfirmationPanelController({ groupId });

  return <SupportConfirmationPanelView {...viewProps} />;
}
