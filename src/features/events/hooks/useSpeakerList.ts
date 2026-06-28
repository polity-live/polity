import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useAgendaActions } from '@/zero/agendas/useAgendaActions';
import { usePermissions } from '@/zero/rbac';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { canJoinEventSpeakerList } from '@/features/agendas/logic/speakerListPermissions';
import { waitForClientApply } from '@/zero/mutate-with-server-check';

export function useSpeakerList(agendaItemId?: string, eventId?: string) {
  const { user } = useAuth();
  const { can } = usePermissions({ eventId });
  const { addSpeaker, removeSpeaker } = useAgendaActions();
  const [addingSpeaker, setAddingSpeaker] = useState(false);
  const [removingSpeaker, setRemovingSpeaker] = useState<string | null>(null);
  const canJoinSpeakerList = eventId ? canJoinEventSpeakerList(can) : true;

  const handleAddToSpeakerList = async (speakerList: { order?: number }[] = []) => {
    if (!user?.id || !agendaItemId || !canJoinSpeakerList) return;

    setAddingSpeaker(true);
    try {
      const maxOrder = speakerList.length > 0 ? Math.max(...speakerList.map(s => s.order || 0)) : 0;

      const speakerId = crypto.randomUUID();
      await waitForClientApply(
        addSpeaker({
          id: speakerId,
          title: translateText('generated.inline.0001_speaker_7c23b0d9'),
          time: 3,
          completed: false,
          order_index: maxOrder + 1,
          user_id: user.id,
          agenda_item_id: agendaItemId,
          start_time: null,
          end_time: null,
        })
      );
    } catch (error) {
      console.error('Error adding to speaker list:', error);
      throw error;
    } finally {
      setAddingSpeaker(false);
    }
  };

  const handleRemoveFromSpeakerList = async (speakerId: string) => {
    if (!user?.id) return;

    setRemovingSpeaker(speakerId);
    try {
      await waitForClientApply(removeSpeaker(speakerId));
    } catch (error) {
      console.error('Error removing from speaker list:', error);
      throw error;
    } finally {
      setRemovingSpeaker(null);
    }
  };

  return {
    handleAddToSpeakerList,
    handleRemoveFromSpeakerList,
    canJoinSpeakerList,
    addingSpeaker,
    removingSpeaker,
  };
}
