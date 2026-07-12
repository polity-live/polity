import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import {
  ChevronDown,
  CopyPlus,
  Eye,
  EyeOff,
  Layers,
  MousePointer2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { Button } from '@/features/shared/ui/ui/button';
import { Input } from '@/features/shared/ui/ui/input';
import { Label } from '@/features/shared/ui/ui/label';
import { LoadingProgressBar } from '@/features/shared/ui/feedback';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/shared/ui/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/shared/ui/ui/select';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import type {
  StreetDesignCostLine,
  StreetDesignCameraPose,
  StreetDesignGeoPoint,
  StreetDesignInteractionMode,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignObjectCategory,
  StreetDesignObjectType,
  StreetDesignOsmWay,
  StreetDesignPropertyValue,
  StreetDesignStateV1,
} from '../types';
import {
  buildStreetDesignLegendSections,
  type StreetDesignLegendEntry,
} from '../logic/streetDesignLegend';
import type {
  StreetDesignChangeRequest,
  StreetDesignChangeRequestTone,
} from '../logic/streetDesignChangeRequests';
import { getStreetDesignChangeRequestMarker } from '../logic/streetDesignChangeRequests';
import { formatMinorCurrency } from '../logic/streetDesignCostCatalog';
import { getStreetDesignObjectDefinition } from '../logic/streetDesignObjectRegistry';
import { getStreetDesignObjectVariantLabelKey } from '../logic/streetDesignVariantCatalog';
import { getStreetDesignComparisonLayers } from '../logic/streetDesignDiff';
import {
  getStreetDesignGeometryCenter,
  getStreetDesignGeometryRotationDeg,
} from '../logic/streetDesignPlacement';
import {
  getStreetDesignOsmFeatureLayer,
  getStreetDesignOsmFeaturePoints,
} from '../logic/streetDesignOsm';
import { projectGeoPointToLocal } from '../logic/streetDesignProjection';
import type { EditorCollaborator } from '@/features/editor/types';
import type { StreetDesignRemoteCursor } from '../hooks/useStreetDesignRemoteCursors';
import {
  StreetDesignChangeRequestCanvasList,
  StreetDesignChangeRequestPanel,
  type StreetDesignDiscussionLike,
} from './StreetDesignChangeRequestPanel';

