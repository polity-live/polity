import { create } from 'zustand';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

/** Local mock group type for the zustand store — not derived from zero */
interface MockGroup {
  id: number;
  name: string;
  members: number;
  role: string;
  description?: string;
  tags?: string[];
  amendments?: number;
  events?: number;
  abbr?: string;
}

// Mock data for groups - in a real app this would come from an API
const MOCK_GROUPS: MockGroup[] = [
  {
    id: 1,
    name: 'Constitutional Reform Network',
    members: 1243,
    role: 'Member',
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
    role: 'Member',
    description: translateText(
      'generated.inline.0501_advocating_for_stronger_protections_for_court_48f037ff'
    ),
    tags: ['judiciary', 'independence', 'advocacy', 'courts'],
    amendments: 4,
    events: 2,
    abbr: 'JII',
  },
  {
    id: 4,
    name: 'Climate Action Coalition',
    members: 2156,
    role: 'Member',
    description: translateText(
      'generated.inline.0502_pushing_for_immediate_climate_policy_reforms_d21eecd6'
    ),
    tags: ['climate', 'environment', 'sustainability', 'policy'],
    amendments: 15,
    events: 23,
    abbr: 'CAC',
  },
  {
    id: 5,
    name: 'Digital Rights Forum',
    members: 892,
    role: 'Member',
    description: translateText(
      'generated.inline.0503_protecting_digital_privacy_and_freedom_online_000c617c'
    ),
    tags: ['digital', 'privacy', 'technology', 'rights'],
    amendments: 6,
    events: 8,
    abbr: 'DRF',
  },
  {
    id: 6,
    name: 'Education Reform Alliance',
    members: 1445,
    role: 'Member',
    description: translateText(
      'generated.inline.0504_advocating_for_modern_education_systems_f6e2472b'
    ),
    tags: ['education', 'reform', 'schools', 'policy'],
    amendments: 9,
    events: 14,
    abbr: 'ERA',
  },
];

interface GroupsState {
  groups: MockGroup[];
  loading: boolean;
  searchTerm: string;
  selectedTags: string[];

  // Actions
  setSearchTerm: (term: string) => void;
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  fetchGroups: () => Promise<void>;
  getFilteredGroups: () => MockGroup[];
  getAllTags: () => string[];
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  loading: false,
  searchTerm: '',
  selectedTags: [],

  setSearchTerm: (term: string) => set({ searchTerm: term }),

  setSelectedTags: (tags: string[]) => set({ selectedTags: tags }),

  toggleTag: (tag: string) => {
    const { selectedTags } = get();
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    set({ selectedTags: newTags });
  },

  fetchGroups: async () => {
    set({ loading: true });
    set({ groups: MOCK_GROUPS, loading: false });
  },

  getFilteredGroups: () => {
    const { groups, searchTerm, selectedTags } = get();

    return groups.filter(group => {
      // Filter by search term
      const matchesSearch =
        searchTerm === '' ||
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.tags?.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      // Filter by selected tags
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every(selectedTag =>
          group.tags?.some((groupTag: string) =>
            groupTag.toLowerCase().includes(selectedTag.toLowerCase())
          )
        );

      return matchesSearch && matchesTags;
    });
  },

  getAllTags: () => {
    const { groups } = get();
    const allTags = groups.flatMap(group => group.tags || []);
    return [...new Set(allTags)].sort();
  },
}));
