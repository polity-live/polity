import { translate as translateText } from '@/features/shared/hooks/use-translation';
/**
 * @deprecated Mock data file for Storybook stories.
 * Shape no longer matches production types (UserProfile).
 * Stories should be updated to use zero-derived mock shapes.
 */
export const USER = {
  id: 'user-123',
  name: 'Sarah Johnson',
  firstName: 'Sarah',
  lastName: 'Johnson',
  subtitle: translateText('generated.inline.0549_constitutional_law_expert_395f8319'),
  avatar: 'https://i.pravatar.cc/150?u=sarah',
  stats: [
    { label: translateText('generated.inline.0179_amendments_90086687'), value: 143 },
    { label: translateText('generated.inline.0550_followers_78eaabf4'), value: 2.5, unit: 'k' },
    { label: translateText('generated.inline.0551_following_90eeb100'), value: 328 },
    { label: translateText('generated.inline.0552_network_53ebc572'), value: 78 },
    { label: translateText('generated.inline.0553_reputation_5f21606b'), value: 4.8 },
  ],
  socialMedia: {
    whatsapp: 'https://wa.me/123456789',
    instagram: 'https://instagram.com/sarahjohnson',
    twitter: 'https://x.com/sarahjconst',
    facebook: 'https://facebook.com/sarahjohnson',
    snapchat: 'https://snapchat.com/add/sarahjlaw',
  },
  about:
    'Political scientist specializing in comparative constitutional design. Worked on constitutional reforms in 7 countries across Europe and Africa. Passionate about democratic innovations and citizen participation.',
  contact: {
    email: 'sarah.johnson@politics.org',
    twitter: '@sarahjconst',
    website: 'sarahjohnson.policy.org',
    location: 'Brussels, Belgium',
  },
  statements: [
    {
      id: '1',
      text: "Constitutional courts should be more representative of society's diversity.",
      supportCount: 0,
      opposeCount: 0,
      commentCount: 0,
      hashtags: [{ id: 'h1', tag: 'Judiciary' }],
    },
    {
      id: '2',
      text: 'Digital democracy tools can increase citizen participation in policymaking.',
      supportCount: 0,
      opposeCount: 0,
      commentCount: 0,
      hashtags: [{ id: 'h2', tag: 'Participation' }],
    },
    {
      id: '3',
      text: 'Federalism offers the best balance between unity and autonomy.',
      supportCount: 0,
      opposeCount: 0,
      commentCount: 0,
      hashtags: [{ id: 'h3', tag: 'Structure' }],
    },
    {
      id: '4',
      text: 'Term limits are essential for preventing power concentration.',
      supportCount: 0,
      opposeCount: 0,
      commentCount: 0,
      hashtags: [{ id: 'h4', tag: 'Governance' }],
    },
  ],
  blogs: [
    {
      id: '1',
      title: translateText('generated.inline.0554_reimagining_parliamentary_oversight_da64769f'),
      date: 'Mar 15, 2023',
      commentCount: 47,
    },
    {
      id: '2',
      title: translateText('generated.inline.0555_the_case_for_citizens_assemblies_a691a9b3'),
      date: 'Feb 2, 2023',
      commentCount: 83,
    },
    {
      id: '3',
      title: translateText('generated.inline.0556_digital_constitutionalism_083250c9'),
      date: 'Jan 10, 2023',
      commentCount: 32,
    },
  ],
  groups: [
    {
      id: 1,
      name: 'Constitutional Reform Network',
      members: 1243,
      role: 'Founder',
      description: translateText(
        'generated.inline.0499_working_to_modernize_constitutional_framework_f4944394'
      ),
      tags: ['constitution', 'reform', 'policy', 'governance'],
      amendments: 8,
      events: 12,
      abbr: 'CRN',
    },
    {
      id: 2,
      name: 'Democracy Innovations Lab',
      members: 567,
      role: 'Member',
      description: translateText(
        'generated.inline.0500_researching_new_forms_of_democratic_participa_6dadc5b3'
      ),
      tags: ['democracy', 'innovation', 'research', 'participation'],
      amendments: 3,
      events: 5,
      abbr: 'DIL',
    },
    {
      id: 3,
      name: 'Judicial Independence Initiative',
      members: 389,
      role: 'Advisor',
      description: translateText(
        'generated.inline.0501_advocating_for_stronger_protections_for_court_48f037ff'
      ),
      tags: ['judiciary', 'independence', 'advocacy', 'courts'],
      amendments: 4,
      events: 2,
      abbr: 'JII',
    },
  ],
  amendments: [
    {
      id: 1,
      code: 'CON-27',
      title: translateText('generated.inline.0557_article_27_reform_proposal_b211b6d7'),
      subtitle: translateText(
        'generated.inline.0558_increasing_judicial_diversity_through_appoint_f2e6f0e5'
      ),
      status: 'Under Review',
      supporters: 1243,
      date: 'Apr 5, 2023',
      tags: ['judicial', 'diversity', 'reform', 'appointments'],
    },
    {
      id: 2,
      code: 'ELC-14',
      title: translateText('generated.inline.0559_electoral_system_amendment_eb38d14f'),
      subtitle: translateText(
        'generated.inline.0560_moving_from_first_past_the_post_to_proportion_b94d2781'
      ),
      status: 'Passed',
      supporters: 2789,
      date: 'Dec 15, 2022',
      tags: ['electoral', 'voting', 'democracy', 'representation'],
    },
    {
      id: 3,
      code: 'JUD-08',
      title: translateText('generated.inline.0561_judicial_appointment_procedure_3f121267'),
      subtitle: translateText(
        'generated.inline.0562_new_transparent_process_for_selecting_constit_646ad4de'
      ),
      status: 'Drafting',
      supporters: 342,
      date: 'May 3, 2023',
      tags: ['judiciary', 'transparency', 'selection', 'governance'],
    },
    {
      id: 4,
      code: 'TRM-52',
      title: translateText('generated.inline.0563_term_limits_for_justices_891dfce1'),
      subtitle: translateText(
        'generated.inline.0564_proposal_for_12_year_term_limits_for_supreme__34ee06ad'
      ),
      status: 'Rejected',
      supporters: 1876,
      date: 'Jan 22, 2023',
      tags: ['term-limits', 'judiciary', 'court-reform', 'accountability'],
    },
  ],
  hashtags: [
    { id: '1', tag: 'constitutional-law' },
    { id: '2', tag: 'democracy' },
    { id: '3', tag: 'judicial-reform' },
    { id: '4', tag: 'governance' },
  ],
};