export interface StreetSceneCanvasViewViewProps {
  design: StreetDesignStateV1;
  metricLabels?: string[];
  initialLegendOpen?: boolean;
  embeddedPreview?: boolean;
  embeddedWorkspace?: boolean;
  isLoadingOsm: boolean;
  placementMode: 'drag_band' | 'path' | null;
  placementPointCount: number;
  canFinishPathPlacement: boolean;
  selectedObject: StreetDesignObject | null;
  selectedObjectCostLine: StreetDesignCostLine | null;
  selectedOsmWay: StreetDesignOsmWay | null;
  hiddenObjectIds?: readonly string[];
  hiddenObjectCategories?: readonly StreetDesignObjectCategory[];
  interactionMode: StreetDesignInteractionMode;
  readOnly: boolean;
  mapContextReadOnly?: boolean;
  changeRequests?: readonly StreetDesignChangeRequest[];
  streetDesignDiscussions?: readonly StreetDesignDiscussionLike[];
  selectedChangeRequestId?: string | null;
  showChangeRequests?: boolean;
  cameraPose?: StreetDesignCameraPose | null;
  canVoteOnChangeRequests?: boolean;
  canFinalizeChangeRequests?: boolean;
  currentUserId?: string | null;
  currentUserDisplayName?: string | null;
  currentUserAvatarUrl?: string | null;
  collaborators?: readonly EditorCollaborator[];
  remoteCursors?: readonly StreetDesignRemoteCursor[];
  onFinishPathPlacement: () => void;
  onCancelPlacement: () => void;
  onObjectSelect: (objectId: string | null) => void;
  onOsmWaySelect: (osmWayId: string | null) => void;
  onObjectVisibilityChange: (objectId: string, visible: boolean) => void;
  onOsmWayHide: (osmWayId: string) => void;
  onOsmWayImport?: (osmWayId: string) => void;
  onOsmImportUndo?: (osmWayId: string) => void;
  onPropertyChange: (objectId: string, key: string, value: StreetDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onRotationChange: (objectId: string, rotationDeg: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
  onChangeRequestSelect?: (changeRequestId: string | null) => void;
  onChangeRequestVote?: (
    changeRequestId: string,
    vote: 'accept' | 'reject' | 'abstain'
  ) => void | Promise<void>;
  onChangeRequestFinalize?: (changeRequestId: string) => void | Promise<void>;
  onChangeRequestTitleChange?: (changeRequestId: string, title: string) => void | Promise<void>;
  onChangeRequestCommentSubmit?: (changeRequestId: string, text: string) => void | Promise<void>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  loadFailed: boolean;
}

export function StreetSceneCanvasViewView({
  design,
  initialLegendOpen = false,
  embeddedPreview = false,
  embeddedWorkspace = false,
  isLoadingOsm,
  placementMode,
  placementPointCount,
  canFinishPathPlacement,
  selectedObject,
  selectedObjectCostLine,
  selectedOsmWay,
  hiddenObjectIds = [],
  hiddenObjectCategories = [],
  interactionMode,
  readOnly,
  mapContextReadOnly = readOnly,
  changeRequests = [],
  streetDesignDiscussions = [],
  selectedChangeRequestId = null,
  showChangeRequests = false,
  cameraPose = null,
  canVoteOnChangeRequests = false,
  canFinalizeChangeRequests = false,
  currentUserId = null,
  currentUserDisplayName = null,
  currentUserAvatarUrl = null,
  collaborators = [],
  remoteCursors = [],
  onFinishPathPlacement,
  onCancelPlacement,
  onObjectSelect,
  onOsmWaySelect,
  onObjectVisibilityChange,
  onOsmWayHide,
  onOsmWayImport = () => undefined,
  onOsmImportUndo = () => undefined,
  onPropertyChange,
  onWidthChange,
  onRotationChange,
  onUnitCostChange,
  onDeleteObject,
  onChangeRequestSelect,
  onChangeRequestVote,
  onChangeRequestFinalize,
  onChangeRequestTitleChange,
  onChangeRequestCommentSubmit,
  canvasRef,
  loadFailed,
}: StreetSceneCanvasViewViewProps) {
  const { t } = useTranslation();
  const [legendOpen, setLegendOpen] = useState(initialLegendOpen);
  const canvasSize = useCanvasElementSize(canvasRef);
  const comparisonLayers = useMemo(
    () => getStreetDesignComparisonLayers(design.comparisonMode),
    [design.comparisonMode]
  );
  const designLayerOffsetX = comparisonLayers.split ? 52 : 0;
  const originalLayerOffsetX = comparisonLayers.split ? -52 : 0;
  const positionedRemoteCursors = useMemo(
    () =>
      remoteCursors.flatMap(cursor => {
        const requestedLayerVisible =
          cursor.layer === 'design' ? comparisonLayers.showDesign : comparisonLayers.showOriginal;
        const renderedLayer = requestedLayerVisible
          ? cursor.layer
          : comparisonLayers.showDesign
            ? 'design'
            : 'original';
        const layerOffsetX = renderedLayer === 'design' ? designLayerOffsetX : originalLayerOffsetX;
        const anchor = getTrackedCanvasAnchorFromLocalPoint({
          point: cursor.position,
          cameraPose,
          canvasSize,
          layerOffsetX,
          hideWhenOutside: true,
        });
        return anchor ? [{ ...cursor, ...anchor }] : [];
      }),
    [
      cameraPose,
      canvasSize,
      comparisonLayers.showDesign,
      comparisonLayers.showOriginal,
      designLayerOffsetX,
      originalLayerOffsetX,
      remoteCursors,
    ]
  );
  const legendSections = useMemo(
    () =>
      buildStreetDesignLegendSections({
        design,
        hiddenObjectIds,
        hiddenObjectCategories,
      }),
    [design, hiddenObjectCategories, hiddenObjectIds]
  );
  const changeRequestMarkers = useMemo(
    () =>
      changeRequests.map(changeRequest =>
        getStreetDesignChangeRequestMarker(changeRequest, design)
      ),
    [changeRequests, design]
  );
  const positionedChangeRequestMarkers = useMemo(
    () =>
      comparisonLayers.showDesign
        ? getStackedChangeRequestMarkers(
            changeRequestMarkers.flatMap(marker => {
              const anchor = getTrackedCanvasAnchorFromLocalPoint({
                point: marker.position,
                cameraPose,
                canvasSize,
                layerOffsetX: designLayerOffsetX,
                hideWhenOutside: true,
              });
              return anchor ? [{ ...marker, ...anchor }] : [];
            })
          )
        : [],
    [cameraPose, canvasSize, changeRequestMarkers, comparisonLayers.showDesign, designLayerOffsetX]
  );
  const hiddenObjectIdSet = useMemo(() => new Set(hiddenObjectIds), [hiddenObjectIds]);
  const selectedChangeRequest =
    changeRequests.find(changeRequest => changeRequest.id === selectedChangeRequestId) ?? null;
  const selectedChangeRequestMarker = selectedChangeRequest
    ? positionedChangeRequestMarkers.find(marker => marker.id === selectedChangeRequest.id)
    : null;
  const selectedObjectAnchor = selectedObject
    ? getTrackedCanvasAnchorFromLocalPoint({
        point: getStreetDesignGeometryCenter(selectedObject.geometry),
        cameraPose,
        canvasSize,
        layerOffsetX: designLayerOffsetX,
      })
    : null;
  const selectedOsmAnchor = selectedOsmWay
    ? getCanvasAnchorFromOsmWay(
        selectedOsmWay,
        design,
        cameraPose,
        canvasSize,
        originalLayerOffsetX
      )
    : null;

  if (loadFailed) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex min-h-[28rem] items-center justify-center p-4 text-sm">
        {t('features.amendments.streetscape.canvas.loadFailed')}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-background relative overflow-hidden',
        embeddedWorkspace
          ? 'min-h-[34rem]'
          : embeddedPreview
            ? 'min-h-[30rem]'
            : 'min-h-[42rem] lg:min-h-[calc(100vh-10rem)]'
      )}
      data-swipe-lock
    >
      <div
        className={cn(
          'bg-muted/10 relative overflow-hidden',
          embeddedWorkspace
            ? 'min-h-[34rem]'
            : embeddedPreview
              ? 'min-h-[30rem]'
              : 'min-h-[42rem] lg:min-h-[calc(100vh-10rem)]'
        )}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            'w-full',
            embeddedWorkspace
              ? 'h-[34rem]'
              : embeddedPreview
                ? 'h-[30rem]'
                : 'h-[42rem] lg:h-[calc(100vh-10rem)]',
            interactionMode === 'camera'
              ? 'cursor-grab'
              : interactionMode === 'select'
                ? 'cursor-pointer'
                : 'cursor-crosshair'
          )}
        />
        {positionedRemoteCursors.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
            {positionedRemoteCursors.map(cursor => (
              <div
                key={cursor.userId}
                className="absolute flex items-start drop-shadow-md"
                style={{
                  left: `${cursor.leftPercent}%`,
                  top: `${cursor.topPercent}%`,
                  color: cursor.color,
                }}
                data-testid={`street-design-remote-cursor-${cursor.userId}`}
              >
                <MousePointer2 className="size-5 fill-current stroke-white stroke-[1.5]" />
                <span
                  className="mt-4 -ml-1 max-w-44 truncate rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-sm"
                  style={{ backgroundColor: cursor.color }}
                >
                  {cursor.name}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        {isLoadingOsm ? (
          <div className="pointer-events-none absolute right-4 bottom-4 left-4 z-10">
            <LoadingProgressBar
              motionStyle="optimistic"
              ariaLabel={t('features.amendments.streetscape.canvas.loadingOsm')}
              className="bg-background/75 ring-border/80 h-2 shadow-sm ring-1 backdrop-blur"
            />
          </div>
        ) : null}
        {!embeddedPreview && showChangeRequests && positionedChangeRequestMarkers.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            {positionedChangeRequestMarkers.map(marker => (
              <button
                key={marker.id}
                type="button"
                className={cn(
                  'focus-visible:ring-ring pointer-events-auto absolute flex min-h-8 max-w-52 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-lg backdrop-blur transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:outline-none',
                  getChangeRequestMarkerClassName(marker.tone),
                  selectedChangeRequestId === marker.id && 'ring-ring ring-2'
                )}
                style={{
                  left: `${marker.leftPercent}%`,
                  top: `${marker.topPercent}%`,
                }}
                data-testid={`street-design-cr-marker-${marker.id}`}
                data-change-request-tone={marker.tone}
                aria-label={marker.label}
                title={marker.label}
                onClick={() => onChangeRequestSelect?.(marker.id)}
              >
                <span className="font-mono text-[11px]">{marker.displayId}</span>
                <span
                  className={cn(
                    'size-3 flex-none rounded-full border',
                    marker.tone === 'remove' && 'border-dashed',
                    marker.tone === 'update' && 'ring-2 ring-current/30'
                  )}
                />
                <span className="min-w-0 truncate">{marker.title}</span>
              </button>
            ))}
          </div>
        ) : null}
        {!embeddedPreview && showChangeRequests && changeRequests.length > 0 ? (
          <StreetDesignChangeRequestCanvasList
            changeRequests={changeRequests}
            selectedChangeRequestId={selectedChangeRequestId}
            onChangeRequestSelect={changeRequestId => onChangeRequestSelect?.(changeRequestId)}
          />
        ) : null}
        {!embeddedPreview && selectedChangeRequest ? (
          <CanvasSelectionPopover
            anchor={
              selectedChangeRequestMarker
                ? {
                    leftPercent: selectedChangeRequestMarker.leftPercent,
                    topPercent: selectedChangeRequestMarker.topPercent,
                  }
                : (getTrackedCanvasAnchorFromLocalPoint({
                    point: { x: 0, z: 0 },
                    cameraPose,
                    canvasSize,
                    layerOffsetX: designLayerOffsetX,
                  }) ?? getCanvasAnchorFromLocalPoint({ x: 0, z: 0 }))
            }
          >
            <StreetDesignChangeRequestPanel
              changeRequest={selectedChangeRequest}
              discussions={streetDesignDiscussions}
              collaborators={collaborators}
              currentUserId={currentUserId}
              currentUserDisplayName={currentUserDisplayName}
              currentUserAvatarUrl={currentUserAvatarUrl}
              canVote={canVoteOnChangeRequests}
              canFinalize={canFinalizeChangeRequests}
              compact
              onClose={() => onChangeRequestSelect?.(null)}
              onVote={onChangeRequestVote}
              onFinalize={onChangeRequestFinalize}
              onTitleChange={onChangeRequestTitleChange}
              onCommentSubmit={onChangeRequestCommentSubmit}
            />
          </CanvasSelectionPopover>
        ) : !embeddedPreview && selectedObject && selectedObjectAnchor ? (
          <CanvasSelectionPopover anchor={selectedObjectAnchor}>
            <StreetDesignObjectPopover
              object={selectedObject}
              costLine={selectedObjectCostLine}
              isHidden={hiddenObjectIdSet.has(selectedObject.id)}
              readOnly={readOnly}
              onClose={() => onObjectSelect(null)}
              onVisibilityChange={onObjectVisibilityChange}
              onPropertyChange={onPropertyChange}
              onWidthChange={onWidthChange}
              onRotationChange={onRotationChange}
              onUnitCostChange={onUnitCostChange}
              onDeleteObject={onDeleteObject}
              onUndoOsmImport={onOsmImportUndo}
            />
          </CanvasSelectionPopover>
        ) : !embeddedPreview && selectedOsmWay && selectedOsmAnchor ? (
          <CanvasSelectionPopover anchor={selectedOsmAnchor}>
            <StreetDesignOsmPopover
              osmWay={selectedOsmWay}
              readOnly={readOnly}
              hideReadOnly={mapContextReadOnly}
              onClose={() => onOsmWaySelect(null)}
              onHideOsmWay={onOsmWayHide}
              onImportOsmWay={onOsmWayImport}
            />
          </CanvasSelectionPopover>
        ) : null}
      </div>
      {!embeddedPreview && legendSections.length > 0 ? (
        <Collapsible
          open={legendOpen}
          onOpenChange={setLegendOpen}
          className={cn(
            'bg-background/95 pointer-events-auto absolute right-6 bottom-6 z-10 w-[min(17rem,calc(100%-3rem))] overflow-hidden rounded-md border text-xs shadow-lg backdrop-blur'
          )}
        >
          <CollapsibleContent className="border-b">
            <div className="max-h-64 space-y-3 overflow-auto p-3 sm:max-h-80">
              {legendSections.map(section => (
                <section key={section.id} className="space-y-1.5">
                  <h3 className="text-muted-foreground text-[10px] font-semibold tracking-normal uppercase">
                    {t(section.labelKey)}
                  </h3>
                  {section.groups && section.groups.length > 0 ? (
                    <div className="space-y-2">
                      {section.groups.map(group => (
                        <div key={group.id} className="space-y-1">
                          <h4 className="text-muted-foreground/90 text-[10px] font-medium tracking-normal">
                            {t(group.labelKey)}
                          </h4>
                          {group.entries.map(entry => (
                            <StreetDesignLegendItem key={entry.id} entry={entry} />
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {section.entries.map(entry => (
                        <StreetDesignLegendItem key={entry.id} entry={entry} />
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </CollapsibleContent>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-full justify-between rounded-none px-3 text-xs font-semibold"
              aria-label={t(
                `features.amendments.streetscape.actions.${legendOpen ? 'collapse' : 'expand'}`,
                {
                  label: t('features.amendments.streetscape.canvas.legend'),
                }
              )}
              title={t(
                `features.amendments.streetscape.actions.${legendOpen ? 'collapse' : 'expand'}`,
                {
                  label: t('features.amendments.streetscape.canvas.legend'),
                }
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Layers className="text-muted-foreground size-3.5 flex-none" />
                <span className="truncate">
                  {t('features.amendments.streetscape.canvas.legend')}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  'size-3.5 flex-none transition-transform',
                  legendOpen ? 'rotate-0' : 'rotate-180'
                )}
              />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      ) : null}
      {placementMode === 'path' ? (
        <div className="border-border bg-background/95 absolute bottom-6 left-6 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur">
          <div>
            <p className="font-semibold">{t('features.amendments.streetscape.canvas.drawPath')}</p>
            <p className="text-muted-foreground">
              {t('features.amendments.streetscape.canvas.pointsSet', {
                count: placementPointCount,
              })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8 px-2 text-xs"
            disabled={readOnly || !canFinishPathPlacement}
            onClick={onFinishPathPlacement}
          >
            {t('common.done')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
            disabled={readOnly}
            onClick={onCancelPlacement}
          >
            {t('common.actions.cancel')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface CanvasAnchor {
  leftPercent: number;
  topPercent: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export function getBoundedCanvasPopoverPlacement(anchor: CanvasAnchor) {
  const leftPercent = Math.min(96, Math.max(4, anchor.leftPercent));
  const topPercent = Math.min(96, Math.max(4, anchor.topPercent));
  const translateX = leftPercent < 35 ? '0' : leftPercent > 65 ? '-100%' : '-50%';
  const translateY = topPercent < 35 ? '0' : topPercent > 65 ? '-100%' : '-50%';

  return {
    leftPercent,
    topPercent,
    transform: `translate(${translateX}, ${translateY})`,
  };
}

function CanvasSelectionPopover({
  anchor,
  children,
}: {
  anchor: CanvasAnchor;
  children: ReactNode;
}) {
  const placement = getBoundedCanvasPopoverPlacement(anchor);

  return (
    <div
      className="bg-background/95 pointer-events-auto absolute z-30 max-h-[calc(100%-2rem)] w-[min(23rem,calc(100%-2rem))] overflow-auto rounded-md border text-sm shadow-xl backdrop-blur"
      style={{
        left: `${placement.leftPercent}%`,
        top: `${placement.topPercent}%`,
        transform: placement.transform,
      }}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

function StreetDesignObjectPopover({
  object,
  costLine,
  isHidden,
  readOnly,
  onClose,
  onVisibilityChange,
  onPropertyChange,
  onWidthChange,
  onRotationChange,
  onUnitCostChange,
  onDeleteObject,
  onUndoOsmImport,
}: {
  object: StreetDesignObject;
  costLine: StreetDesignCostLine | null;
  isHidden: boolean;
  readOnly: boolean;
  onClose: () => void;
  onVisibilityChange: (objectId: string, visible: boolean) => void;
  onPropertyChange: (objectId: string, key: string, value: StreetDesignPropertyValue) => void;
  onWidthChange: (objectId: string, width: number) => void;
  onRotationChange: (objectId: string, rotationDeg: number) => void;
  onUnitCostChange: (objectId: string, unitCostMinor: number | null) => void;
  onDeleteObject: (objectId: string) => void;
  onUndoOsmImport: (osmWayId: string) => void;
}) {
  const { t } = useTranslation();
  const definition = getStreetDesignObjectDefinition(object.type);
  const objectLabel = t(getStreetDesignObjectVariantLabelKey(object) ?? definition.labelKey);
  const unitCostEuro =
    (object.cost.customUnitCostMinor ?? object.cost.suggestedUnitCostMinor) / 100;
  const fieldLabel = (labelKey: string, unit?: string) =>
    unit
      ? t('features.amendments.streetscape.inspector.fieldWithUnit', {
          label: t(labelKey),
          unit,
        })
      : t(labelKey);

  return (
    <div className="max-h-[min(32rem,70vh)] overflow-auto p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            {t('features.amendments.streetscape.inspector.title')}
          </p>
          <h2 className="truncate text-base font-semibold">{objectLabel}</h2>
          <p className="text-muted-foreground font-mono text-[11px]">{object.id.slice(0, 8)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('features.amendments.streetscape.changeRequests.close')}
          title={t('features.amendments.streetscape.changeRequests.close')}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {object.geometry.kind === 'corridor' || object.geometry.kind === 'path_corridor' ? (
          <div className="bg-muted/20 grid grid-cols-2 gap-2 rounded-md border p-2">
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.width')}
              </Label>
              <Input
                type="number"
                min={0.1}
                step={0.1}
                value={object.geometry.width}
                disabled={readOnly}
                onChange={event => onWidthChange(object.id, Number(event.target.value))}
              />
            </div>
            <ReadonlyMetric
              label={t('features.amendments.streetscape.inspector.length')}
              value={object.geometry.length.toFixed(1)}
            />
            <ReadonlyMetric
              label={t('features.amendments.streetscape.inspector.area')}
              value={object.geometry.area.toFixed(1)}
            />
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.rotation')}
              </Label>
              <Input
                type="number"
                step={1}
                value={Number(getStreetDesignGeometryRotationDeg(object.geometry).toFixed(1))}
                disabled={readOnly}
                onChange={event => onRotationChange(object.id, Number(event.target.value))}
              />
            </div>
          </div>
        ) : null}

        {object.geometry.kind === 'point' ? (
          <div className="bg-muted/20 rounded-md border p-2">
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.rotation')}
              </Label>
              <Input
                type="number"
                step={1}
                value={Number(getStreetDesignGeometryRotationDeg(object.geometry).toFixed(1))}
                disabled={readOnly}
                onChange={event => onRotationChange(object.id, Number(event.target.value))}
              />
            </div>
          </div>
        ) : null}

        {definition.propertySchema.map(field => {
          const value = object.properties[field.key];

          if (field.fieldType === 'boolean') {
            return (
              <label key={field.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  disabled={readOnly}
                  onChange={event => onPropertyChange(object.id, field.key, event.target.checked)}
                />
                {t(field.labelKey)}
              </label>
            );
          }

          if (field.fieldType === 'select') {
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{t(field.labelKey)}</Label>
                <Select
                  value={asInputValue(value)}
                  disabled={readOnly}
                  onValueChange={nextValue => onPropertyChange(object.id, field.key, nextValue)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field.fieldType === 'combobox') {
            const datalistId = `street-design-object-${sanitizeDomId(object.id)}-${field.key}`;

            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs">{fieldLabel(field.labelKey, field.unit)}</Label>
                <Input
                  type="text"
                  aria-label={fieldLabel(field.labelKey, field.unit)}
                  list={datalistId}
                  value={asInputValue(value)}
                  disabled={readOnly}
                  onChange={event => onPropertyChange(object.id, field.key, event.target.value)}
                />
                <datalist id={datalistId}>
                  {(field.options ?? []).map(option => (
                    <option key={option.value} value={option.value} label={t(option.labelKey)} />
                  ))}
                </datalist>
              </div>
            );
          }

          return (
            <div key={field.key} className="space-y-1">
              <Label className="text-xs">{fieldLabel(field.labelKey, field.unit)}</Label>
              <Input
                type={field.fieldType === 'number' ? 'number' : 'text'}
                aria-label={fieldLabel(field.labelKey, field.unit)}
                min={field.min}
                max={field.max}
                step={field.step}
                value={asInputValue(value)}
                disabled={readOnly}
                onChange={event =>
                  onPropertyChange(
                    object.id,
                    field.key,
                    field.fieldType === 'number' ? Number(event.target.value) : event.target.value
                  )
                }
              />
            </div>
          );
        })}

        <div className="bg-muted/20 rounded-md border p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">
                {t('features.amendments.streetscape.inspector.price')}
              </Label>
              <Input
                type="number"
                aria-label={t('features.amendments.streetscape.inspector.price')}
                min={0}
                step={0.01}
                value={unitCostEuro}
                disabled={readOnly}
                onChange={event => {
                  const value = event.target.value;
                  onUnitCostChange(
                    object.id,
                    value === '' ? null : Math.max(0, Math.round(Number(value) * 100))
                  );
                }}
              />
            </div>
            <ReadonlyMetric
              label={t('features.amendments.streetscape.inspector.total')}
              value={formatMinorCurrency(costLine?.totalCostMinor ?? 0)}
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            {t('features.amendments.streetscape.inspector.suggestedCost', {
              cost: formatMinorCurrency(object.cost.suggestedUnitCostMinor),
            })}
          </p>
          {object.cost.customUnitCostMinor != null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-auto px-0 text-xs"
              disabled={readOnly}
              onClick={() => onUnitCostChange(object.id, null)}
            >
              {t('features.amendments.streetscape.inspector.resetToSuggestedPrice')}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {object.provenance?.source === 'osm' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-2 text-xs"
              disabled={readOnly}
              onClick={() => onUndoOsmImport(object.provenance?.featureId ?? '')}
            >
              <Undo2 className="size-3.5" />
              {t('features.amendments.streetscape.actions.undoOsmImport')}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-2 text-xs"
            disabled={readOnly}
            onClick={() => onVisibilityChange(object.id, isHidden)}
          >
            {isHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {t(`features.amendments.streetscape.actions.${isHidden ? 'show' : 'hide'}`, {
              label: objectLabel,
            })}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-8 gap-2 text-xs"
            disabled={readOnly}
            onClick={() => onDeleteObject(object.id)}
          >
            <Trash2 className="size-3.5" />
            {t('features.amendments.streetscape.actions.removeShort')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StreetDesignOsmPopover({
  osmWay,
  readOnly,
  hideReadOnly,
  onClose,
  onHideOsmWay,
  onImportOsmWay,
}: {
  osmWay: StreetDesignOsmWay;
  readOnly: boolean;
  hideReadOnly: boolean;
  onClose: () => void;
  onHideOsmWay: (osmWayId: string) => void;
  onImportOsmWay: (osmWayId: string) => void;
}) {
  const { t } = useTranslation();
  const osmFeaturePoints = getStreetDesignOsmFeaturePoints(osmWay);
  const osmLayer = getStreetDesignOsmFeatureLayer(osmWay.kind);
  const relevantTags = getRelevantOsmTags(osmWay.tags);
  const mappedDefinition = osmWay.mappedObjectType
    ? getStreetDesignObjectDefinition(osmWay.mappedObjectType)
    : null;

  return (
    <div className="max-h-[min(30rem,70vh)] overflow-auto p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            {t('features.amendments.streetscape.inspector.existing')}
          </p>
          <h2 className="truncate text-base font-semibold">
            {osmWay.label ?? t('features.amendments.streetscape.inspector.osmFallback')}
          </h2>
          <p className="text-muted-foreground text-xs">
            {t(getOsmLayerLabelKey(osmLayer))}
            {osmWay.subkind ? ` · ${osmWay.subkind}` : ''} · {osmWay.id}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('features.amendments.streetscape.changeRequests.close')}
          title={t('features.amendments.streetscape.changeRequests.close')}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid gap-2 text-sm">
        {mappedDefinition ? (
          <ReadonlyCard
            label={t('features.amendments.streetscape.inspector.mappedAs')}
            value={`${t(mappedDefinition.labelKey)} · ${t(
              `features.amendments.streetscape.inspector.mappingConfidence.${osmWay.mappingConfidence ?? 'generic'}`
            )}`}
          />
        ) : (
          <ReadonlyCard
            label={t('features.amendments.streetscape.inspector.mappedAs')}
            value={t('features.amendments.streetscape.inspector.noSafeMapping')}
          />
        )}
        <ReadonlyCard
          label={t('features.amendments.streetscape.inspector.points')}
          value={String(osmFeaturePoints.length)}
        />
        {osmWay.widthMeters ? (
          <ReadonlyCard
            label={t('features.amendments.streetscape.inspector.width')}
            value={`${osmWay.widthMeters.toFixed(1)} m`}
          />
        ) : null}
        {osmWay.height ? (
          <ReadonlyCard
            label={t('features.amendments.streetscape.inspector.height')}
            value={`${osmWay.height.toFixed(1)} m`}
          />
        ) : null}
        {isFiniteNumber(osmWay.deckElevationMeters) ? (
          <ReadonlyCard
            label={t('features.amendments.streetscape.inspector.deckElevation')}
            value={formatMeters(osmWay.deckElevationMeters)}
          />
        ) : null}
        {isFiniteNumber(osmWay.baseElevationMeters) && osmWay.baseElevationMeters !== 0 ? (
          <ReadonlyCard
            label={t('features.amendments.streetscape.inspector.baseElevation')}
            value={formatMeters(osmWay.baseElevationMeters)}
          />
        ) : null}
        {osmWay.semanticUse || osmWay.level || osmWay.access ? (
          <ReadonlyCard
            label={t('features.amendments.streetscape.inspector.tags')}
            value={[osmWay.semanticUse, osmWay.level, osmWay.access].filter(Boolean).join(' · ')}
          />
        ) : null}
        {relevantTags.length > 0 ? (
          <div className="bg-muted/20 rounded-md border px-3 py-2">
            <p className="text-muted-foreground text-xs">
              {t('features.amendments.streetscape.inspector.tags')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {relevantTags.map(([key, value]) => (
                <span
                  key={key}
                  className="bg-background/80 rounded border px-1.5 py-0.5 text-[11px]"
                >
                  {key}={value}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {osmWay.mappedObjectType && osmWay.mappingConfidence !== 'generic' ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-2 text-xs"
            disabled={readOnly}
            onClick={() => onImportOsmWay(osmWay.id)}
          >
            <CopyPlus className="size-3.5" />
            {t('features.amendments.streetscape.inspector.importAsPlanned')}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-2 text-xs"
          disabled={hideReadOnly}
          onClick={() => onHideOsmWay(osmWay.id)}
        >
          <EyeOff className="size-3.5" />
          {t('features.amendments.streetscape.inspector.removeFromMap')}
        </Button>
      </div>
    </div>
  );
}

function ReadonlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} disabled />
    </div>
  );
}

function ReadonlyCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/20 rounded-md border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function useCanvasElementSize(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [canvasSize, setCanvasSize] = useState<CanvasSize | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const updateCanvasSize = () => {
      const nextSize = getCanvasElementSize(canvas);
      setCanvasSize(previousSize =>
        previousSize?.width === nextSize.width && previousSize.height === nextSize.height
          ? previousSize
          : nextSize
      );
    };

    updateCanvasSize();

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(updateCanvasSize);
      resizeObserver.observe(canvas);
      return () => resizeObserver.disconnect();
    }

    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [canvasRef]);

  return canvasSize;
}

function getCanvasElementSize(canvas: HTMLCanvasElement): CanvasSize {
  return {
    width: canvas.clientWidth || canvas.width || 1,
    height: canvas.clientHeight || canvas.height || 1,
  };
}

function getCanvasAnchorFromLocalPoint(point: StreetDesignLocalPoint): CanvasAnchor {
  return {
    leftPercent: clamp(50 + point.x * 1.2, 18, 82),
    topPercent: clamp(50 - point.z * 1.2, 18, 86),
  };
}

function getTrackedCanvasAnchorFromLocalPoint({
  point,
  cameraPose,
  canvasSize,
  layerOffsetX = 0,
  hideWhenOutside = false,
}: {
  point: StreetDesignLocalPoint;
  cameraPose: StreetDesignCameraPose | null | undefined;
  canvasSize: CanvasSize | null;
  layerOffsetX?: number;
  hideWhenOutside?: boolean;
}): CanvasAnchor | null {
  if (!cameraPose || !canvasSize) return getCanvasAnchorFromLocalPoint(point);

  const projectedAnchor = projectLocalPointToCanvasAnchor(point, cameraPose, canvasSize, {
    layerOffsetX,
  });
  if (!projectedAnchor) return hideWhenOutside ? null : getCanvasAnchorFromLocalPoint(point);
  if (hideWhenOutside && isCanvasAnchorOutside(projectedAnchor, 12)) return null;

  return {
    leftPercent: clamp(projectedAnchor.leftPercent, 4, 96),
    topPercent: clamp(projectedAnchor.topPercent, 4, 96),
  };
}

export function projectLocalPointToCanvasAnchor(
  point: StreetDesignLocalPoint,
  cameraPose: StreetDesignCameraPose,
  canvasSize: CanvasSize,
  options: { layerOffsetX?: number; y?: number } = {}
): CanvasAnchor | null {
  const worldPoint = {
    x: point.x + (options.layerOffsetX ?? 0),
    y: options.y ?? 0,
    z: point.z,
  };
  const cameraPosition = cameraPose.position;
  const cameraTarget = cameraPose.target;
  const forward = normalizeVector3({
    x: cameraTarget.x - cameraPosition.x,
    y: cameraTarget.y - cameraPosition.y,
    z: cameraTarget.z - cameraPosition.z,
  });
  if (!forward) return null;

  const right = normalizeVector3(crossVector3(forward, { x: 0, y: 1, z: 0 }));
  if (!right) return null;
  const up = normalizeVector3(crossVector3(right, forward));
  if (!up) return null;

  const cameraToPoint = {
    x: worldPoint.x - cameraPosition.x,
    y: worldPoint.y - cameraPosition.y,
    z: worldPoint.z - cameraPosition.z,
  };
  const depth = dotVector3(cameraToPoint, forward);
  if (depth <= 0.1) return null;

  const verticalScale = Math.tan((45 * Math.PI) / 360);
  const aspect = canvasSize.width / Math.max(canvasSize.height, 1);
  const ndcX = dotVector3(cameraToPoint, right) / (depth * verticalScale * aspect);
  const ndcY = dotVector3(cameraToPoint, up) / (depth * verticalScale);

  return {
    leftPercent: 50 + ndcX * 50,
    topPercent: 50 - ndcY * 50,
  };
}

function getCanvasAnchorFromOsmWay(
  osmWay: StreetDesignOsmWay,
  design: StreetDesignStateV1,
  cameraPose: StreetDesignCameraPose | null | undefined,
  canvasSize: CanvasSize | null,
  layerOffsetX: number
): CanvasAnchor {
  const points = getStreetDesignOsmFeaturePoints(osmWay);
  if (points.length === 0) return getCanvasAnchorFromLocalPoint({ x: 0, z: 0 });

  const averagePoint = points.reduce<StreetDesignGeoPoint>(
    (sum, point) => ({
      lat: sum.lat + point.lat / points.length,
      lon: sum.lon + point.lon / points.length,
    }),
    { lat: 0, lon: 0 }
  );

  const localPoint = projectGeoPointToLocal(averagePoint, design.origin);
  return (
    getTrackedCanvasAnchorFromLocalPoint({
      point: localPoint,
      cameraPose,
      canvasSize,
      layerOffsetX,
    }) ?? getCanvasAnchorFromLocalPoint(localPoint)
  );
}

function isCanvasAnchorOutside(anchor: CanvasAnchor, paddingPercent: number) {
  return (
    anchor.leftPercent < -paddingPercent ||
    anchor.leftPercent > 100 + paddingPercent ||
    anchor.topPercent < -paddingPercent ||
    anchor.topPercent > 100 + paddingPercent
  );
}

function dotVector3(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number }
) {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function crossVector3(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number }
) {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  };
}

function normalizeVector3(vector: { x: number; y: number; z: number }) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length < 0.000001) return null;

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function asInputValue(value: StreetDesignPropertyValue | undefined) {
  if (value == null) return '';
  return String(value);
}

function sanitizeDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function getOsmLayerLabelKey(layer: ReturnType<typeof getStreetDesignOsmFeatureLayer>) {
  if (layer === 'bike_lane') return 'features.amendments.streetscape.osmLayers.bikeLane';
  if (layer === 'street_furniture')
    return 'features.amendments.streetscape.osmLayers.streetFurniture';
  if (layer === 'landuse_context')
    return 'features.amendments.streetscape.osmLayers.landuseContext';
  return `features.amendments.streetscape.osmLayers.${layer}`;
}

function getRelevantOsmTags(tags: Record<string, string> | undefined) {
  if (!tags) return [];

  const relevantPrefixes = [
    'highway',
    'natural',
    'amenity',
    'parking',
    'parking:',
    'cycleway',
    'cycleway:',
    'sidewalk',
    'sidewalk:',
    'railway',
    'public_transport',
    'barrier',
    'traffic_calming',
    'crossing',
    'access',
    'bridge',
    'bridge:',
    'tunnel',
    'layer',
    'ele',
    'incline',
    'step_count',
    'embankment',
    'cutting',
    'man_made',
    'area:highway',
    'maxheight',
    'maxheight:',
    'min_height',
    'clearance',
    'shop',
    'office',
    'tourism',
    'leisure',
    'landuse',
    'building',
    'emergency',
    'lanes',
    'oneway',
    'width',
    'height',
    'surface',
  ];

  return Object.entries(tags)
    .filter(([key]) => relevantPrefixes.some(prefix => key === prefix || key.startsWith(prefix)))
    .slice(0, 8);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatMeters(value: number) {
  return `${value.toFixed(Math.abs(value) < 1 ? 2 : 1)} m`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function StreetDesignLegendItem({ entry }: { entry: StreetDesignLegendEntry }) {
  const { t } = useTranslation();

  return (
    <div className="bg-background/75 flex min-h-10 items-center gap-2 rounded-md border px-2 py-1.5">
      <StreetDesignLegendPreview entry={entry} />
      <span className="min-w-0 truncate">{t(entry.labelKey)}</span>
    </div>
  );
}

function getStackedChangeRequestMarkers(
  markers: ReturnType<typeof getStreetDesignChangeRequestMarker>[]
) {
  const countsByBucket = new Map<string, number>();

  return markers.map(marker => {
    const bucket = `${Math.round(marker.leftPercent / 5) * 5}:${Math.round(marker.topPercent / 5) * 5}`;
    const index = countsByBucket.get(bucket) ?? 0;
    countsByBucket.set(bucket, index + 1);

    return {
      ...marker,
      leftPercent: clamp(marker.leftPercent + (index % 2 === 0 ? 0 : 3), 8, 92),
      topPercent: clamp(marker.topPercent + index * 5, 8, 92),
    };
  });
}

function getChangeRequestMarkerClassName(tone: StreetDesignChangeRequestTone) {
  switch (tone) {
    case 'add':
      return 'border-[var(--badge-success-border)] bg-[var(--badge-success-bg)] text-[var(--badge-success-fg)]';
    case 'remove':
      return 'border-dashed border-[var(--badge-danger-border)] bg-[var(--badge-danger-bg)] text-[var(--badge-danger-fg)]';
    case 'update':
      return 'border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]';
    default:
      return 'border-border bg-background/90 text-foreground';
  }
}

function StreetDesignLegendPreview({ entry }: { entry: StreetDesignLegendEntry }) {
  const previewKind = getLegendPreviewKind(entry);

  return (
    <span
      className="bg-muted/30 relative h-8 w-10 flex-none overflow-hidden rounded-md border shadow-inner"
      data-testid={`street-design-legend-preview-${previewKind}`}
      data-legend-entry-id={entry.id}
      aria-hidden="true"
    >
      <span
        className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-black/15 blur-[1px]"
        aria-hidden="true"
      />
      {renderLegendPreviewContent(entry, previewKind)}
    </span>
  );
}

function getLegendPreviewKind(entry: StreetDesignLegendEntry) {
  if (entry.objectType) return entry.objectType;
  if (entry.layer) return entry.layer;
  return entry.renderKind;
}

function renderLegendPreviewContent(entry: StreetDesignLegendEntry, previewKind: string) {
  const color = entry.color;

  switch (previewKind as StreetDesignObjectType | string) {
    case 'tree': {
      const species = getLegendTreeSpecies(entry);
      if (species === 'conifer') {
        return (
          <>
            <span className="absolute bottom-2 left-[19px] h-3 w-1 rounded-sm bg-[#7a5635]" />
            <span
              className="absolute top-1 left-[12px] h-5 w-4 shadow-sm"
              style={{
                backgroundColor: color,
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
              }}
            />
            <span
              className="absolute top-3 left-[10px] h-4 w-5"
              style={{
                backgroundColor: '#2f6f35',
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
              }}
            />
          </>
        );
      }

      const canopyColor =
        species === 'ornamental_cherry'
          ? '#f4a7c4'
          : species === 'flowering_plum'
            ? '#b678a6'
            : color;

      return (
        <>
          <span className="absolute bottom-2 left-[18px] h-3 w-1 rounded-sm bg-[#7a5635]" />
          <span
            className={cn(
              'absolute shadow-sm',
              species === 'columnar_poplar'
                ? 'top-1 left-[15px] h-6 w-3 rounded-full'
                : 'top-1 left-[11px] size-4 rounded-full'
            )}
            style={{ backgroundColor: canopyColor }}
          />
          {species === 'columnar_poplar' ? null : (
            <span
              className="absolute top-2 left-[20px] size-3 rounded-full"
              style={{ backgroundColor: species === 'fruit' ? '#6a9b4f' : canopyColor }}
            />
          )}
          {species === 'fruit' ? (
            <>
              <span className="absolute top-2 left-[14px] size-1 rounded-full bg-[#dc2626]" />
              <span className="absolute top-4 left-[22px] size-1 rounded-full bg-[#facc15]" />
            </>
          ) : null}
        </>
      );
    }
    case 'bush':
    case 'hedge':
      return (
        <>
          <span
            className="absolute bottom-2 left-2 h-3 w-5 rounded-full shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute bottom-2 left-5 h-3 w-4 rounded-full bg-[#6a9b4f]" />
        </>
      );
    case 'street_lamp':
      return (
        <>
          <span className="absolute bottom-2 left-[19px] h-5 w-0.5 rounded-sm bg-[#475569]" />
          <span className="absolute top-1 left-[15px] size-3 rounded-full bg-[#fde68a] shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
          <span className="absolute bottom-1 left-[14px] h-1 w-3 rounded-full bg-[#64748b]" />
        </>
      );
    case 'bank':
      return (
        <>
          <span className="absolute top-3 left-2 h-1.5 w-6 rounded-sm bg-[#8a6a42]" />
          <span className="absolute top-5 left-2 h-1.5 w-6 rounded-sm bg-[#8a6a42]" />
          <span className="absolute top-4 left-3 h-3 w-0.5 bg-[#475569]" />
          <span className="absolute top-4 right-3 h-3 w-0.5 bg-[#475569]" />
        </>
      );
    case 'traffic_signal':
      return (
        <>
          <span className="absolute bottom-2 left-[12px] h-5 w-0.5 rounded-sm bg-[#475569]" />
          <span className="absolute top-1 left-[16px] flex h-5 w-2 flex-col items-center justify-center gap-0.5 rounded-sm bg-[#1f2937]">
            <span className="size-1 rounded-full bg-[#ef4444]" />
            <span className="size-1 rounded-full bg-[#f59e0b]" />
            <span className="size-1 rounded-full bg-[#22c55e]" />
          </span>
        </>
      );
    case 'bus_stop':
    case 'station_platform':
      return (
        <>
          <span className="absolute bottom-2 left-2 h-4 w-5 rounded-sm border border-[#2563eb] bg-[#dbeafe]" />
          <span className="absolute top-1 right-2 h-5 w-0.5 rounded-sm bg-[#475569]" />
          <span className="absolute top-1.5 right-[5px] size-2 rounded-full bg-[#2563eb]" />
        </>
      );
    case 'hydrant':
    case 'waste_bin':
    case 'recycling_container':
    case 'post_box':
    case 'fountain':
      return (
        <>
          <span
            className="absolute bottom-2 left-[14px] h-4 w-3 rounded-t-md shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute bottom-1 left-[12px] h-1 w-4 rounded-full bg-black/20" />
        </>
      );
    case 'building': {
      const buildingUse = getLegendStringProperty(entry, 'use', 'mixed');
      const isResidential = buildingUse === 'residential';
      const isIndustrial = buildingUse === 'industrial';
      const isOffice = buildingUse === 'office' || buildingUse === 'commercial';

      return (
        <>
          <span
            className={cn(
              'absolute right-2 bottom-2 rounded-[2px] shadow-sm',
              isOffice ? 'h-6 w-5' : 'h-5 w-5',
              isIndustrial ? 'bottom-2 h-4 w-6' : null
            )}
            style={{ backgroundColor: color }}
          />
          {isResidential ? (
            <span
              className="absolute right-1.5 bottom-[25px] h-2 w-6 bg-[#8a5f45]"
              style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
            />
          ) : null}
          <span className="absolute right-3 bottom-4 grid grid-cols-2 gap-0.5">
            <span
              className={cn(
                'size-1 rounded-[1px]',
                isResidential ? 'bg-[#fde68a]' : 'bg-[#d7edf4]'
              )}
            />
            <span
              className={cn(
                'size-1 rounded-[1px]',
                isResidential ? 'bg-[#fde68a]' : 'bg-[#d7edf4]'
              )}
            />
            <span
              className={cn(
                'size-1 rounded-[1px]',
                isResidential ? 'bg-[#fef3c7]' : 'bg-[#d7edf4]'
              )}
            />
            <span
              className={cn(
                'size-1 rounded-[1px]',
                isResidential ? 'bg-[#fef3c7]' : 'bg-[#d7edf4]'
              )}
            />
          </span>
          {isIndustrial ? (
            <span className="absolute top-3 left-2 h-2 w-2 rounded-t-sm bg-[#475569]" />
          ) : (
            <span className="absolute right-1 bottom-[21px] h-1 w-5 skew-x-[-25deg] rounded-sm bg-white/35" />
          )}
        </>
      );
    }
    case 'car_lane': {
      const direction = getLegendStringProperty(entry, 'direction', 'one_way');
      const isTwoWay = direction === 'two_way';

      return (
        <>
          <span
            className="absolute top-2 left-[-4px] h-4 w-12 -rotate-12 rounded-sm"
            style={{ backgroundColor: color }}
          />
          {isTwoWay ? (
            <>
              <span className="absolute top-[15px] left-1 h-0.5 w-9 -rotate-12 rounded-full bg-[#facc15]" />
              <span
                className="absolute top-[9px] left-[8px] h-2 w-5 -rotate-12 bg-[#f8fafc]"
                style={{
                  clipPath: 'polygon(0 38%, 58% 38%, 58% 12%, 100% 50%, 58% 88%, 58% 62%, 0 62%)',
                }}
              />
              <span
                className="absolute top-[18px] left-[15px] h-2 w-5 -rotate-12 bg-[#f8fafc]"
                style={{
                  clipPath: 'polygon(0 38%, 58% 38%, 58% 12%, 100% 50%, 58% 88%, 58% 62%, 0 62%)',
                }}
              />
            </>
          ) : (
            <>
              <span
                className="absolute top-[11px] left-[6px] h-2.5 w-6 -rotate-12 bg-[#f8fafc]"
                style={{
                  clipPath: 'polygon(0 40%, 60% 40%, 60% 12%, 100% 50%, 60% 88%, 60% 60%, 0 60%)',
                }}
              />
              <span
                className="absolute top-[16px] left-[18px] h-2.5 w-6 -rotate-12 bg-[#f8fafc]"
                style={{
                  clipPath: 'polygon(0 40%, 60% 40%, 60% 12%, 100% 50%, 60% 88%, 60% 60%, 0 60%)',
                }}
              />
            </>
          )}
        </>
      );
    }
    case 'street':
    case 'road': {
      const roadClass = getLegendStringProperty(entry, 'roadClass', 'residential');
      const status = getLegendStringProperty(entry, 'status', 'open');
      const isConstruction = roadClass === 'construction' || status === 'construction';
      const isPedestrian = roadClass === 'pedestrian' || roadClass === 'living_street';

      if (isConstruction) {
        return (
          <>
            <span
              className="absolute top-2 left-[-4px] h-4 w-12 -rotate-12 rounded-sm"
              style={{
                background: `repeating-linear-gradient(135deg, ${color}, ${color} 4px, #f8fafc 4px, #f8fafc 7px)`,
              }}
            />
          </>
        );
      }

      return (
        <>
          <span
            className={cn(
              'absolute left-[-4px] w-12 -rotate-12 rounded-sm',
              roadClass === 'primary' ? 'top-1.5 h-5' : 'top-2 h-4'
            )}
            style={{ backgroundColor: color }}
          />
          {isPedestrian ? (
            <>
              <span className="absolute inset-x-2 top-3 h-px -rotate-12 bg-white/45" />
              <span className="absolute inset-x-2 top-5 h-px -rotate-12 bg-white/45" />
              <span className="absolute top-2 left-5 h-4 w-px -rotate-12 bg-white/35" />
            </>
          ) : (
            <>
              <span className="absolute top-[15px] left-1 h-0.5 w-4 -rotate-12 rounded-full bg-[#f8fafc]" />
              <span className="absolute top-[12px] left-6 h-0.5 w-4 -rotate-12 rounded-full bg-[#f8fafc]" />
              {roadClass === 'primary' ? (
                <span className="absolute top-[18px] left-5 h-0.5 w-4 -rotate-12 rounded-full bg-[#f8fafc]" />
              ) : null}
            </>
          )}
        </>
      );
    }
    case 'bike_lane': {
      const protection = getLegendStringProperty(entry, 'protection', 'painted');

      return (
        <>
          <span
            className={cn(
              'absolute left-[-4px] w-12 -rotate-12 rounded-sm',
              protection === 'raised' ? 'top-1.5 h-5 border border-white/55' : 'top-2 h-4'
            )}
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-[13px] left-3 h-0.5 w-5 -rotate-12 rounded-full bg-[#c7fff5]" />
          <span className="absolute top-[17px] left-3 size-1 rounded-full bg-[#c7fff5]" />
          {protection === 'protected' ? (
            <>
              <span className="absolute top-[9px] left-3 size-1 rounded-full bg-white/80" />
              <span className="absolute top-[7px] left-6 size-1 rounded-full bg-white/80" />
            </>
          ) : null}
        </>
      );
    }
    case 'sidewalk':
    case 'stairs':
      return (
        <>
          <span
            className="absolute top-2 left-[-3px] h-4 w-12 -rotate-12 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute inset-x-2 top-3 h-px -rotate-12 bg-white/45" />
          <span className="absolute inset-x-2 top-5 h-px -rotate-12 bg-white/45" />
          <span className="absolute top-2 left-5 h-4 w-px -rotate-12 bg-white/35" />
        </>
      );
    case 'parking_area':
    case 'loading_zone':
    case 'parking':
      return (
        <>
          <span
            className="absolute top-2 left-1 h-5 w-8 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-3 h-3 w-px bg-white/70" />
          <span className="absolute top-3 left-6 h-3 w-px bg-white/70" />
        </>
      );
    case 'rail_track':
    case 'rail':
      return (
        <>
          <span className="absolute top-2 left-2 h-5 w-0.5 rotate-12 rounded-sm bg-[#475569]" />
          <span className="absolute top-2 right-2 h-5 w-0.5 rotate-12 rounded-sm bg-[#475569]" />
          <span className="absolute top-3 left-2 h-0.5 w-6 rotate-12 rounded-full bg-[#8a8178]" />
          <span className="absolute top-5 left-2 h-0.5 w-6 rotate-12 rounded-full bg-[#8a8178]" />
        </>
      );
    case 'water_area':
    case 'wetland_area':
    case 'water':
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-[45%] shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-4 left-3 h-0.5 w-5 rounded-full bg-white/55" />
          <span className="absolute top-5 left-5 h-0.5 w-3 rounded-full bg-white/45" />
        </>
      );
    case 'flower_bed':
    case 'grass_strip':
    case 'scrub_area':
    case 'heath_area':
    case 'orchard_area':
    case 'vineyard_area':
    case 'green':
    case 'trees':
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-[45%] shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-3 size-1 rounded-full bg-[#f9a8d4]" />
          <span className="absolute top-5 left-5 size-1 rounded-full bg-[#fde68a]" />
          <span className="absolute top-4 right-3 size-1 rounded-full bg-[#dcfce7]" />
        </>
      );
    case 'crossing':
      return (
        <>
          <span className="absolute top-2 left-[-4px] h-4 w-12 -rotate-12 rounded-sm bg-[#3f474c]" />
          <span className="absolute top-3 left-2 h-0.5 w-6 -rotate-12 bg-[#f8fafc]" />
          <span className="absolute top-[18px] left-2 h-0.5 w-6 -rotate-12 bg-[#f8fafc]" />
          <span className="absolute top-6 left-2 h-0.5 w-6 -rotate-12 bg-[#f8fafc]" />
        </>
      );
    case 'traffic_calming':
    case 'construction_area':
    case 'construction':
      return (
        <>
          <span
            className="absolute top-2 left-1 h-5 w-8 rounded-sm"
            style={{
              background: `repeating-linear-gradient(135deg, ${color}, ${color} 4px, #f8fafc 4px, #f8fafc 7px)`,
            }}
          />
        </>
      );
    case 'bollard':
    case 'gate':
    case 'fence':
    case 'wall':
    case 'barrier':
      return (
        <>
          <span className="absolute bottom-2 left-2 h-4 w-1 rounded-sm bg-[#475569]" />
          <span className="absolute bottom-2 left-[18px] h-4 w-1 rounded-sm bg-[#475569]" />
          <span className="absolute right-2 bottom-2 h-4 w-1 rounded-sm bg-[#475569]" />
          <span
            className="absolute top-4 left-2 h-1 w-7 rounded-sm"
            style={{ backgroundColor: color }}
          />
        </>
      );
    case 'playground':
    case 'sports_pitch':
    case 'sports':
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-3 h-3 w-5 rounded-sm border border-white/70" />
          <span className="absolute top-4 left-[18px] size-1 rounded-full bg-white/80" />
        </>
      );
    case 'landuse_context_area':
    case 'civic_area':
    case 'landuse_context':
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-3 h-3 w-3 rounded-sm bg-white/45" />
          <span className="absolute top-3 right-3 h-3 w-2 rounded-sm bg-white/30" />
        </>
      );
    default:
      return (
        <>
          <span
            className="absolute inset-x-1 top-2 h-5 rounded-sm shadow-sm"
            style={{ backgroundColor: color }}
          />
          <span className="absolute top-3 left-2 h-0.5 w-6 rounded-full bg-white/35" />
        </>
      );
  }
}

function getLegendTreeSpecies(entry: StreetDesignLegendEntry) {
  const species = getLegendStringProperty(entry, 'species', 'deciduous').trim().toLowerCase();
  if (species === 'stadtbaum' || species === 'allee' || species === 'native') return 'deciduous';
  if (species === 'obstbaum') return 'fruit';
  if (species === 'zierkirsche' || species === 'japanese_cherry') return 'ornamental_cherry';
  if (species === 'pflaume' || species === 'plum') return 'flowering_plum';
  return species;
}

function getLegendStringProperty(entry: StreetDesignLegendEntry, key: string, fallback: string) {
  const value = entry.properties?.[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}
