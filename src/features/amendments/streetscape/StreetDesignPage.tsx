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
      readOnly={controller.readOnly}
      design={controller.design}
      selectedObject={controller.selectedObject}
      selectedOsmWay={controller.selectedOsmWay}
      selectedObjectCostLine={controller.selectedObjectCostLine}
      selectedObjectId={controller.state.selectedObjectId}
      selectedTool={controller.state.selectedTool}
      interactionMode={controller.interactionMode}
      selectedCenter={controller.selectedCenter}
      selectedBbox={controller.selectedBbox}
      selectedMapSelection={controller.selectedMapSelection}
      costSummary={controller.costSummary}
      isDirty={controller.state.isDirty}
      placementPreview={controller.placementPreview}
      placementPreviewType={controller.placementPreviewType}
      placementStart={controller.placementStart}
      placementMode={controller.placementMode}
      placementPointCount={controller.placementPointCount}
      canFinishPathPlacement={controller.canFinishPathPlacement}
      osmLayerVisibility={controller.osmLayerVisibility}
      showStreetMarkings={controller.showStreetMarkings}
      isLoadingOsm={controller.isLoadingOsm}
      osmError={controller.osmError}
      isSaving={controller.isSaving}
      saveError={controller.saveError}
      onSelectedMapSelectionChange={controller.onSelectedMapSelectionChange}
      onLoadOsm={controller.onLoadOsm}
      onLoadSample={controller.onLoadSample}
      onSave={controller.onSave}
      onToolChange={controller.setSelectedTool}
      onInteractionModeChange={controller.setInteractionMode}
      onComparisonModeChange={controller.setComparisonMode}
      onScenePointerDown={controller.handleScenePointerDown}
      onScenePointerMove={controller.handleScenePointerMove}
      onFinishPlacement={controller.finishPlacement}
      onFinishPathPlacement={controller.finishPathPlacement}
      onCancelPlacement={controller.cancelPlacement}
      onObjectSelect={controller.selectObject}
      onOsmWaySelect={controller.selectOsmWay}
      onOsmWayHide={controller.hideOsmWay}
      onOsmLayerVisibilityChange={controller.setOsmLayerVisibility}
      onShowStreetMarkingsChange={controller.setShowStreetMarkings}
      onPropertyChange={controller.updateObjectProperty}
      onWidthChange={controller.updateObjectWidth}
      onUnitCostChange={controller.updateObjectUnitCost}
      onDeleteObject={controller.deleteObject}
    />
  );
}
