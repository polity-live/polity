import {
  useManageWorkflowsTabViewModel,
  type ManageWorkflowsTabProps,
} from '../hooks/useManageWorkflowsTabViewModel';
import { ManageWorkflowsTabContentView } from './ManageWorkflowsTabContentView';

export type { ManageWorkflowsTabProps };

export function ManageWorkflowsTab(props: ManageWorkflowsTabProps) {
  const viewModel = useManageWorkflowsTabViewModel(props);

  return <ManageWorkflowsTabContentView {...viewModel} />;
}
