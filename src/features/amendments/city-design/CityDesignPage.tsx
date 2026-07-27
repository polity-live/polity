import { useCityDesignPageController } from './hooks/useCityDesignPageController';
import { CityDesignPageView } from './ui/CityDesignPageView';

interface CityDesignPageProps {
  amendmentId: string;
}

export function CityDesignPage({ amendmentId }: CityDesignPageProps) {
  const controller = useCityDesignPageController(amendmentId);

  return (
    <CityDesignPageView
      amendmentId={controller.amendmentId}
      amendment={controller.amendment}
      isLoading={controller.isLoading}
      showActionBars={controller.showActionBars}
      readOnly={controller.readOnly}
      canEditMapContext={controller.canEditMapContext}
      mode={controller.mode}
      modeDisabledReasons={controller.modeDisabledReasons}
      canChangeMode={controller.canChangeMode}
      canVoteOnStreetChangeRequests={controller.canVoteOnStreetChangeRequests}
      canFinalizeStreetChangeRequests={controller.canFinalizeStreetChangeRequests}
      currentUserId={controller.currentUserId}
      currentUserAvatarUrl={controller.currentUserAvatarUrl}
      currentUserDisplayName={controller.currentUserDisplayName}
      collaborationDocumentId={controller.collaborationDocumentId}
      editorCollaborators={controller.editorCollaborators}
      existingCollaboratorIds={controller.existingCollaboratorIds}
      onlinePeerMap={controller.onlinePeerMap}
      activeCursorUserIds={controller.activeCursorUserIds}
      presenceColorByUserId={controller.presenceColorByUserId}
      remoteCursors={controller.remoteCursors}
      streetChangeRequests={controller.streetChangeRequests}
      cityDesignDiscussions={controller.cityDesignDiscussions}
      changeRequestColorMode={controller.changeRequestColorMode}
      design={controller.design}
      selectedObject={controller.selectedObject}
      selectedOsmWay={controller.selectedOsmWay}
      selectedObjectCostLine={controller.selectedObjectCostLine}
      selectedObjectId={controller.state.selectedObjectId}
      selectedObjectFocusRequestKey={controller.state.selectedObjectFocusRequestKey}
      selectedOsmFocusRequestKey={controller.state.selectedOsmFocusRequestKey}
      hiddenObjectIds={controller.state.hiddenObjectIds}
      hiddenObjectCategories={controller.state.hiddenObjectCategories}
      selectedTool={controller.state.selectedTool}
      interactionMode={controller.interactionMode}
      placementSettings={controller.placementSettings}
      selectedCenter={controller.selectedCenter}
      selectedBbox={controller.selectedBbox}
      selectedMapSelection={controller.selectedMapSelection}
      selectionAddress={controller.selectionAddress}
      selectionAddressLabel={controller.selectionAddressLabel}
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
      onSelectionAddressChange={controller.onSelectionAddressChange}
      onLoadOsm={controller.onLoadOsm}
      onSave={controller.onSave}
      onModeChange={controller.onModeChange}
      onChangeRequestVote={controller.onChangeRequestVote}
      onChangeRequestTitleChange={controller.onChangeRequestTitleChange}
      onChangeRequestFinalize={controller.onChangeRequestFinalize}
      onChangeRequestCommentSubmit={controller.onChangeRequestCommentSubmit}
      onChangeRequestColorModeChange={controller.onChangeRequestColorModeChange}
      onToolChange={controller.setSelectedTool}
      onInteractionModeChange={controller.setInteractionMode}
      onComparisonModeChange={controller.setComparisonMode}
      onScenePointerDown={controller.handleScenePointerDown}
      onScenePointerMove={controller.handleScenePointerMove}
      onScenePointerHover={controller.broadcastCursor}
      onFinishPlacement={controller.finishPlacement}
      onFinishPathPlacement={controller.finishPathPlacement}
      onCancelPlacement={controller.cancelPlacement}
      onObjectSelect={controller.selectObject}
      onOsmWaySelect={controller.selectOsmWay}
      onObjectVisibilityChange={controller.setObjectVisibility}
      onObjectCategoryVisibilityChange={controller.setObjectCategoryVisibility}
      onOsmWayHide={controller.hideOsmWay}
      onOsmWayImport={controller.importOsmWay}
      onOsmImportUndo={controller.undoOsmImport}
      onOsmLayerVisibilityChange={controller.setOsmLayerVisibility}
      onShowStreetMarkingsChange={controller.setShowStreetMarkings}
      onPlacementPropertyChange={controller.updatePlacementProperty}
      onPlacementWidthChange={controller.updatePlacementWidth}
      onPlacementRotationChange={controller.updatePlacementRotation}
      onPlacementUnitCostChange={controller.updatePlacementUnitCost}
      onPropertyChange={controller.updateObjectProperty}
      onWidthChange={controller.updateObjectWidth}
      onRotationChange={controller.rotateObject}
      onUnitCostChange={controller.updateObjectUnitCost}
      onDeleteObject={controller.deleteObject}
      onDeleteObjectCategory={controller.deleteObjectCategory}
    />
  );
}
