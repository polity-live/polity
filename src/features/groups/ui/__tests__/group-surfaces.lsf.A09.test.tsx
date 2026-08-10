/* @vitest-environment jsdom */

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewProps: {} as Record<string, any>,
  filterProps: undefined as any,
  validatedProps: undefined as any,
  deadlineProps: undefined as any,
}));

afterEach(cleanup);

vi.mock('@/features/shared/hooks/use-translation', () => ({
  translate: (key: string) => key,
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/features/shared/ui/form', () => ({
  FormControlInput: (props: any) => <input {...props} />,
  FormControlLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  FormControlTextarea: (props: any) => <textarea {...props} />,
  FormControlSelect: ({ children }: any) => <div>{children}</div>,
  FormControlSelectContent: ({ children }: any) => <div>{children}</div>,
  FormControlSelectItem: ({ children }: any) => <div>{children}</div>,
  FormControlSelectTrigger: ({ children }: any) => <div>{children}</div>,
  FormControlSelectValue: () => <span />,
}));
vi.mock('@/features/shared/ui/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock('@/features/shared/ui/dialog', () => ({
  ScrollableDialogContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/create/ui/inputs/TodoDeadlineInput', () => ({
  TodoDeadlineInput: (props: any) => {
    mocks.deadlineProps = props;
    return (
      <button
        data-testid="deadline"
        onClick={() => props.onChange({ dueDate: '2026-08-09', dueTime: '12:00' })}
      />
    );
  },
}));
vi.mock('@/features/shared/ui/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/features/shared/ui/form/MiniPlateEditor', () => ({ MiniPlateEditor: () => <div /> }));
vi.mock('@/features/shared/ui/form/ValidatedInputField', () => ({
  ValidatedInputField: (props: any) => {
    mocks.validatedProps = props;
    props.validator('abc');
    return <div />;
  },
}));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: any) => <div>{children}</div> }));

vi.mock('@/features/groups/hooks/useGroupsPage', () => ({ useGroupsPage: () => ({ groups: [] }) }));
vi.mock('../../GroupsPageView', () => ({
  GroupsPageView: (props: any) => {
    mocks.viewProps.groupsPage = props;
    return <div />;
  },
}));
vi.mock('../useAddPaymentDialogController', () => ({
  useAddPaymentDialogController: (props: any) => props,
}));
vi.mock('../AddPaymentDialogView', () => ({
  AddPaymentDialogView: (props: any) => {
    mocks.viewProps.payment = props;
    return <div />;
  },
}));
vi.mock('@/features/groups/hooks/useAddTodoDialogController', () => ({
  useAddTodoDialogController: (props: any) => props,
}));
vi.mock('../AddTodoDialogView', async importOriginal => {
  const actual = await importOriginal<any>();
  return actual;
});
vi.mock('@/features/groups/hooks/useAmendmentGroupsController', () => ({
  useAmendmentGroupsController: (props: any) => props,
}));
vi.mock('../AmendmentGroupsView', () => ({
  AmendmentGroupsView: (props: any) => {
    mocks.viewProps.amendmentGroups = props;
    return <div />;
  },
}));
vi.mock('../useAssignHolderDialogController', () => ({
  useAssignHolderDialogController: (props: any) => props,
}));
vi.mock('../AssignHolderDialogView', () => ({
  AssignHolderDialogView: (props: any) => {
    mocks.viewProps.assign = props;
    return <div />;
  },
}));
vi.mock('../useGroupAmendmentsPageController', () => ({
  useGroupAmendmentsPageController: (props: any) => ({
    ...props,
    t: (key: string) => key,
    canCreate: () => false,
    groupedAmendments: { accepted: [], pending: [], rejected: [], withdrawn: [] },
    filters: {},
    showFilters: false,
    hasActiveFilters: false,
    updateFilter: vi.fn(),
    clearFilter: vi.fn(),
    setShowFilters: vi.fn(),
  }),
}));
vi.mock('../useGroupBlogsAndStatementsPageController', () => ({
  useGroupBlogsAndStatementsPageController: (props: any) => props,
}));
vi.mock('../GroupBlogsAndStatementsPageView', () => ({
  GroupBlogsAndStatementsPageView: (props: any) => {
    mocks.viewProps.blogs = props;
    return <div />;
  },
}));
vi.mock('../useGroupEditController', () => ({ useGroupEditController: (props: any) => props }));
vi.mock('../GroupEditView', () => ({
  GroupEditView: (props: any) => {
    mocks.viewProps.edit = props;
    return <div />;
  },
}));
vi.mock('../useProcessAgendaPreviewDialogController', () => ({
  useProcessAgendaPreviewDialogController: (props: any) => props,
}));
vi.mock('../ProcessAgendaPreviewDialogView', () => ({
  ProcessAgendaPreviewDialogView: (props: any) => {
    mocks.viewProps.preview = props;
    return <div />;
  },
}));
vi.mock('../AmendmentSearchAndFilters', () => ({
  AmendmentSearchAndFilters: (props: any) => {
    mocks.filterProps = props;
    return <div>{props.actions}</div>;
  },
}));

