import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/shared/ui/ui/tabs';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import type { NetworkTab } from '../types/network.types';

interface NetworkTabsProps {
  activeTab: NetworkTab;
  onTabChange: (tab: NetworkTab) => void;
  currentNetworkContent: React.ReactNode;
  manageNetworkContent: React.ReactNode;
  manageWorkflowsContent?: React.ReactNode;
  showManageNetworkTab?: boolean;
  showManageWorkflowsTab?: boolean;
}

export function NetworkTabs({
  activeTab,
  onTabChange,
  currentNetworkContent,
  manageNetworkContent,
  manageWorkflowsContent,
  showManageNetworkTab = true,
  showManageWorkflowsTab = true,
}: NetworkTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs
      value={activeTab}
      onValueChange={value => onTabChange(value as NetworkTab)}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="current-network">
          {t('features.network.tabs.currentNetwork')}
        </TabsTrigger>
        {showManageNetworkTab ? (
          <TabsTrigger value="manage-network" data-tutorial-anchor="manage-network">
            {t('features.network.tabs.manageNetwork')}
          </TabsTrigger>
        ) : null}
        {showManageWorkflowsTab ? (
          <TabsTrigger value="manage-workflows">
            {t('features.network.tabs.manageWorkflows')}
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="current-network" className="space-y-6">
        {currentNetworkContent}
      </TabsContent>

      {showManageNetworkTab ? (
        <TabsContent value="manage-network" className="space-y-6">
          {manageNetworkContent}
        </TabsContent>
      ) : null}

      {showManageWorkflowsTab ? (
        <TabsContent value="manage-workflows" className="space-y-6">
          {manageWorkflowsContent}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
