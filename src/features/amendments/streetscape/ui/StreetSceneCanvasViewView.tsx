export interface StreetSceneCanvasViewViewProps {
  design: any;
  placementPreview: any;
  selectedObjectId: any;
  readOnly: any;
  onPointerDown: any;
  onPointerMove: any;
  onObjectSelect: any;
  canvasRef: any;
  loadFailed: any;
  setLoadFailed: any;
}

export function StreetSceneCanvasViewView({
  design,
  canvasRef,
  loadFailed,
}: StreetSceneCanvasViewViewProps) {
  if (loadFailed) {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground flex min-h-[560px] items-center justify-center rounded-md border text-sm">
        Three.js konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="border-border bg-muted/20 relative min-h-[560px] overflow-hidden rounded-md border">
      <canvas ref={canvasRef} className="h-[560px] w-full cursor-crosshair" />
      <div className="pointer-events-none absolute top-3 left-3 flex gap-2 text-xs font-medium">
        {design.comparisonMode === 'split' ? (
          <>
            <span className="bg-background/90 rounded-md border px-2 py-1 shadow-sm">Original</span>
            <span className="bg-background/90 rounded-md border px-2 py-1 shadow-sm">
              Neues Design
            </span>
          </>
        ) : (
          <span className="bg-background/90 rounded-md border px-2 py-1 shadow-sm">
            {design.comparisonMode === 'original'
              ? 'Original'
              : design.comparisonMode === 'new_design'
                ? 'Neues Design'
                : 'Overlay'}
          </span>
        )}
      </div>
    </div>
  );
}
