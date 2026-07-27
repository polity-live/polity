import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

// TanStack Router navigate function type
type NavigateFn = (opts: { to: string }) => void;

// This function factory creates navigation items with router integration
export const navItemsAuthenticated = (
  navigate: NavigateFn,
  t?: (key: string) => string // Optional translation function
) => {
  const translate = t ?? translateText;
  const navigatePrimary = (to: string) => {
    const performNavigation = () => navigate({ to });
    if (typeof window === 'undefined') {
      performNavigation();
    } else {
      window.setTimeout(performNavigation, 0);
    }
  };
  // Note: useTranslation() hook removed to fix hook order issues
  // Using static strings temporarily until i18n is properly configured
  // Translation function can be passed as parameter for i18n support

  // Define navigation items for primary navigation with Next.js router integration
  const primaryNavItems: NavigationItem[] = [
    {
      id: 'home',
      label: translateText('generated.inline.0186_home_70f8bb9a'),
      icon: 'Home',
      href: '/home',
      onClick: () => {
        navigatePrimary('/home');
      },
    },
    {
      id: 'messages',
      label: translateText('generated.inline.0187_messages_f1702b46'),
      icon: 'MessageSquare',
      href: '/messages',
      onClick: () => {
        navigatePrimary('/messages');
      },
    },
    {
      id: 'search',
      label: translateText('generated.inline.0188_search_bce06414'),
      icon: 'Search',
      href: '/search',
      onClick: () => {
        navigatePrimary('/search');
      },
    },
    {
      id: 'create',
      label: translateText('generated.inline.0189_create_6e157c5d'),
      icon: 'PlusCircle',
      href: '/create',
      onClick: () => {
        navigatePrimary('/create');
      },
    },

    {
      id: 'calendar',
      label: translateText('generated.inline.0190_calendar_adab5090'),
      icon: 'Calendar',
      href: '/calendar',
      onClick: () => {
        navigatePrimary('/calendar');
      },
    },
    {
      id: 'todos',
      label: translateText('generated.inline.0180_todos_a4114a83'),
      icon: 'CheckSquare',
      href: '/todos',
      onClick: () => {
        navigatePrimary('/todos');
      },
    },
    {
      id: 'notifications',
      label: translateText('generated.inline.0191_notifications_753a22b2'),
      icon: 'Bell',
      href: '/notifications',
      onClick: () => {
        navigatePrimary('/notifications');
      },
    },
  ];
  // Define route-specific secondary navigation items
  const projectSecondaryNavItems: NavigationItem[] = [
    {
      id: 'tasks',
      label: translate('navigation.secondary.projects.tasks'),
      icon: 'File',
      href: '/projects/tasks',
      onClick: () => navigate({ to: '/projects/tasks' }),
    },
    {
      id: 'tests',
      label: translate('navigation.secondary.projects.tests'),
      icon: 'FolderOpen',
      href: '/projects/tests',
      onClick: () => navigate({ to: '/projects/tests' }),
    },
  ];

  // Function to create event secondary navigation items for a specific event
  const getEventSecondaryNavItems = (
    eventId: string,
    isAdmin = false,
    canViewNotifications = false
  ): NavigationItem[] => {
    const items: NavigationItem[] = [
      {
        id: 'overview',
        label: translate('navigation.secondary.event.overview'),
        icon: 'FileText',
        href: `/event/${eventId}`,
        onClick: () => navigate({ to: `/event/${eventId}` }),
      },
      {
        id: 'agenda',
        label: translate('navigation.secondary.event.agenda'),
        icon: 'Calendar',
        href: `/event/${eventId}/agenda`,
        onClick: () => navigate({ to: `/event/${eventId}/agenda` }),
      },
      {
        id: 'network',
        label: translate('navigation.secondary.event.network'),
        icon: 'Network',
        href: `/event/${eventId}/network`,
        onClick: () => navigate({ to: `/event/${eventId}/network` }),
      },
    ];

    // Only add participants and edit items if user is admin
    if (isAdmin) {
      items.push({
        id: 'participants',
        label: translate('navigation.secondary.event.participants'),
        icon: 'Users',
        href: `/event/${eventId}/participants`,
        onClick: () => navigate({ to: `/event/${eventId}/participants` }),
      });
    }

    if (canViewNotifications) {
      items.push({
        id: 'notifications',
        label: translate('navigation.secondary.event.notifications'),
        icon: 'Bell',
        href: `/event/${eventId}/notifications`,
        onClick: () => navigate({ to: `/event/${eventId}/notifications` }),
      });
    }

    if (isAdmin) {
      items.push({
        id: 'edit',
        label: translate('navigation.secondary.event.edit'),
        icon: 'Settings',
        href: `/event/${eventId}/settings`,
        onClick: () => navigate({ to: `/event/${eventId}/settings` }),
      });
    }

    return items;
  };

  const getUserSecondaryNavItems = (userId: string, isOwnUser: boolean): NavigationItem[] => {
    const items: NavigationItem[] = [
      {
        id: 'user',
        label: translate('navigation.secondary.user.profile'),
        icon: 'User',
        href: `/user/${userId}`,
        onClick: () => navigate({ to: `/user/${userId}` }),
      },
    ];

    // Only show subscriptions and memberships for own user profile
    if (isOwnUser) {
      items.push(
        {
          id: 'memberships',
          label: translate('navigation.secondary.user.memberships'),
          icon: 'Users',
          href: `/user/${userId}/memberships`,
          onClick: () => navigate({ to: `/user/${userId}/memberships` }),
        },
        {
          id: 'subscriptions',
          label: translate('navigation.secondary.user.subscriptions'),
          icon: 'Bell',
          href: `/user/${userId}/subscriptions`,
          onClick: () => navigate({ to: `/user/${userId}/subscriptions` }),
        }
      );
    }

    items.push(
      {
        id: 'meet',
        label: translate('navigation.secondary.user.meet'),
        icon: 'Calendar',
        href: `/user/${userId}/meet`,
        onClick: () => navigate({ to: `/user/${userId}/meet` }),
      },
      {
        id: 'network',
        label: translate('navigation.secondary.user.network'),
        icon: 'Network',
        href: `/user/${userId}/network`,
        onClick: () => navigate({ to: `/user/${userId}/network` }),
      }
    );

    if (isOwnUser) {
      items.push({
        id: 'edit',
        label: translate('navigation.secondary.user.edit'),
        icon: 'Settings',
        href: `/user/${userId}/settings`,
        onClick: () => navigate({ to: `/user/${userId}/settings` }),
      });
    }

    return items;
  };

  // Function to create group secondary navigation items for a specific group
  const getGroupSecondaryNavItems = (
    groupId: string,
    isAdmin = false,
    _isMember = false,
    canManageMembers = false,
    canViewNotifications = false,
    canAccessOperation = false,
    canAccessEditor = false
  ): NavigationItem[] => {
    void _isMember;
    const items: NavigationItem[] = [
      {
        id: 'overview',
        label: translate('navigation.secondary.group.overview'),
        icon: 'Home',
        href: `/group/${groupId}`,
        onClick: () => navigate({ to: `/group/${groupId}` }),
      },
    ];

    // Add operation as second item if user is a member
    if (canAccessOperation) {
      items.push({
        id: 'operation',
        label: translate('navigation.secondary.group.operation'),
        icon: 'AreaChart',
        href: `/group/${groupId}/operation`,
        onClick: () => navigate({ to: `/group/${groupId}/operation` }),
      });
    }

    items.push(
      {
        id: 'events',
        label: translate('navigation.secondary.group.events'),
        icon: 'Calendar',
        href: `/group/${groupId}/events`,
        onClick: () => navigate({ to: `/group/${groupId}/events` }),
      },
      {
        id: 'amendments',
        label: translate('navigation.secondary.group.amendments'),
        icon: 'FileText',
        href: `/group/${groupId}/amendments`,
        onClick: () => navigate({ to: `/group/${groupId}/amendments` }),
      },
      {
        id: 'blogs-and-statements',
        label: translate('navigation.secondary.group.blogsAndStatements'),
        icon: 'BookOpen',
        href: `/group/${groupId}/blogs-and-statements`,
        onClick: () => navigate({ to: `/group/${groupId}/blogs-and-statements` }),
      },
      {
        id: 'network',
        label: translate('navigation.secondary.group.network'),
        icon: 'Network',
        href: `/group/${groupId}/network`,
        onClick: () => navigate({ to: `/group/${groupId}/network` }),
      }
    );

    // Add editor/documents item if user is a member
    if (canAccessEditor) {
      items.push({
        id: 'editor',
        label: translate('navigation.secondary.group.editor'),
        icon: 'FileText',
        href: `/group/${groupId}/editor`,
        onClick: () => navigate({ to: `/group/${groupId}/editor` }),
      });
    }

    // Add memberships item if user can manage members (groupMemberships permission)
    if (canManageMembers) {
      items.push({
        id: 'memberships',
        label: translate('navigation.secondary.group.memberships'),
        icon: 'Users',
        href: `/group/${groupId}/memberships`,
        onClick: () => navigate({ to: `/group/${groupId}/memberships` }),
      });
    }

    // Add notifications tab if user has viewNotifications permission
    if (canViewNotifications) {
      items.push({
        id: 'notifications',
        label: translate('navigation.secondary.group.notifications'),
        icon: 'Bell',
        href: `/group/${groupId}/notifications`,
        onClick: () => navigate({ to: `/group/${groupId}/notifications` }),
      });
    }

    // Only add edit if user is admin
    if (isAdmin) {
      items.push({
        id: 'edit',
        label: translate('navigation.secondary.group.edit'),
        icon: 'Settings',
        href: `/group/${groupId}/settings`,
        onClick: () => navigate({ to: `/group/${groupId}/settings` }),
      });
    }

    return items;
  };

  // Function to create amendment secondary navigation items for a specific amendment
  const getAmendmentSecondaryNavItems = (
    amendmentId: string,
    canReadContent = false,
    _canUpdate = false,
    canManage = false,
    canViewNotifications = false
  ): NavigationItem[] => {
    void _canUpdate;
    const items: NavigationItem[] = [
      {
        id: 'overview',
        label: translate('navigation.secondary.amendment.overview'),
        icon: 'FileText',
        href: `/amendment/${amendmentId}`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}` }),
      },
    ];

    // Publicly readable amendment content must not depend on mutation rights.
    if (canReadContent) {
      items.push({
        id: 'text',
        label: translate('navigation.secondary.amendment.text'),
        icon: 'File',
        href: `/amendment/${amendmentId}/text`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/text` }),
      });
    }

    if (canReadContent) {
      items.push({
        id: 'changeRequests',
        label: translate('navigation.secondary.amendment.changeRequests'),
        icon: 'FileText',
        href: `/amendment/${amendmentId}/change-requests`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/change-requests` }),
      });
    }

    items.push(
      {
        id: 'discussions',
        label: translate('navigation.secondary.amendment.discussions'),
        icon: 'MessageSquare',
        href: `/amendment/${amendmentId}/discussions`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/discussions` }),
      },
      {
        id: 'city-design',
        label: translate('navigation.secondary.amendment.cityDesign'),
        icon: 'Map',
        href: `/amendment/${amendmentId}/citydesign`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/citydesign` }),
      },
      {
        id: 'process',
        label: translate('navigation.secondary.amendment.process'),
        icon: 'Workflow',
        href: `/amendment/${amendmentId}/process`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/process` }),
      }
    );

    if (canManage) {
      items.push({
        id: 'collaborators',
        label: translate('navigation.secondary.amendment.collaborators'),
        icon: 'Users',
        href: `/amendment/${amendmentId}/collaborators`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/collaborators` }),
      });
    }

    if (canViewNotifications) {
      items.push({
        id: 'notifications',
        label: translate('navigation.secondary.amendment.notifications'),
        icon: 'Bell',
        href: `/amendment/${amendmentId}/notifications`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/notifications` }),
      });
    }

    if (canManage) {
      items.push({
        id: 'edit',
        label: translate('navigation.secondary.amendment.edit'),
        icon: 'Settings',
        href: `/amendment/${amendmentId}/settings`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/settings` }),
      });
    }

    return items;
  };

  const getBlogSecondaryNavItems = (
    blogId: string,
    isOwner = false,
    canViewNotifications = false,
    groupId?: string,
    userId?: string
  ): NavigationItem[] => {
    const blogBase = groupId
      ? `/group/${groupId}/blog/${blogId}`
      : userId
        ? `/user/${userId}/blog/${blogId}`
        : `/blog/${blogId}`;

    const items: NavigationItem[] = [
      {
        id: 'overview',
        label: translate('navigation.secondary.blog.overview'),
        icon: 'FileText',
        href: blogBase,
        onClick: () => navigate({ to: blogBase }),
      },
    ];

    // Only add editor and edit items if user is owner
    if (isOwner) {
      items.push(
        {
          id: 'editor',
          label: translate('navigation.secondary.blog.editor'),
          icon: 'Edit',
          href: `${blogBase}/editor`,
          onClick: () => navigate({ to: `${blogBase}/editor` }),
        },
        {
          id: 'edit',
          label: translate('navigation.secondary.blog.edit'),
          icon: 'Settings',
          href: `${blogBase}/edit`,
          onClick: () => navigate({ to: `${blogBase}/edit` }),
        }
      );
    }

    if (canViewNotifications) {
      items.push({
        id: 'notifications',
        label: translate('navigation.secondary.blog.notifications'),
        icon: 'Bell',
        href: `${blogBase}/notifications`,
        onClick: () => navigate({ to: `${blogBase}/notifications` }),
      });
    }

    return items;
  };

  return {
    primaryNavItems,
    projectSecondaryNavItems,
    getEventSecondaryNavItems,
    getUserSecondaryNavItems,
    getGroupSecondaryNavItems,
    getAmendmentSecondaryNavItems,
    getBlogSecondaryNavItems,

    // Utility function to get secondary items based on current route
    getSecondaryNavItems: (
      currentPrimaryRoute: string | null,
      eventId?: string,
      userId?: string,
      isOwnUser?: boolean,
      groupId?: string,
      amendmentId?: string,
      isGroupAdmin?: boolean,
      isEventAdmin?: boolean,
      canViewAmendment?: boolean,
      canUpdateAmendment?: boolean,
      canManageAmendment?: boolean,
      blogId?: string,
      isBlogOwner?: boolean,
      isGroupMember?: boolean,
      canManageMembers?: boolean,
      canViewNotifications?: boolean,
      canAccessGroupOperation?: boolean,
      canAccessGroupEditor?: boolean
    ) => {
      switch (currentPrimaryRoute) {
        case 'projects':
          return projectSecondaryNavItems;
        case 'event':
          return eventId
            ? getEventSecondaryNavItems(
                eventId,
                isEventAdmin ?? false,
                canViewNotifications ?? false
              )
            : null;
        case 'user':
          return userId ? getUserSecondaryNavItems(userId, isOwnUser ?? false) : null;
        case 'group':
          return groupId
            ? getGroupSecondaryNavItems(
                groupId,
                isGroupAdmin ?? false,
                isGroupMember ?? false,
                canManageMembers ?? false,
                canViewNotifications ?? false,
                canAccessGroupOperation ?? false,
                canAccessGroupEditor ?? false
              )
            : null;
        case 'amendment':
          return amendmentId
            ? getAmendmentSecondaryNavItems(
                amendmentId,
                canViewAmendment ?? false,
                canUpdateAmendment ?? false,
                canManageAmendment ?? false,
                canViewNotifications ?? false
              )
            : null;
        case 'blog':
          return blogId
            ? getBlogSecondaryNavItems(
                blogId,
                isBlogOwner ?? false,
                canViewNotifications ?? false,
                groupId,
                userId
              )
            : null;
        default:
          return null;
      }
    },
  };
};
