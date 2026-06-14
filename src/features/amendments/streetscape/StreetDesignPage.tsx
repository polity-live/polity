import { useStreetDesignPageController } from './hooks/useStreetDesignPageController';
import { StreetDesignPageView } from './ui/StreetDesignPageView';

interface StreetDesignPageProps {
  amendmentId: string;
}

export function StreetDesignPage({ amendmentId }: StreetDesignPageProps) {
  const controller = useStreetDesignPageController(amendmentId);

  return (
    <StreetDesignPageView
      amendment={controller.amendment}
      isLoading={controller.isLoading}
      canEdit={controller.canEdit}
      design={controller.design}
      selectedObject={controller.selectedObject}
      selectedObjectId={controller.state.selectedObjectId}
      selectedTool={controller.state.selectedTool}
      selectedCenter={controller.selectedCenter}
      selectedBbox={controller.selectedBbox}
      costSummary={controller.costSummary}
      isDirty={controller.state.isDirty}
      isLoadingOsm={controller.isLoadingOsm}
      osmError={controller.osmError}
      isSaving={controller.isSaving}
      saveError={controller.saveError}
      placementDraft={controller.state.placementDraft}
      onSelectedCenterChange={controller.onSelectedCenterChange}
      onLoadOsm={controller.onLoadOsm}
      onLoadSample={controller.onLoadSample}
      onSave={controller.onSave}
      onToolChange={controller.setSelectedTool}
      onComparisonModeChange={controller.setComparisonMode}
      onScenePointerDown={controller.handleScenePointerDown}
      onScenePointerMove={controller.handleScenePointerMove}
      onObjectSelect={controller.selectObject}
      onPropertyChange={controller.updateObjectProperty}
      onWidthChange={controller.updateObjectWidth}
      onUnitCostChange={controller.updateObjectUnitCost}
      onDeleteObject={controller.deleteObject}
    />
  );
}
