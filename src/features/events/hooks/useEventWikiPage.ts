import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/features/shared/ui/ui/sonner';
import { useAuth } from '@/providers/auth-provider';
import { useEventWikiData } from '@/zero/events/useEventState';
import { useUserState } from '@/zero/users';
import { useElectionActions } from '@/zero/elections/useElectionActions';
import { useVotingPasswordActions } from '@/zero/voting-password/useVotingPasswordActions';
import { useSubscribeEvent } from './useSubscribeEvent';
import { useEventParticipation } from './useEventParticipation';
import { computeAgendaStats } from '@/features/agendas/logic/computeAgendaStats';
import { checkEntityAccess } from '@/features/auth/logic/checkEntityAccess';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export function useEventWikiPage(eventId: string) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [electionsDialogOpen, setElectionsDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [candidacyPasswordError, setCandidacyPasswordError] = useState<string | null>(null);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);

  const { addCandidate } = useElectionActions();
  const { verifyVotingPassword } = useVotingPasswordActions();

  const subscribeData = useSubscribeEvent(eventId);
  const participationData = useEventParticipation(eventId);

  const { event, agendaItems: agendaItemRows, isLoading: eventLoading } = useEventWikiData(eventId);
  const { allUsers } = useUserState({ includeAllUsers: true });

  const currentUserProfile = user ? (allUsers || []).find(u => u.id === user.id) : null;

  // Calculate agenda statistics
  const agendaItems = useMemo(
    () => (agendaItemRows || []).filter(item => item.event?.id === eventId),
    [agendaItemRows, eventId]
  );

  const agendaStats = useMemo(() => computeAgendaStats(agendaItems), [agendaItems]);

  // Get elections for this event (flatten the one-to-many relation)
  const elections = useMemo(() => agendaItems.flatMap(item => item.election ?? []), [agendaItems]);

  type ElectionItem = (typeof elections)[number];

  const [selectedElection, setSelectedElection] = useState<ElectionItem | null>(null);

  const getUserCandidacy = useCallback(
    (election: ElectionItem) => election.candidates?.find(c => c.user?.id === user?.id),
    [user?.id]
  );

  const handleElectionClick = useCallback((election: ElectionItem) => {
    setSelectedElection(election);
    setCandidacyPasswordError(null);
    setElectionsDialogOpen(false);
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmCandidacy = useCallback(
    async (password: string) => {
      if (!user || !selectedElection) return;

      setIsSubmitting(true);
      setCandidacyPasswordError(null);
      try {
        await verifyVotingPassword(password);

        const existingCandidacy = getUserCandidacy(selectedElection);
        if (existingCandidacy) {
          toast.error(
            translateText('generated.inline.0479_sie_sind_bereits_kandidat_f_r_diese_wahl_48adad8d')
          );
          setConfirmDialogOpen(false);
          setIsSubmitting(false);
          return;
        }

        const candidateId = crypto.randomUUID();
        const maxOrder = Math.max(
          0,
          ...(selectedElection.candidates || []).map(c => c.order_index || 0)
        );

        const candidateName = currentUserProfile?.first_name || user.email || 'Unbenannt';

        await addCandidate({
          id: candidateId,
          name: candidateName,
          description: '',
          image_url: currentUserProfile?.avatar || '',
          order_index: maxOrder + 1,
          election_id: selectedElection.id as string,
          user_id: user.id,
          status: 'nominated',
        });

        toast.success(
          translateText(
            'generated.inline.0480_sie_wurden_erfolgreich_als_kandidat_hinzugef__d99fe7a6'
          )
        );
        setConfirmDialogOpen(false);
        setSelectedElection(null);
      } catch (error) {
        console.error('Failed to add candidate:', error);
        setCandidacyPasswordError(
          error instanceof Error
            ? error.message
            : translateText(
                'generated.inline.0481_fehler_beim_hinzuf_gen_des_kandidaten_bitte_v_14c00c58'
              )
        );
        toast.error(
          translateText(
            'generated.inline.0481_fehler_beim_hinzuf_gen_des_kandidaten_bitte_v_14c00c58'
          )
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      user,
      selectedElection,
      currentUserProfile,
      getUserCandidacy,
      addCandidate,
      verifyVotingPassword,
      eventId,
      event?.title,
    ]
  );

  // Visibility access check
  const canAccess = checkEntityAccess(event?.visibility, !!user, participationData.isParticipant);

  return {
    navigate,
    user,

    // Access
    canAccess,

    // Subscribe
    ...subscribeData,

    // Participation
    participation: participationData,

    // Event data
    event,
    isLoading: eventLoading,
    agendaItems,
    agendaStats,
    elections,

    // Dialog state
    electionsDialogOpen,
    setElectionsDialogOpen,
    confirmDialogOpen,
    setConfirmDialogOpen,
    selectedElection,
    isSubmitting,
    candidacyPasswordError,
    participantsDialogOpen,
    setParticipantsDialogOpen,

    // Handlers
    getUserCandidacy,
    handleElectionClick,
    handleConfirmCandidacy,
  };
}
