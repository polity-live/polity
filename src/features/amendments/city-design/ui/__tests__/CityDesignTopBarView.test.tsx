/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/cityDesignOsm';
import { createPointCityDesignObject } from '../../logic/cityDesignPlacement';
import type { CityDesignCostSummary } from '../../types';
import {
  CityDesignSecondaryActionBarView,
  CityDesignTopBarView,
  cityDesignTopBarInternals,
} from '../CityDesignTopBarView';

vi.mock('@/features/shared/ui/ui-platejs/fixed-toolbar', async () => {
  const { Toolbar } = await vi.importActual<typeof import('@/features/shared/ui/layout')>(
    '@/features/shared/ui/layout'
  );

  return {
    FixedToolbar: (props: ComponentProps<typeof Toolbar>) => <Toolbar {...props} />,
  };
});

vi.mock('@/features/editor/ui/InviteCollaboratorDialog', () => ({
  InviteCollaboratorDialog: () => <button type="button">Invite</button>,
}));

afterEach(() => {
  cleanup();
  document.body.removeAttribute('data-app-tutorial-active');
});

const streetChangeRequest = {
  id: 'cr-tree',
  source_type: 'city_design_object',
  source_id: 'tree-1',
  title: 'Add canopy tree',
  change_type: 'add',
};

function costSummary(): CityDesignCostSummary {
  return {
    currency: 'EUR',
    totalCostMinor: 45_000,
    categories: [{ category: 'greenery', quantity: 1, totalCostMinor: 45_000 }],
    lines: [],
  };
}

function renderTopBar(overrides: Partial<Parameters<typeof CityDesignTopBarView>[0]> = {}) {
  const tree = createPointCityDesignObject({
    id: 'tree-1',
    type: 'tree',
    point: { x: 0, z: 0 },
  });
  const props: Parameters<typeof CityDesignTopBarView>[0] = {
    readOnly: false,
    mapContextReadOnly: false,
    mode: 'edit',
    modeDisabledReasons: {},
    canChangeMode: true,
    isDirty: true,
    isSaving: false,
    saveError: null,
    selectedTool: 'tree',
    selectedToolProperties: {},
    interactionMode: 'select',
    objects: [tree],
    selectedObjectId: 'tree-1',
    selectedOsmWay: null,
    hiddenObjectIds: [],
    hiddenObjectCategories: [],
    osmLayerVisibility: DEFAULT_CITY_DESIGN_OSM_LAYER_VISIBILITY,
    showStreetMarkings: true,
    comparisonMode: 'overlay',
    costSummary: costSummary(),
    areaPickerOpen: false,
    costSummaryOpen: false,
    isLoadingOsm: false,
    osmError: null,
    areaPickerContent: <div>Area picker panel</div>,
    costSummaryContent: <div>Cost summary panel</div>,
    onModeChange: vi.fn(),
    onSave: vi.fn(),
    onToolChange: vi.fn(),
    onInteractionModeChange: vi.fn(),
    onObjectSelect: vi.fn(),
    onObjectVisibilityChange: vi.fn(),
    onObjectCategoryVisibilityChange: vi.fn(),
    onObjectDelete: vi.fn(),
    onObjectCategoryDelete: vi.fn(),
    onOsmLayerVisibilityChange: vi.fn(),
    onShowStreetMarkingsChange: vi.fn(),
    onComparisonModeChange: vi.fn(),
    onAreaPickerOpenChange: vi.fn(),
    onCostSummaryOpenChange: vi.fn(),
    onLoadOsm: vi.fn(),
    onOsmWayHide: vi.fn(),
    ...overrides,
  };

  render(<CityDesignTopBarView {...props} />);
  return props;
}

function renderSecondaryActionBar(
  overrides: Partial<Parameters<typeof CityDesignSecondaryActionBarView>[0]> = {}
) {
  const props: Parameters<typeof CityDesignSecondaryActionBarView>[0] = {
    amendmentId: 'amendment-1',
    title: 'Safer street',
    readOnly: true,
    currentUserId: undefined,
    collaborationDocumentId: null,
    existingCollaboratorIds: [],
    changeRequests: [streetChangeRequest],
    selectedChangeRequestId: null,
    showChangeRequests: true,
    onShowChangeRequestsChange: vi.fn(),
    onChangeRequestSelect: vi.fn(),
    ...overrides,
  };

  render(<CityDesignSecondaryActionBarView {...props} />);
  return props;
}

