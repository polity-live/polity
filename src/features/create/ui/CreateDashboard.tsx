'use client';

import {
  BookOpen,
  Calendar,
  CheckSquare,
  DollarSign,
  FileText,
  Scale,
  UserCheck,
  Users,
} from 'lucide-react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { CreateDashboardView, type CreateDashboardSectionViewModel } from './CreateDashboardView';

export function CreateDashboard() {
  const { t } = useTranslation();

  const sections: CreateDashboardSectionViewModel[] = [
    {
      key: 'core',
      title: t('pages.create.dashboard.core'),
      items: [
        {
          href: '/create/group',
          icon: Users,
          title: t('pages.create.group.pageTitle'),
          description: t('pages.create.group.description'),
        },
        {
          href: '/create/event',
          icon: Calendar,
          title: t('pages.create.event.pageTitle'),
          description: t('pages.create.event.description'),
        },
        {
          href: '/create/amendment',
          icon: Scale,
          title: t('pages.create.amendment.pageTitle'),
          description: t('pages.create.amendment.description'),
        },
        {
          href: '/create/blog-entry',
          icon: BookOpen,
          title: t('pages.create.blog.pageTitle'),
          description: t('pages.create.blog.description'),
        },
      ],
    },
    {
      key: 'operational',
      title: t('pages.create.dashboard.operational'),
      items: [
        {
          href: '/create/todo',
          icon: CheckSquare,
          title: t('pages.create.todo.pageTitle'),
          description: t('pages.create.todo.description'),
        },
        {
          href: '/create/statement',
          icon: FileText,
          title: t('pages.create.statement.pageTitle'),
          description: t('pages.create.statement.description'),
        },
        {
          href: '/create/payment',
          icon: DollarSign,
          title: t('pages.create.payment.pageTitle'),
          description: t('pages.create.payment.description'),
        },
      ],
    },
    {
      key: 'event-options',
      title: t('pages.create.dashboard.eventOptions'),
      items: [
        {
          href: '/create/agenda-item',
          icon: Calendar,
          title: t('pages.create.agendaItem.pageTitle'),
          description: t('pages.create.agendaItem.description'),
        },
        {
          href: '/create/election-candidate',
          icon: UserCheck,
          title: t('pages.create.electionCandidate.pageTitle'),
          description: t('pages.create.electionCandidate.description'),
        },
      ],
    },
  ];

  return (
    <CreateDashboardView sections={sections} accessibleTitle={t('pages.create.dashboard.title')} />
  );
}
