import type { CityDesignComparisonMode } from '../types';

export interface CityDesignComparisonLayers {
  showOriginal: boolean;
  showDesign: boolean;
  showOverlay: boolean;
  split: boolean;
}

export function getCityDesignComparisonLayers(
  mode: CityDesignComparisonMode
): CityDesignComparisonLayers {
  if (mode === 'original') {
    return {
      showOriginal: true,
      showDesign: false,
      showOverlay: false,
      split: false,
    };
  }

  if (mode === 'new_design') {
    return {
      showOriginal: false,
      showDesign: true,
      showOverlay: false,
      split: false,
    };
  }

  if (mode === 'split') {
    return {
      showOriginal: true,
      showDesign: true,
      showOverlay: false,
      split: true,
    };
  }

  return {
    showOriginal: true,
    showDesign: true,
    showOverlay: true,
    split: false,
  };
}
