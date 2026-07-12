/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY } from '../../logic/streetDesignOsm';
import { createPointStreetDesignObject } from '../../logic/streetDesignPlacement';
import type { StreetDesignCostSummary } from '../../types';
import {
  StreetDesignSecondaryActionBarView,
  StreetDesignTopBarView,
} from '../StreetDesignTopBarView';

vi.mock('@/features/shared/ui/ui-platejs/fixed-toolbar', async () => {
  const { Toolbar } = await vi.importActual<typeof import('@/features/shared/ui/layout')>(
    '@/features/shared/ui/layout'
  );

  return {
    FixedToolbar: (props: ComponentProps<typeof Toolbar>) => <Toolbar {...props} />,
  };
});

afterEach(() => {
  cleanup();
});

const streetChangeRequest = {
  id: 'cr-tree',
  source_type: 'street_design_object',
  source_id: 'tree-1',
  title: 'Add canopy tree',
  change_type: 'add',
};

function costSummary(): StreetDesignCostSummary {
  return {
    currency: 'EUR',
    totalCostMinor: 45_000,
    categories: [{ category: 'greenery', quantity: 1, totalCostMinor: 45_000 }],
    lines: [],
  };
}

function renderTopBar(overrides: Partial<Parameters<typeof StreetDesignTopBarView>[0]> = {}) {
  const tree = createPointStreetDesignObject({
    id: 'tree-1',
    type: 'tree',
    point: { x: 0, z: 0 },
  });
  const props: Parameters<typeof StreetDesignTopBarView>[0] = {
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
    osmLayerVisibility: DEFAULT_STREET_DESIGN_OSM_LAYER_VISIBILITY,
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

  render(<StreetDesignTopBarView {...props} />);
  return props;
}

function renderSecondaryActionBar(
  overrides: Partial<Parameters<typeof StreetDesignSecondaryActionBarView>[0]> = {}
) {
  const props: Parameters<typeof StreetDesignSecondaryActionBarView>[0] = {
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

  render(<StreetDesignSecondaryActionBarView {...props} />);
  return props;
}

describe('StreetDesignTopBarView', () => {
  it('handles global street design actions from the fixed icon toolbar', () => {
    const props = renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSave).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: 'Place' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Camera' }));
    expect(props.onInteractionModeChange).toHaveBeenCalledWith('place');
    expect(props.onInteractionModeChange).toHaveBeenCalledWith('camera');

    fireEvent.click(screen.getByRole('radio', { name: 'Map section' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Costs' }));
    expect(props.onAreaPickerOpenChange).toHaveBeenCalledWith(true);
    expect(props.onCostSummaryOpenChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Load OSM' }));
    expect(props.onLoadOsm).toHaveBeenCalled();
  });

  it('renders section insert buttons, layers, objects, comparison, and status picker', () => {
    const props = renderTopBar();

    expect(screen.getByRole('radio', { name: 'Collaborative Editing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /layers/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Objects' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Comparison' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Green' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /insert/i })).toBeNull();
    expect(props.objects).toHaveLength(1);
  });

  it('renders the map selector as a full-screen dialog when open', () => {
    renderTopBar({ areaPickerOpen: true });

    const dialog = screen.getByRole('dialog', { name: 'Map section' });
    expect(screen.getByText('Area picker panel')).toBeTruthy();
    expect(dialog.className).toContain('h-dvh');
    expect(dialog.className).toContain('w-screen');
    expect(dialog.className).toContain('max-w-none');
    expect(dialog.className).toContain('sm:max-w-none');
  });

  it('keeps object suggestions available while hiding map-context mutations', () => {
    renderTopBar({ mode: 'suggest_event', mapContextReadOnly: true });

    expect(screen.getByRole('radio', { name: 'Place' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Map section' }).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Load OSM' })).toBeNull();
  });

  it('renders secondary share, invite, change request, and overlay controls', async () => {
    const onChangeRequestColorModeChange = vi.fn();
    const props = renderSecondaryActionBar({ onChangeRequestColorModeChange });

    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invite' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '1 CRs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show canvas overlay' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Color changes' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show canvas overlay' }));
    expect(props.onShowChangeRequestsChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'Color changes' }));
    expect(onChangeRequestColorModeChange).toHaveBeenCalledWith('tinted');

    fireEvent.pointerDown(screen.getByRole('button', { name: '1 CRs' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /add canopy tree/i }));
    expect(props.onChangeRequestSelect).toHaveBeenCalledWith('cr-tree');
  });
});
