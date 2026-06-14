import type { NavigationItem } from '@/features/navigation/types/navigation.types.tsx';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

// TanStack Router navigate function type
type NavigateFn = (opts: { to: string }) => void;

// This function factory creates navigation items with router integration
export const navItemsAuthenticated = (
  navigate: NavigateFn,
  setCurrentPrimaryRoute?: (route: string) => void,
  t?: (key: string) => string // Optional translation function
) => {
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
        navigate({ to: '/home' });
        if (setCurrentPrimaryRoute) setCurrentPrimaryRoute('home');
      },
    },
    {
      id: 'messages',
      label: translateText('generated.inline.0187_messages_f1702b46'),
      icon: 'MessageSquare',
      href: '/messages',
      onClick: () => {
        navigate({ to: '/messages' });
        if (setCurrentPrimaryRoute) setCurrentPrimaryRoute('messages');
      },
    },
    {
      id: 'search',
      label: translateText('generated.inline.0188_search_bce06414'),
      icon: 'Search',
      href: '/search',
      onClick: () => {
        navigate({ to: '/search' });
        if (setCurrentPrimaryRoute) setCurrentPrimaryRoute('search');
      },
    },
    {
      id: 'create',
      label: translateText('generated.inline.0189_create_6e157c5d'),
      icon: 'PlusCircle',
      href: '/create',
      onClick: () => {
        navigate({ to: '/create' });
        if (setCurrentPrimaryRoute) setCurrentPrimaryRoute('create');
      },
    },

    {
      id: 'calendar',
      label: translateText('generated.inline.0190_calendar_adab5090'),
      icon: 'Calendar',
      href: '/calendar',
      onClick: () => {
        navigate({ to: '/calendar' });
        if (setCurrentPrimaryRoute) setCurrentPrimaryRoute('calendar');
      },
    },
    {
      id: 'todos',
      label: translateText('generated.inline.0180_todos_a4114a83'),
      icon: 'CheckSquare',
      href: '/todos',
      onClick: () => {
        navigate({ to: '/todos' });
        if (setCurrentPrimaryRoute) setCurrentPrimaryRoute('todos');
      },
    },
    {
      id: 'notifications',
      label: translateText('generated.inline.0191_notifications_753a22b2'),
      icon: 'Bell',
      href: '/notifications',
      onClick: () => {
        navigate({ to: '/notifications' });
        if (setCurrentPrimaryRoute) setCurrentPrimaryRoute('notifications');
      },
    },
  ];
  // Define route-specific secondary navigation items
  const projectSecondaryNavItems: NavigationItem[] = [
    {
      id: 'tasks',
      label: t ? t('navigation.secondary.projects.tasks') : 'Tasks',
      icon: 'File',
      href: '/projects/tasks',
      onClick: () => navigate({ to: '/projects/tasks' }),
    },
    {
      id: 'tests',
      label: t ? t('navigation.secondary.projects.tests') : 'Tests',
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
        label: t ? t('navigation.secondary.event.overview') : 'Overview',
        icon: 'FileText',
        href: `/event/${eventId}`,
        onClick: () => navigate({ to: `/event/${eventId}` }),
      },
      {
        id: 'agenda',
        label: t ? t('navigation.secondary.event.agenda') : 'Agenda',
        icon: 'Calendar',
        href: `/event/${eventId}/agenda`,
        onClick: () => navigate({ to: `/event/${eventId}/agenda` }),
      },
      {
        id: 'network',
        label: t ? t('navigation.secondary.event.network') : 'Network',
        icon: 'Network',
        href: `/event/${eventId}/network`,
        onClick: () => navigate({ to: `/event/${eventId}/network` }),
      },
    ];

    // Only add participants and edit items if user is admin
    if (isAdmin) {
      items.push({
        id: 'participants',
        label: t ? t('navigation.secondary.event.participants') : 'Participants',
        icon: 'Users',
        href: `/event/${eventId}/participants`,
        onClick: () => navigate({ to: `/event/${eventId}/participants` }),
      });
    }

    if (canViewNotifications) {
      items.push({
        id: 'notifications',
        label: t ? t('navigation.secondary.event.notifications') : 'Notifications',
        icon: 'Bell',
        href: `/event/${eventId}/notifications`,
        onClick: () => navigate({ to: `/event/${eventId}/notifications` }),
      });
    }

    if (isAdmin) {
      items.push({
        id: 'edit',
        label: t ? t('navigation.secondary.event.edit') : 'Edit Event',
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
        label: t ? t('navigation.secondary.user.profile') : 'User',
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
          label: t ? t('navigation.secondary.user.memberships') : 'Memberships',
          icon: 'Users',
          href: `/user/${userId}/memberships`,
          onClick: () => navigate({ to: `/user/${userId}/memberships` }),
        },
        {
          id: 'subscriptions',
          label: t ? t('navigation.secondary.user.subscriptions') : 'Subscriptions',
          icon: 'Bell',
          href: `/user/${userId}/subscriptions`,
          onClick: () => navigate({ to: `/user/${userId}/subscriptions` }),
        }
      );
    }

    items.push(
      {
        id: 'meet',
        label: t ? t('navigation.secondary.user.meet') : 'Meet',
        icon: 'Calendar',
        href: `/user/${userId}/meet`,
        onClick: () => navigate({ to: `/user/${userId}/meet` }),
      },
      {
        id: 'network',
        label: t ? t('navigation.secondary.user.network') : 'Network',
        icon: 'Network',
        href: `/user/${userId}/network`,
        onClick: () => navigate({ to: `/user/${userId}/network` }),
      }
    );

    if (isOwnUser) {
      items.push({
        id: 'edit',
        label: t ? t('navigation.secondary.user.edit') : 'Settings',
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
        label: t ? t('navigation.secondary.group.overview') : 'Overview',
        icon: 'Home',
        href: `/group/${groupId}`,
        onClick: () => navigate({ to: `/group/${groupId}` }),
      },
    ];

    // Add operation as second item if user is a member
    if (canAccessOperation) {
      items.push({
        id: 'operation',
        label: t ? t('navigation.secondary.group.operation') : 'Operation',
        icon: 'AreaChart',
        href: `/group/${groupId}/operation`,
        onClick: () => navigate({ to: `/group/${groupId}/operation` }),
      });
    }

    items.push(
      {
        id: 'events',
        label: t ? t('navigation.secondary.group.events') : 'Events',
        icon: 'Calendar',
        href: `/group/${groupId}/events`,
        onClick: () => navigate({ to: `/group/${groupId}/events` }),
      },
      {
        id: 'amendments',
        label: t ? t('navigation.secondary.group.amendments') : 'Amendments',
        icon: 'FileText',
        href: `/group/${groupId}/amendments`,
        onClick: () => navigate({ to: `/group/${groupId}/amendments` }),
      },
      {
        id: 'blogs-and-statements',
        label: t ? t('navigation.secondary.group.blogsAndStatements') : 'Blogs & Statements',
        icon: 'BookOpen',
        href: `/group/${groupId}/blogs-and-statements`,
        onClick: () => navigate({ to: `/group/${groupId}/blogs-and-statements` }),
      },
      {
        id: 'network',
        label: t ? t('navigation.secondary.group.network') : 'Network',
        icon: 'Network',
        href: `/group/${groupId}/network`,
        onClick: () => navigate({ to: `/group/${groupId}/network` }),
      }
    );

    // Add editor/documents item if user is a member
    if (canAccessEditor) {
      items.push({
        id: 'editor',
        label: t ? t('navigation.secondary.group.editor') : 'Documents',
        icon: 'FileText',
        href: `/group/${groupId}/editor`,
        onClick: () => navigate({ to: `/group/${groupId}/editor` }),
      });
    }

    // Add memberships item if user can manage members (groupMemberships permission)
    if (canManageMembers) {
      items.push({
        id: 'memberships',
        label: t ? t('navigation.secondary.group.memberships') : 'Members',
        icon: 'Users',
        href: `/group/${groupId}/memberships`,
        onClick: () => navigate({ to: `/group/${groupId}/memberships` }),
      });
    }

    // Add notifications tab if user has viewNotifications permission
    if (canViewNotifications) {
      items.push({
        id: 'notifications',
        label: t ? t('navigation.secondary.group.notifications') : 'Notifications',
        icon: 'Bell',
        href: `/group/${groupId}/notifications`,
        onClick: () => navigate({ to: `/group/${groupId}/notifications` }),
      });
    }

    // Only add edit if user is admin
    if (isAdmin) {
      items.push({
        id: 'edit',
        label: t ? t('navigation.secondary.group.edit') : 'Edit Group',
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
    canView = false,
    canUpdate = false,
    canManage = false,
    canViewNotifications = false
  ): NavigationItem[] => {
    const items: NavigationItem[] = [
      {
        id: 'overview',
        label: t ? t('navigation.secondary.amendment.overview') : 'Overview',
        icon: 'FileText',
        href: `/amendment/${amendmentId}`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}` }),
      },
      {
        id: 'discussions',
        label: t ? t('navigation.secondary.amendment.discussions') : 'Discussions',
        icon: 'MessageSquare',
        href: `/amendment/${amendmentId}/discussions`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/discussions` }),
      },
      {
        id: 'process',
        label: t ? t('navigation.secondary.amendment.process') : 'Process',
        icon: 'Workflow',
        href: `/amendment/${amendmentId}/process`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/process` }),
      },
      {
        id: 'streetscape',
        label: t ? t('navigation.secondary.amendment.streetscape') : 'Strassenentwurf',
        icon: 'Map',
        href: `/amendment/${amendmentId}/streetscape`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/streetscape` }),
      },
    ];

    // Add items requiring view permission
    if (canView) {
      items.push({
        id: 'changeRequests',
        label: t ? t('navigation.secondary.amendment.changeRequests') : 'Change Requests',
        icon: 'FileText',
        href: `/amendment/${amendmentId}/change-requests`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/change-requests` }),
      });
    }

    // Add items requiring manage permission
    if (canUpdate || canManage) {
      items.push({
        id: 'text',
        label: t ? t('navigation.secondary.amendment.text') : 'Full Text',
        icon: 'File',
        href: `/amendment/${amendmentId}/text`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/text` }),
      });
    }

    if (canManage) {
      items.push({
        id: 'collaborators',
        label: t ? t('navigation.secondary.amendment.collaborators') : 'Collaborators',
        icon: 'Users',
        href: `/amendment/${amendmentId}/collaborators`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/collaborators` }),
      });
    }

    if (canViewNotifications) {
      items.push({
        id: 'notifications',
        label: t ? t('navigation.secondary.amendment.notifications') : 'Notifications',
        icon: 'Bell',
        href: `/amendment/${amendmentId}/notifications`,
        onClick: () => navigate({ to: `/amendment/${amendmentId}/notifications` }),
      });
    }

    if (canManage) {
      items.push({
        id: 'edit',
        label: t ? t('navigation.secondary.amendment.edit') : 'Edit Amendment',
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
        label: t ? t('navigation.secondary.blog.overview') : 'Overview',
        icon: 'FileText',
        href: blogBase,
        onClick: () => navigate({ to: blogBase }),
      },
    ];

    // Only add bloggers, editor and edit items if user is owner
    if (isOwner) {
      items.push(
        {
          id: 'bloggers',
          label: t ? t('navigation.secondary.blog.bloggers') : 'Bloggers',
          icon: 'Users',
          href: `${blogBase}/bloggers`,
          onClick: () => navigate({ to: `${blogBase}/bloggers` }),
        },
        {
          id: 'editor',
          label: t ? t('navigation.secondary.blog.editor') : 'Editor',
          icon: 'Edit',
          href: `${blogBase}/editor`,
          onClick: () => navigate({ to: `${blogBase}/editor` }),
        },
        {
          id: 'edit',
          label: t ? t('navigation.secondary.blog.edit') : 'Edit Blog',
          icon: 'Settings',
          href: `${blogBase}/settings`,
          onClick: () => navigate({ to: `${blogBase}/settings` }),
        }
      );
    }

    if (canViewNotifications) {
      items.push({
        id: 'notifications',
        label: t ? t('navigation.secondary.blog.notifications') : 'Notifications',
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
