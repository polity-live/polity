import {
  useManageNetworkTabController,
  type ManageNetworkTabProps,
} from '../hooks/useManageNetworkTabController';
import { ManageNetworkTabContentView } from './ManageNetworkTabContentView';

export type { ManageNetworkTabProps };

export function ManageNetworkTab(props: ManageNetworkTabProps) {
  const viewModel = useManageNetworkTabController(props);

  return <ManageNetworkTabContentView {...viewModel} />;
}
