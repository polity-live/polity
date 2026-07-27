import { describe, expect, it } from 'vitest';

import { translateWithLanguage } from '@/features/shared/hooks/use-translation';
import { localizeNotificationCopy } from '../localizeNotificationCopy';

const titleKey = 'generated.inline.0201_group_invitation_3afe15fe';
const messageKey = 'generated.inline.0202_you_ve_been_invited_to_join_groupname_c44a7ef2';

describe('localizeNotificationCopy', () => {
  it('re-localizes fixed system copy for the recipient language', () => {
    const english = translateWithLanguage('en', titleKey);

    expect(localizeNotificationCopy(english, 'de')).toBe(translateWithLanguage('de', titleKey));
  });

  it('retains interpolation parameters while changing language', () => {
    const params = { groupName: 'Kiezrat' };
    const english = translateWithLanguage('en', messageKey, params);

    expect(localizeNotificationCopy(english, 'de')).toBe(
      translateWithLanguage('de', messageKey, params)
    );
  });

  it('does not modify user-authored copy', () => {
    expect(localizeNotificationCopy('Eigener Titel', 'en')).toBe('Eigener Titel');
  });
});
