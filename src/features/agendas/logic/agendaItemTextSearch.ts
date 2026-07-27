import { getAppTutorialElectionCopy } from '@/features/app-tutorial/amendment-fixture';
import { resolveAppTutorialFixtureText } from '@/features/app-tutorial/fixture-copy';

export function agendaItemTextMatchesSearch({
  title,
  description,
  isTutorialElection,
  tutorialRunId,
  language,
  loweredSearchQuery,
}: {
  title?: string | null;
  description?: string | null;
  isTutorialElection: boolean;
  tutorialRunId?: string | null;
  language?: string;
  loweredSearchQuery: string;
}) {
  if (loweredSearchQuery.length === 0) return true;

  const tutorialCopy = getAppTutorialElectionCopy(language);
  const fixtureLanguage = language === 'en' ? 'en' : 'de';
  const searchableTitle = isTutorialElection
    ? tutorialCopy.agendaTitle
    : resolveAppTutorialFixtureText(title, { tutorialRunId, language: fixtureLanguage });
  const searchableDescription = isTutorialElection
    ? tutorialCopy.agendaDescription
    : resolveAppTutorialFixtureText(description, { tutorialRunId, language: fixtureLanguage });

  return Boolean(
    searchableTitle?.toLowerCase().includes(loweredSearchQuery) ||
    searchableDescription?.toLowerCase().includes(loweredSearchQuery)
  );
}
