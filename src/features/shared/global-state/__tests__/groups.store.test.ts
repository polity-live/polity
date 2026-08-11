import { beforeEach, describe, expect, it } from 'vitest';

import { useGroupsStore } from '../groups.store';

beforeEach(() => {
  useGroupsStore.setState({ groups: [], loading: false, searchTerm: '', selectedTags: [] });
});

describe('groups store', () => {
  it('updates search and tag selection, including both toggle directions', () => {
    const store = useGroupsStore.getState();
    store.setSearchTerm('climate');
    store.setSelectedTags(['policy']);
    expect(useGroupsStore.getState()).toMatchObject({
      searchTerm: 'climate',
      selectedTags: ['policy'],
    });

    useGroupsStore.getState().toggleTag('research');
    expect(useGroupsStore.getState().selectedTags).toEqual(['policy', 'research']);
    useGroupsStore.getState().toggleTag('policy');
    expect(useGroupsStore.getState().selectedTags).toEqual(['research']);
  });

  it('loads the mock catalog', async () => {
    await useGroupsStore.getState().fetchGroups();
    expect(useGroupsStore.getState().loading).toBe(false);
    expect(useGroupsStore.getState().groups).toHaveLength(6);
  });

  it('filters by name, description, tags, and combinations of selected tags', () => {
    useGroupsStore.setState({
      groups: [
        {
          id: 1,
          name: 'Climate Council',
          members: 10,
          role: 'Member',
          description: 'Protect rivers',
          tags: ['Environment', 'Policy'],
        },
        {
          id: 2,
          name: 'Civic Lab',
          members: 5,
          role: 'Member',
          tags: ['Research'],
        },
        { id: 3, name: 'Untyped', members: 1, role: 'Member' },
      ],
    });

    expect(useGroupsStore.getState().getFilteredGroups()).toHaveLength(3);

    useGroupsStore.setState({ searchTerm: 'climate', selectedTags: [] });
    expect(
      useGroupsStore
        .getState()
        .getFilteredGroups()
        .map(group => group.id)
    ).toEqual([1]);

    useGroupsStore.setState({ searchTerm: 'rivers' });
    expect(
      useGroupsStore
        .getState()
        .getFilteredGroups()
        .map(group => group.id)
    ).toEqual([1]);

    useGroupsStore.setState({ searchTerm: 'research' });
    expect(
      useGroupsStore
        .getState()
        .getFilteredGroups()
        .map(group => group.id)
    ).toEqual([2]);

    useGroupsStore.setState({ searchTerm: '', selectedTags: ['env', 'policy'] });
    expect(
      useGroupsStore
        .getState()
        .getFilteredGroups()
        .map(group => group.id)
    ).toEqual([1]);

    useGroupsStore.setState({ searchTerm: 'missing', selectedTags: ['missing'] });
    expect(useGroupsStore.getState().getFilteredGroups()).toEqual([]);
  });

  it('returns sorted unique tags and tolerates groups without tags', () => {
    useGroupsStore.setState({
      groups: [
        { id: 1, name: 'One', members: 1, role: 'Member', tags: ['zeta', 'alpha'] },
        { id: 2, name: 'Two', members: 2, role: 'Member', tags: ['alpha'] },
        { id: 3, name: 'Three', members: 3, role: 'Member' },
      ],
    });

    expect(useGroupsStore.getState().getAllTags()).toEqual(['alpha', 'zeta']);
  });
});