import { GroupsPage } from '../../GroupsPage';
import { AddPaymentDialog } from '../AddPaymentDialog';
import { AddTodoDialog } from '../AddTodoDialog';
import { AddTodoDialogView } from '../AddTodoDialogView';
import { AmendmentGroups } from '../AmendmentGroups';
import { AssignHolderDialog } from '../AssignHolderDialog';
import { BasicInfoSection } from '../BasicInfoSection';
import { GroupAmendmentsPage } from '../GroupAmendmentsPage';
import { GroupAmendmentsPageView } from '../GroupAmendmentsPageView';
import { GroupBlogsAndStatementsPage } from '../GroupBlogsAndStatementsPage';
import { GroupEdit } from '../GroupEdit';
import { GroupsHeader } from '../GroupsHeader';
import { ProcessAgendaPreviewDialog } from '../ProcessAgendaPreviewDialog';

it('renders every small group controller/view wrapper', () => {
  render(<GroupsPage />);
  render(
    <AddPaymentDialog
      open
      onOpenChange={vi.fn()}
      onSubmit={vi.fn()}
      direction="income"
      groupId="group"
    />
  );
  render(<AddTodoDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
  render(
    <AmendmentGroups
      groupedAmendments={{ accepted: [], pending: [], rejected: [], withdrawn: [] }}
    />
  );
  render(
    <AssignHolderDialog
      open
      onOpenChange={vi.fn()}
      role={{ id: 'role' }}
      groupId="group"
      onAssign={vi.fn()}
    />
  );
  render(<GroupAmendmentsPage groupId="group" />);
  render(<GroupBlogsAndStatementsPage groupId="group" />);
  render(<GroupEdit groupId="group" activeTab="general" />);
  render(<GroupsHeader />);
  render(<ProcessAgendaPreviewDialog open onOpenChange={vi.fn()} amendmentId="amendment" />);
  expect(mocks.viewProps.groupsPage.gp).toEqual({ groups: [] });
  expect(mocks.viewProps.payment.groupId).toBe('group');
  expect(mocks.viewProps.assign.role.id).toBe('role');
});

it('executes add-todo deadline fanout and text handlers', () => {
  const onTitleChange = vi.fn();
  const onDescriptionChange = vi.fn();
  const onDueDateChange = vi.fn();
  const onDueTimeChange = vi.fn();
  const view = render(
    <AddTodoDialogView
      open
      onOpenChange={vi.fn()}
      title=""
      description=""
      priority="medium"
      dueDate=""
      dueTime=""
      onTitleChange={onTitleChange}
      onDescriptionChange={onDescriptionChange}
      onPriorityChange={vi.fn()}
      onDueDateChange={onDueDateChange}
      onDueTimeChange={onDueTimeChange}
      onSubmit={vi.fn()}
    />
  );
  fireEvent.change(view.container.querySelector('#todo-title')!, { target: { value: 'Title' } });
  fireEvent.change(view.container.querySelector('#todo-description')!, {
    target: { value: 'Body' },
  });
  fireEvent.click(view.getByTestId('deadline'));
  expect(onTitleChange).toHaveBeenCalledWith('Title');
  expect(onDescriptionChange).toHaveBeenCalledWith('Body');
  expect(onDueDateChange).toHaveBeenCalledWith('2026-08-09');
  expect(onDueTimeChange).toHaveBeenCalledWith('12:00');
});

it('renders basic info and invokes its validator', () => {
  render(
    <BasicInfoSection
      formData={{ name: 'Group', descriptionContent: [] } as never}
      onNameChange={vi.fn()}
      onDescriptionContentChange={vi.fn()}
    />
  );
  expect(mocks.validatedProps.validator('ab')).toBe(false);
  expect(mocks.validatedProps.validator('abc')).toBe(true);
});

it('executes every group amendment filter callback', () => {
  const updateFilter = vi.fn();
  const clearFilter = vi.fn();
  const setShowFilters = vi.fn();
  render(
    <GroupAmendmentsPageView
      groupId="group"
      t={(key: string) => key}
      canCreate={() => false}
      groupedAmendments={{ accepted: [], pending: [], rejected: [], withdrawn: [] }}
      groupName="Group"
      filters={{}}
      showFilters={false}
      hasActiveFilters={false}
      updateFilter={updateFilter}
      clearFilter={clearFilter}
      setShowFilters={setShowFilters}
    />
  );
  mocks.filterProps.onSearchChange('find');
  mocks.filterProps.onStatusChange('pending');
  mocks.filterProps.onHashtagChange('tag');
  mocks.filterProps.onToggleFilters();
  mocks.filterProps.onClearStatusFilter();
  mocks.filterProps.onClearHashtagFilter();
  expect(updateFilter).toHaveBeenCalledTimes(3);
  expect(clearFilter).toHaveBeenCalledTimes(2);
  expect(setShowFilters).toHaveBeenCalledWith(true);
});