describe('CityDesignTopBarView', () => {
  it('handles global city design actions from the fixed icon toolbar', () => {
    const props = renderTopBar();

    for (const actionId of [
      'amendments.city-topbar.select.mode-place',
      'amendments.city-topbar.select.mode-select',
      'amendments.city-topbar.select.mode-camera',
      'amendments.city-topbar.open.editing-mode',
      'amendments.city-topbar.open.area-picker',
      'amendments.city-topbar.open.cost-summary',
      'amendments.city-topbar.load.osm',
      'amendments.city-topbar.save.design',
      'amendments.city-topbar.toggle.selected-object-visibility',
      'amendments.city-topbar.delete.selected-object',
    ]) {
      expect(document.querySelector(`[data-action-id="${actionId}"]`), actionId).toBeTruthy();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSave).toHaveBeenCalled();

    const placeButton = screen.getByRole('button', { name: 'Place' });
    const selectButton = screen.getByRole('button', { name: 'Select' });
    const cameraButton = screen.getByRole('button', { name: 'Camera' });
    expect(placeButton.getAttribute('aria-pressed')).toBe('false');
    expect(selectButton.getAttribute('aria-pressed')).toBe('true');
    expect(cameraButton.getAttribute('aria-pressed')).toBe('false');
    fireEvent.pointerDown(placeButton);
    fireEvent.click(placeButton);
    fireEvent.keyDown(selectButton, { key: 'Enter' });
    fireEvent.click(selectButton);
    fireEvent.keyDown(cameraButton, { key: ' ' });
    fireEvent.click(cameraButton);
    expect(props.onInteractionModeChange).toHaveBeenCalledWith('place');
    expect(props.onInteractionModeChange).toHaveBeenCalledWith('select');
    expect(props.onInteractionModeChange).toHaveBeenCalledWith('camera');

    const mapSectionButton = screen.getByRole('button', { name: 'Map section' });
    const costsButton = screen.getByRole('button', { name: 'Costs' });
    expect(mapSectionButton.getAttribute('aria-pressed')).toBe('false');
    expect(costsButton.getAttribute('aria-pressed')).toBe('false');
    fireEvent.pointerDown(mapSectionButton);
    fireEvent.click(mapSectionButton);
    fireEvent.pointerDown(costsButton);
    fireEvent.click(costsButton);
    expect(props.onAreaPickerOpenChange).toHaveBeenCalledWith(true);
    expect(props.onCostSummaryOpenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Load OSM' }));
    expect(props.onLoadOsm).toHaveBeenCalled();

    fireEvent.click(
      document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-topbar.toggle.selected-object-visibility"]'
      ) as HTMLElement
    );
    fireEvent.click(
      document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-topbar.delete.selected-object"]'
      ) as HTMLElement
    );
    expect(props.onObjectVisibilityChange).toHaveBeenCalledWith('tree-1', false);
    expect(props.onObjectDelete).toHaveBeenCalledWith('tree-1');
  });

  it('hides the selected OSM way through a stable topbar action', () => {
    const onOsmWayHide = vi.fn();
    renderTopBar({
      selectedObjectId: null,
      selectedOsmWay: {
        id: 'osm-road-1',
        kind: 'road',
        geometryKind: 'line',
        points: [
          { lat: 52.52, lon: 13.405 },
          { lat: 52.521, lon: 13.406 },
        ],
        source: 'osm',
      },
      onOsmWayHide,
    });

    const hide = document.querySelector<HTMLElement>(
      '[data-action-id="amendments.city-topbar.hide.selected-osm-way"]'
    );
    expect(hide).toBeTruthy();
    fireEvent.click(hide as HTMLElement);
    expect(onOsmWayHide).toHaveBeenCalledWith('osm-road-1');
  });

  it('renders section insert buttons, layers, objects, comparison, and status picker', () => {
    const props = renderTopBar();

    expect(
      screen.getByRole('button', { name: 'Collaborative Editing' }).getAttribute('aria-pressed')
    ).toBe('false');
    expect(screen.getByRole('button', { name: /layers/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Objects' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Comparison' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Green' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect(screen.queryByRole('button', { name: /insert/i })).toBeNull();
    expect(props.objects).toHaveLength(1);
  });

  it('dispatches layer, object, comparison, and editing menu actions', async () => {
    const props = renderTopBar();
    const selectMenuAction = async (triggerName: string, actionId: string) => {
      fireEvent.pointerDown(screen.getByRole('button', { name: triggerName }));
      const action = await vi.waitFor(() => {
        const element = document.querySelector<HTMLElement>(`[data-action-id="${actionId}"]`);
        expect(element).toBeTruthy();
        return element as HTMLElement;
      });
      fireEvent.click(action);
    };

    await selectMenuAction('Layers', 'amendments.city-layers.toggle.layer');
    expect(props.onOsmLayerVisibilityChange).toHaveBeenCalled();
    await selectMenuAction('Layers', 'amendments.city-layers.toggle.street-markings');
    expect(props.onShowStreetMarkingsChange).toHaveBeenCalledWith(false);

    await selectMenuAction('Objects', 'amendments.city-objects.toggle.category-visibility');
    expect(props.onObjectCategoryVisibilityChange).toHaveBeenCalledWith('greenery', false);
    await selectMenuAction('Objects', 'amendments.city-objects.select.object');
    expect(props.onObjectSelect).toHaveBeenCalledWith('tree-1');
    await selectMenuAction('Objects', 'amendments.city-objects.toggle.object-visibility');
    expect(props.onObjectVisibilityChange).toHaveBeenCalledWith('tree-1', false);
    await selectMenuAction('Objects', 'amendments.city-objects.delete.object');
    expect(props.onObjectDelete).toHaveBeenCalledWith('tree-1');
    await selectMenuAction('Objects', 'amendments.city-objects.delete.category');
    expect(props.onObjectCategoryDelete).toHaveBeenCalledWith('greenery');

    await selectMenuAction('Comparison', 'amendments.city-comparison.select.mode');
    expect(props.onComparisonModeChange).toHaveBeenCalled();
  });

  it('dispatches editing-mode choices through the stable mode action', async () => {
    const props = renderTopBar();
    const trigger = screen.getByRole('button', { name: 'Collaborative Editing' });
    expect(trigger.getAttribute('data-action-id')).toBe('amendments.city-topbar.open.editing-mode');
    expect(trigger.getAttribute('aria-pressed')).toBe('false');
    fireEvent.pointerDown(trigger);
    const viewing = await screen.findByRole('menuitemradio', { name: /Viewing/ });
    fireEvent.click(viewing);
    await vi.waitFor(() => expect(props.onModeChange).toHaveBeenCalledWith('view'));
  });

  it('renders the map selector as a full-screen dialog when open', () => {
    renderTopBar({ areaPickerOpen: true });

    const dialog = screen.getByRole('dialog', { name: 'Map section' });
    expect(screen.getByText('Area picker panel')).toBeTruthy();
    expect(dialog.className).toContain('h-dvh');
    expect(dialog.className).toContain('w-screen');
    expect(dialog.className).toContain('max-w-none');
    expect(dialog.className).toContain('sm:max-w-none');
    expect(document.body.style.pointerEvents).toBe('none');
  });

  it('keeps global tutorial controls interactive while the map selector is open', () => {
    document.body.setAttribute('data-app-tutorial-active', '');
    const onAreaPickerOpenChange = vi.fn();
    render(
      <div data-testid="app-tutorial-spotlight">
        <button type="button">Minimize instruction</button>
      </div>
    );
    renderTopBar({ areaPickerOpen: true, onAreaPickerOpenChange });

    const coachControl = screen.getByRole('button', { name: 'Minimize instruction' });
    const dialog = screen.getByRole('dialog', { name: 'Map section' });

    expect(document.body.style.pointerEvents).not.toBe('none');

    fireEvent.pointerDown(coachControl);
    fireEvent.click(coachControl);
    coachControl.focus();
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(document.activeElement).toBe(coachControl);
    expect(onAreaPickerOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('exposes stable tutorial targets for map selection and deciduous trees', async () => {
    const props = renderTopBar();
    const mapSelection = screen.getByRole('button', { name: 'Map section' });
    const trees = screen.getByRole('button', { name: 'Trees' });
    const save = screen.getByRole('button', { name: 'Save' });

    expect(mapSelection.getAttribute('aria-pressed')).toBe('false');
    expect(trees.getAttribute('aria-pressed')).toBe('false');
    expect(mapSelection.getAttribute('data-tutorial-anchor')).toBe('city-design-map-selection');
    expect(trees.getAttribute('data-tutorial-anchor')).toBe('city-design-trees-menu');
    expect(
      trees
        .closest('[data-tutorial-horizontal-scroller]')
        ?.getAttribute('data-tutorial-horizontal-scroller')
    ).toBe('city-design-toolbar');
    expect(save.getAttribute('data-tutorial-anchor')).toBe('city-design-save');
    expect(
      save
        .closest('[data-tutorial-horizontal-scroller]')
        ?.getAttribute('data-tutorial-horizontal-scroller')
    ).toBe('city-design-toolbar');
    expect(
      screen.getByRole('button', { name: 'Load OSM' }).getAttribute('data-tutorial-anchor')
    ).toBe('city-design-load-osm');

    fireEvent.pointerDown(trees);
    fireEvent.click(trees);
    const deciduous = await screen.findByRole('menuitem', {
      name: /deciduous tree/i,
    });
    expect(deciduous.getAttribute('data-action-id')).toBe(
      'amendments.city-topbar.select.placement-tool'
    );
    expect(deciduous.getAttribute('data-tutorial-anchor')).toBe('city-design-tree-deciduous');
    expect(
      deciduous.parentElement
        ?.closest('[data-tutorial-anchor]')
        ?.getAttribute('data-tutorial-anchor')
    ).toBe('city-design-tree-placement-workspace');

    fireEvent.click(deciduous);
    expect(props.onToolChange).toHaveBeenCalledWith(
      'tree',
      expect.objectContaining({ species: 'deciduous' }),
      undefined
    );
  });

  it('keeps object suggestions available while hiding map-context mutations', () => {
    renderTopBar({ mode: 'suggest_event', mapContextReadOnly: true });

    expect(screen.getByRole('button', { name: 'Place' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
    const mapSectionButton = screen.getByRole('button', { name: 'Map section' });
    expect(mapSectionButton.getAttribute('aria-disabled')).toBe('true');
    const nativeMapSectionButton = document.querySelector<HTMLButtonElement>(
      '[data-action-id="amendments.city-topbar.open.area-picker"]'
    );
    expect(nativeMapSectionButton?.tagName).toBe('BUTTON');
    expect(nativeMapSectionButton?.disabled).toBe(true);
    expect(nativeMapSectionButton?.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Load OSM' })).toBeNull();
  });

  it('renders secondary share, invite, change request, and overlay controls', async () => {
    const onChangeRequestColorModeChange = vi.fn();
    const props = renderSecondaryActionBar({ onChangeRequestColorModeChange });

    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invite' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '1 CR' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show canvas overlay' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Color changes' })).toBeTruthy();

    for (const actionId of [
      'amendments.city-secondary.open.share',
      'amendments.city-secondary.show.invite-disabled',
      'amendments.city-secondary.toggle.cr-overlay',
      'amendments.city-secondary.toggle.cr-color-mode',
      'amendments.city-cr-menu.open.list',
    ]) {
      expect(document.querySelector(`[data-action-id="${actionId}"]`), actionId).toBeTruthy();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Show canvas overlay' }));
    expect(props.onShowChangeRequestsChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Color changes' }));
    expect(onChangeRequestColorModeChange).toHaveBeenCalledWith('tinted');

    fireEvent.pointerDown(screen.getByRole('button', { name: '1 CR' }));
    const request = await screen.findByRole('menuitem', { name: /add canopy tree/i });
    expect(request.getAttribute('data-action-id')).toBe('amendments.city-cr-menu.select.request');
    fireEvent.click(request);
    expect(props.onChangeRequestSelect).toHaveBeenCalledWith('cr-tree');

    fireEvent.pointerDown(screen.getByRole('button', { name: '1 CR' }));
    const selectAll = await vi.waitFor(() => {
      const action = document.querySelector<HTMLElement>(
        '[data-action-id="amendments.city-cr-menu.select.all"]'
      );
      expect(action).toBeTruthy();
      return action as HTMLElement;
    });
    fireEvent.click(selectAll);
    expect(props.onChangeRequestSelect).toHaveBeenLastCalledWith(null);
  });

  it('renders empty object and change-request menus and enables collaboration invitations', async () => {
    const topBar = renderTopBar({ objects: [], selectedObjectId: null });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Objects' }));
    const noObjects = await vi.waitFor(() => {
      const item = document.querySelector<HTMLElement>('[data-action-scope="presentation"]');
      expect(item?.textContent).toContain('No objects');
      return item as HTMLElement;
    });
    expect(noObjects.hasAttribute('data-disabled')).toBe(true);
    cleanup();

    renderSecondaryActionBar({
      readOnly: false,
      currentUserId: 'user-1',
      collaborationDocumentId: 'document-1',
      changeRequests: [],
    });
    expect(screen.getByRole('button', { name: 'Invite' })).toHaveProperty('disabled', false);
    fireEvent.pointerDown(screen.getByRole('button', { name: '0 CRs' }));
    await vi.waitFor(() => {
      expect(
        document.querySelector<HTMLElement>('[data-action-scope="presentation"]')?.textContent
      ).toContain('change requests');
    });
    expect(topBar.onObjectSelect).not.toHaveBeenCalled();
  });

  it('handles bare section tools and every change-request tone', () => {
    const isSelected = cityDesignTopBarInternals.isSectionToolSelected;
    expect(
      isSelected({
        tool: { id: 'lamp', objectType: 'street_lamp' },
        selectedTool: 'street_lamp',
        selectedToolProperties: {},
      })
    ).toBe(true);
    expect(
      isSelected({
        tool: {
          id: 'configured-lamp',
          objectType: 'street_lamp',
          propertyOverrides: { height: 5 },
          selectionPropertyKeys: [],
        },
        selectedTool: 'street_lamp',
        selectedToolProperties: {},
      })
    ).toBe(false);
    expect(cityDesignTopBarInternals.getChangeRequestToneClassName('remove')).toContain('danger');
    expect(cityDesignTopBarInternals.getChangeRequestToneClassName('update')).toContain('info');
    expect(cityDesignTopBarInternals.getChangeRequestToneClassName('unknown')).toContain('muted');
  });

  it('renders read-only, container, error, hidden-object, and missing-selection alternatives', async () => {
    renderTopBar({
      readOnly: true,
      canChangeMode: false,
    });
    expect(screen.queryByRole('button', { name: 'Place' })).toBeNull();
    const editingModeButton = screen.getByRole('button', { name: 'Collaborative Editing' });
    expect(editingModeButton.getAttribute('aria-pressed')).toBe('false');
    fireEvent.pointerDown(editingModeButton);
    expect(await screen.findByText(/view only/i)).toBeTruthy();

    cleanup();
    renderTopBar({ positionMode: 'container', readOnly: true, areaPickerOpen: true });
    expect(screen.getByRole('dialog', { name: 'Map section' }).className).toContain('inset-0');

    cleanup();
    renderTopBar({
      selectedObjectId: 'missing',
      isDirty: false,
      osmError: 'Overpass failed',
      saveError: 'Save failed',
    });
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).toBe('true');
    expect(
      document.querySelector<HTMLButtonElement>(
        '[data-action-id="amendments.city-topbar.save.design"]'
      )?.disabled
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Load OSM' }).querySelector('.text-destructive')
    ).toBeTruthy();

    cleanup();
    const lamp = createPointCityDesignObject({
      id: 'lamp-1',
      type: 'street_lamp',
      point: { x: 1, z: 2 },
    });
    const hiddenProps = renderTopBar({
      objects: [lamp],
      selectedTool: 'street_lamp',
      selectedObjectId: 'lamp-1',
      hiddenObjectIds: ['lamp-1'],
      hiddenObjectCategories: ['furniture'],
    });
    fireEvent.click(screen.getByRole('button', { name: /show street lamp/i }));
    expect(hiddenProps.onObjectVisibilityChange).toHaveBeenCalledWith('lamp-1', true);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Objects' }));
    expect(await screen.findByText('Furniture')).toBeTruthy();
    expect(screen.getAllByText(/show street lamp/i).length).toBeGreaterThan(0);

    cleanup();
    renderTopBar({
      readOnly: true,
      objects: [lamp],
      selectedObjectId: 'lamp-1',
      hiddenObjectIds: ['lamp-1'],
      hiddenObjectCategories: ['furniture'],
    });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Objects' }));
    await screen.findByText('Furniture');
    expect(
      document.querySelector('[data-action-id="amendments.city-objects.delete.object"]')
    ).toBeNull();

    cleanup();
    renderTopBar({
      mapContextReadOnly: true,
      selectedObjectId: null,
      selectedOsmWay: {
        id: 'osm-hidden-action',
        kind: 'road',
        geometryKind: 'line',
        points: [
          { lat: 1, lon: 2 },
          { lat: 2, lon: 3 },
        ],
        source: 'osm',
      },
    });
    expect(
      document.querySelector('[data-action-id="amendments.city-topbar.hide.selected-osm-way"]')
    ).toBeNull();
  });

  it('renders tinted hidden overlays and invokes the optional color callback default', async () => {
    renderSecondaryActionBar({
      selectedChangeRequestId: 'cr-tree',
      showChangeRequests: false,
      changeRequestColorMode: 'tinted',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Color changes' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: '1 CR' }));
    const request = await screen.findByRole('menuitem', { name: /add canopy tree/i });
    expect(request.className).toContain('bg-primary');
  });
});
